// Quest 05 — Capa do Reino (azul / vermelha) e a borda (docs/quests/05-capa-real.md).
//
// O bot anda de Armia até o castelo de Hekalotia (Guarda_Real e Rei_Harabard) ou até o
// Rei_Glantuar. O Guarda_Real teleporta o Mortal para a área dos Cavaleiros Mortais, que soltam o
// Emblema_do_Reino (4081). O Rei troca o 4081 no Equip[13] (ou safiras 697/4131) pela capa do reino
// no Equip[15]; a partir do armazenado 255 troca a capa sem borda pela com borda. O Rei só age com
// confirm ≠ 0 (talkQuest com confirm 1, o padrão do talkKing do cenário 5). Nível, classe, emblema,
// capa e safiras vêm do banco. Cada caso confere o efeito: posição, Equip[13]/Equip[15], safiras no
// inventário e o banco depois do relog.
import type { GameClient } from '../../client/GameClient.ts';
import { fight } from '../../bot/combat.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { type NpcSpec, talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { reviveAfterDeath } from '../../bot/survival.ts';
import { isInArmia, returnToArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import {
  AREA, CAV_SPAWNS, EMBLEM_MOBS, EQUIP_SLOT, GUARD_LEVEL, HUNT_ATTRS, HUNT_GEAR, HUNT_HP, inArea as inAreaXY, isInArea, ITEM,
  KING_LEVEL, NPC, ROUTE_TO_AKELONIA, ROUTE_TO_AREA, ROUTE_TO_HEKALOTIA, TELEPORT_DEST, TELEPORT_SPREAD,
} from '../../world/quests/05-capa-real.ts';
import { carryOf, diffSlots, type SlotItem } from './helpers.ts';
import type { CaseCtx, QuestSpec } from './runner.ts';

const inArea = (c: GameClient) => inAreaXY(c.self!.x, c.self!.y);
const pos = (c: GameClient) => ({ x: c.self!.x, y: c.self!.y });
const equipAt = (c: GameClient, slot: number) => c.self!.equip[slot]?.index ?? 0;
/** Nível ARMAZENADO da caça (exibido 241): ainda dentro da faixa do Guarda_Real. */
const HUNT_LEVEL = 240;

// ---------------------------------------------------------------- seed

/** Mortal no nível ARMAZENADO dado, com atributos e o equipamento de caça. */
async function char(db: Db, name: string, storedLevel: number): Promise<void> {
  // max_hp é o BaseMaxHP: o Go não o recalcula pelo nível (herança da quest 02).
  await db.setCharacter(name, {
    level: storedLevel, exp: 0, coin: 200_000, class_master: CLASS_MASTER.MORTAL, clan: 0,
    ...HUNT_ATTRS, max_hp: HUNT_HP, hp: HUNT_HP, max_mp: 1000, mp: 1000,
  });
  for (const [slot, index] of Object.entries(HUNT_GEAR)) await db.putItem(name, 'equip', Number(slot), { index });
}

const putEquip = (db: Db, name: string, slot: number, index: number) => db.putItem(name, 'equip', slot, { index });
const putEmblem = (db: Db, name: string) => putEquip(db, name, EQUIP_SLOT.emblema, ITEM.emblemaDoReino);
const putCape = (db: Db, name: string, index: number) => putEquip(db, name, EQUIP_SLOT.capa, index);

/** Preço atual do Rei_Harabard (Hekalotia) em safiras, como o Go o lê (sapphire_balance). */
const hekalotiaPrice = async (db: Db) => (await db.kingdomCapeQuote()).hekalotia;

/** Safiras no inventário a partir do slot 0: `packs` × 4131 e `units` × 697. */
async function putSapphires(db: Db, name: string, packs: number, units: number): Promise<void> {
  let slot = 0;
  for (let i = 0; i < packs; i++) await db.putItem(name, 'carry', slot++, { index: ITEM.pacoteSafiras });
  for (let i = 0; i < units; i++) await db.putItem(name, 'carry', slot++, { index: ITEM.safira });
}

/** Pagamento que o Go aceita (exato): 4131 para as dezenas e 697 para o resto. */
const putExactPayment = async (db: Db, name: string, kingdom: 'hekalotia' | 'akelonia' = 'hekalotia') => {
  const p = kingdom === 'hekalotia' ? await hekalotiaPrice(db) : (await db.kingdomCapeQuote()).akelonia;
  await putSapphires(db, name, Math.floor(p / 10), p % 10);
};

// ---------------------------------------------------------------- ações

/** De Armia (ou de perto) até o lado do NPC. */
async function goTo(ctx: CaseCtx, npc: NpcSpec): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, npc.pos.x, npc.pos.y) <= 40) {
    await walkTo(c, npc.stand.x, npc.stand.y);
    return;
  }
  if (!isInArmia(me.x, me.y)) await returnToArmia(c, ctx.log);
  await walkPath(c, npc === NPC.reiGlantuar ? ROUTE_TO_AKELONIA : ROUTE_TO_HEKALOTIA, { abort: () => me.hp <= 0 });
  if (me.hp <= 0) throw new Error(`morreu no caminho do ${npc.name}`);
  await walkTo(c, npc.stand.x, npc.stand.y);
}

