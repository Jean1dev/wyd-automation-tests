// Quest 04 — Molar do Gárgula (docs/quests/04-molar-gargula.md).
//
// O bot vai pelo Mestre Grifo ("Calabouço") e pelo tile do Armia Field até o Dungeon 1 e anda até a
// Patrulha__ (787,4058), que teleporta para a arena dos Gárgulas. O Molar_de_Gárgula (4122) é usado
// com o botão direito (MSG_UseItem) e refina Equip[1..5] para +6. Nível, classe, equipamento e o
// molar vêm do banco. Cada caso confere o efeito: posição, refinação de cada Equip[i], o 4122 no
// inventário, AC e dano, e o banco depois do relog.
import type { GameClient } from '../../client/GameClient.ts';
import { fight } from '../../bot/combat.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { approachNpc, type NpcSpec, talkQuest, type QuestTalk, useItem } from '../../bot/npc.ts';
import { waitForReset } from '../../bot/quest.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { griffTravel, isInArmia, returnToArmia, teleportTile } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import {
  ARENA, ARENA_SAFE_SPOT, GARGULA_SPAWNS, GRIFF_WARP, HUNT_ATTRS, HUNT_GEAR, HUNT_HP, inArena as inArenaXY, isInArea, ITEM, LEVEL,
  MOLAR_MOBS, MOLAR_SANC, MOLAR_SLOTS, NPC, ROUTE_TO_PATRULHA, TELEPORT, TELEPORT_DEST, TELEPORT_SPREAD, WALK_INTO_ARENA,
} from '../../world/quests/04-molar-gargula.ts';
import { carryOf, diffSlots, EF_SANC, effValue, hasItem, type SlotItem } from './helpers.ts';
import type { CaseCtx, QuestSpec } from './runner.ts';

const inArena = (c: GameClient) => inArenaXY(c.self!.x, c.self!.y);
const pos = (c: GameClient) => ({ x: c.self!.x, y: c.self!.y });

// ---------------------------------------------------------------- seed

/** Personagem no nível ARMAZENADO dado, Mortal (ou Arch), com atributos e o equipamento de caça. */
async function char(db: Db, name: string, storedLevel: number, o: { arch?: boolean } = {}): Promise<void> {
  // max_hp é o BaseMaxHP: o Go não o recalcula pelo nível (herança da quest 02).
  await db.setCharacter(name, {
    level: storedLevel, exp: 0, coin: 200_000, class_master: o.arch ? CLASS_MASTER.ARCH : CLASS_MASTER.MORTAL,
    ...HUNT_ATTRS, max_hp: HUNT_HP, hp: HUNT_HP, max_mp: 1000, mp: 1000,
  });
  for (const [slot, index] of Object.entries(HUNT_GEAR)) await db.putItem(name, 'equip', Number(slot), { index });
}

/** Refinação semeada em cada Equip[1..5] (undefined = slot vazio). */
type Refines = Partial<Record<(typeof MOLAR_SLOTS)[number], number | undefined>>;

/** Peças de +0 a +5 e uma +7 (MG-05). */
const MIXED: Refines = { 1: 0, 2: 3, 3: 5, 4: 7, 5: 1 };

async function refines(db: Db, name: string, r: Refines): Promise<void> {
  for (const slot of MOLAR_SLOTS) {
    if (!(slot in r)) continue;
    const s = r[slot];
    if (s === undefined) { await db.clearItem(name, 'equip', slot); continue; }
    await db.putItem(name, 'equip', slot, { index: HUNT_GEAR[slot], eff: s > 0 ? [[EF_SANC, s]] : [] });
  }
}

const putMolar = (db: Db, name: string, slot = 0) => db.putItem(name, 'carry', slot, { index: ITEM.molarDeGargula });

// ---------------------------------------------------------------- ações

/** De Armia (ou de onde estiver) até o lado da Patrulha__: Grifo "Calabouço", tile para o Dungeon 1 e a pé. */
async function goToPatrulha(ctx: CaseCtx): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (inArena(c) || dist(me.x, me.y, NPC.patrulha.pos.x, NPC.patrulha.pos.y) <= 60) {
    await walkTo(c, NPC.patrulha.stand.x, NPC.patrulha.stand.y);
    return;
  }
  if (!(me.y >= 3600 && me.x < 1000)) {
    if (!isInArmia(me.x, me.y)) await returnToArmia(c, ctx.log);
    await griffTravel(c, ctx.log, GRIFF_WARP.calabouco);
    await teleportTile(c, ctx.log, TELEPORT.fieldToDungeon, 'Armia Field → Dungeon 1');
  }
  await walkPath(c, ROUTE_TO_PATRULHA);
}

