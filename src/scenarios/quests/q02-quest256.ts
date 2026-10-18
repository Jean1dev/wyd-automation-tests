// Quest 02 — Quest 256: as cinco arenas e os troféus (docs/quests/02-quest256-tickets.md).
//
// Os casos rodam na arena do Coveiro (passo 1), a única que se alcança a pé de Armia: as rotas,
// a arena e os spawns vêm de src/world/coveiro.ts e quest256.ts (os mesmos dos cenários 2 e 4).
// Nível, classe, ticket, troféu, atributos e equipamento vêm do banco. Cada caso confere o
// efeito: slots, posição (dentro/fora da arena), exp e gold, e o banco depois do relog.
import type { GameClient } from '../../client/GameClient.ts';
import type { BotConfig } from '../../config.ts';
import { signupAccount } from '../../bot/account.ts';
import { fight } from '../../bot/combat.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { approachNpc, type NpcSpec, talkQuest, type QuestTalk, useItem } from '../../bot/npc.ts';
import { probeIntruder, waitForReset } from '../../bot/quest.ts';
import { createCharacter, enterWorld, login } from '../../bot/session.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import {
  COVEIRO, HUNT_ATTRS, HUNT_GEAR, HUNT_HP, INTRUDER_PROBE, isInArea, ITEM, NPC, ROUTE_TO_ARMIA, ROUTE_TO_COVEIRO,
} from '../../world/quests/02-quest256.ts';
import { newCharName } from '../common.ts';
import { carryOf, diffSlots, hasItem, type SlotItem } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

const A = COVEIRO;
const inArena = (c: GameClient) => isInArea(A.area, c.self!.x, c.self!.y);
const pos = (c: GameClient) => ({ x: c.self!.x, y: c.self!.y });
/** Armia vai até x 2171; a leste disso o personagem está na rota do Coveiro. */
const ARMIA_MAX_X = 2171;

// ---------------------------------------------------------------- seed

/** Mortal (ou Arch) no nível ARMAZENADO dado, com exp 0 (abaixo do próximo nível) e gold conhecido. */
async function char(db: Db, name: string, storedLevel: number, o: { arch?: boolean; coin?: number } = {}): Promise<void> {
  await db.setCharacter(name, { level: storedLevel, exp: 0, coin: o.coin ?? 1000, class_master: o.arch ? CLASS_MASTER.ARCH : CLASS_MASTER.MORTAL });
}

/** Atributos e equipamento de caça (TK), para aguentar a Aparição (nv 98) dentro da arena. */
async function huntGear(db: Db, name: string): Promise<void> {
  // max_hp é o BaseMaxHP: o Go só soma IncHP no level up e 2 por ponto de Con (misc.go:63).
  await db.setCharacter(name, { ...HUNT_ATTRS, max_hp: HUNT_HP, hp: HUNT_HP, max_mp: 600, mp: 600 });
  for (const [slot, index] of Object.entries(HUNT_GEAR)) await db.putItem(name, 'equip', Number(slot), { index });
}

async function put(db: Db, name: string, slot: number, index: number, amount?: number): Promise<void> {
  await db.putItem(name, 'carry', slot, { index, eff: amount ? [[P.EF_AMOUNT, amount]] : [] });
}

// ---------------------------------------------------------------- ações

/** Vai de onde estiver até o lado do Coveiro (de Armia pela rota do leste). */
async function goToCoveiro(c: GameClient): Promise<void> {
  const me = c.self!;
  if (inArena(c)) { await walkTo(c, A.npc.stand.x, A.npc.stand.y); return; }
  const rest = me.x > ARMIA_MAX_X ? ROUTE_TO_COVEIRO.filter((p) => p.x >= me.x) : ROUTE_TO_COVEIRO;
  await walkPath(c, rest.length ? rest : [A.npc.stand]);
}

async function goToArmia(c: GameClient): Promise<void> {
  if (c.self!.x > ARMIA_MAX_X) await walkPath(c, ROUTE_TO_ARMIA);
}

interface Talk {
  talk: QuestTalk;
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  final: { x: number; y: number };
  inArena: boolean;
}

