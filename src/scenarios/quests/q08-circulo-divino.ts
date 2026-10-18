// Quest 08 — Círculo Divino (Jeffi e Shama) (docs/quests/08-circulo-divino.md).
//
// O bot vai pelo Grifo até o Jardim dos Deuses e anda até o Jeffi e a Shaman, no leste de Azran. O pedaço
// ou o círculo vem pelo banco no Equip[13], com o gold, o Special[0..3], o LearnedSkill e a flag Circle
// (coluna celestial_circle: no Go, QuestInfo.Circle é o mesmo campo da Arcana). Cada caso confere o efeito:
// Equip[13], gold, SpecialBonus, Special e LearnedSkill no cliente e no banco depois do relog.
import type { GameClient } from '../../client/GameClient.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { type NpcSpec, talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { griffTravel, isInArmia, returnToArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import {
  CIRCLE_SLOT, GRIFF_WARP, ITEM, NPC, PRICE, PURO, PURO_COMP, RESET, ROUTE_TO_AZRAN, TREE_MASK,
} from '../../world/quests/08-circulo-divino.ts';
import type { CaseCtx, QuestSpec } from './runner.ts';

/** Todas as 24 skills da classe aprendidas (bits 0–23). */
const ALL_TREES = 0xffffff;
const SPECIAL_FULL: [number, number, number, number] = [60, 60, 60, 60];

interface Seed {
  coin?: number;
  /** Item do Equip[13]. */
  circle: number;
  special?: [number, number, number, number];
  learned?: number;
  /** QuestInfo.Circle (coluna celestial_circle). */
  circleFlag?: number;
}

async function char(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, {
    level: 99, exp: 0, coin: s.coin ?? 0, class_master: CLASS_MASTER.MORTAL, max_hp: 3000, hp: 3000,
    special_bonus: 0, learned_skill: s.learned ?? 0, celestial_circle: s.circleFlag ?? 0,
  });
  await db.setSpecial(name, s.special ?? [0, 0, 0, 0]);
  await db.putItem(name, 'equip', CIRCLE_SLOT, { index: s.circle });
}

// ---------------------------------------------------------------- ações

async function goTo(ctx: CaseCtx, npc: NpcSpec): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, npc.pos.x, npc.pos.y) <= 60) { await walkTo(c, npc.stand.x, npc.stand.y); return; }
  if (!isInArmia(me.x, me.y)) await returnToArmia(c, ctx.log);
  await griffTravel(c, ctx.log, GRIFF_WARP.jardimDosDeuses);
  await walkPath(c, [...ROUTE_TO_AZRAN, npc.stand], { abort: () => me.hp <= 0 });
  if (me.hp <= 0) throw new Error(`morreu no caminho do ${npc.name}`);
}

interface State {
  coin: number;
  circle: number;
  specialBonus: number;
  special: number[];
  learn: number;
}

const live = (c: GameClient): State => {
  const me = c.self!;
  return { coin: me.coin, circle: me.equip[CIRCLE_SLOT]?.index ?? 0, specialBonus: me.specialBonus, special: [...(me.special ?? [])], learn: Number(me.learn) };
};

interface Saved extends State { circleFlag: number }

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const row = await db.character(ch);
    const eq = (await db.items(ch, 'equip')).find((x) => x.slot === CIRCLE_SLOT);
    return {
      coin: Number(row.coin), circle: eq?.index ?? 0, specialBonus: Number(row.special_bonus), special: await db.special(ch),
      learn: Number(row.learned_skill), circleFlag: Number(row.celestial_circle),
    };
  });
}

interface Talk {
  talk: QuestTalk;
  before: State;
  after: State;
  db: Saved;
}

/** Vai até o NPC, fala (MSG_Quest), lê o estado e confere o banco depois do relog. */
async function talk(ctx: CaseCtx, npc: NpcSpec): Promise<Talk> {
  await goTo(ctx, npc);
  const before = live(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 4000);
  await sleep(1500);
  const after = live(ctx.c);
  await ctx.relog();
  return { talk: t, before, after, db: await saved(ctx) };
}

const answer = (t: QuestTalk) => (t.notices.length ? `notices ${t.notices.join(',')}` : t.texts.length ? `"${t.texts.join(' | ')}"` : 'sem resposta');
const hex = (n: number) => `0x${n.toString(16)}`;
const fmt = (s: State) => `Equip[13] ${s.circle}, gold ${s.coin}, SpecialBonus ${s.specialBonus}, Special [${s.special.join(',')}], Learn ${hex(s.learn)}`;
const same = (a: State, b: State) => a.coin === b.coin && a.circle === b.circle && a.specialBonus === b.specialBonus && a.special.join() === b.special.join() && a.learn === b.learn;
const note = (r: Talk) => `${r.talk.npc}: ${answer(r.talk)}; antes ${fmt(r.before)} → depois ${fmt(r.after)}; banco depois do relog: ${fmt(r.db)}, Circle ${r.db.circleFlag}`;

