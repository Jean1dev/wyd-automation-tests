// Quest 12 — Pedra Ideal e Arch → Celestial (docs/quests/12-celestial.md).
//
// Cada caso é um personagem novo semeado pelo banco (Mortal exibido 300 ou Arch no nível do caso, com a
// exp mínima, MortalLevel, Clan 0, Cristal e os itens: 1742/Sephirot no Equip[10]/[11], Pedras Secretas,
// Pedra Ideal 5338 e 1742 em slots altos). Rei: o bot anda até o Rei_Glantuar (rota do cenário 5), fala
// com confirm 1 e confere no banco a 5338, as Pedras Secretas, o Equip[10]/[11] e se nasceu um Arch.
// Celestial: MSG_UseItem na pedra (botão direito) em Armia, espera o _MSG_SendArchEffect, reconecta e
// confere no banco ClassMaster, nível, Cythera (Equip[1]), capa, SpecialBonus, LearnedSkill e ArchLevel.
import { walkPath } from '../../bot/movement.ts';
import { approachNpc } from '../../bot/npc.ts';
import { sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import {
  CELESTIAL_SPECIAL_BONUS, EQUIP_SLOT, EXP_AT, HIGH_SEED, ITEM, NPC, ROUTE_TO_KING, SOUL_BIT,
} from '../../world/quests/12-celestial.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

interface Seed {
  classMaster: number;
  /** Nível ARMAZENADO (exibido − 1). */
  level: number;
  mortalLevel?: number;
  crystal?: number;
  /** Inventário: slot → índice (slots altos: o 1º login põe os itens iniciais nos primeiros vazios). */
  carry?: Record<number, number>;
  equip?: Record<number, number>;
}

async function seedChar(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, {
    ...HIGH_SEED,
    level: s.level,
    exp: EXP_AT[s.level],
    class_master: s.classMaster,
    mortal_level: s.mortalLevel ?? 0,
    arch_crystal_stage: s.crystal ?? 0,
    clan: 0,
  });
  for (const [slot, index] of Object.entries(s.carry ?? {})) await db.putItem(name, 'carry', Number(slot), { index });
  for (const [slot, index] of Object.entries(s.equip ?? {})) await db.putItem(name, 'equip', Number(slot), { index });
}

const ARCH = (level: number, extra: Partial<Seed> = {}): Seed => ({ classMaster: CLASS_MASTER.ARCH, level, mortalLevel: 99, ...extra });
const MORTAL_300 = (extra: Partial<Seed> = {}): Seed => ({ classMaster: CLASS_MASTER.MORTAL, level: 299, ...extra });
const KING_GEAR = { [EQUIP_SLOT.imortalidade]: ITEM.pedraImortalidade, [EQUIP_SLOT.sephirot]: ITEM.sephirotTK };
const STONES_AT = (stones: readonly number[]) => Object.fromEntries(stones.map((index, i) => [20 + i, index]));
const ALL_STONES = STONES_AT(ITEM.pedraSecreta);

// ---------------------------------------------------------------- estado no banco

interface Row {
  id: number;
  slot: number;
  classMaster: number;
  level: number;
  specialBonus: number;
  learned: number;
  archLevel: number;
  carry: { slot: number; index: number }[];
  equip: { slot: number; index: number }[];
}

async function rows(ctx: CaseCtx): Promise<Row[]> {
  return ctx.query(async (db, ch) => {
    const list = await db.charactersNamed(ch);
    return Promise.all(list.map(async (r) => ({
      id: r.id,
      slot: r.slot,
      classMaster: Number(r.class_master),
      level: Number(r.level),
      specialBonus: Number(r.special_bonus),
      learned: Number(r.learned_skill),
      archLevel: Number(r.celestial_arch_level),
      carry: (await db.itemsById(r.id, 'carry')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index })),
      equip: (await db.itemsById(r.id, 'equip')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index })),
    })));
  });
}