/** Fala com o NPC (MSG_Quest, confirm 0) e devolve o que mudou no inventário e onde ficou. */
async function talk(ctx: CaseCtx, npc: NpcSpec = A.npc): Promise<Talk> {
  if (npc === A.npc) await goToCoveiro(ctx.c);
  await approachNpc(ctx.c, npc);
  const carry0 = carryOf(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 6000);
  await sleep(1000);
  return { talk: t, carry: diffSlots(carry0, carryOf(ctx.c)), final: pos(ctx.c), inArena: inArena(ctx.c) };
}

const summary = (t: Talk) => ({
  npc: t.talk.npc, from: t.talk.from, teleport: t.talk.teleport, notices: t.talk.notices, texts: t.talk.texts,
  carryGained: t.carry.gained, carryLost: t.carry.lost, final: t.final, inArena: t.inArena,
});

const refused = (t: Talk) => !t.talk.teleport && !t.carry.lost.length && !t.carry.gained.length && !t.inArena;

/**
 * Fica `ms` dentro da arena, num ponto longe dos spawns, e diz se o guarda de intruso (que roda
 * a cada segundo) mandou para fora: quem tem a QuestFlag do passo fica.
 */
async function stays(c: GameClient, ms = 6000): Promise<{ stayed: boolean; kickedTo?: { x: number; y: number }; final: { x: number; y: number } }> {
  let kicked: { x: number; y: number } | undefined;
  const onTp = (e: { to: { x: number; y: number } }) => { if (!isInArea(A.area, e.to.x, e.to.y)) kicked ??= e.to; };
  c.on('teleport', onTp);
  try {
    await walkTo(c, A.safeSpot.x, A.safeSpot.y, { abort: () => !!kicked });
    const t0 = Date.now();
    while (!kicked && Date.now() - t0 < ms) await sleep(500);
  } finally {
    c.off('teleport', onTp);
  }
  return { stayed: !kicked && inArena(c), kickedTo: kicked, final: pos(c) };
}

/** Entrega a Vela ao Coveiro e confere: o ticket some, entra na arena e fica (QuestFlag 1). */
async function enterWithTicket(ctx: CaseCtx): Promise<{ t: Talk; ok: boolean }> {
  const t = await talk(ctx);
  const ok = !!t.talk.teleport && t.inArena && t.carry.lost.some((x) => x.index === A.ticket);
  return { t, ok };
}

/** Usa o item do slot e espera o servidor responder (SendItem do slot ou aviso). */
async function use(c: GameClient, slot: number, waitMs = 4000): Promise<{ frames: number[]; notices: number[]; texts: string[] }> {
  const since = useItem(c, slot);
  try {
    await c.waitFor((f) => (f.header.type === Op.SendItem && P.parseSendItem(f.body).slot === slot) || f.header.type === Op.MessageBoxOk, { timeoutMs: waitMs, since, what: `uso do slot ${slot}` });
  } catch {
    // sem resposta: registrado abaixo
  }
  await sleep(1500); // UpdateEtc (gold/exp) e teleporte
  const fr = c.framesSince(since);
  return {
    frames: fr.map((f) => f.header.type),
    notices: fr.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: fr.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat || f.header.type === Op.ExpPanel).map((f) => P.parseText(f.body)),
  };
}

const amountAt = (c: GameClient, slot: number) => (c.self!.carry[slot]?.index ? P.itemAmount(c.self!.carry[slot]) : 0);

/** Exp e gold do personagem (para medir a recompensa do troféu). */
const wallet = (c: GameClient) => ({ exp: Number(c.self!.exp), coin: c.self!.coin, level: c.self!.level });

/** Exp esperado do troféu no legado: o exp da tabela e mais 10 % como "líder" de si mesmo (_MSG_UseItem.cpp:2398-2410). */
const legacySoloExp = (e: number) => e + Math.floor(e / 10);

// ---------------------------------------------------------------- segundo personagem (QST-11)

async function secondChar(ctx: CaseCtx, seed: (db: Db, name: string) => Promise<void>): Promise<{ c: GameClient; name: string }> {
  const acc = await signupAccount();
  const cfg: BotConfig = { ...ctx.cfg, ...acc, charClass: 0 };
  const name = newCharName(cfg.charPrefix);
  ctx.log.info('segunda conta', { account: acc.account, char: name });
  const sel = await login(cfg, ctx.log);
  await createCharacter(sel, name, 0, ctx.log);
  sel.close();
  await ctx.query(async (db) => seed(db, name));
  const c = await login(cfg, ctx.log);
  await enterWorld(c, name, ctx.log);
  return { c, name };
}

