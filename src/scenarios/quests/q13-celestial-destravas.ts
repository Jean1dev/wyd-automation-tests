// Quest 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub (docs/quests/13-celestial-destravas.md).
//
// Cada caso é um personagem novo semeado pelo banco já como Celestial (class_master CELESTIAL, ou
// SCELESTIAL no CL-10) no nível armazenado do caso, com a exp da curva do Celestial do Go, as flags
// celestial_lv40/lv90/circle, a Fama e os itens em slots altos (o 1º login põe os itens iniciais nos
// primeiros vazios). Lv40: MSG_CombineItemOdin com a receita nas posições 0..6 (sem andar até o Odin:
// nem o legado nem o Go conferem a distância). Pedra da Fúria: MSG_UseItem (botão direito) na 3020.
// O efeito é conferido no banco depois do relog. "Voltar a ganhar exp" e o level up do Sub são medidos
// matando um dragão ao norte de Azran (rota do cenário 6): a exp do kill passa pelo applyLevelUps.
import type { GameClient } from '../../client/GameClient.ts';
import { fight } from '../../bot/combat.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { griffTravel, isInArmia, returnToArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db, type SeedItem } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { isInArea } from '../../world/quests/06-terra-mistica.ts';
import {
  CEL_SEED, celExp, DRAGON_AREA, DRAGON_MOBS, DRAGON_SPAWNS, EF_AC, EF_HP, EQUIP_SLOT, FURY_FAME, GRIFF_WARP, HUNT_GEAR,
  ITEM, LV40_RECIPE, RESET_EXP, REST_SPOT, ROUTE_TO_EXPLOR, SUB_ADDS,
} from '../../world/quests/13-celestial-destravas.ts';
import { effValue } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

interface Seed {
  /** Nível ARMAZENADO (exibido − 1). */
  level: number;
  classMaster?: number;
  exp?: number;
  lv40?: number;
  lv90?: number;
  circle?: number;
  fame?: number;
  /** Inventário: slot → item. */
  carry?: Record<number, SeedItem>;
  /** Equipamento: slot → item. */
  equip?: Record<number, SeedItem>;
}

async function seedChar(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, {
    ...CEL_SEED,
    level: s.level,
    exp: s.exp ?? celExp(s.level),
    class_master: s.classMaster ?? CLASS_MASTER.CELESTIAL,
    celestial_lv40: s.lv40 ?? 0,
    celestial_lv90: s.lv90 ?? 0,
    celestial_circle: s.circle ?? 0,
    fame: s.fame ?? 0,
    clan: 0,
  });
  for (const [slot, it] of Object.entries(s.carry ?? {})) await db.putItem(name, 'carry', Number(slot), it);
  for (const [slot, it] of Object.entries(s.equip ?? {})) await db.putItem(name, 'equip', Number(slot), it);
}

const RECIPE_SLOT = 20;
const RECIPE: Record<number, SeedItem> = Object.fromEntries(LV40_RECIPE.map((index, i) => [RECIPE_SLOT + i, { index }]));
const RECIPE_POS = LV40_RECIPE.map((_, i) => RECIPE_SLOT + i);
const FURY_SLOT = 27;
const FURY = { [FURY_SLOT]: { index: ITEM.pedraFuria } };
const STONES: Record<number, SeedItem> = Object.fromEntries(ITEM.pedraSecreta.map((index, i) => [22 + i, { index }]));
/** Equipamento de caça sem o elmo (o Equip[1] fica com a Cythera). */
const HUNT_EQUIP: Record<number, SeedItem> = Object.fromEntries(Object.entries(HUNT_GEAR).filter(([s]) => Number(s) !== EQUIP_SLOT.cythera).map(([s, index]) => [s, { index }]));

// ---------------------------------------------------------------- estado no banco

interface Saved {
  classMaster: number;
  level: number;
  exp: number;
  lv40: number;
  lv90: number;
  circle: number;
  fame: number;
  carry: { slot: number; index: number }[];
  cythera: { index: number; eff: [number, number][] };
}

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const r = await db.character(ch);
    const carry = (await db.items(ch, 'carry')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index }));
    const eq1 = (await db.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.cythera);
    return {
      classMaster: Number(r.class_master), level: Number(r.level), exp: Number(r.exp), lv40: Number(r.celestial_lv40),
      lv90: Number(r.celestial_lv90), circle: Number(r.celestial_circle), fame: Number(r.fame), carry,
      cythera: { index: eq1?.index ?? 0, eff: eq1?.eff ?? [] },
    };
  });
}

