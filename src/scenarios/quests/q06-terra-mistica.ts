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

/** Recompensa do Cap.Explor.: um amuleto da faixa com stEffect[0] = 43 no inventário e no banco, e a flag 3. */
function reward(t: Talk, band: { min: number; max: number }, what: string): CaseResult {
  const isAmulet = (x: SlotItem) => x.index >= band.min && x.index <= band.max;
  const got = t.carry.gained.find(isAmulet);
  const savedAmulet = t.savedCarry.find(isAmulet);
  const pass = !!got && got.eff[0]?.[0] === AMULET_EF0 && !!savedAmulet && t.flag.saved === FLAG.recompensada;
  return {
    pass, evidence: { ...talkEvidence(t), amulet: got, savedAmulet },
    note: pass
      ? `${what}: recebeu o ${got!.index} (efeitos ${JSON.stringify(got!.eff)}), terra_mistica 3 no banco`
      : `${what}: esperado um amuleto ${band.min}–${band.max} e a flag 3; ${got ? `ganhou ${got.index}` : 'nenhum item'} (${answer(t.talk)}), terra_mistica ${t.flag.before} → ${t.flag.saved} no banco`,
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

// ---------------------------------------------------------------- caça dos dragões (TM-07)

interface Hunt {
  kills: { t: string; mob: string }[];
  /** Textos do servidor durante a caça (o legado manda _NN_Watching_Town_Success no kill que conclui). */
  texts: { t: string; text: string }[];
  /** terra_mistica lido no banco a cada checagem (o Go grava no save periódico/relog). */
  checks: { t: string; kills: number; flag: number }[];
  deaths: number;
  minutes: number;
}

const inHunt = (c: GameClient) => isInArea(DRAGON_AREA, c.self!.x, c.self!.y);

/** Caça os mobs de rosto 239/241 até `untilMs` ou até a flag aparecer como 2 no banco. */
async function huntDragons(ctx: CaseCtx, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const h: Hunt = { kills: [], texts: [], checks: [], deaths: 0, minutes: 0 };
  const onText = (e: { text: string }) => { h.texts.push({ t: new Date().toISOString(), text: e.text }); };
  let bound: GameClient | undefined;
  const bind = () => { if (bound !== c()) { bound?.off('text', onText); c().on('text', onText); bound = c(); } };
  try {
    while (Date.now() < untilMs) {
      bind();
      const me = c().self!;
      if (c().isClosed) throw new Error('conexão caiu na caça');
      if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
      if (!inHunt(c())) {
        await goTo(ctx, NPC.capExplor);
        await walkTo(c(), DRAGON_SPAWNS[0].x + 4, DRAGON_SPAWNS[0].y + 4, { abort: () => me.hp <= 0 });
        continue;
      }
      if (me.hp < me.maxHp * 0.4) {
        await walkTo(c(), REST_SPOT.x, REST_SPOT.y, { abort: () => me.hp <= 0 });
        const r0 = Date.now();
        while (me.hp > 0 && me.hp < me.maxHp * 0.85 && Date.now() - r0 < 60_000) await sleep(2000);
        if (me.hp > 0) await walkTo(c(), DRAGON_SPAWNS[0].x + 4, DRAGON_SPAWNS[0].y + 4, { abort: () => me.hp <= 0 });
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
      const m = targets[0];
      const r = await fight(c(), m, { minHpRatio: 0.4, maxSwings: 120 });
      if (r.result === 'killed') {
        h.kills.push({ t: new Date().toISOString(), mob: m.name });
        ctx.log.info('kill', { mob: m.name, kills: h.kills.length, hp: me.hp, maxHp: me.maxHp });
        if (h.kills.length % 10 === 0) {
          const flag = (await ctx.query((db, n) => db.character(n))).terra_mistica;
          h.checks.push({ t: new Date().toISOString(), kills: h.kills.length, flag });
          if (flag === FLAG.concluida) break;
        }
      }
    }
  } finally {
    bound?.off('text', onText);
  }
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
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
    {
      id: 'TM-02',
      title: 'Ask',
      type: 'controle',
      seed: async (db, n) => { await char(db, n); },
      run: async (ctx) => withParty(ctx, true, (db, n) => char(db, n), async () => control(await talk(ctx, NPC.capMercenario, 0), 'líder de grupo, confirm 0')),
    },
    {
      id: 'TM-03',
      title: 'Membro, não líder',
      type: 'controle',
      seed: async (db, n) => { await char(db, n); },
      run: async (ctx) => withParty(ctx, false, (db, n) => char(db, n), async () => control(await talk(ctx, NPC.capMercenario, 1), 'membro (a conta B lidera), confirm 1')),
    },
    {
      id: 'TM-04',
      title: 'Aceitar',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n); },
      run: async (ctx) => withParty(ctx, true, (db, n) => char(db, n), async () => {
        await goTo(ctx, NPC.capMercenario);
        const first = await talkQuest(ctx.c, ctx.log, NPC.capMercenario, 4000, 1);
        await sleep(2000);
        // Na mesma sessão, um segundo pedido mostra a flag em memória: com 1 o Go recusa (NoticeReqNotMet).
        const again = await talkQuest(ctx.c, ctx.log, NPC.capMercenario, 4000, 1);
        const inMemory = again.notices.length > 0 && !first.notices.length;
        await ctx.relog();
        const saved = (await ctx.query((db, n) => db.character(n))).terra_mistica;
        const pass = saved === FLAG.aceita;
        const evidence = { first: { notices: first.notices, texts: first.texts }, again: { notices: again.notices, texts: again.texts }, inMemory, saved };
        ctx.log.info('resultado do aceite', evidence);
        return {
          pass, evidence,
          note: pass
            ? `líder com a conta B no grupo, confirm 1: terra_mistica 0 → ${saved} no banco depois do relog (${answer(first)})`
            : `líder com membro, confirm 1: ${answer(first)}; ${inMemory ? `o segundo pedido já recusa (${answer(again)}), a flag virou 1 em memória` : `o segundo pedido responde igual (${answer(again)})`}, mas terra_mistica ficou ${saved} no banco depois do relog`,
        };
      }),
    },
    {
      id: 'TM-05',
      title: 'Aceitar de novo',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, { flag: FLAG.aceita }); },
      run: async (ctx) => withParty(ctx, true, (db, n) => char(db, n), async () => control(await talk(ctx, NPC.capMercenario, 1), 'terra_mistica 1, líder com membro, confirm 1')),
    },
    {
      id: 'TM-06',
      title: 'Recompensa antes da hora',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, { flag: FLAG.aceita }); },
      run: async (ctx) => control(await talk(ctx, NPC.capExplor, 0), 'terra_mistica 1 no Cap.Explor.'),
    },
    {
      id: 'TM-07',
      title: 'Concluir a missão',
      type: 'feliz',
      timeoutMs: 15 * 60_000,
      seed: async (db, n) => { await char(db, n, { flag: FLAG.aceita }); },
      run: async (ctx) => {
        const h = await huntDragons(ctx, Date.now() + 10 * 60_000);
        await ctx.relog();
        const saved = (await ctx.query((db, n) => db.character(n))).terra_mistica;
        const pass = saved === FLAG.concluida;
        // Legado: 1 em 20 por kill (MobKilled.cpp:2909) — a chance de nenhum sucesso em N kills é 0,95^N.
        const miss = +(0.95 ** h.kills.length * 100).toFixed(1);
        const byMob = h.kills.reduce<Record<string, number>>((a, k) => ({ ...a, [k.mob]: (a[k.mob] ?? 0) + 1 }), {});
        const evidence = { kills: h.kills.length, byMob, texts: h.texts, checks: h.checks, deaths: h.deaths, minutes: h.minutes, saved, legacyMissPct: miss };
        ctx.log.info('resultado da caça', evidence);
        return {
          pass, evidence,
          note: pass
            ? `terra_mistica 1 → 2 depois de ${h.kills.length} kills em ${h.minutes} min`
            : `${h.kills.length} kills (${Object.entries(byMob).map(([k, v]) => `${v} ${k}`).join(', ')}) em ${h.minutes} min, ${h.deaths} mortes: nenhuma mensagem de conclusão, terra_mistica ${saved} no banco (no legado a chance de não concluir em ${h.kills.length} kills é ${miss}%)`,
        };
      },
    },
    {
      id: 'TM-08',
      title: 'Recompensa',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, { flag: FLAG.concluida, level: 100 }); },
      run: async (ctx) => reward(await talk(ctx, NPC.capExplor, 0), AMULET.mistico, 'terra_mistica 2, exibido 101'),
    },
    {
      id: 'TM-09',
      title: 'Faixa do amuleto',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, { flag: FLAG.concluida, level: 49 }); },
      run: async (ctx) => reward(await talk(ctx, NPC.capExplor, 0), AMULET.prata, 'terra_mistica 2, exibido 50'),
    },
    {
      id: 'TM-10',
      title: 'Recompensa repetida',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, { flag: FLAG.recompensada }); },
      run: async (ctx) => control(await talk(ctx, NPC.capExplor, 0), 'terra_mistica 3 no Cap.Explor.'),
    },
    {
      id: 'TM-11',
      title: 'Arch',
      type: 'controle',
      // Arch líder de um grupo (o segundo também Arch, para o grupo fechar): só a classe barra o aceite.
      seed: async (db, n) => { await char(db, n, { arch: true }); },
      run: async (ctx) => withParty(ctx, true, (db, n) => char(db, n, { arch: true }), async () => control(await talk(ctx, NPC.capMercenario, 1), 'Arch líder de grupo, confirm 1')),
    },
  ],
};

export default quest;