/** O líder convida e o outro aceita (MSG_SendReqParty → MSG_AcceptParty). */
async function makeParty(leader: GameClient, member: GameClient): Promise<{ invited: boolean; frames: string[] }> {
  const L = leader.self!, M = member.self!;
  const since = member.mark;
  leader.send(Op.SendReqParty, P.sendReqParty(L.clientId, M.clientId, { name: L.name, cls: L.cls, level: L.level, hp: L.hp, maxHp: L.maxHp }));
  let invited = true;
  try {
    await member.waitType(Op.SendReqParty, { timeoutMs: 5000, since });
  } catch {
    invited = false;
  }
  const lsince = leader.mark;
  member.send(Op.AcceptParty, P.acceptParty(L.clientId, L.name));
  await sleep(2000);
  return { invited, frames: leader.framesSince(lsince).map((f) => `0x${f.header.type.toString(16)}`) };
}

// ---------------------------------------------------------------- caça do troféu (QST-08)

interface Hunt {
  entries: number;
  kills: { t: string; mob: string; trophy: boolean }[];
  deaths: number;
  dropAt?: string;
  minutes: number;
}

async function huntTrophy(ctx: CaseCtx, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const h: Hunt = { entries: 0, kills: [], deaths: 0, minutes: 0 };
  while (Date.now() < untilMs && c().findItem(A.trophy) < 0) {
    const me = c().self!;
    if (c().isClosed) throw new Error('conexão caiu na caça do troféu');
    if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
    if (!inArena(c())) {
      if (c().findItem(A.ticket) < 0) throw new Error('as Velas acabaram antes do troféu');
      const e = await enterWithTicket(ctx);
      if (!e.ok) throw new Error(`o Coveiro não deixou entrar: ${JSON.stringify(summary(e.t))}`);
      h.entries++;
      continue;
    }
    if (me.hp < me.maxHp * 0.35) {
      await walkTo(c(), A.safeSpot.x, A.safeSpot.y, { abort: () => !inArena(c()) || me.hp <= 0 });
      const r0 = Date.now();
      while (me.hp > 0 && inArena(c()) && me.hp < me.maxHp * 0.8 && Date.now() - r0 < 60_000) await sleep(2000);
      continue;
    }
    const targets = c().liveMobs()
      .filter((m) => A.mobs.includes(m.name) && isInArea(A.area, m.x, m.y))
      .sort((a, b) => (a.name === A.mobs[0] ? 0 : 1) - (b.name === A.mobs[0] ? 0 : 1) || dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = A.spawns[Math.floor(Math.random() * A.spawns.length)];
      await walkTo(c(), p.x, p.y + 2, { abort: () => !inArena(c()) || me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const m = targets[0];
    const r = await fight(c(), m, { minHpRatio: 0.35, maxSwings: 60 });
    if (r.result === 'killed') {
      await sleep(800);
      const got = c().findItem(A.trophy) >= 0;
      h.kills.push({ t: new Date().toISOString(), mob: m.name, trophy: got });
      ctx.log.info('kill na arena', { mob: m.name, trophy: got, hp: me.hp, maxHp: me.maxHp });
      if (got) h.dropAt = new Date().toISOString();
    }
  }
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
}

// ---------------------------------------------------------------- casos

const quest: QuestSpec = {
  id: '02',
  name: 'Quest 256: as cinco arenas e os troféus',
  cases: [
    {
      id: 'QST-01',
      title: 'Entrega do ticket',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, A.level.min); await huntGear(db, n); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const { t, ok } = await enterWithTicket(ctx);
        const ev: Record<string, unknown> = { handin: summary(t) };
        if (!ok) return { pass: false, evidence: ev, note: `exibido 40 com a Vela: ${t.talk.teleport ? `teleportou para (${t.final.x},${t.final.y})` : 'sem teleporte'}; Vela ${t.carry.lost.length ? 'consumida' : 'ficou'}` };
        const s = await stays(ctx.c);
        ev.stays = s;
        const pass = s.stayed;
        return {
          pass, evidence: ev,
          note: pass
            ? `Vela consumida; teleportado para (${t.talk.teleport!.to.x},${t.talk.teleport!.to.y}) e ficou na arena 6 s (QuestFlag 1)`
            : `entrou mas o guarda mandou para (${s.kickedTo?.x},${s.kickedTo?.y}): QuestFlag não ficou`,
        };
      },
    },
    {
      id: 'QST-02',
      title: 'Sem ticket / ticket de outro passo',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, A.level.min); await put(db, n, 0, ITEM.colheitaDoJardineiro); await put(db, n, 1, ITEM.manaDoBatedor); },
      run: async (ctx) => {
        const t = await talk(ctx);
        const pass = refused(t) && hasItem(carryOf(ctx.c), ITEM.colheitaDoJardineiro) && hasItem(carryOf(ctx.c), ITEM.manaDoBatedor);
        return { pass, evidence: summary(t), note: pass ? `com 4039 e 4041 (sem a Vela): recusa (notices ${t.talk.notices.join(',') || '—'}), nada some` : 'o Coveiro aceitou ticket de outro passo ou mexeu no inventário' };
      },
    },
    {
      id: 'QST-03',
      title: 'Um nível abaixo do mínimo',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, A.level.min - 1); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const t = await talk(ctx);
        const pass = refused(t) && hasItem(carryOf(ctx.c), A.ticket);
        return { pass, evidence: summary(t), note: pass ? `exibido 39 com a Vela: recusa (notices ${t.talk.notices.join(',') || '—'}), a Vela fica` : 'o Coveiro aceitou o exibido 39' };
      },
    },
    {
      id: 'QST-04',
      title: 'Intruso',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, A.level.min); await huntGear(db, n); },
      run: async (ctx) => {
        await goToCoveiro(ctx.c);
        const r = await probeIntruder(ctx.c, ctx.log, INTRUDER_PROBE, (x, y) => isInArea(A.area, x, y));
        return { pass: r.ok, evidence: { probe: r }, note: r.ok ? `entrou a pé em (${r.target.x},${r.target.y}) e foi mandado para (${r.final.x},${r.final.y})` : `ficou na arena sem QuestFlag (${r.final.x},${r.final.y})` };
      },
    },
    {
      id: 'QST-05',
      title: 'Reset',
      type: 'feliz',
      timeoutMs: 18 * 60_000,
      seed: async (db, n) => { await char(db, n, A.level.max - 1); await huntGear(db, n); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const { t, ok } = await enterWithTicket(ctx);
        if (!ok) return { pass: false, evidence: { handin: summary(t) }, note: 'a entrega não levou para a arena (pré-condição)' };
        const enteredAt = Date.now();
        const r = await waitForReset(ctx.c, ctx.log, { enteredAt, waitUntil: enteredAt + 12 * 60_000, safeSpot: A.safeSpot, inArea: (x, y) => isInArea(A.area, x, y) });
        const pass = !!r.ok;
        return {
          pass, evidence: { handin: summary(t), reset: r },
          note: pass
            ? `mandado para (${r.kicked!.to.x},${r.kicked!.to.y}) ${r.kicked!.secondsAfterEntry} s depois da entrada (${r.kicked!.t.slice(11, 19)} UTC)`
            : `12 min na arena sem reset (final ${r.final.x},${r.final.y})`,
        };
      },
    },
    {
      id: 'QST-06',
      title: 'Relogin dentro da arena',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, A.level.max - 1); await huntGear(db, n); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const { t, ok } = await enterWithTicket(ctx);
        if (!ok) return { pass: false, evidence: { handin: summary(t) }, note: 'a entrega não levou para a arena (pré-condição)' };
        await walkTo(ctx.c, A.safeSpot.x, A.safeSpot.y);
        const before = pos(ctx.c);
        await ctx.relog();
        const login = pos(ctx.c);
        let kicked: { x: number; y: number } | undefined;
        const onTp = (e: { to: { x: number; y: number } }) => { kicked ??= e.to; };
        ctx.c.on('teleport', onTp);
        for (let i = 0; i < 12 && !kicked; i++) await sleep(500);
        ctx.c.off('teleport', onTp);
        const final = pos(ctx.c);
        const pass = !isInArea(A.area, final.x, final.y);
        const where = isInArea(A.area, login.x, login.y) ? `voltou na arena (${login.x},${login.y})${kicked ? ` e o guarda mandou para (${kicked.x},${kicked.y})` : ''}` : `voltou fora da arena (${login.x},${login.y})`;
        return { pass, evidence: { handin: summary(t), before, login, kicked, final }, note: pass ? `relog dentro da arena: ${where}` : `relog: ${where} e ficou lá sem QuestFlag` };
      },
    },
    {
      id: 'QST-07',
      title: 'Acima do máximo',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, A.level.max); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const t = await talk(ctx);
        const pass = refused(t) && hasItem(carryOf(ctx.c), A.ticket);
        return { pass, evidence: summary(t), note: pass ? `exibido 116 com a Vela: recusa (notices ${t.talk.notices.join(',') || '—'}), a Vela fica` : 'o Coveiro aceitou o exibido 116' };
      },
    },
    {
      id: 'QST-08',
      title: 'Drop do troféu',
      type: 'feliz',
      timeoutMs: 16 * 60_000,
      seed: async (db, n) => {
        await char(db, n, A.level.max - 1);
        await huntGear(db, n);
        for (let s = 0; s < 4; s++) await put(db, n, s, A.ticket);
      },
      run: async (ctx) => {
        const h = await huntTrophy(ctx, Date.now() + 14 * 60_000);
        const slot = ctx.c.findItem(A.trophy);
        const ev: Record<string, unknown> = { hunt: h, attrs: ctx.c.self!.attrs, damage: ctx.c.self!.damage, maxHp: ctx.c.self!.maxHp };
        if (slot < 0) {
          const byMob = h.kills.reduce<Record<string, number>>((m, k) => ((m[k.mob] = (m[k.mob] ?? 0) + 1), m), {});
          return { pass: false, evidence: ev, note: `${h.minutes} min, kills ${JSON.stringify(byMob)}, sem o troféu ${A.trophy}` };
        }
        const k = h.kills.find((x) => x.trophy);
        return { pass: true, evidence: ev, note: `a Caixa_da_Sabedoria 4117 caiu no inventário (slot ${slot}) ao matar ${k?.mob ?? '?'} depois de ${h.kills.length} kill(s), ${h.minutes} min` };
      },
    },
    {
      id: 'QST-09',
      title: 'Usar o troféu',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, A.level.max - 1, { coin: 1000 }); await put(db, n, 0, A.trophy, 2); },
      run: async (ctx) => {
        const w0 = wallet(ctx.c);
        const u = await use(ctx.c, 0);
        const w1 = wallet(ctx.c);
        const left = amountAt(ctx.c, 0);
        await ctx.relog();
        const saved = await ctx.query(async (db, n) => ({ row: await db.character(n), carry: await db.items(n, 'carry') }));
        const savedLeft = saved.carry.find((x) => x.slot === 0);
        const dExp = w1.exp - w0.exp, dCoin = w1.coin - w0.coin;
        const wantExp = legacySoloExp(A.rate.exp.mortal);
        const ev = { use: u, before: w0, after: w1, left, saved: { exp: saved.row.exp, coin: saved.row.coin, slot0: savedLeft }, want: { exp: wantExp, tableExp: A.rate.exp.mortal, coin: A.rate.coin } };
        const coinOk = dCoin === A.rate.coin && Number(saved.row.coin) === w0.coin + A.rate.coin;
        const oneUnit = left === 1;
        const expOk = dExp === wantExp;
        const pass = coinOk && oneUnit && expOk;
        return {
          pass, evidence: ev,
          note: `exibido 115, 2 Caixas: +${dExp} exp (legado ${wantExp} = ${A.rate.exp.mortal} + 10 % de líder), +${dCoin} gold (tabela ${A.rate.coin}), sobrou ${left}; banco: coin ${saved.row.coin}, exp ${saved.row.exp}`,
        };
      },
    },
    {
      id: 'QST-10',
      title: 'Troféu fora da faixa',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, A.level.max, { coin: 1000 }); await put(db, n, 0, A.trophy); },
      run: async (ctx) => {
        const w0 = wallet(ctx.c);
        const u = await use(ctx.c, 0);
        const w1 = wallet(ctx.c);
        const kept = ctx.c.self!.carry[0]?.index === A.trophy;
        const pass = kept && w1.exp === w0.exp && w1.coin === w0.coin;
        return { pass, evidence: { use: u, before: w0, after: w1, kept }, note: pass ? `exibido 116: recusa (notices ${u.notices.join(',') || '—'}), a Caixa fica, exp e gold iguais` : `exibido 116: exp ${w0.exp}→${w1.exp}, gold ${w0.coin}→${w1.coin}, Caixa ${kept ? 'ficou' : 'consumida'}` };
      },
    },
    {
      id: 'QST-11',
      title: 'Troféu em grupo',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, A.level.max - 1); },
      run: async (ctx) => {
        const m = await secondChar(ctx, async (db, n) => { await char(db, n, A.level.max - 1); await put(db, n, 0, A.trophy); });
        try {
          const party = await makeParty(ctx.c, m.c);
          const l0 = wallet(ctx.c), m0 = wallet(m.c);
          const u = await use(m.c, 0);
          await sleep(1500);
          const l1 = wallet(ctx.c), m1 = wallet(m.c);
          const dLeader = l1.exp - l0.exp, dMember = m1.exp - m0.exp;
          const share = Math.floor(A.rate.exp.mortal / 10);
          const pass = dLeader === share && dMember === A.rate.exp.mortal;
          return {
            pass, evidence: { party, use: u, leader: { before: l0, after: l1 }, member: { before: m0, after: m1, name: m.name } },
            note: `${party.invited ? 'grupo formado' : 'o convite não chegou'}; o membro usou a Caixa: membro +${dMember} exp, líder +${dLeader} (esperado ${share})`,
          };
        } finally {
          m.c.close();
        }
      },
    },
    {
      id: 'QST-12',
      title: 'Ticket com o botão direito',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, A.level.min); await huntGear(db, n); await put(db, n, 0, A.ticket, 2); },
      run: async (ctx) => {
        const from = pos(ctx.c);
        const u = await use(ctx.c, 0);
        const left = amountAt(ctx.c, 0);
        const at = pos(ctx.c);
        const entered = isInArea(A.area, at.x, at.y);
        const s = entered ? await stays(ctx.c) : undefined;
        // O legado não tem esse caminho (a Vela não tem EF_VOLATILE); o Go (item.go:627) consome uma
        // unidade e teleporta com a QuestFlag. Registro informativo: passa se o Go faz o que diz.
        const pass = entered && left === 1 && !!s?.stayed;
        return {
          pass, evidence: { from, use: u, left, at, stays: s },
          note: entered
            ? `só no Go: clique direito na Vela (×2) teleportou de (${from.x},${from.y}) para (${at.x},${at.y}), sobrou ${left}, ${s?.stayed ? 'ficou na arena (QuestFlag 1)' : 'o guarda mandou para fora'}`
            : `clique direito na Vela: sem teleporte (sobrou ${left}; notices ${u.notices.join(',') || '—'})`,
        };
      },
    },
    {
      id: 'QST-13',
      title: 'Mestre_Grifo dá a QuestFlag',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, A.level.min); await huntGear(db, n); },
      run: async (ctx) => {
        await goToArmia(ctx.c);
        const t = await talk(ctx, NPC.mestreGrifo);
        const s = t.inArena ? await stays(ctx.c) : undefined;
        const pass = t.inArena && !!s?.stayed && !t.carry.lost.length;
        return {
          pass, evidence: { talk: summary(t), stays: s },
          note: t.inArena
            ? `só no Go: o Mestre_Grifo (MSG_Quest, sem ticket) levou para (${t.final.x},${t.final.y}) na arena do Coveiro e ${s?.stayed ? 'ficou (QuestFlag 1)' : 'o guarda mandou para fora'}`
            : `o Mestre_Grifo ${t.talk.teleport ? `levou para (${t.final.x},${t.final.y}), fora da arena` : 'não teleportou'}`,
        };
      },
    },
    {
      id: 'QST-14',
      title: 'Arch na arena',
      type: 'borda',
      seed: async (db, n) => { await char(db, n, A.level.min, { arch: true }); await huntGear(db, n); await put(db, n, 0, A.ticket); },
      run: async (ctx) => {
        const { t, ok } = await enterWithTicket(ctx);
        const s = ok ? await stays(ctx.c) : undefined;
        const pass = ok && !!s?.stayed;
        return {
          pass, evidence: { handin: summary(t), stays: s },
          note: ok ? `Arch exibido 40: Vela consumida, teleportado para (${t.final.x},${t.final.y}) e ${s?.stayed ? 'ficou na arena' : 'o guarda mandou para fora'}` : `Arch exibido 40 com a Vela: recusa (notices ${t.talk.notices.join(',') || '—'})`,
        };
      },
    },
  ],
};

export default quest;
