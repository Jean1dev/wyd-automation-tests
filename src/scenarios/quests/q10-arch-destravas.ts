// Quest 10 — Destravas do Arch: Lindy 355/370 e Cristais (docs/quests/10-arch-destravas.md).
//
// Cada caso é um personagem novo semeado pelo banco já como Arch (class_master ARCH) no nível
// armazenado do caso, com a exp mínima do nível, as flags Level355/Level370/Fame/Cristal e os
// ingredientes no inventário. Lindy: o bot anda de Armia até ela (rota do cenário 3), manda o
// MSG_CombineItemLindy com a receita nas posições 0..6 (sem clicar na Lindy: o clique cai na Alma do
// Mortal) e confere o inventário, a capa e as flags no banco depois do relog. Cristais: MSG_UseItem no
// cristal e confere etapa, exp, nível e BaseScore (MaxHp/MaxMp no banco, AC no score depois do relog).
import type { GameClient } from '../../client/GameClient.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { isInArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db, type SeedItem } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { ROUTE_TO_ARMIA } from '../../world/arch.ts';
import {
  ARCH_SEED, CRYSTAL_EXP, CRYSTAL_REWARD, EQUIP_SLOT, EXP_AT, ITEM, NPC, ROUTE_TO_LINDY,
} from '../../world/quests/10-arch-destravas.ts';
import { carryOf, type SlotItem } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestCase, QuestSpec } from './runner.ts';

interface Seed {
  /** Nível ARMAZENADO (exibido − 1). */
  level: number;
  classMaster?: number;
  exp?: number;
  lv355?: number;
  lv370?: number;
  fame?: number;
  clan?: number;
  crystal?: number;
  /** Inventário por slot (undefined = vazio). */
  carry?: (SeedItem | undefined)[];
}

async function seedChar(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, {
    ...ARCH_SEED,
    level: s.level,
    exp: s.exp ?? EXP_AT[s.level],
    class_master: s.classMaster ?? CLASS_MASTER.ARCH,
    arch_lv355: s.lv355 ?? 0,
    arch_lv370: s.lv370 ?? 0,
    fame: s.fame ?? 0,
    clan: s.clan ?? 0,
    arch_crystal_stage: s.crystal ?? 0,
  });
  for (const [slot, it] of (s.carry ?? []).entries()) if (it) await db.putItem(name, 'carry', slot, it);
}

const lac10: SeedItem = { index: ITEM.poeiraLac, eff: [[P.EF_AMOUNT, 10]] };
const lac: SeedItem = { index: ITEM.poeiraLac };
/** Receita da Lindy nos slots 0..6, na ordem das posições da combinação. */
const RECIPE: SeedItem[] = [lac10, lac10, { index: ITEM.pergaminhoSelado }, lac, lac, lac, lac];
const RECIPE_POS = [0, 1, 2, 3, 4, 5, 6];
const crystal = (stage: number): SeedItem => ({ index: ITEM.cristal[stage - 1] });

// ---------------------------------------------------------------- estado

const amount = (eff: [number, number][]) => eff.find(([e]) => e === P.EF_AMOUNT)?.[1] ?? 1;
const idx = (l: SlotItem[]) => l.filter((x) => x.index).map((x) => `${x.slot}:${x.index}${amount(x.eff) > 1 ? `x${amount(x.eff)}` : ''}`).join(' ') || 'vazio';

interface Live {
  carry: string;
  capa: number;
  level: number;
  exp: string;
  maxHp: number;
  maxMp: number;
  ac: number;
}

const live = (c: GameClient): Live => {
  const me = c.self!;
  return { carry: idx(carryOf(c)), capa: me.equip[EQUIP_SLOT.capa]?.index ?? 0, level: me.level, exp: String(me.exp), maxHp: me.maxHp, maxMp: me.maxMp, ac: me.ac };
};