/** O que a Shama do legado deixa: Special devolvido até o teto, árvore do círculo apagada, Equip[13] vazio. */
function shamaExpected(b: State, circle: number): { specialBonus: number; special: number[]; learn: number } {
  const comp = circle >= PURO_COMP.min;
  const tree = circle - (comp ? PURO_COMP.min : PURO.min);
  const cap = comp ? RESET.completo : RESET.comum;
  let bonus = b.specialBonus;
  const special = b.special.map((v) => { const d = Math.min(v, cap); bonus += d; return v - d; });
  return { specialBonus: bonus, special, learn: b.learn & ~TREE_MASK[tree] & 0xffffffff };
}

/** A Shama aceitou o círculo como no legado (no cliente e no banco). */
function shamaApplied(r: Talk, circle: number): boolean {
  const e = shamaExpected(r.before, circle);
  const ok = (s: State) => s.circle === 0 && s.specialBonus === e.specialBonus && s.special.join() === e.special.join() && (s.learn >>> 0) === (e.learn >>> 0);
  return ok(r.after) && ok(r.db);
}

const quest: QuestSpec = {
  id: '08',
  name: 'Círculo Divino (Jeffi e Shama)',
  cases: [
    {
      id: 'CD-01',
      title: 'Purificar sem gold',
      type: 'controle',
      seed: (db, ch) => char(db, ch, { circle: ITEM.pedaco, coin: PRICE.pedaco - 1 }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.jeffi);
        // Esperado: _NN_Need_1000000_Gold e nada muda.
        const pass = same(r.before, r.after) && r.db.circle === ITEM.pedaco && r.db.coin === PRICE.pedaco - 1;
        return { pass, evidence: { ...r }, note: note(r) };
      },
    },
    {
      id: 'CD-02',
      title: 'Purificar',
      type: 'feliz',
      seed: (db, ch) => char(db, ch, { circle: ITEM.pedaco, coin: PRICE.pedaco + 5000 }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.jeffi);
        const pure = (n: number) => n >= PURO.min && n <= PURO.max;
        const pass = pure(r.after.circle) && r.after.coin === r.before.coin - PRICE.pedaco && pure(r.db.circle) && r.db.coin === r.before.coin - PRICE.pedaco;
        return { pass, evidence: { ...r }, note: note(r) };
      },
    },
    {
      id: 'CD-03',
      title: 'Shama sem círculo puro',
      type: 'controle',
      seed: (db, ch) => char(db, ch, { circle: ITEM.pedaco, coin: 1000, special: SPECIAL_FULL, learned: ALL_TREES }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.shama);
        // Esperado: _NN_Need_Pure_Divine e nada muda.
        const pass = same(r.before, r.after) && r.db.circle === ITEM.pedaco && r.db.special.join() === SPECIAL_FULL.join() && r.db.learn === ALL_TREES;
        return { pass, evidence: { ...r }, note: note(r) };
      },
    },
    {
      id: 'CD-04',
      title: 'Reiniciar',
      type: 'feliz',
      seed: (db, ch) => char(db, ch, { circle: PURO.min, special: SPECIAL_FULL, learned: ALL_TREES }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.shama);
        const pass = shamaApplied(r, PURO.min) && r.db.circleFlag === 1;
        return { pass, evidence: { ...r, expected: shamaExpected(r.before, PURO.min) }, note: note(r) };
      },
    },
    {
      id: 'CD-05',
      title: 'Segundo círculo comum',
      type: 'controle',
      seed: (db, ch) => char(db, ch, { circle: PURO.min, special: SPECIAL_FULL, learned: ALL_TREES, circleFlag: 1 }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.shama);
        // Esperado: _NN_Youve_Done_It_Already; o círculo fica e nada muda.
        const pass = same(r.before, r.after) && r.db.circle === PURO.min && r.db.special.join() === SPECIAL_FULL.join() && r.db.learn === ALL_TREES && r.db.circleFlag === 1;
        return { pass, evidence: { ...r }, note: note(r) };
      },
    },
    {
      id: 'CD-06',
      title: 'Círculo completo depois do comum',
      type: 'borda',
      seed: (db, ch) => char(db, ch, { circle: PURO_COMP.min + 1, special: [120, 120, 120, 120], learned: ALL_TREES, circleFlag: 1 }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.shama);
        const pass = shamaApplied(r, PURO_COMP.min + 1) && r.db.circleFlag === 1;
        return { pass, evidence: { ...r, expected: shamaExpected(r.before, PURO_COMP.min + 1) }, note: note(r) };
      },
    },
    {
      id: 'CD-07',
      title: 'Special abaixo do teto',
      type: 'borda',
      seed: (db, ch) => char(db, ch, { circle: PURO.min + 2, special: [30, 60, 60, 60], learned: ALL_TREES }),
      run: async (ctx) => {
        const r = await talk(ctx, NPC.shama);
        const pass = shamaApplied(r, PURO.min + 2) && r.db.special[0] === 0;
        return { pass, evidence: { ...r, expected: shamaExpected(r.before, PURO.min + 2) }, note: note(r) };
      },
    },
  ],
};

export default quest;