interface Talk {
  talk: QuestTalk;
  final: { x: number; y: number };
  inArena: boolean;
}

async function talk(ctx: CaseCtx, npc: NpcSpec = NPC.patrulha): Promise<Talk> {
  await approachNpc(ctx.c, npc);
  const t = await talkQuest(ctx.c, ctx.log, npc, 6000);
  await sleep(1500);
  return { talk: t, final: pos(ctx.c), inArena: inArena(ctx.c) };
}

const summary = (t: Talk) => ({ npc: t.talk.npc, from: t.talk.from, teleport: t.talk.teleport, notices: t.talk.notices, texts: t.talk.texts, final: t.final, inArena: t.inArena });
const answer = (n: number[], tx: string[]) => (n.length ? `notices ${n.join(',')}` : tx.length ? `"${tx.join(' | ')}"` : 'sem resposta');
const talkAnswer = (t: Talk) => answer(t.talk.notices, t.talk.texts);

const inTeleportSpread = (p: { x: number; y: number }) =>
  p.x >= TELEPORT_DEST.x + TELEPORT_SPREAD.lo && p.x <= TELEPORT_DEST.x + TELEPORT_SPREAD.hi &&
  p.y >= TELEPORT_DEST.y + TELEPORT_SPREAD.lo && p.y <= TELEPORT_DEST.y + TELEPORT_SPREAD.hi;

/** Entra na arena pela Patrulha__ (ou a pé, se ela recusar: não há guarda). */
async function enterArena(ctx: CaseCtx): Promise<{ via: 'patrulha' | 'a pé'; t?: Talk }> {
  await goToPatrulha(ctx);
  if (inArena(ctx.c)) return { via: 'a pé' };
  const t = await talk(ctx);
  if (t.inArena) return { via: 'patrulha', t };
  await walkPath(ctx.c, WALK_INTO_ARENA);
  await sleep(1500);
  if (!inArena(ctx.c)) throw new Error(`não entrou na arena a pé (${ctx.c.self!.x},${ctx.c.self!.y})`);
  return { via: 'a pé', t };
}

/** Refinação de Equip[1..5] (−1 = slot vazio). */
type Sancs = Record<number, number>;
const sancsOf = (equip: { slot: number; index: number; eff: [number, number][] }[]): Sancs =>
  Object.fromEntries(MOLAR_SLOTS.map((s) => { const it = equip.find((x) => x.slot === s && x.index); return [s, it ? effValue(it, EF_SANC) : -1]; }));
const liveSancs = (c: GameClient): Sancs =>
  sancsOf(MOLAR_SLOTS.map((s) => ({ slot: s, index: c.self!.equip[s]?.index ?? 0, eff: c.self!.equip[s]?.eff ?? [] })));
const fmt = (s: Sancs) => MOLAR_SLOTS.map((i) => `${i}:${s[i] < 0 ? '—' : `+${s[i]}`}`).join(' ');
/** O que o legado deixa: < +6 vira +6, o resto fica, slot vazio é pulado. */
const expected = (s: Sancs): Sancs => Object.fromEntries(MOLAR_SLOTS.map((i) => [i, s[i] < 0 ? -1 : Math.max(s[i], MOLAR_SANC)]));
const sameSancs = (a: Sancs, b: Sancs) => MOLAR_SLOTS.every((i) => a[i] === b[i]);

interface Use {
  slot: number;
  frames: number[];
  notices: number[];
  texts: string[];
  sancs: { before: Sancs; after: Sancs };
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  molarAfter: boolean;
  ac: { before: number; after: number };
  damage: { before: number; after: number };
}