/** Só os itens da quest no inventário (o 1º login acrescenta os itens iniciais). */
const QUEST_ITEMS = new Set<number>([...LV40_RECIPE, ITEM.pedraFuria, ...ITEM.pedraSecreta, ITEM.cytheraMistica, ITEM.poeiraFada]);
const questCarry = (s: Saved) => s.carry.filter((x) => QUEST_ITEMS.has(x.index)).map((x) => `${x.slot}:${x.index}`).join(' ') || 'nada';
const has = (s: Saved, index: number) => s.carry.some((x) => x.index === index);
const at = (s: Saved, slot: number) => s.carry.find((x) => x.slot === slot)?.index ?? 0;
const fmtS = (s: Saved) => `master ${s.classMaster} nível ${s.level} exp ${s.exp} Lv40 ${s.lv40} Lv90 ${s.lv90} Circle ${s.circle} Fame ${s.fame} `
  + `Equip[1] ${s.cythera.index}${s.cythera.eff.length ? ` [${s.cythera.eff.map(([e, v]) => `${e}:${v}`).join(',')}]` : ''} inv(quest) [${questCarry(s)}]`;
/** Retrato comparável (para os controles). */
const sig = (s: Saved) => `${s.classMaster}/${s.level}/${s.exp}/${s.lv40}/${s.lv90}/${s.circle}/${s.fame}/${questCarry(s)}`;

// ---------------------------------------------------------------- respostas

interface Answer {
  t: string;
  combine?: number;
  texts: string[];
  notices: number[];
}

function answerOf(c: GameClient, since: number): Answer {
  const frames = c.framesSince(since);
  const cc = frames.find((f) => f.header.type === Op.CombineComplete);
  return {
    t: new Date().toISOString(),
    combine: cc ? P.parseNotice(cc.body) : undefined,
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
  };
}

const fmtA = (a: Answer) => [a.combine !== undefined ? `CombineComplete ${a.combine}` : 'sem CombineComplete', ...a.texts.map((t) => `"${t}"`), ...a.notices.map((n) => `notice ${n}`)].join(', ');

interface Step {
  what: string;
  answer: Answer;
  before: Saved;
  after: Saved;
}

const noteStep = (s: Step) => `${s.what} (${s.answer.t}): ${fmtA(s.answer)}; banco ${fmtS(s.before)} → ${fmtS(s.after)}`;

/** Manda um pacote, espera a resposta, reconecta e lê o banco. */
async function step(ctx: CaseCtx, what: string, send: (c: GameClient) => void, waitCombine = false): Promise<Step> {
  const before = await saved(ctx);
  const c = ctx.c;
  const since = c.mark;
  send(c);
  if (waitCombine) {
    try {
      await c.waitType(Op.CombineComplete, { timeoutMs: 6000, since, what: 'CombineComplete' });
    } catch {
      // o legado sai calado em alguns ramos
    }
    await sleep(1500);
  } else await sleep(3000);
  const answer = answerOf(c, since);
  await ctx.relog();
  const r: Step = { what, answer, before, after: await saved(ctx) };
  ctx.log.info(what, r as unknown as Record<string, unknown>);
  return r;
}

/** MSG_CombineItemOdin com a receita dos slots 20..26 nas posições 0..6. */
const combineOdin = (ctx: CaseCtx) => step(ctx, 'combinação do Odin', (c) => {
  const inputs = RECIPE_POS.map((slot) => (c.self!.carry[slot]?.index ? { slot, item: c.self!.carry[slot] } : undefined));
  c.send(Op.CombineItemOdin, P.combineItem(inputs));
}, true);

/** Botão direito na Pedra da Fúria (slot 27). */
const useFury = (ctx: CaseCtx) => step(ctx, 'botão direito na 3020', (c) => {
  c.send(Op.UseItem, P.useItem(FURY_SLOT, c.self!.x, c.self!.y));
});