const answer = (n: number[], tx: string[]) => (n.length ? `notices ${n.join(',')}` : tx.length ? `"${tx.join(' | ')}"` : 'sem resposta');
const talkAnswer = (t: QuestTalk) => answer(t.notices, t.texts);

interface GuardTalk {
  talk: QuestTalk;
  final: { x: number; y: number };
  inArea: boolean;
}

async function talkGuard(ctx: CaseCtx): Promise<GuardTalk> {
  await goTo(ctx, NPC.guardaReal);
  const t = await talkQuest(ctx.c, ctx.log, NPC.guardaReal, 6000);
  await sleep(1500);
  return { talk: t, final: pos(ctx.c), inArea: inArea(ctx.c) };
}

const guardSummary = (t: GuardTalk) => ({ from: t.talk.from, teleport: t.talk.teleport, notices: t.talk.notices, texts: t.talk.texts, final: t.final, inArea: t.inArea });

const inTeleportSpread = (p: { x: number; y: number }) =>
  p.x >= TELEPORT_DEST.x + TELEPORT_SPREAD.lo && p.x <= TELEPORT_DEST.x + TELEPORT_SPREAD.hi &&
  p.y >= TELEPORT_DEST.y + TELEPORT_SPREAD.lo && p.y <= TELEPORT_DEST.y + TELEPORT_SPREAD.hi;

/** Estado que o Rei pode mexer: emblema, capa e safiras. */
interface KingState {
  emblema: number;
  capa: number;
  /** Valor das safiras (697 = 1, 4131 = 10). */
  sapphires: number;
  clan?: number;
}

const sapphireValue = (l: { index: number }[]) => l.reduce((n, it) => n + (it.index === ITEM.safira ? 1 : it.index === ITEM.pacoteSafiras ? 10 : 0), 0);
const liveState = (c: GameClient): KingState => ({ emblema: equipAt(c, EQUIP_SLOT.emblema), capa: equipAt(c, EQUIP_SLOT.capa), sapphires: sapphireValue(carryOf(c)) });
const fmtState = (s: KingState) => `Equip[13] ${s.emblema || '—'}, Equip[15] ${s.capa || '—'}, safiras ${s.sapphires}${s.clan !== undefined ? `, clan ${s.clan}` : ''}`;
const sameState = (a: KingState, b: KingState) => a.emblema === b.emblema && a.capa === b.capa && a.sapphires === b.sapphires;

async function savedState(ctx: CaseCtx): Promise<KingState> {
  return ctx.query(async (db, n) => {
    const eq = await db.items(n, 'equip');
    const ca = await db.items(n, 'carry');
    const at = (s: number) => eq.find((x) => x.slot === s)?.index ?? 0;
    return { emblema: at(EQUIP_SLOT.emblema), capa: at(EQUIP_SLOT.capa), sapphires: sapphireValue(ca), clan: (await db.character(n)).clan };
  });
}

interface KingTalk {
  npc: string;
  confirm: number;
  price: { hekalotia: number; akelonia: number };
  talk: QuestTalk;
  before: KingState;
  after: KingState;
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  saved: KingState;
}

/** Fala com o Rei (confirm 0 pergunta, 1 confirma) e confere o efeito na hora e no banco depois do relog. */
async function talkKing(ctx: CaseCtx, npc: NpcSpec, confirm: number): Promise<KingTalk> {
  const quote = await ctx.query((db) => db.kingdomCapeQuote());
  await goTo(ctx, npc);
  const before = liveState(ctx.c), carry0 = carryOf(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 4000, confirm);
  await sleep(2000); // SendItem do Equip/Carry depois da gravação no banco
  const after = liveState(ctx.c);
  const carry = diffSlots(carry0, carryOf(ctx.c));
  await ctx.relog();
  const saved = await savedState(ctx);
  const k: KingTalk = { npc: npc.name, confirm, price: { hekalotia: quote.hekalotia, akelonia: quote.akelonia }, talk: t, before, after, carry, saved };
  ctx.log.info('resultado do Rei', k as unknown as Record<string, unknown>);
  return k;
}