/** Usa o 4122 (MSG_UseItem) e devolve o que mudou: refinação, inventário, AC e dano. */
async function useMolar(ctx: CaseCtx): Promise<Use> {
  const c = ctx.c;
  const slot = c.findItem(ITEM.molarDeGargula);
  if (slot < 0) throw new Error('o 4122 não está no inventário');
  const before = liveSancs(c), carry0 = carryOf(c), ac0 = c.self!.ac, dmg0 = c.self!.damage;
  const since = useItem(c, slot);
  try {
    await c.waitFor((f) => (f.header.type === Op.SendItem && P.parseSendItem(f.body).place === P.PLACE_CARRY && P.parseSendItem(f.body).slot === slot) || f.header.type === Op.MessageBoxOk || f.header.type === Op.MessagePanel, { timeoutMs: 5000, since, what: 'resposta ao 4122' });
  } catch {
    // sem resposta: registrado abaixo
  }
  await sleep(2000); // SendItem do Equip e UpdateScore
  const fr = c.framesSince(since);
  const u: Use = {
    slot,
    frames: fr.map((f) => f.header.type),
    notices: fr.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: fr.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    sancs: { before, after: liveSancs(c) },
    carry: diffSlots(carry0, carryOf(c)),
    molarAfter: hasItem(carryOf(c), ITEM.molarDeGargula),
    ac: { before: ac0, after: c.self!.ac },
    damage: { before: dmg0, after: c.self!.damage },
  };
  ctx.log.info('usou o 4122', u as unknown as Record<string, unknown>);
  return u;
}

const useAnswer = (u: Use) => answer(u.notices, u.texts);
const unchanged = (u: Use) => sameSancs(u.sancs.before, u.sancs.after) && u.molarAfter;

/** Refinação e o 4122 salvos no banco (depois de um relog). */
async function saved(ctx: CaseCtx): Promise<{ sancs: Sancs; molar: boolean }> {
  return ctx.query(async (db, n) => {
    const eq = await db.items(n, 'equip');
    const ca = await db.items(n, 'carry');
    return { sancs: sancsOf(eq), molar: ca.some((x) => x.index === ITEM.molarDeGargula) };
  });
}

/** Usa o molar e confere o efeito do legado (na hora e no banco depois do relog). */
async function refineCase(ctx: CaseCtx): Promise<{ pass: boolean; u: Use; db: Awaited<ReturnType<typeof saved>>; want: Sancs }> {
  const u = await useMolar(ctx);
  const want = expected(u.sancs.before);
  await ctx.relog();
  const db = await saved(ctx);
  const pass = sameSancs(u.sancs.after, want) && !u.molarAfter && sameSancs(db.sancs, want) && !db.molar && u.ac.after > u.ac.before;
  return { pass, u, db, want };
}

const refineNote = (r: Awaited<ReturnType<typeof refineCase>>) => r.pass
  ? `refinação ${fmt(r.u.sancs.before)} → ${fmt(r.u.sancs.after)} (banco igual), o 4122 sumiu, AC ${r.u.ac.before}→${r.u.ac.after}, dano ${r.u.damage.before}→${r.u.damage.after}`
  : `esperado ${fmt(r.want)}; ficou ${fmt(r.u.sancs.after)} (banco ${fmt(r.db.sancs)}), 4122 ${r.u.molarAfter ? 'continua' : 'sumiu'} (${useAnswer(r.u)}), AC ${r.u.ac.before}→${r.u.ac.after}`;

// ---------------------------------------------------------------- caça do molar (MG-04)

interface Hunt {
  entries: number;
  kills: { t: string; mob: string; molar: boolean }[];
  deaths: number;
  dropAt?: string;
  minutes: number;
}