const eq = (r: Row | undefined, slot: number) => r?.equip.find((x) => x.slot === slot)?.index ?? 0;
const count = (r: Row | undefined, index: number) => r?.carry.filter((x) => x.index === index).length ?? 0;
/** Só os itens da quest (o 1º login acrescenta os itens iniciais). */
const QUEST_ITEMS = new Set<number>([ITEM.pedraImortalidade, ITEM.pedraIdeal, ...ITEM.pedraSecreta, ITEM.sephirotTK]);
const questCarry = (r: Row) => r.carry.filter((x) => QUEST_ITEMS.has(x.index)).map((x) => `${x.slot}:${x.index}`).join(' ') || 'nada';
const fmtR = (r: Row) => `slot ${r.slot} master ${r.classMaster} nível ${r.level} SpecialBonus ${r.specialBonus} LearnedSkill ${r.learned} ArchLevel ${r.archLevel} `
  + `Equip[1] ${eq(r, EQUIP_SLOT.cythera)} [10] ${eq(r, EQUIP_SLOT.imortalidade)} [11] ${eq(r, EQUIP_SLOT.sephirot)} [15] ${eq(r, EQUIP_SLOT.capa)} inv(quest) [${questCarry(r)}]`;
const fmtRows = (l: Row[]) => l.map(fmtR).join(' | ');
/** Retrato comparável de um personagem (para os controles; sem o Equip[0], o rosto que o 1º save grava). */
const sig = (r: Row | undefined) => (r ? `${r.classMaster}/${r.level}/${r.specialBonus}/${r.learned}/${r.archLevel}/${questCarry(r)}/${r.equip.filter((x) => x.slot !== 0).map((x) => `${x.slot}:${x.index}`).join(',')}` : '-');

// ---------------------------------------------------------------- respostas

interface Answer {
  t: string;
  notices: number[];
  texts: string[];
  logout: boolean;
  newCharList: boolean;
  archEffectSlot?: number;
}

async function waitAnswer(ctx: CaseCtx, since: number, waitMs: number): Promise<Answer> {
  const c = ctx.c;
  try {
    await c.waitType(Op.SendArchEffect, { timeoutMs: waitMs, since, what: 'SendArchEffect' });
    await sleep(1000);
  } catch {
    // sem efeito: as respostas (se houver) já estão nos frames
  }
  const frames = c.framesSince(since);
  const effect = frames.find((f) => f.header.type === Op.SendArchEffect);
  return {
    t: new Date().toISOString(),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    logout: frames.some((f) => f.header.type === Op.CNFCharacterLogout),
    newCharList: frames.some((f) => f.header.type === Op.CNFNewCharacter),
    archEffectSlot: effect && effect.body.length >= 4 ? effect.body.readInt32LE(0) : undefined,
  };
}

const fmtA = (a: Answer) => [
  a.archEffectSlot !== undefined ? `SendArchEffect slot ${a.archEffectSlot}` : 'sem SendArchEffect',
  a.logout ? 'CNFCharacterLogout' : '',
  a.newCharList ? 'lista nova' : '',
  ...a.texts.map((x) => `"${x}"`),
  ...a.notices.map((n) => `notice ${n}`),
].filter(Boolean).join(', ');

// ---------------------------------------------------------------- Rei

interface King {
  answer: Answer;
  before: Row[];
  after: Row[];
}

/** Anda até o Rei, fala com confirm 1 e lê o banco (com relog quando o personagem ficou no mundo). */
async function talkKing(ctx: CaseCtx): Promise<King> {
  const before = await rows(ctx);
  const c = ctx.c;
  const me = c.self!;
  await walkPath(c, ROUTE_TO_KING, { abort: () => me.hp <= 0 });
  if (me.hp <= 0) throw new Error('morreu no caminho do Rei');
  const ent = await approachNpc(c, NPC.rei);
  await sleep(500);
  const since = c.mark;
  c.send(Op.Quest, P.quest(ent.id, 1));
  const answer = await waitAnswer(ctx, since, 8000);
  ctx.log.info(`falou com ${NPC.rei.name}`, answer as unknown as Record<string, unknown>);
  if (answer.logout) await sleep(3000);
  else await ctx.relog();
  return { answer, before, after: await rows(ctx) };
}

const kingNote = (k: King) => `Rei: ${fmtA(k.answer)}; banco antes ${fmtRows(k.before)} → depois ${fmtRows(k.after)}`;

/** Legado: a 5334 vira 5338, as 5335–5337 somem, Equip[10]/[11] vazios, e nenhum Arch novo. */
function idealMade(k: King): CaseResult {
  const self = k.after.find((r) => r.id === k.before[0].id);
  const pass = k.after.length === k.before.length && count(self, ITEM.pedraIdeal) === 1
    && ITEM.pedraSecreta.every((p) => count(self, p) === 0)
    && eq(self, EQUIP_SLOT.imortalidade) === 0 && eq(self, EQUIP_SLOT.sephirot) === 0
    && self?.classMaster === k.before[0].classMaster;
  return { pass, evidence: { ...k }, note: kingNote(k) };
}