const kingEvidence = (k: KingTalk) => ({ npc: k.npc, confirm: k.confirm, price: k.price, notices: k.talk.notices, texts: k.talk.texts, before: k.before, after: k.after, carry: k.carry, saved: k.saved });
const untouched = (k: KingTalk) => sameState(k.before, k.after) && sameState(k.before, k.saved);
const kingAnswer = (k: KingTalk) => talkAnswer(k.talk);

/** Controle no Rei: nada muda (na hora e no banco). */
function kingControl(k: KingTalk, what: string): { pass: boolean; note: string } {
  const pass = untouched(k);
  return { pass, note: pass ? `${what}: ${kingAnswer(k)}; nada muda (${fmtState(k.after)}, banco igual)` : `${what}: ${fmtState(k.before)} → ${fmtState(k.after)} (banco ${fmtState(k.saved)}), ${kingAnswer(k)}` };
}

/** Troca no Rei: o que o legado deixa no Equip[13]/Equip[15] e nas safiras (na hora e no banco). */
function kingTrade(k: KingTalk, want: { capa: number; emblema: number; sapphires: number }): { pass: boolean; note: string } {
  const ok = (s: KingState) => s.capa === want.capa && s.emblema === want.emblema && s.sapphires === want.sapphires;
  const pass = ok(k.after) && ok(k.saved);
  const exp = `Equip[13] ${want.emblema || '—'}, Equip[15] ${want.capa}, safiras ${want.sapphires}`;
  return {
    pass,
    note: pass
      ? `${fmtState(k.before)} → ${fmtState(k.after)} (banco igual, clan ${k.saved.clan}); preço ${k.price.hekalotia}`
      : `esperado ${exp}; ficou ${fmtState(k.after)} (banco ${fmtState(k.saved)}), ${kingAnswer(k)}; preço ${k.price.hekalotia}`,
  };
}

// ---------------------------------------------------------------- caça do emblema (CR-03)

interface Hunt {
  entries: string[];
  kills: { t: string; mob: string; emblem: boolean }[];
  deaths: number;
  dropAt?: string;
  minutes: number;
}