interface Saved {
  carry: string;
  capa: number;
  level: number;
  exp: number;
  lv355: number;
  lv370: number;
  fame: number;
  crystal: number;
  maxHp: number;
  maxMp: number;
}

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const r = await db.character(ch);
    const carry = (await db.items(ch, 'carry')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index, eff: x.eff }));
    const capa = (await db.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.capa)?.index ?? 0;
    return {
      carry: idx(carry), capa, level: Number(r.level), exp: Number(r.exp), lv355: Number(r.arch_lv355), lv370: Number(r.arch_lv370),
      fame: Number(r.fame), crystal: Number(r.arch_crystal_stage), maxHp: Number(r.max_hp), maxMp: Number(r.max_mp),
    };
  });
}

/** Flags e BaseScore do banco (sem o inventário: o personagem novo ganha os itens iniciais no primeiro save). */
const flags = (s: Saved) => `nível ${s.level} exp ${s.exp} Level355 ${s.lv355} Level370 ${s.lv370} Fame ${s.fame} Cristal ${s.crystal} MaxHp ${s.maxHp} MaxMp ${s.maxMp} capa ${s.capa}`;
const fmtS = (s: Saved) => `${flags(s)} inv [${s.carry}]`;
const hasIndex = (carry: string, index: number) => carry.split(' ').some((x) => x.split(':')[1]?.split('x')[0] === String(index));

interface Answer {
  t: string;
  combine?: number;
  texts: string[];
  notices: number[];
}

function answerOf(c: GameClient, since: number): Omit<Answer, 't'> {
  const frames = c.framesSince(since);
  const cc = frames.find((f) => f.header.type === Op.CombineComplete);
  return {
    combine: cc ? P.parseNotice(cc.body) : undefined,
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
  };
}

const fmtA = (a: Answer) => [a.combine !== undefined ? `CombineComplete ${a.combine}` : 'sem CombineComplete', ...a.texts.map((t) => `"${t}"`), ...a.notices.map((n) => `notice ${n}`)].join(', ');

// ---------------------------------------------------------------- Lindy

async function goToLindy(ctx: CaseCtx): Promise<{ lindy?: { id: number; merchant: number; x: number; y: number } }> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, NPC.lindy.pos.x, NPC.lindy.pos.y) > 30) {
    if (!isInArmia(me.x, me.y)) await walkPath(c, ROUTE_TO_ARMIA);
    await walkPath(c, ROUTE_TO_LINDY, { abort: () => me.hp <= 0 });
  } else await walkTo(c, NPC.lindy.stand.x, NPC.lindy.stand.y);
  if (me.hp <= 0) throw new Error('morreu no caminho da Lindy');
  await sleep(1000);
  const m = [...c.mobs.values()].find((x) => !x.isPlayer && x.name === NPC.lindy.name);
  return { lindy: m ? { id: m.id, merchant: m.merchant, x: m.x, y: m.y } : undefined };
}

interface Combine {
  lindy?: { id: number; merchant: number; x: number; y: number };
  pos: { x: number; y: number };
  answer: Answer;
  before: Live;
  after: Live;
  seed: Saved;
  db: Saved;
}

/** Anda até a Lindy e manda o MSG_CombineItemLindy com o slot de cada posição (−1 = posição vazia). */
async function combineLindy(ctx: CaseCtx, positions = RECIPE_POS): Promise<Combine> {
  const seed = await saved(ctx);
  const { lindy } = await goToLindy(ctx);
  const c = ctx.c;
  const before = live(c);
  const inputs = positions.map((slot) => (slot >= 0 && c.self!.carry[slot]?.index ? { slot, item: c.self!.carry[slot] } : undefined));
  const since = c.mark;
  c.send(Op.CombineItemLindy, P.combineItem(inputs));
  try {
    await c.waitType(Op.CombineComplete, { timeoutMs: 6000, since, what: 'CombineComplete' });
  } catch {
    // o legado sai calado em alguns ramos; o Go responde sempre
  }
  await sleep(1500);
  const answer: Answer = { t: new Date().toISOString(), ...answerOf(c, since) };
  const after = live(c);
  const pos = { x: c.self!.x, y: c.self!.y };
  await ctx.relog();
  const db = await saved(ctx);
  const r: Combine = { lindy, pos, answer, before, after, seed, db };
  ctx.log.info('combinação da Lindy', r as unknown as Record<string, unknown>);
  return r;
}