const recipeIn = (s: Saved) => RECIPE_POS.every((slot, i) => at(s, slot) === LV40_RECIPE[i]);
const recipeGone = (s: Saved) => RECIPE_POS.every((slot) => !LV40_RECIPE.includes(at(s, slot) as never));

/** Controle da combinação: recusa, receita no lugar, Lv40 igual. */
function combineRefused(s: Step): CaseResult {
  const pass = s.answer.combine !== 1 && recipeIn(s.after) && s.after.lv40 === s.before.lv40;
  return { pass, evidence: { ...s }, note: noteStep(s) };
}

// ---------------------------------------------------------------- dragão (exp de kill)

interface Hunt {
  kills: { t: string; mob: string; level: number; exp: number }[];
  deaths: number;
  minutes: number;
  levelBefore: number;
  levelAfter: number;
  expBefore: number;
  expAfter: number;
}

const inHunt = (c: GameClient) => isInArea(DRAGON_AREA, c.self!.x, c.self!.y);

/** Vai do Jardim dos Deuses até os dragões ao norte de Azran e mata até o nível passar de `level` (ou acabar o tempo). */
async function huntUntilLevel(ctx: CaseCtx, level: number, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const me0 = c().self!;
  const h: Hunt = { kills: [], deaths: 0, minutes: 0, levelBefore: me0.level, levelAfter: me0.level, expBefore: Number(me0.exp), expAfter: Number(me0.exp) };
  while (Date.now() < untilMs && c().self!.level <= level) {
    const me = c().self!;
    if (c().isClosed) throw new Error('conexão caiu na caça');
    if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
    if (!inHunt(c())) {
      if (dist(me.x, me.y, DRAGON_SPAWNS[0].x, DRAGON_SPAWNS[0].y) > 150) {
        if (!isInArmia(me.x, me.y)) await returnToArmia(c(), ctx.log);
        await griffTravel(c(), ctx.log, GRIFF_WARP.jardimDosDeuses);
        await walkPath(c(), ROUTE_TO_EXPLOR, { abort: () => me.hp <= 0 });
      }
      await walkTo(c(), DRAGON_SPAWNS[0].x + 4, DRAGON_SPAWNS[0].y + 4, { abort: () => me.hp <= 0 });
      continue;
    }
    if (me.hp < me.maxHp * 0.4) {
      await walkTo(c(), REST_SPOT.x, REST_SPOT.y, { abort: () => me.hp <= 0 });
      const r0 = Date.now();
      while (me.hp > 0 && me.hp < me.maxHp * 0.85 && Date.now() - r0 < 60_000) await sleep(2000);
      continue;
    }
    const targets = c().liveMobs()
      .filter((m) => (DRAGON_MOBS as readonly string[]).includes(m.name) && isInArea(DRAGON_AREA, m.x, m.y))
      .sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = DRAGON_SPAWNS[Math.floor(Math.random() * DRAGON_SPAWNS.length)];
      await walkTo(c(), p.x, p.y + 1, { abort: () => me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const r = await fight(c(), targets[0], { minHpRatio: 0.4, maxSwings: 120 });
    if (r.result === 'killed') {
      await sleep(800);
      h.kills.push({ t: new Date().toISOString(), mob: targets[0].name, level: me.level, exp: Number(me.exp) });
      ctx.log.info('kill', { mob: targets[0].name, level: me.level, exp: String(me.exp) });
    }
  }
  const me = c().self!;
  h.levelAfter = me.level;
  h.expAfter = Number(me.exp);
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
}

const noteH = (h: Hunt) => `caça ${h.minutes} min, ${h.kills.length} kills, ${h.deaths} mortes; cliente nível ${h.levelBefore}→${h.levelAfter}, exp ${h.expBefore}→${h.expAfter}`
  + (h.kills.length ? ` (1º kill ${h.kills[0].t} ${h.kills[0].mob})` : '');

// ---------------------------------------------------------------- Pedra da Fúria

/** Controle: a 3020 fica, Fama e flags iguais. */
function furyRefused(s: Step): CaseResult {
  return { pass: sig(s.after) === sig(s.before) && at(s.after, FURY_SLOT) === ITEM.pedraFuria, evidence: { ...s }, note: noteStep(s) };
}

const furyGone = (s: Step) => at(s.after, FURY_SLOT) !== ITEM.pedraFuria;
const famePaid = (s: Step) => s.after.fame === s.before.fame - FURY_FAME;

// ---------------------------------------------------------------- casos

const CEL40 = { lv40: 1 } as const;
const CEL200 = { level: 199, lv40: 1, lv90: 1, fame: 600 } as const;

const quest: QuestSpec = {
  id: '13',
  name: 'Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub',
  cases: [
    {
      id: 'CL-01',
      title: 'Lv40 fora do nível',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 38, carry: RECIPE }),
      run: async (ctx) => combineRefused(await combineOdin(ctx)),
    },
    {
      id: 'CL-02',
      title: 'Lv40',
      type: 'feliz',
      timeoutMs: 30 * 60_000,
      // Exp já no limiar do 40 (c[40]): travado no 39 sem a destrava; o 1º kill depois dela sobe para o 40.
      seed: (db, ch) => seedChar(db, ch, { level: 39, exp: celExp(40), carry: RECIPE, equip: { [EQUIP_SLOT.cythera]: { index: ITEM.cytheraPrateada }, ...HUNT_EQUIP } }),
      run: async (ctx) => {
        // g_pOdinRate[4] = 40 %: repete a receita (pelo banco) até 6 vezes.
        const tries: Step[] = [];
        for (let i = 0; i < 6; i++) {
          if (i) await ctx.reseed(async (db, ch) => { for (const [slot, it] of Object.entries(RECIPE)) await db.putItem(ch, 'carry', Number(slot), it); });
          const s = await combineOdin(ctx);
          tries.push(s);
          if (s.after.lv40 === 1 || !recipeGone(s.after)) break;
        }
        const last = tries[tries.length - 1];
        const consumed = tries.every((s) => recipeGone(s.after));
        const unlocked = last.after.lv40 === 1 && last.answer.combine === 1;
        const hunt = unlocked ? await huntUntilLevel(ctx, 39, Date.now() + 12 * 60_000) : undefined;
        if (hunt) await ctx.relog();
        const db = await saved(ctx);
        const grows = !!hunt && hunt.levelAfter === 40 && db.level === 40;
        const pass = consumed && unlocked && grows;
        return {
          pass,
          evidence: { tries, hunt, db },
          note: `${tries.map((s, i) => `tentativa ${i + 1}: ${noteStep(s)}`).join(' | ')}${hunt ? ` | ${noteH(hunt)}; banco depois do relog nível ${db.level} exp ${db.exp}` : ''}`,
        };
      },
    },
    {
      id: 'CL-03',
      title: 'Lv40 de novo',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 39, ...CEL40, carry: RECIPE }),
      run: async (ctx) => combineRefused(await combineOdin(ctx)),
    },
    {
      id: 'CL-04',
      title: 'Lv90 sem Fama',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 89, ...CEL40, fame: 100, carry: FURY }),
      run: async (ctx) => furyRefused(await useFury(ctx)),
    },
    {
      id: 'CL-05',
      title: 'Lv90',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { level: 89, ...CEL40, fame: 600, carry: FURY }),
      run: async (ctx) => {
        // Legado: Fama −500 e a pedra some sempre; ~87 %: Lv90 = 1 e um 3502; senão _NN_FAILURE.
        const s = await useFury(ctx);
        const won = s.after.lv90 === 1 && has(s.after, ITEM.cytheraMistica);
        const lost = s.after.lv90 === 0 && s.answer.texts.length > 0;
        return { pass: furyGone(s) && famePaid(s) && (won || lost), evidence: { ...s }, note: `${won ? 'sucesso' : lost ? 'falha' : 'nada'}; ${noteStep(s)}` };
      },
    },
    {
      id: 'CL-06',
      title: 'Arcana',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { ...CEL200, carry: { ...FURY, ...STONES } }),
      run: async (ctx) => {
        await ctx.reseed((db, ch) => db.clearItem(ch, 'equip', EQUIP_SLOT.cythera)); // tira o elmo inicial
        // Legado: as 4 pedras e 500 de Fama somem; ~87 %: 3507 no Equip[1] e Circle = 1.
        const s = await useFury(ctx);
        const stonesGone = ITEM.pedraSecreta.every((p) => !has(s.after, p));
        const won = s.after.cythera.index === ITEM.cytheraArcana && s.after.circle === 1;
        const lost = s.after.circle === 0 && s.answer.texts.length > 0;
        return { pass: furyGone(s) && famePaid(s) && stonesGone && (won || lost), evidence: { ...s }, note: `${won ? 'sucesso' : lost ? 'falha' : 'nada'}; ${noteStep(s)}` };
      },
    },
    {
      id: 'CL-07',
      title: 'Arcana herdando o `Circle`',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { ...CEL200, circle: 1, exp: celExp(199) + 30_000_000, carry: { ...FURY, ...STONES } }),
      run: async (ctx) => {
        await ctx.reseed((db, ch) => db.clearItem(ch, 'equip', EQUIP_SLOT.cythera));
        // Legado: Circle = 1 cai no ramo Reset: exp −20M, Fama −500, a 3020 some; as pedras e o Equip[1] ficam.
        const s = await useFury(ctx);
        const stonesKept = ITEM.pedraSecreta.every((p) => has(s.after, p));
        const pass = furyGone(s) && famePaid(s) && stonesKept && s.after.exp === s.before.exp - RESET_EXP && s.after.cythera.index !== ITEM.cytheraArcana;
        return { pass, evidence: { ...s }, note: noteStep(s) };
      },
    },
    {
      id: 'CL-08',
      title: 'Reset',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { ...CEL200, circle: 1, exp: celExp(199) + 30_000_000, carry: FURY, equip: { [EQUIP_SLOT.cythera]: { index: ITEM.cytheraArcana } } }),
      run: async (ctx) => {
        // Legado: Exp −20M, nível recalculado (c[199] ≤ exp: fica 199), Fama −500, Reset +1 (o banco não tem coluna).
        const s = await useFury(ctx);
        const pass = furyGone(s) && famePaid(s) && s.after.exp === s.before.exp - RESET_EXP && s.after.level === 199;
        return { pass, evidence: { ...s }, note: `${noteStep(s)}; Reset: sem coluna no banco (internal/migrations), não dá para conferir` };
      },
    },
    {
      id: 'CL-09',
      title: 'Comandos que pulam quest',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { level: 39 }),
      run: async (ctx) => {
        // Legado e Go gravam o Lv40 sem a receita. Só registro: os cenários não usam o comando.
        const s = await step(ctx, '/destravar40', (c) => c.send(Op.MessageWhisper, P.whisper('destravar40')), true);
        const pass = s.after.lv40 === 1 && s.answer.combine === 1;
        return { pass, evidence: { ...s }, note: `${pass ? 'Go grava sem receita, como o legado (não usar nos cenários)' : 'Go não gravou'}; ${noteStep(s)}` };
      },
    },
    {
      id: 'CL-10',
      title: 'Adds do Sub',
      type: 'feliz',
      timeoutMs: 25 * 60_000,
      // Sub-Celestial armazenado 119 com a exp já no limiar do 120: o 1º kill sobe para o 120.
      seed: (db, ch) => seedChar(db, ch, {
        level: 119, classMaster: CLASS_MASTER.SCELESTIAL, exp: celExp(120), ...CEL40, lv90: 1,
        equip: { [EQUIP_SLOT.cythera]: { index: ITEM.cytheraPrateada }, ...HUNT_EQUIP },
      }),
      run: async (ctx) => {
        const before = await saved(ctx);
        const hunt = await huntUntilLevel(ctx, 119, Date.now() + 15 * 60_000);
        const live = ctx.c.self!.equip[EQUIP_SLOT.cythera];
        const liveEff = live ? live.eff.map(([e, v]) => [e, v] as [number, number]) : [];
        await ctx.relog();
        const after = await saved(ctx);
        const want = SUB_ADDS[120];
        const it = { eff: after.cythera.eff };
        const pass = after.level === 120 && effValue(it, EF_AC) === want.ac && effValue(it, EF_HP) === want.hp;
        return {
          pass,
          evidence: { before, hunt, liveEff, after },
          note: `esperado no Equip[1] EF_AC ${want.ac} e EF_HP ${want.hp}; ${noteH(hunt)}; diadema no cliente [${liveEff.map(([e, v]) => `${e}:${v}`).join(',')}]; banco ${fmtS(before)} → ${fmtS(after)}`,
        };
      },
    },
  ],
};

export default quest;