// ---------------------------------------------------------------- Celestial (botão direito)

interface Use {
  item: number;
  slot: number;
  answer: Answer;
  after: Row[];
  /** Cliente depois do relog (quando houve). */
  client?: { level: number; cythera: number; capa: number };
}

/** Botão direito no item (slot do inventário); reconecta e lê o banco. */
async function useStone(ctx: CaseCtx, item: number): Promise<Use> {
  const c = ctx.c;
  const slot = c.self!.carry.findIndex((x) => x?.index === item);
  if (slot < 0) throw new Error(`o item ${item} não está no inventário`);
  const since = c.mark;
  c.send(Op.UseItem, P.useItem(slot, c.self!.x, c.self!.y));
  const answer = await waitAnswer(ctx, since, 6000);
  ctx.log.info(`usou o ${item} do slot ${slot}`, answer as unknown as Record<string, unknown>);
  const c2 = await ctx.relog();
  const me = c2.self!;
  return {
    item, slot, answer, after: await rows(ctx),
    client: { level: me.level, cythera: me.equip[EQUIP_SLOT.cythera]?.index ?? 0, capa: me.equip[EQUIP_SLOT.capa]?.index ?? 0 },
  };
}

const useNote = (u: Use) => `${u.item} (slot ${u.slot}): ${fmtA(u.answer)}; banco ${fmtRows(u.after)}; cliente nível ${u.client?.level} Equip[1] ${u.client?.cythera} capa ${u.client?.capa}`;

/**
 * O 1º login equipa o elmo inicial (1103) no Equip[1] vazio: sai, limpa o Equip[1] no banco e volta
 * (o kit inicial só vem no primeiro login).
 */
async function noStarterHelm(ctx: CaseCtx): Promise<void> {
  await ctx.reseed((db, ch) => db.clearItem(ch, 'equip', EQUIP_SLOT.cythera));
}

/**
 * Resposta do legado à 5338 recusada (_MSG_UseItem.cpp:3003-3024): Arch < 355 ou MortalLevel < 99 → só o
 * SendItem do slot, calado; Equip[1] ocupado → _NN_Cant_with_armor (Language.txt 205) e nenhum notice.
 */
const ARMOR_TEXT = /pode equipar arma e armadura/;
type Refusal = 'calado' | 'armadura';

function legacyRefusal(a: Answer, want: Refusal): boolean {
  if (a.notices.length) return false;
  return want === 'calado' ? a.texts.length === 0 : a.texts.length === 1 && ARMOR_TEXT.test(a.texts[0]);
}

/**
 * Controle: o botão direito na 5338 recusa com a resposta do legado e não muda nada; a 1742 (sem
 * EF_VOLATILE) também não muda nada.
 */
async function untouched(ctx: CaseCtx, want: Refusal): Promise<CaseResult> {
  if (want !== 'armadura') await noStarterHelm(ctx);
  const before = await rows(ctx);
  const uses = [await useStone(ctx, ITEM.pedraIdeal), await useStone(ctx, ITEM.pedraImortalidade)];
  const same = uses.every((u) => u.answer.archEffectSlot === undefined && !u.answer.logout && sig(u.after[0]) === sig(before[0]));
  const answered = legacyRefusal(uses[0].answer, want);
  const expected = want === 'calado' ? 'esperado (legado): 5338 recusada calada' : 'esperado (legado): 5338 recusada só com _NN_Cant_with_armor';
  return { pass: same && answered, evidence: { before, uses }, note: `${expected}; antes ${fmtRows(before)}; ${uses.map(useNote).join('; ')}` };
}

interface CelestialExpect {
  cythera: number;
  archLevel: number;
  capa: number;
}

/** Feliz: Celestial nível 0 (exibido 1), Cythera, capa Mestre, SpecialBonus 855, só a Alma, a pedra some. */
function celestialOk(u: Use, x: CelestialExpect): boolean {
  const r = u.after[0];
  return u.answer.archEffectSlot !== undefined && r.classMaster === CLASS_MASTER.CELESTIAL && r.level === 0
    && eq(r, EQUIP_SLOT.cythera) === x.cythera && eq(r, EQUIP_SLOT.capa) === x.capa && r.specialBonus === CELESTIAL_SPECIAL_BONUS
    && r.learned === SOUL_BIT && r.archLevel === x.archLevel && count(r, u.item) === 0
    && u.client?.level === 0 && u.client?.cythera === x.cythera;
}

