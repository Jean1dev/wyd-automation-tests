// Quest 03 — Capa Verde (Formatura Aprendiz) (docs/quests/03-capa-verde.md).
//
// O Mortal vai pelo Mestre Grifo até o Jardim dos Deuses e anda até o Diretor_Treina. (sul de
// Azran); o Diretor teleporta para a arena, onde ficam os Taurus e o Chefe_Treina. O Arch anda de
// Armia até o Lider_Aprendiz, no centro dos reinos. Nível, classe, emblema, capa, atributos e
// equipamento vêm do banco. Cada caso confere o efeito: posição (dentro/fora da arena), Equip[13]
// e Equip[15], inventário e o banco depois do relog.
import type { GameClient } from '../../client/GameClient.ts';
import { fight } from '../../bot/combat.ts';
import { equipFromCarry } from '../../bot/equip.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { approachNpc, type NpcSpec, talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { waitForReset } from '../../bot/quest.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { griffTravel, isInArmia, returnToArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import {
  ARENA, ARENA_SAFE_SPOT, EMBLEM_MOBS, EQUIP_SLOT, GRIFF_WARP, HUNT_ATTRS, HUNT_GEAR, HUNT_HP, isInArea, ITEM, LEVEL, NPC,
  ROUTE_TO_DIRETOR, ROUTE_TO_LIDER, TAURUS_SPAWNS, TELEPORT_DEST, TELEPORT_SPREAD, WALK_INTO_ARENA,
} from '../../world/quests/03-capa-verde.ts';
import { carryOf, diffSlots, equipOf, hasItem, type SlotItem } from './helpers.ts';
import type { CaseCtx, QuestSpec } from './runner.ts';

/** ReqLvl do 4080 (ItemList.csv:5743), comparado com o nível armazenado. */
const EMBLEM_REQ_LEVEL = 100;
const inArena = (c: GameClient) => isInArea(ARENA, c.self!.x, c.self!.y);
const pos = (c: GameClient) => ({ x: c.self!.x, y: c.self!.y });
const equipAt = (c: GameClient, slot: number) => c.self!.equip[slot]?.index ?? 0;

// ---------------------------------------------------------------- seed

/** Personagem no nível ARMAZENADO dado, Mortal (ou Arch), com atributos e equipamento de caça. */
async function char(db: Db, name: string, storedLevel: number, o: { arch?: boolean } = {}): Promise<void> {
  // max_hp é o BaseMaxHP: o Go não o recalcula pelo nível (herança da quest 02).
  await db.setCharacter(name, {
    level: storedLevel, exp: 0, coin: 200_000, class_master: o.arch ? CLASS_MASTER.ARCH : CLASS_MASTER.MORTAL,
    ...HUNT_ATTRS, max_hp: HUNT_HP, hp: HUNT_HP, max_mp: 800, mp: 800,
  });
  for (const [slot, index] of Object.entries(HUNT_GEAR)) await db.putItem(name, 'equip', Number(slot), { index });
}

const putCarry = (db: Db, name: string, slot: number, index: number) => db.putItem(name, 'carry', slot, { index });
const putEquip = (db: Db, name: string, slot: number, index: number) => db.putItem(name, 'equip', slot, { index });

// ---------------------------------------------------------------- ações

/** De Armia (ou de onde estiver) até o lado do Diretor: Grifo para o Jardim dos Deuses e a pé para o sul. */
async function goToDiretor(ctx: CaseCtx): Promise<void> {
  const c = ctx.c;
  if (inArena(c) || dist(c.self!.x, c.self!.y, NPC.diretor.pos.x, NPC.diretor.pos.y) <= 40) {
    await walkTo(c, NPC.diretor.stand.x, NPC.diretor.stand.y);
    return;
  }
  if (!isInArmia(c.self!.x, c.self!.y)) await returnToArmia(c, ctx.log);
  await griffTravel(c, ctx.log, GRIFF_WARP.jardimDosDeuses);
  await walkPath(c, ROUTE_TO_DIRETOR);
}

async function goToLider(ctx: CaseCtx): Promise<void> {
  await walkPath(ctx.c, ROUTE_TO_LIDER);
}

interface Talk {
  talk: QuestTalk;
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  equip: { gained: SlotItem[]; lost: SlotItem[] };
  ac: { before: number; after: number };
  final: { x: number; y: number };
  inArena: boolean;
}

/** Fala com o NPC (MSG_Quest, confirm 0) e devolve o que mudou no inventário, no equipamento e onde ficou. */
async function talk(ctx: CaseCtx, npc: NpcSpec): Promise<Talk> {
  await approachNpc(ctx.c, npc);
  const carry0 = carryOf(ctx.c), equip0 = equipOf(ctx.c), ac0 = ctx.c.self!.ac;
  const t = await talkQuest(ctx.c, ctx.log, npc, 6000);
  await sleep(1500);
  return {
    talk: t, carry: diffSlots(carry0, carryOf(ctx.c)), equip: diffSlots(equip0, equipOf(ctx.c)),
    ac: { before: ac0, after: ctx.c.self!.ac }, final: pos(ctx.c), inArena: inArena(ctx.c),
  };
}

const summary = (t: Talk) => ({
  npc: t.talk.npc, from: t.talk.from, teleport: t.talk.teleport, notices: t.talk.notices, texts: t.talk.texts,
  carryGained: t.carry.gained, carryLost: t.carry.lost, equipGained: t.equip.gained, equipLost: t.equip.lost,
  ac: t.ac, final: t.final, inArena: t.inArena,
});

const nothingChanged = (t: Talk) => !t.talk.teleport && !t.carry.lost.length && !t.carry.gained.length && !t.equip.lost.length && !t.equip.gained.length;
const answer = (t: Talk) => (t.talk.notices.length ? `notices ${t.talk.notices.join(',')}` : t.talk.texts.length ? `"${t.talk.texts.join(' | ')}"` : 'sem resposta');

const inTeleportSpread = (p: { x: number; y: number }) =>
  p.x >= TELEPORT_DEST.x + TELEPORT_SPREAD.lo && p.x <= TELEPORT_DEST.x + TELEPORT_SPREAD.hi &&
  p.y >= TELEPORT_DEST.y + TELEPORT_SPREAD.lo && p.y <= TELEPORT_DEST.y + TELEPORT_SPREAD.hi;

/**
 * Entra na arena: pelo Diretor (quem está na faixa) ou a pé (quem o Diretor recusa; não há guarda).
 * Devolve a fala com o Diretor, se houve.
 */
async function enterArena(ctx: CaseCtx, o: { onFoot?: boolean } = {}): Promise<{ via: 'diretor' | 'a pé'; diretor?: Talk }> {
  await goToDiretor(ctx);
  let diretor: Talk | undefined;
  if (!o.onFoot) {
    diretor = await talk(ctx, NPC.diretor);
    if (diretor.inArena) return { via: 'diretor', diretor };
  }
  await walkPath(ctx.c, WALK_INTO_ARENA);
  await sleep(1500);
  if (!inArena(ctx.c)) throw new Error(`não entrou na arena a pé (${ctx.c.self!.x},${ctx.c.self!.y})`);
  return { via: 'a pé', diretor };
}

/** Entra na arena e fala com o Chefe_Treina. */
async function handIn(ctx: CaseCtx, o: { onFoot?: boolean; before?: () => Promise<void> } = {}): Promise<{ entry: Awaited<ReturnType<typeof enterArena>>; t: Talk }> {
  const entry = await enterArena(ctx, o);
  await o.before?.();
  const t = await talk(ctx, NPC.chefeTreina);
  return { entry, t };
}

/** Equip e inventário salvos no banco (depois de um relog). */
async function saved(ctx: CaseCtx): Promise<{ equip13: number; equip15: number; carry4080: boolean }> {
  return ctx.query(async (db, n) => {
    const eq = await db.items(n, 'equip');
    const ca = await db.items(n, 'carry');
    return {
      equip13: eq.find((x) => x.slot === EQUIP_SLOT.emblema)?.index ?? 0,
      equip15: eq.find((x) => x.slot === EQUIP_SLOT.capa)?.index ?? 0,
      carry4080: ca.some((x) => x.index === ITEM.emblemaDaAprendizagem),
    };
  });
}

// ---------------------------------------------------------------- caça do emblema (CV-05)

interface Hunt {
  entries: number;
  kills: { t: string; mob: string; emblem: boolean; exp: number }[];
  deaths: number;
  dropAt?: string;
  minutes: number;
}

async function huntEmblem(ctx: CaseCtx, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const h: Hunt = { entries: 0, kills: [], deaths: 0, minutes: 0 };
  while (Date.now() < untilMs && c().findItem(ITEM.emblemaDaAprendizagem) < 0) {
    const me = c().self!;
    if (c().isClosed) throw new Error('conexão caiu na caça do emblema');
    if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
    if (!inArena(c())) { await enterArena(ctx); h.entries++; continue; }
    if (me.hp < me.maxHp * 0.4) {
      await walkTo(c(), ARENA_SAFE_SPOT.x, ARENA_SAFE_SPOT.y, { abort: () => !inArena(c()) || me.hp <= 0 });
      const r0 = Date.now();
      while (me.hp > 0 && inArena(c()) && me.hp < me.maxHp * 0.85 && Date.now() - r0 < 60_000) await sleep(2000);
      continue;
    }
    const targets = c().liveMobs()
      .filter((m) => (EMBLEM_MOBS as readonly string[]).includes(m.name) && isInArea(ARENA, m.x, m.y))
      .sort((a, b) => (a.name === 'Chefe_Taurus' ? 0 : 1) - (b.name === 'Chefe_Taurus' ? 0 : 1) || dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = TAURUS_SPAWNS[Math.floor(Math.random() * TAURUS_SPAWNS.length)];
      await walkTo(c(), p.x, p.y + 1, { abort: () => !inArena(c()) || me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const m = targets[0];
    const exp0 = me.exp;
    const r = await fight(c(), m, { minHpRatio: 0.4, maxSwings: 80 });
    if (r.result === 'killed') {
      await sleep(800);
      const got = c().findItem(ITEM.emblemaDaAprendizagem) >= 0;
      const exp = Number(me.exp - exp0);
      h.kills.push({ t: new Date().toISOString(), mob: m.name, emblem: got, exp });
      ctx.log.info('kill na arena', { mob: m.name, emblem: got, exp, hp: me.hp, maxHp: me.maxHp });
      if (got) h.dropAt = new Date().toISOString();
    }
  }
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
}

// ---------------------------------------------------------------- casos

const quest: QuestSpec = {
  id: '03',
  name: 'Capa Verde (Formatura Aprendiz)',
  cases: [
    {
      id: 'CV-01',
      title: 'Teleporte abaixo do nível',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min - 1); },
      run: async (ctx) => {
        await goToDiretor(ctx);
        const t = await talk(ctx, NPC.diretor);
        const pass = nothingChanged(t) && !t.inArena;
        return { pass, evidence: summary(t), note: pass ? `exibido 99: recusa (${answer(t)}), sem teleporte, ficou em (${t.final.x},${t.final.y})` : `exibido 99: teleportou para (${t.final.x},${t.final.y})` };
      },
    },
    {
      id: 'CV-02',
      title: 'Teleporte',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, LEVEL.min); },
      run: async (ctx) => {
        await goToDiretor(ctx);
        const t = await talk(ctx, NPC.diretor);
        const to = t.talk.teleport?.to;
        const pass = !!to && inTeleportSpread(to) && t.inArena;
        return { pass, evidence: summary(t), note: pass ? `exibido 100: teleportado para (${to!.x},${to!.y}), dentro da arena` : `exibido 100: ${to ? `teleportou para (${to.x},${to.y})` : `sem teleporte (${answer(t)})`}` };
      },
    },
    {
      id: 'CV-03',
      title: 'Entrega sem emblema',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min); },
      run: async (ctx) => {
        const { entry, t } = await handIn(ctx);
        const pass = nothingChanged(t) && equipAt(ctx.c, EQUIP_SLOT.capa) === 0;
        return { pass, evidence: { via: entry.via, handin: summary(t) }, note: pass ? `na arena (${entry.via}) sem o 4080: recusa (${answer(t)}), Equip[15] continua vazio, nada muda` : 'o Chefe_Treina. mexeu no inventário/equipamento sem o emblema' };
      },
    },
    {
      id: 'CV-04',
      title: 'Emblema no inventário, não equipado',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min); await putCarry(db, n, 0, ITEM.emblemaDaAprendizagem); },
      run: async (ctx) => {
        const { entry, t } = await handIn(ctx);
        const pass = nothingChanged(t) && hasItem(carryOf(ctx.c), ITEM.emblemaDaAprendizagem) && equipAt(ctx.c, EQUIP_SLOT.capa) === 0;
        return { pass, evidence: { via: entry.via, handin: summary(t) }, note: pass ? `4080 no inventário (slot 0): recusa (${answer(t)}), o emblema fica, Equip[15] vazio` : 'o Chefe_Treina. aceitou o emblema fora do Equip[13]' };
      },
    },
    {
      id: 'CV-05',
      title: 'Drop do emblema',
      type: 'feliz',
      timeoutMs: 18 * 60_000,
      seed: async (db, n) => { await char(db, n, 139); },
      run: async (ctx) => {
        const h = await huntEmblem(ctx, Date.now() + 15 * 60_000);
        const slot = ctx.c.findItem(ITEM.emblemaDaAprendizagem);
        const byMob = h.kills.reduce<Record<string, number>>((m, k) => ((m[k.mob] = (m[k.mob] ?? 0) + 1), m), {});
        const ev = { hunt: h, byMob, attrs: ctx.c.self!.attrs, damage: ctx.c.self!.damage, maxHp: ctx.c.self!.maxHp };
        if (slot < 0) return { pass: false, evidence: ev, note: `${h.minutes} min, kills ${JSON.stringify(byMob)}, ${h.deaths} morte(s), sem o 4080` };
        const k = h.kills.find((x) => x.emblem);
        return { pass: true, evidence: ev, note: `o 4080 caiu no inventário (slot ${slot}) ao matar ${k?.mob ?? '?'}; ${h.kills.length} kill(s) ${JSON.stringify(byMob)} em ${h.minutes} min` };
      },
    },
    {
      id: 'CV-06',
      title: 'Entrega',
      type: 'feliz',
      // O 4080 pede ReqLvl 100 (ItemList.csv:5743) contra o nível ARMAZENADO (Basedef.cpp:5050 `lvl > score->Level`;
      // Go item.go:1779): o exibido 100 não equipa, então a entrega usa o exibido 101.
      seed: async (db, n) => { await char(db, n, EMBLEM_REQ_LEVEL); await putCarry(db, n, 0, ITEM.emblemaDaAprendizagem); },
      run: async (ctx) => {
        let eq: Awaited<ReturnType<typeof equipFromCarry>> | undefined;
        const { entry, t } = await handIn(ctx, { before: async () => { eq = await equipFromCarry(ctx.c, ctx.log, 0, EQUIP_SLOT.emblema); } });
        const live = { equip13: equipAt(ctx.c, EQUIP_SLOT.emblema), equip15: equipAt(ctx.c, EQUIP_SLOT.capa) };
        await ctx.relog();
        const db = await saved(ctx);
        const ev = { via: entry.via, equip: eq, handin: summary(t), live, saved: db };
        if (!eq?.ok) return { pass: false, evidence: ev, note: `equipar o 4080 no Equip[13] foi recusado (notices ${eq?.notices.join(',') || '—'})` };
        const pass = live.equip13 === 0 && live.equip15 === ITEM.mantoDoAprendiz && t.ac.after > t.ac.before && db.equip13 === 0 && db.equip15 === ITEM.mantoDoAprendiz;
        return {
          pass, evidence: ev,
          note: pass
            ? `Equip[13] vazio, Equip[15] = 4006, AC ${t.ac.before}→${t.ac.after}; no banco depois do relog: Equip[15] 4006, Equip[13] vazio`
            : `Equip[13] ${live.equip13}, Equip[15] ${live.equip15}, AC ${t.ac.before}→${t.ac.after}; banco 13=${db.equip13} 15=${db.equip15} (${answer(t)})`,
        };
      },
    },
    {
      id: 'CV-07',
      title: 'Entrega com capa',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min); await putEquip(db, n, EQUIP_SLOT.capa, ITEM.mantoDoAprendiz); await putEquip(db, n, EQUIP_SLOT.emblema, ITEM.emblemaDaAprendizagem); },
      run: async (ctx) => {
        const { entry, t } = await handIn(ctx);
        const pass = nothingChanged(t) && equipAt(ctx.c, EQUIP_SLOT.emblema) === ITEM.emblemaDaAprendizagem && equipAt(ctx.c, EQUIP_SLOT.capa) === ITEM.mantoDoAprendiz;
        return { pass, evidence: { via: entry.via, handin: summary(t) }, note: pass ? `com o 4006 e o 4080 equipados: recusa (${answer(t)}), o emblema fica no Equip[13]` : `Equip[13] ${equipAt(ctx.c, 13)}, Equip[15] ${equipAt(ctx.c, 15)} (${answer(t)})` };
      },
    },
    {
      id: 'CV-08',
      title: 'Acima do nível',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.max); await putEquip(db, n, EQUIP_SLOT.emblema, ITEM.emblemaDaAprendizagem); },
      run: async (ctx) => {
        const { entry, t } = await handIn(ctx);
        const pass = nothingChanged(t) && equipAt(ctx.c, EQUIP_SLOT.emblema) === ITEM.emblemaDaAprendizagem && equipAt(ctx.c, EQUIP_SLOT.capa) === 0;
        const dir = entry.diretor ? `o Diretor ${entry.diretor.talk.teleport ? 'teleportou' : `recusou (${answer(entry.diretor)})`}, ` : '';
        return { pass, evidence: { via: entry.via, diretor: entry.diretor && summary(entry.diretor), handin: summary(t) }, note: pass ? `exibido 151 com o 4080 no Equip[13]: ${dir}entrou ${entry.via}; o Chefe recusa (${answer(t)}), nada muda` : `exibido 151: Equip[13] ${equipAt(ctx.c, 13)}, Equip[15] ${equipAt(ctx.c, 15)}` };
      },
    },
    {
      id: 'CV-09',
      title: 'Reset da arena',
      type: 'feliz',
      timeoutMs: 18 * 60_000,
      seed: async (db, n) => { await char(db, n, 139); },
      run: async (ctx) => {
        const entry = await enterArena(ctx);
        const enteredAt = Date.now();
        const r = await waitForReset(ctx.c, ctx.log, { enteredAt, waitUntil: enteredAt + 12 * 60_000, safeSpot: ARENA_SAFE_SPOT, inArea: (x, y) => isInArea(ARENA, x, y) });
        const pass = !!r.ok;
        return {
          pass, evidence: { via: entry.via, reset: r },
          note: pass
            ? `entrou ${entry.via}; mandado para (${r.kicked!.to.x},${r.kicked!.to.y}) ${r.kicked!.secondsAfterEntry} s depois (${r.kicked!.t.slice(11, 19)} UTC)`
            : `12 min na arena sem reset (final ${r.final.x},${r.final.y})`,
        };
      },
    },
    {
      id: 'CV-10',
      title: 'Arch pelo Lider_Aprendiz',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, 99, { arch: true }); },
      run: async (ctx) => {
        await goToLider(ctx);
        const t = await talk(ctx, NPC.liderAprendiz);
        const live15 = equipAt(ctx.c, EQUIP_SLOT.capa);
        await ctx.relog();
        const db = await saved(ctx);
        const pass = live15 === ITEM.mantoDoAprendiz && db.equip15 === ITEM.mantoDoAprendiz;
        return { pass, evidence: { handin: summary(t), live15, saved: db }, note: pass ? `Arch BaseScore 99: Equip[15] = 4006 (banco também), AC ${t.ac.before}→${t.ac.after}` : `Arch BaseScore 99 sem capa: o Lider_Aprendiz ${answer(t)}; Equip[15] ${live15 || 'vazio'} (banco ${db.equip15 || 'vazio'})` };
      },
    },
    {
      id: 'CV-11',
      title: 'Arch fora da faixa',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, 98, { arch: true }); },
      run: async (ctx) => {
        await goToLider(ctx);
        const t = await talk(ctx, NPC.liderAprendiz);
        const pass = nothingChanged(t) && equipAt(ctx.c, EQUIP_SLOT.capa) === 0;
        return { pass, evidence: summary(t), note: pass ? `Arch BaseScore 98: ${answer(t)}, Equip[15] continua vazio` : `Arch BaseScore 98 recebeu Equip[15] ${equipAt(ctx.c, 15)}` };
      },
    },
    {
      id: 'CV-12',
      title: 'Mortal no Lider_Aprendiz',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min); },
      run: async (ctx) => {
        await goToLider(ctx);
        const t = await talk(ctx, NPC.liderAprendiz);
        const pass = nothingChanged(t) && equipAt(ctx.c, EQUIP_SLOT.capa) === 0;
        return { pass, evidence: summary(t), note: pass ? `Mortal exibido 100: ${answer(t)}, Equip[15] continua vazio` : `Mortal recebeu Equip[15] ${equipAt(ctx.c, 15)}` };
      },
    },
    {
      id: 'CV-13',
      title: 'Arch no Diretor',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, LEVEL.min, { arch: true }); },
      run: async (ctx) => {
        await goToDiretor(ctx);
        const t = await talk(ctx, NPC.diretor);
        const pass = nothingChanged(t) && !t.inArena;
        return { pass, evidence: summary(t), note: pass ? `Arch exibido 100: recusa (${answer(t)}), sem teleporte` : `Arch exibido 100 teleportado para (${t.final.x},${t.final.y})` };
      },
    },
  ],
};

export default quest;