const noteC = (r: Combine) => `${r.lindy ? `Lindy id ${r.lindy.id} merchant ${r.lindy.merchant}` : 'Lindy não vista'} em (${r.pos.x},${r.pos.y}); ${fmtA(r.answer)}; inv [${r.before.carry}] → [${r.after.carry}]; banco antes: ${fmtS(r.seed)} → depois do relog: ${fmtS(r.db)}`;

/** Controle: recusa, nada some, flags iguais (cliente e banco). */
function refused(r: Combine): CaseResult {
  const same = r.before.carry === r.after.carry && r.before.carry === r.db.carry && r.before.capa === r.after.capa && flags(r.seed) === flags(r.db);
  return { pass: same && r.answer.combine !== 1, evidence: { ...r }, note: noteC(r) };
}

/** A receita (slots 0..6) sumiu do inventário e do banco. */
const recipeGone = (r: Combine) => RECIPE_POS.every((s) => !r.after.carry.split(' ').some((x) => x.startsWith(`${s}:`)) && !r.db.carry.split(' ').some((x) => x.startsWith(`${s}:`)));

// ---------------------------------------------------------------- Poeira de Fada e cristais

interface Use {
  slot: number;
  item: number;
  answer: Answer;
  before: Live;
  after: Live;
}

/** MSG_UseItem no slot do inventário e espera a resposta (o cristal salva antes de responder). */
async function use(ctx: CaseCtx, slot: number): Promise<Use> {
  const c = ctx.c;
  const before = live(c);
  const item = c.self!.carry[slot]?.index ?? 0;
  const since = c.mark;
  c.send(Op.UseItem, P.useItem(slot));
  await sleep(3000);
  const r: Use = { slot, item, answer: { t: new Date().toISOString(), ...answerOf(c, since) }, before, after: live(c) };
  ctx.log.info(`usou o ${item} do slot ${slot}`, r as unknown as Record<string, unknown>);
  return r;
}

const noteU = (u: Use) => `${u.item}: ${fmtA(u.answer)}; nível ${u.before.level}→${u.after.level}, exp ${u.before.exp}→${u.after.exp}, inv [${u.before.carry}] → [${u.after.carry}]`;

interface Crystals {
  uses: Use[];
  seed: Saved;
  db: Saved;
  /** Score do cliente antes e depois do relog (o AC só existe no score: o banco não tem a coluna). */
  scoreBefore: Live;
  scoreAfter: Live;
}

/** Usa os cristais dos slots dados, em ordem, e confere o banco e o score depois do relog. */
async function useCrystals(ctx: CaseCtx, slots: number[]): Promise<Crystals> {
  const seed = await saved(ctx);
  const scoreBefore = live(ctx.c);
  const uses: Use[] = [];
  for (const s of slots) uses.push(await use(ctx, s));
  await ctx.relog();
  await sleep(1000);
  const r: Crystals = { uses, seed, db: await saved(ctx), scoreBefore, scoreAfter: live(ctx.c) };
  return r;
}

const noteCr = (r: Crystals) => `${r.uses.map(noteU).join(' | ')}; banco: ${fmtS(r.seed)} → ${fmtS(r.db)}; score MaxHp/MaxMp/AC ${r.scoreBefore.maxHp}/${r.scoreBefore.maxMp}/${r.scoreBefore.ac} → ${r.scoreAfter.maxHp}/${r.scoreAfter.maxMp}/${r.scoreAfter.ac}`;

/** Nada mudou: o cristal voltou, etapa/exp/nível/HP/MP iguais. */
function crystalRefused(r: Crystals): CaseResult {
  const ok = r.uses.every((u) => u.before.carry === u.after.carry) && r.scoreBefore.carry === r.scoreAfter.carry && flags(r.seed) === flags(r.db)
    && r.scoreBefore.ac === r.scoreAfter.ac;
  return { pass: ok, evidence: { ...r }, note: noteCr(r) };
}