/** CE-07/CE-09: a 5338; se nada acontecer, a 1742 só como evidência do caminho do Go. */
async function celestialCase(ctx: CaseCtx, x: CelestialExpect): Promise<CaseResult> {
  await noStarterHelm(ctx);
  const before = await rows(ctx);
  const u = await useStone(ctx, ITEM.pedraIdeal);
  const pass = celestialOk(u, x);
  const ev: Record<string, unknown> = { before, use5338: u };
  let extra = '';
  if (!pass && u.after[0].classMaster === CLASS_MASTER.ARCH) {
    const g = await useStone(ctx, ITEM.pedraImortalidade);
    ev.use1742 = g;
    extra = `; evidência do Go, botão direito na 1742: ${useNote(g)}`;
  }
  return { pass, evidence: ev, note: `antes ${fmtRows(before)}; esperado Equip[1] ${x.cythera} ArchLevel ${x.archLevel} capa ${x.capa}; ${useNote(u)}${extra}` };
}

const STONES_BOTH = { 20: ITEM.pedraIdeal, 21: ITEM.pedraImortalidade };

const quest: QuestSpec = {
  id: '12',
  name: 'Pedra Ideal e Arch → Celestial',
  cases: [
    {
      id: 'CE-01',
      title: 'Pedra Ideal',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, ARCH(355, { carry: ALL_STONES, equip: KING_GEAR })),
      run: async (ctx) => idealMade(await talkKing(ctx)),
    },
    {
      id: 'CE-02',
      title: 'Faltando uma Pedra Secreta',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, MORTAL_300({ carry: STONES_AT(ITEM.pedraSecreta.slice(0, 3)), equip: KING_GEAR })),
      run: async (ctx) => {
        const k = await talkKing(ctx);
        // Legado: sem a 5337 não há Pedra Ideal, e o Mortal ≥ 299 segue para a criação do Arch.
        const arch = k.after.find((r) => r.classMaster === CLASS_MASTER.ARCH);
        const noIdeal = k.after.every((r) => count(r, ITEM.pedraIdeal) === 0);
        return { pass: noIdeal && !!arch && k.answer.archEffectSlot !== undefined, evidence: { ...k }, note: kingNote(k) };
      },
    },
    {
      id: 'CE-03',
      title: 'Mortal com as 4 pedras no Rei',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, MORTAL_300({ carry: ALL_STONES, equip: KING_GEAR })),
      run: async (ctx) => idealMade(await talkKing(ctx)),
    },
    {
      id: 'CE-04',
      title: 'Celestial com armadura',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, ARCH(355, { carry: STONES_BOTH, equip: { [EQUIP_SLOT.cythera]: ITEM.elmo } })),
      run: (ctx) => untouched(ctx, 'armadura'),
    },
    {
      id: 'CE-05',
      title: 'Arch abaixo do nível',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, ARCH(354, { carry: STONES_BOTH })),
      run: (ctx) => untouched(ctx, 'calado'),
    },
    {
      id: 'CE-06',
      title: 'Mortal de origem baixo',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, ARCH(355, { mortalLevel: 98, carry: STONES_BOTH })),
      run: (ctx) => untouched(ctx, 'calado'),
    },
    {
      id: 'CE-07',
      title: 'Celestial',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, ARCH(355, { carry: STONES_BOTH })),
      run: (ctx) => celestialCase(ctx, { cythera: ITEM.cytheraPrateada, archLevel: 1, capa: ITEM.capaMestreSemReino }),
    },
    {
      id: 'CE-08',
      title: '1742 com o botão direito',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, ARCH(355, { carry: { 21: ITEM.pedraImortalidade } })),
      run: async (ctx) => {
        await noStarterHelm(ctx);
        const before = await rows(ctx);
        const u = await useStone(ctx, ITEM.pedraImortalidade);
        // Legado: a 1742 não tem Vol 211; nada muda.
        const pass = u.answer.archEffectSlot === undefined && sig(u.after[0]) === sig(before[0]);
        return { pass, evidence: { before, use: u }, note: `antes ${fmtRows(before)}; ${useNote(u)}` };
      },
    },
    {
      id: 'CE-09',
      title: 'Faixa da Cythera',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, ARCH(399, { crystal: 4, carry: STONES_BOTH })),
      run: (ctx) => celestialCase(ctx, { cythera: ITEM.cytheraMistica, archLevel: 5, capa: ITEM.capaMestreSemReino }),
    },
  ],
};

export default quest;