async function huntMolar(ctx: CaseCtx, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const h: Hunt = { entries: 0, kills: [], deaths: 0, minutes: 0 };
  while (Date.now() < untilMs && c().findItem(ITEM.molarDeGargula) < 0) {
    const me = c().self!;
    if (c().isClosed) throw new Error('conexão caiu na caça do molar');
    if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
    if (!inArena(c())) { await enterArena(ctx); h.entries++; continue; }
    if (me.hp < me.maxHp * 0.4) {
      await walkTo(c(), ARENA_SAFE_SPOT.x, ARENA_SAFE_SPOT.y, { abort: () => !inArena(c()) || me.hp <= 0 });
      const r0 = Date.now();
      while (me.hp > 0 && inArena(c()) && me.hp < me.maxHp * 0.85 && Date.now() - r0 < 60_000) await sleep(2000);
      continue;
    }
    const targets = c().liveMobs()
      .filter((m) => (MOLAR_MOBS as readonly string[]).includes(m.name) && isInArea(ARENA, m.x, m.y))
      .sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = GARGULA_SPAWNS[Math.floor(Math.random() * GARGULA_SPAWNS.length)];
      await walkTo(c(), p.x, p.y + 1, { abort: () => !inArena(c()) || me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const m = targets[0];
    const r = await fight(c(), m, { minHpRatio: 0.4, maxSwings: 80 });
    if (r.result === 'killed') {
      await sleep(800);
      const got = c().findItem(ITEM.molarDeGargula) >= 0;
      h.kills.push({ t: new Date().toISOString(), mob: m.name, molar: got });
      ctx.log.info('kill na arena', { mob: m.name, molar: got, hp: me.hp, maxHp: me.maxHp });
      if (got) h.dropAt = new Date().toISOString();
    }
  }
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
}

// ---------------------------------------------------------------- casos

const quest: QuestSpec = {
  id: '04',
  name: 'Molar do Gárgula',
  cases: [
    {
      id: 'MG-01',
      title: 'Teleporte abaixo do nível',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min - 1); },
      run: async (ctx) => {
        await goToPatrulha(ctx);
        const t = await talk(ctx);
        const pass = !t.talk.teleport && !t.inArena;
        return { pass, evidence: summary(t), note: pass ? `Mortal exibido 199: recusa (${talkAnswer(t)}), sem teleporte, ficou em (${t.final.x},${t.final.y})` : `exibido 199 teleportado para (${t.final.x},${t.final.y})` };
      },
    },
    {
      id: 'MG-02',
      title: 'Teleporte',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, LEVEL.min); },
      run: async (ctx) => {
        await goToPatrulha(ctx);
        const t = await talk(ctx);
        const to = t.talk.teleport?.to;
        const pass = !!to && inTeleportSpread(to) && t.inArena;
        return { pass, evidence: summary(t), note: pass ? `Mortal exibido 200: teleportado para (${to!.x},${to!.y}), dentro da arena` : `exibido 200: ${to ? `teleportou para (${to.x},${to.y})` : `sem teleporte (${talkAnswer(t)})`}` };
      },
    },
    {
      id: 'MG-03',
      title: 'Arch',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min, { arch: true }); },
      run: async (ctx) => {
        await goToPatrulha(ctx);
        const t = await talk(ctx);
        const pass = !t.talk.teleport && !t.inArena;
        return { pass, evidence: summary(t), note: pass ? `Arch exibido 200: recusa (${talkAnswer(t)}), sem teleporte` : `Arch exibido 200 teleportado para (${t.final.x},${t.final.y})` };
      },
    },
    {
      id: 'MG-04',
      title: 'Drop',
      type: 'feliz',
      timeoutMs: 18 * 60_000,
      seed: async (db, n) => { await char(db, n, LEVEL.max - 1); },
      run: async (ctx) => {
        const h = await huntMolar(ctx, Date.now() + 15 * 60_000);
        const slot = ctx.c.findItem(ITEM.molarDeGargula);
        const byMob = h.kills.reduce<Record<string, number>>((m, k) => ((m[k.mob] = (m[k.mob] ?? 0) + 1), m), {});
        const ev = { hunt: h, byMob, damage: ctx.c.self!.damage, maxHp: ctx.c.self!.maxHp };
        if (slot < 0) return { pass: false, evidence: ev, note: `${h.minutes} min, kills ${JSON.stringify(byMob)}, ${h.deaths} morte(s), sem o 4122` };
        const k = h.kills.find((x) => x.molar);
        return { pass: true, evidence: ev, note: `o 4122 caiu no inventário (slot ${slot}) ao matar ${k?.mob ?? '?'}; ${h.kills.length} kill(s) ${JSON.stringify(byMob)} em ${h.minutes} min` };
      },
    },
    {
      id: 'MG-05',
      title: 'Uso do molar',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, LEVEL.min); await refines(db, n, MIXED); await putMolar(db, n); },
      run: async (ctx) => {
        const r = await refineCase(ctx);
        return { pass: r.pass, evidence: { use: r.u, saved: r.db, want: r.want }, note: refineNote(r) };
      },
    },
    {
      id: 'MG-06',
      title: 'Uso repetido',
      type: 'controle',
      // A flag MolarGargula não existe no banco do Go: a pré-condição sai do primeiro uso, jogando.
      seed: async (db, n) => { await char(db, n, LEVEL.min); await refines(db, n, MIXED); await putMolar(db, n, 0); await putMolar(db, n, 1); },
      run: async (ctx) => {
        const first = await useMolar(ctx);
        const firstOk = sameSancs(first.sancs.after, expected(first.sancs.before)) && ctx.c.findItem(ITEM.molarDeGargula) >= 0 && carryOf(ctx.c).filter((x) => x.index === ITEM.molarDeGargula).length === 1;
        // Na mesma sessão: com a flag, o segundo 4122 tem de voltar ao slot (sem ela seria consumido à toa).
        const second = await useMolar(ctx);
        const ev = { first, second, firstOk };
        if (!firstOk) return { pass: false, evidence: ev, note: `pré-condição: o primeiro uso não refinou (${fmt(first.sancs.before)} → ${fmt(first.sancs.after)}, ${useAnswer(first)}); segundo uso: ${useAnswer(second)}, refinação ${unchanged(second) ? 'intacta' : 'mudou'}` };
        const pass = unchanged(second);
        return { pass, evidence: ev, note: pass ? `primeiro uso refinou; segundo: recusa (${useAnswer(second)}), o 4122 volta ao slot ${second.slot}, refinação intacta` : `segundo uso: ${second.molarAfter ? 'o 4122 ficou' : 'o 4122 foi consumido'}, refinação ${fmt(second.sancs.before)} → ${fmt(second.sancs.after)}` };
      },
    },
    {
      id: 'MG-07',
      title: 'Uso fora da faixa',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.max); await refines(db, n, MIXED); await putMolar(db, n); },
      run: async (ctx) => {
        const u = await useMolar(ctx);
        const pass = unchanged(u);
        return { pass, evidence: { use: u }, note: pass ? `Mortal exibido 255: recusa (${useAnswer(u)}), o 4122 fica no slot ${u.slot}, refinação ${fmt(u.sancs.after)} intacta` : `exibido 255 refinou: ${fmt(u.sancs.before)} → ${fmt(u.sancs.after)}` };
      },
    },
    {
      id: 'MG-08',
      title: 'Slot vazio',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, LEVEL.min); await refines(db, n, { ...MIXED, 3: undefined }); await putMolar(db, n); },
      run: async (ctx) => {
        const r = await refineCase(ctx);
        const pass = r.pass && r.u.sancs.after[3] === -1;
        return { pass, evidence: { use: r.u, saved: r.db, want: r.want }, note: `Equip[3] vazio: ${refineNote(r)}` };
      },
    },
    {
      id: 'MG-09',
      title: 'Flag persiste',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, LEVEL.min); await refines(db, n, MIXED); await putMolar(db, n, 0); await putMolar(db, n, 1); },
      run: async (ctx) => {
        const first = await useMolar(ctx);
        const firstOk = sameSancs(first.sancs.after, expected(first.sancs.before));
        // Relog com a refinação de volta a +0: só a flag salva impede o segundo uso.
        const c = await ctx.reseed(async (db, n) => { await refines(db, n, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }); });
        const second = await useMolar({ ...ctx, c });
        const ev = { first, second, firstOk };
        if (!firstOk) return { pass: false, evidence: ev, note: `pré-condição (MG-05) não acontece: o primeiro uso ${useAnswer(first)}, refinação ${fmt(first.sancs.after)}; depois do relog o segundo uso ${useAnswer(second)}` };
        const pass = unchanged(second);
        return { pass, evidence: ev, note: pass ? `depois do relog: recusa (${useAnswer(second)}), refinação +0 intacta` : `depois do relog o molar refinou de novo: ${fmt(second.sancs.after)}` };
      },
    },
    {
      id: 'MG-10',
      title: 'Reset da arena',
      type: 'feliz',
      timeoutMs: 18 * 60_000,
      seed: async (db, n) => { await char(db, n, LEVEL.max - 1); },
      run: async (ctx) => {
        const entry = await enterArena(ctx);
        const enteredAt = Date.now();
        const r = await waitForReset(ctx.c, ctx.log, { enteredAt, waitUntil: enteredAt + 12 * 60_000, safeSpot: ARENA_SAFE_SPOT, inArea: inArenaXY });
        const pass = !!r.ok;
        return {
          pass, evidence: { via: entry.via, reset: r },
          note: pass
            ? `entrou ${entry.via}; mandado para (${r.kicked!.to.x},${r.kicked!.to.y}) ${r.kicked!.secondsAfterEntry} s depois (${r.kicked!.t.slice(11, 19)} UTC)`
            : `12 min na arena sem reset (final ${r.final.x},${r.final.y})`,
        };
      },
    },
  ],
};

export default quest;