/** Etapas `from`..`to` concluídas: BaseScore somado, exp −100M por etapa, cristais consumidos. */
function crystalDone(r: Crystals, from: number, to: number): CaseResult {
  const sum = CRYSTAL_REWARD.slice(from - 1, to).reduce((a, x) => ({ mp: a.mp + x.mp, ac: a.ac + x.ac, hp: a.hp + x.hp }), { mp: 0, ac: 0, hp: 0 });
  const n = to - from + 1;
  const ok = r.db.crystal === to && r.db.exp === r.seed.exp - n * CRYSTAL_EXP && r.db.level === r.seed.level
    && r.db.maxMp === r.seed.maxMp + sum.mp && r.db.maxHp === r.seed.maxHp + sum.hp
    && r.scoreAfter.ac === r.scoreBefore.ac + sum.ac && ITEM.cristal.every((i) => !hasIndex(r.db.carry, i));
  return { pass: ok, evidence: { ...r, expected: sum }, note: `esperado MaxMp +${sum.mp} MaxHp +${sum.hp} AC +${sum.ac} exp −${n * 100}M Cristal ${to}; ${noteCr(r)}` };
}

// ---------------------------------------------------------------- casos

/** Arch armazenado 355 (exibido 356) com a 355 feita: o mínimo do Go para os cristais (#327). */
const CRYSTAL_ARCH = { level: 355, lv355: 1 } as const;
/** Exp com folga para que −100M por etapa não baixe o nível 355 (o legado não rebaixa; o Go sim, #348). */
const expFor = (stages: number) => EXP_AT[355] + stages * CRYSTAL_EXP + 11_000_000;

