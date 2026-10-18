// Quest 06 — Terra Mística (Defendendo a Terra Mística) (docs/quests/06-terra-mistica.md).
//
// O bot vai de Armia ao Jardim dos Deuses pelo Grifo e anda até Azran: o Cap.Mercenario (passo 1,
// confirm ≠ 0, líder de grupo) e o Cap.Explor. (passo 3, amuleto pela faixa de nível). O passo 2 é
// matar dragões/basiliscos (rosto 239/241) ao norte de Azran, 1 chance em 20 por kill. O grupo usa
// uma segunda conta NOVA (secondChar/makeParty). A flag QuestInfo.Mortal.TerraMistica é a coluna
// terra_mistica e persiste: a pré-condição vem do banco e o efeito é conferido nele depois do relog,
// junto com o inventário (amuleto) e a resposta do NPC.
import type { GameClient } from '../../client/GameClient.ts';
import { fight } from '../../bot/combat.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { type NpcSpec, talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { griffTravel, isInArmia, returnToArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import {
  AMULET, AMULET_EF0, DRAGON_AREA, DRAGON_MOBS, DRAGON_SPAWNS, FLAG, GRIFF_WARP, HUNT_ATTRS, HUNT_GEAR, HUNT_HP,
  isInArea, NPC, REST_SPOT, ROUTE_TO_EXPLOR, ROUTE_TO_MERCENARIO,
} from '../../world/quests/06-terra-mistica.ts';
import { carryOf, diffSlots, makeParty, secondChar, type SlotItem } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

/** Nível ARMAZENADO padrão (exibido 151): forte o bastante para andar até Azran e caçar dragões. */
const LEVEL = 150;

// ---------------------------------------------------------------- seed

/** Personagem no nível ARMAZENADO dado, com a flag da Terra Mística, atributos e equipamento de caça. */
async function char(db: Db, name: string, o: { level?: number; flag?: number; arch?: boolean } = {}): Promise<void> {
  // max_hp é o BaseMaxHP: o Go não o recalcula pelo nível (herança da quest 02).
  await db.setCharacter(name, {
    level: o.level ?? LEVEL, exp: 0, coin: 100_000, class_master: o.arch ? CLASS_MASTER.ARCH : CLASS_MASTER.MORTAL,
    terra_mistica: o.flag ?? FLAG.nada, ...HUNT_ATTRS, max_hp: HUNT_HP, hp: HUNT_HP, max_mp: 1000, mp: 1000,
  });
  for (const [slot, index] of Object.entries(HUNT_GEAR)) await db.putItem(name, 'equip', Number(slot), { index });
}

// ---------------------------------------------------------------- ações

/** De Armia (ou de perto) até o lado do NPC: Grifo para o Jardim dos Deuses e a pé até Azran. */
async function goTo(ctx: CaseCtx, npc: NpcSpec): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, npc.pos.x, npc.pos.y) <= 150 && !isInArmia(me.x, me.y)) {
    await walkTo(c, npc.stand.x, npc.stand.y);
    return;
  }
  if (!isInArmia(me.x, me.y)) await returnToArmia(c, ctx.log);
  await griffTravel(c, ctx.log, GRIFF_WARP.jardimDosDeuses);
  await walkPath(c, npc === NPC.capMercenario ? ROUTE_TO_MERCENARIO : ROUTE_TO_EXPLOR, { abort: () => me.hp <= 0 });
  if (me.hp <= 0) throw new Error(`morreu no caminho do ${npc.name}`);
}

const answer = (t: QuestTalk) => (t.notices.length ? `notices ${t.notices.join(',')}` : t.texts.length ? `"${t.texts.join(' | ')}"` : 'sem resposta');

interface Talk {
  npc: string;
  confirm: number;
  talk: QuestTalk;
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  /** terra_mistica no banco antes da fala e depois do relog. */
  flag: { before: number; saved: number };
  /** Inventário salvo no banco depois do relog. */
  savedCarry: SlotItem[];
}

/** Fala com o NPC (MSG_Quest com `confirm`) e confere o efeito na hora e no banco depois do relog. */
async function talk(ctx: CaseCtx, npc: NpcSpec, confirm: number): Promise<Talk> {
  const before = (await ctx.query((db, n) => db.character(n))).terra_mistica;
  await goTo(ctx, npc);
  const carry0 = carryOf(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 4000, confirm);
  await sleep(2000);
  const carry = diffSlots(carry0, carryOf(ctx.c));
  await ctx.relog();
  const { saved, savedCarry } = await ctx.query(async (db, n) => ({
    saved: (await db.character(n)).terra_mistica,
    savedCarry: (await db.items(n, 'carry')).map((it) => ({ slot: it.slot, index: it.index, eff: it.eff })) as SlotItem[],
  }));
  const r: Talk = { npc: npc.name, confirm, talk: t, carry, flag: { before, saved }, savedCarry };
  ctx.log.info('resultado da fala', r as unknown as Record<string, unknown>);
  return r;
}

const talkEvidence = (t: Talk) => ({ npc: t.npc, confirm: t.confirm, from: t.talk.from, notices: t.talk.notices, texts: t.talk.texts, carry: t.carry, flag: t.flag });

/** Controle: a flag não muda (no banco) e nada entra nem sai do inventário. */
function control(t: Talk, what: string): CaseResult {
  const pass = t.flag.saved === t.flag.before && !t.carry.gained.length && !t.carry.lost.length;
  return {
    pass, evidence: talkEvidence(t),
    note: pass
      ? `${what}: ${answer(t.talk)}; terra_mistica ${t.flag.saved} no banco, inventário igual`
      : `${what}: terra_mistica ${t.flag.before} → ${t.flag.saved}, ganhou ${t.carry.gained.map((x) => x.index).join(',') || '—'} (${answer(t.talk)})`,
  };
}

/** Leva uma segunda conta ao mundo, forma o grupo e roda `fn`; fecha a segunda conta no fim. */
async function withParty<T>(ctx: CaseCtx, leaderIsA: boolean, seedB: (db: Db, n: string) => Promise<void>, fn: (p: { formed: boolean; invited: boolean; b: string }) => Promise<T>): Promise<T> {
  const b = await secondChar(ctx, seedB);
  try {
    const p = leaderIsA ? await makeParty(ctx.c, b.c) : await makeParty(b.c, ctx.c);
    ctx.log.info('grupo', { leader: leaderIsA ? ctx.char : b.name, member: leaderIsA ? b.name : ctx.char, ...p });
    if (!p.formed) throw new Error(`o grupo não se formou (convite ${p.invited ? 'chegou' : 'não chegou'}; frames ${p.frames.join(',')})`);
    return await fn({ formed: p.formed, invited: p.invited, b: b.name });
  } finally {
    b.c.close();
  }
}

// ---------------------------------------------------------------- casos

const quest: QuestSpec = {
  id: '06',
  name: 'Terra Mística (Defendendo a Terra Mística)',
  cases: [
    {
      id: 'TM-01',
      title: 'Sozinho',
      type: 'controle',
      seed: async (db, n) => { await char(db, n); },
      run: async (ctx) => control(await talk(ctx, NPC.capMercenario, 1), 'Mortal sem grupo, confirm 1'),
    },
  ],
};

export default quest;