async function huntEmblem(ctx: CaseCtx, untilMs: number): Promise<Hunt> {
  const c = () => ctx.c;
  const t0 = Date.now();
  const h: Hunt = { entries: [], kills: [], deaths: 0, minutes: 0 };
  while (Date.now() < untilMs && c().findItem(ITEM.emblemaDoReino) < 0) {
    const me = c().self!;
    if (c().isClosed) throw new Error('conexão caiu na caça do emblema');
    if (me.hp <= 0) { h.deaths++; await reviveAfterDeath(c(), ctx.log); continue; }
    if (!inArea(c())) {
      // Pelo Guarda_Real (como um jogador); se ele não mandar, a pé (a área não tem guarda).
      const t = await talkGuard(ctx);
      h.entries.push(t.inArea ? 'guarda' : 'a pé');
      if (!t.inArea) await walkPath(c(), ROUTE_TO_AREA, { abort: () => me.hp <= 0 });
      continue;
    }
    if (me.hp < me.maxHp * 0.4) {
      // Sai da área para o lado do castelo e espera o HP voltar.
      await walkTo(c(), ROUTE_TO_AREA[1].x, ROUTE_TO_AREA[1].y, { abort: () => me.hp <= 0 });
      const r0 = Date.now();
      while (me.hp > 0 && me.hp < me.maxHp * 0.85 && Date.now() - r0 < 60_000) await sleep(2000);
      continue;
    }
    const targets = c().liveMobs()
      .filter((m) => (EMBLEM_MOBS as readonly string[]).includes(m.name) && isInArea(AREA, m.x, m.y))
      .sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = CAV_SPAWNS[Math.floor(Math.random() * CAV_SPAWNS.length)];
      await walkTo(c(), p.x, p.y + 1, { abort: () => me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const m = targets[0];
    const r = await fight(c(), m, { minHpRatio: 0.4, maxSwings: 120 });
    if (r.result === 'killed') {
      await sleep(800);
      const got = c().findItem(ITEM.emblemaDoReino) >= 0;
      h.kills.push({ t: new Date().toISOString(), mob: m.name, emblem: got });
      ctx.log.info('kill na área', { mob: m.name, emblem: got, hp: me.hp, maxHp: me.maxHp });
      if (got) h.dropAt = new Date().toISOString();
    }
  }
  h.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  return h;
}

// ---------------------------------------------------------------- casos

const quest: QuestSpec = {
  id: '05',
  name: 'Capa do Reino (azul / vermelha) e a borda',
  cases: [
    {
      id: 'CR-01',
      title: 'Teleporte abaixo do nível',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, GUARD_LEVEL.min - 1); },
      run: async (ctx) => {
        const t = await talkGuard(ctx);
        const pass = !t.talk.teleport && !t.inArea;
        return { pass, evidence: guardSummary(t), note: pass ? `Mortal exibido 199: recusa (${talkAnswer(t.talk)}), sem teleporte, ficou em (${t.final.x},${t.final.y})` : `exibido 199 teleportado para (${t.final.x},${t.final.y})` };
      },
    },
    {
      id: 'CR-02',
      title: 'Teleporte',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, GUARD_LEVEL.min); },
      run: async (ctx) => {
        const t = await talkGuard(ctx);
        const to = t.talk.teleport?.to;
        const pass = !!to && inTeleportSpread(to) && t.inArea;
        return { pass, evidence: guardSummary(t), note: pass ? `Mortal exibido 200: teleportado para (${to!.x},${to!.y}), na área dos Cav._Mortal` : `exibido 200: ${to ? `teleportou para (${to.x},${to.y})` : `sem teleporte (${talkAnswer(t.talk)})`}` };
      },
    },
    {
      id: 'CR-03',
      title: 'Drop do emblema',
      type: 'feliz',
      timeoutMs: 20 * 60_000,
      seed: async (db, n) => { await char(db, n, HUNT_LEVEL); },
      run: async (ctx) => {
        const h = await huntEmblem(ctx, Date.now() + 15 * 60_000);
        const slot = ctx.c.findItem(ITEM.emblemaDoReino);
        const byMob = h.kills.reduce<Record<string, number>>((m, k) => ((m[k.mob] = (m[k.mob] ?? 0) + 1), m), {});
        const ev = { hunt: h, byMob, damage: ctx.c.self!.damage, maxHp: ctx.c.self!.maxHp };
        if (slot < 0) return { pass: false, evidence: ev, note: `${h.minutes} min, kills ${JSON.stringify(byMob)}, ${h.deaths} morte(s), sem o 4081` };
        const k = h.kills.find((x) => x.emblem);
        return { pass: true, evidence: ev, note: `o 4081 caiu no inventário (slot ${slot}) ao matar ${k?.mob ?? '?'}; ${h.kills.length} kill(s) ${JSON.stringify(byMob)}, ${h.deaths} morte(s), ${h.minutes} min com a viagem` };
      },
    },
    {
      id: 'CR-04',
      title: 'Rei abaixo do nível',
      type: 'controle',
      // Emblema e pagamento exato: só o nível pode barrar (no Go também).
      seed: async (db, n) => { await char(db, n, KING_LEVEL.cape - 1); await putEmblem(db, n); await putExactPayment(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingControl(k, 'Mortal exibido 219 com o 4081 e as safiras');
        return { pass: r.pass, evidence: kingEvidence(k), note: r.note };
      },
    },
    {
      id: 'CR-05',
      title: 'Preço (ask)',
      type: 'feliz',
      // Com o emblema e o pagamento exato: o confirm 0 tem de só informar o preço.
      seed: async (db, n) => { await char(db, n, KING_LEVEL.cape); await putEmblem(db, n); await putExactPayment(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 0);
        const priced = k.talk.texts.some((t) => (t.match(/\d+/g) ?? ([] as string[])).includes(String(k.price.hekalotia)));
        const pass = priced && untouched(k);
        return {
          pass, evidence: kingEvidence(k),
          note: pass
            ? `confirm 0: ${kingAnswer(k)} (preço ${k.price.hekalotia} no sapphire_balance); nada muda (${fmtState(k.after)}, banco igual)`
            : `confirm 0: ${kingAnswer(k)}, preço ${k.price.hekalotia}; ${fmtState(k.before)} → ${fmtState(k.after)} (banco ${fmtState(k.saved)})`,
        };
      },
    },
    {
      id: 'CR-06',
      title: 'Capa pelo emblema',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, KING_LEVEL.cape); await putEmblem(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingTrade(k, { emblema: 0, capa: ITEM.mantoHekalotia, sapphires: 0 });
        return { pass: r.pass, evidence: kingEvidence(k), note: `exibido 220, 4081 e sem safiras: ${r.note}` };
      },
    },
    {
      id: 'CR-07',
      title: 'Sem emblema e sem safira',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, KING_LEVEL.cape); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const priced = k.talk.texts.some((t) => (t.match(/\d+/g) ?? ([] as string[])).includes(String(k.price.hekalotia)));
        const r = kingControl(k, 'exibido 220, sem 4081 e sem safiras');
        return { pass: r.pass, evidence: { ...kingEvidence(k), priced }, note: r.note };
      },
    },
    {
      id: 'CR-08',
      title: 'Rei do outro reino',
      type: 'controle',
      // Capa de Hekalotia no Rei de Akelonia, com nível de borda, 4081 e safiras: só o reino barra.
      seed: async (db, n) => { await char(db, n, KING_LEVEL.border); await putCape(db, n, ITEM.mantoHekalotia); await putEmblem(db, n); await putExactPayment(db, n, 'akelonia'); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiGlantuar, 1);
        const r = kingControl(k, '545 no Rei_Glantuar (exibido 256, 4081 e safiras)');
        return { pass: r.pass, evidence: kingEvidence(k), note: r.note };
      },
    },
    {
      id: 'CR-09',
      title: 'Capa já com borda',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, KING_LEVEL.border); await putCape(db, n, ITEM.mantoDoGuerreiro); await putEmblem(db, n); await putExactPayment(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingControl(k, '543 no Rei_Harabard (exibido 256, 4081 e safiras)');
        return { pass: r.pass, evidence: kingEvidence(k), note: r.note };
      },
    },
    {
      id: 'CR-10',
      title: 'Borda antes do nível',
      type: 'controle',
      // 4081 e pagamento exato: só o nível barra a borda.
      seed: async (db, n) => { await char(db, n, KING_LEVEL.border - 1); await putCape(db, n, ITEM.mantoHekalotia); await putEmblem(db, n); await putExactPayment(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingControl(k, '545, exibido 255, 4081 e safiras');
        return { pass: r.pass, evidence: kingEvidence(k), note: r.note };
      },
    },
    {
      id: 'CR-11',
      title: 'Borda pelo emblema',
      type: 'feliz',
      seed: async (db, n) => { await char(db, n, KING_LEVEL.border); await putCape(db, n, ITEM.mantoHekalotia); await putEmblem(db, n); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingTrade(k, { emblema: 0, capa: ITEM.mantoDoGuerreiro, sapphires: 0 });
        return { pass: r.pass, evidence: kingEvidence(k), note: `545, exibido 256, 4081 e sem safiras: ${r.note}` };
      },
    },
    {
      id: 'CR-12',
      title: 'Pagamento em safiras',
      type: 'feliz',
      // Pacotes 4131 que cobrem o preço com sobra (o legado consome o 4131 inteiro).
      seed: async (db, n) => { await char(db, n, KING_LEVEL.cape); await putSapphires(db, n, Math.ceil((await hekalotiaPrice(db)) / 10), 0); },
      run: async (ctx) => {
        const k = await talkKing(ctx, NPC.reiHarabard, 1);
        const r = kingTrade(k, { emblema: 0, capa: ITEM.mantoHekalotia, sapphires: 0 });
        if (r.pass) return { pass: true, evidence: kingEvidence(k), note: `${k.before.sapphires / 10} × 4131: ${r.note}` };
        // Evidência para a issue: com o pagamento exato (697) o Go entrega.
        await ctx.reseed(async (db, n) => { await db.clearItem(n, 'carry', 0); await putExactPayment(db, n); });
        const exact = await talkKing(ctx, NPC.reiHarabard, 1);
        const ex = kingTrade(exact, { emblema: 0, capa: ITEM.mantoHekalotia, sapphires: 0 });
        return {
          pass: false, evidence: { surplus: kingEvidence(k), exact: { ...kingEvidence(exact), ok: ex.pass } },
          note: `${k.before.sapphires / 10} × 4131 (valor ${k.before.sapphires}, preço ${k.price.hekalotia}): ${r.note}. Com ${exact.before.sapphires} × 697 (exato): ${ex.pass ? 'entrega' : 'não entrega'} — ${ex.note}`,
        };
      },
    },
    {
      id: 'CR-13',
      title: 'Mortal acima de 254 no Guarda',
      type: 'controle',
      seed: async (db, n) => { await char(db, n, GUARD_LEVEL.max); },
      run: async (ctx) => {
        const t = await talkGuard(ctx);
        const pass = !t.talk.teleport && !t.inArea;
        return { pass, evidence: guardSummary(t), note: pass ? `Mortal exibido 255: recusa (${talkAnswer(t.talk)}), sem teleporte, ficou em (${t.final.x},${t.final.y})` : `exibido 255 teleportado para (${t.final.x},${t.final.y})` };
      },
    },
  ],
};

export default quest;