const quest: QuestSpec = {
  id: '10',
  name: 'Destravas do Arch: Lindy 355/370 e Cristais',
  cases: [
    {
      id: 'LD-01',
      title: 'Mortal na Lindy',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 354, classMaster: CLASS_MASTER.MORTAL, carry: RECIPE }),
      run: async (ctx) => refused(await combineLindy(ctx)),
    },
    {
      id: 'LD-02',
      title: 'Arch fora do nível',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 353, carry: RECIPE }),
      run: async (ctx) => refused(await combineLindy(ctx)),
    },
    {
      id: 'LD-03',
      title: 'Receita errada',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 354, carry: [lac10, lac10, undefined, lac, lac, lac, lac] }),
      run: async (ctx) => refused(await combineLindy(ctx, [0, 1, -1, 3, 4, 5, 6])),
    },
    {
      id: 'LD-04',
      title: 'Destrava 355',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { level: 354, clan: 8, carry: [...RECIPE, ...Array<undefined>(13), { index: ITEM.poeiraFada }, { index: ITEM.poeiraFada }] }),
      run: async (ctx) => {
        // Poeiras nos slots 20/21 (os itens iniciais do personagem novo caem nos 7–10).
        // Antes: a Poeira de Fada não pode passar do 354 sem a Lindy (trava do Arch).
        const dustBefore = await use(ctx, 20);
        const r = await combineLindy(ctx);
        // Depois: o personagem volta a ganhar exp (a Poeira sobe para o armazenado 355, exibido 356).
        const dustAfter = await use(ctx, 21);
        await ctx.relog();
        const db = await saved(ctx);
        const locked = dustBefore.after.level === dustBefore.before.level && dustBefore.before.carry === dustBefore.after.carry;
        const unlocked = r.db.lv355 === 1 && r.db.capa === ITEM.capaClan8 && r.after.capa === ITEM.capaClan8 && recipeGone(r) && r.answer.combine === 1;
        const grows = dustAfter.after.level === 355 && db.level === 355;
        return {
          pass: locked && unlocked && grows,
          evidence: { dustBefore, combine: r, dustAfter, db },
          note: `Poeira antes: ${noteU(dustBefore)} | ${noteC(r)} | Poeira depois: ${noteU(dustAfter)}; banco final nível ${db.level}`,
        };
      },
    },
    {
      id: 'LD-05',
      title: '355 de novo',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 354, lv355: 1, clan: 8, carry: RECIPE }),
      run: async (ctx) => refused(await combineLindy(ctx)),
    },
    {
      id: 'LD-06',
      title: '355 acima do nível',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { level: 359, clan: 8, carry: RECIPE }),
      run: async (ctx) => {
        // Legado: recusa (CurrentScore.Level ≠ 354). Go: aceita qualquer nível ≥ 354, de propósito, porque a
        // trava de exp (archExpLocked) também é ≥ 354 — sem isso o Arch que passou da trava ficaria preso.
        const r = await combineLindy(ctx);
        const accepted = r.db.lv355 === 1 && r.db.capa === ITEM.capaClan8 && recipeGone(r);
        return { pass: accepted, evidence: { ...r }, note: `${accepted ? 'Go aceitou (como documentado)' : 'Go recusou'}; ${noteC(r)}` };
      },
    },
    {
      id: 'LD-07',
      title: '370 sem Fame',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 369, lv355: 1, fame: 0, carry: RECIPE }),
      run: async (ctx) => refused(await combineLindy(ctx)),
    },
    {
      id: 'LD-08',
      title: 'Destrava 370',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { level: 369, lv355: 1, fame: 3, carry: RECIPE }),
      run: async (ctx) => {
        const r = await combineLindy(ctx);
        const ok = r.db.lv370 === 1 && r.db.fame === r.seed.fame - 1 && recipeGone(r) && r.answer.combine === 1;
        return { pass: ok, evidence: { ...r }, note: noteC(r) };
      },
    },
    {
      id: 'CR-01',
      title: 'Cristal fora de ordem',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { ...CRYSTAL_ARCH, exp: expFor(1), carry: [crystal(2)] }),
      run: async (ctx) => crystalRefused(await useCrystals(ctx, [0])),
    },
    {
      id: 'CR-02',
      title: 'Etapa 1',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { ...CRYSTAL_ARCH, exp: expFor(1), carry: [crystal(1)] }),
      run: async (ctx) => crystalDone(await useCrystals(ctx, [0]), 1, 1),
    },
    {
      id: 'CR-03',
      title: 'Etapa repetida',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { ...CRYSTAL_ARCH, crystal: 1, exp: expFor(1), carry: [crystal(1)] }),
      run: async (ctx) => crystalRefused(await useCrystals(ctx, [0])),
    },
    {
      id: 'CR-04',
      title: 'Quatro etapas',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { ...CRYSTAL_ARCH, exp: expFor(4), carry: [crystal(1), crystal(2), crystal(3), crystal(4)] }),
      run: async (ctx) => crystalDone(await useCrystals(ctx, [0, 1, 2, 3]), 1, 4),
    },
    {
      id: 'CR-05',
      title: 'Mortal com cristal',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { level: 355, classMaster: CLASS_MASTER.MORTAL, exp: expFor(1), carry: [crystal(1)] }),
      run: async (ctx) => {
        // Legado: aceita (checagem comentada). Go: recusa de propósito (#327). Informativo.
        const r = crystalRefused(await useCrystals(ctx, [0]));
        return { ...r, note: `${r.pass ? 'Go recusou (#327, proposital)' : 'Go não recusou'}; ${r.note}` };
      },
    },
    {
      id: 'CR-06',
      title: 'Exp abaixo de 100M',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { ...CRYSTAL_ARCH, exp: 50_000_000, carry: [crystal(1)] }),
      run: async (ctx) => {
        // Legado: exp −100M fica negativa e o nível não cai. Go (#348): exp zera e o nível é recalculado pela exp.
        const r = await useCrystals(ctx, [0]);
        const ok = r.db.crystal === 1 && r.db.exp === 0 && r.db.level === 0 && !hasIndex(r.db.carry, ITEM.cristal[0]);
        return { pass: ok, evidence: { ...r }, note: `${ok ? 'Go zerou a exp e recalculou o nível (#348, proposital)' : 'Go fora do #348'}; ${noteCr(r)}` };
      },
    },
  ],
};

export default quest;
