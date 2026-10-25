// Suíte 15 — PvP em Armia e duelo 1x1 (docs/quests/15-pvp-duelo.md).
//
// Cada caso: o personagem do runner é A (o atacante/desafiante, um TK forte semeado) e uma segunda conta nova é B
// (a vítima/desafiado, nível 50 com EXP no meio da faixa). Os dois andam até o ponto do caso, lado a lado:
// - arena de Armia: as células 0x40 do AttributeMap no norte da cidade (2124–2147, 2140–2155);
// - praça de Armia (tile 0x01) e campo a leste (tile 0x00, fora dos limites da cidade).
// O critério é o do legado (pedido do usuário: exigir o legado); o Go está anotado em cada caso.
// O HP da vítima vem do cliente dela; o ponto caos (nick) vem do MobName[12] dos CreateMob; a EXP e o CP
// salvos vêm do banco depois do logout.
import type { GameClient } from '../../client/GameClient.ts';
import { sleep } from '../../bot/util.ts';
import {
  acceptDuel, framesOf, killPlayer, landed, placePair, recordMessages, requestDuel, seeEachOther, setPkMode, swingAt, waitTeleport, type Swing,
} from '../../bot/pvp.ts';
import { walkTo } from '../../bot/movement.ts';
import type { Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { AREA, DUEL, GO_NOTICE, inArea, lostPkArena, PATH, PK_GUILTY_NICK, PK_NEUTRAL, SEED, SPOT, TEXT } from '../../world/quests/15-pvp-duelo.ts';
import { secondChar } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

// ---------------------------------------------------------------- sementes

interface Fighter {
  level: number;
  exp?: number;
  str: number;
  dex: number;
  con: number;
  int: number;
}

/** Espera o servidor salvar o personagem depois de sair (como o runner). */
const SAVE_GRACE_MS = 6000;

async function seedFighter(db: Db, name: string, f: Fighter, extra: Parameters<Db['setCharacter']>[1] = {}): Promise<void> {
  // max_hp é o BaseMaxHP (o Go não o recalcula pelo nível, quest 02).
  const hp = f.level >= 200 ? 8000 : 900;
  await db.setCharacter(name, {
    level: f.level, exp: f.exp ?? 0, str: f.str, dex: f.dex, con: f.con, int: f.int,
    max_hp: hp, hp, max_mp: 500, mp: 500, coin: 1000, clan: 0, pk_point: PK_NEUTRAL, guilty: 0, ...extra,
  });
}

const attackerSeed = (extra: Parameters<Db['setCharacter']>[1] = {}) => (db: Db, n: string) => seedFighter(db, n, SEED.attacker, extra);
const victimSeed = (extra: Parameters<Db['setCharacter']>[1] = {}) => (db: Db, n: string) => seedFighter(db, n, SEED.victim, extra);

// ---------------------------------------------------------------- dupla

interface Pair {
  a: GameClient;
  b: GameClient;
  aName: string;
  bName: string;
  ctx: CaseCtx;
}

/** Leva a segunda conta (B) ao mundo, roda `fn` e fecha B no fim. */
async function withPair<T>(ctx: CaseCtx, seedB: (db: Db, n: string) => Promise<void>, fn: (p: Pair) => Promise<T>): Promise<T> {
  const b = await secondChar(ctx, seedB);
  try {
    return await fn({ a: ctx.c, b: b.c, aName: ctx.char, bName: b.name, ctx });
  } finally {
    b.c.close();
  }
}

type Place = 'armiaArena' | 'armiaPlaza' | 'field';

/** A e B lado a lado no lugar do caso; erro se não se virem (falha do bot, não do jogo). */
async function place(p: Pair, where: Place): Promise<{ a: { x: number; y: number }; b: { x: number; y: number } }> {
  const path = where === 'armiaArena' ? PATH.armiaArena : where === 'field' ? PATH.field : [];
  const ok = await placePair(p.a, p.b, SPOT[where], path);
  const pos = { a: { x: p.a.self!.x, y: p.a.self!.y }, b: { x: p.b.self!.x, y: p.b.self!.y } };
  p.ctx.log.info('posição', { where, ...pos, seen: ok });
  if (!ok) throw new Error(`A e B não se viram em ${where} (${JSON.stringify(pos)})`);
  return pos;
}

/** CreateMob de A ou B com o nick vermelho (MobName[12] = 0) nos dois clientes desde as marcas. */
function guiltyMarks(p: Pair, since: { a: number; b: number }): { a: boolean; b: boolean; frames: { on: string; id: number; pk: number }[] } {
  const idA = p.a.self!.clientId, idB = p.b.self!.clientId;
  const frames: { on: string; id: number; pk: number }[] = [];
  for (const [on, c, s] of [['A', p.a, since.a], ['B', p.b, since.b]] as const) {
    for (const f of framesOf(c, s, Op.CreateMob)) {
      if (f.body.length < 152) continue;
      const m = P.parseCreateMob(f.body);
      if ((m.id === idA || m.id === idB) && m.pkPoint !== undefined) frames.push({ on, id: m.id === idA ? 0 : 1, pk: m.pkPoint });
    }
  }
  return { a: frames.some((x) => x.id === 0 && x.pk === PK_GUILTY_NICK), b: frames.some((x) => x.id === 1 && x.pk === PK_GUILTY_NICK), frames };
}

const fmtSwings = (ss: Swing[]) => ss.map((s) => `${s.echoDamage ?? '—'}:${s.hpBefore}→${s.hpAfter}`).join(' ');

/** Golpes de A em B com o K de cada um como pedido; devolve os golpes e as marcas de Guilty. */
async function strike(p: Pair, o: { kA: boolean; kB: boolean; swings: number }) {
  const pkA = o.kA ? await setPkMode(p.a, true) : undefined;
  const pkB = o.kB ? await setPkMode(p.b, true) : undefined;
  await sleep(500);
  const since = { a: p.a.mark, b: p.b.mark };
  const swings = await swingAt(p.a, p.b, o.swings);
  await sleep(1500);
  return { pkInfoA: pkA, pkInfoB: pkB, swings, landed: landed(swings), guilty: guiltyMarks(p, since) };
}

// ---------------------------------------------------------------- morte

/** Lê do banco a EXP de B e o pk_point de A, depois de os dois saírem (o logout grava). */
async function savedAfterLogout(p: Pair): Promise<{ bExp: number; aPk: number; aGuilty: number }> {
  p.b.close();
  p.a.close();
  await sleep(SAVE_GRACE_MS);
  const b = await p.ctx.query((db) => db.character(p.bName));
  const a = await p.ctx.query((db) => db.character(p.aName));
  return { bExp: Number(b.exp), aPk: Number(a.pk_point), aGuilty: Number(a.guilty) };
}

// ---------------------------------------------------------------- duelo

interface DuelStart {
  forwarded?: { id: number; parm1: number; parm2: number };
  tpA?: { x: number; y: number; at: string };
  tpB?: { x: number; y: number; at: string };
  startTimeA?: number;
  startTimeB?: number;
  startedAt?: string;
}

const near = (pt: { x: number; y: number } | undefined, want: { x: number; y: number }, r = 2) => !!pt && Math.abs(pt.x - want.x) <= r && Math.abs(pt.y - want.y) <= r;

/** A desafia B e B aceita; espera os teleportes para a arena e o StartTime. */
async function startDuel(p: Pair): Promise<DuelStart> {
  const r: DuelStart = {};
  r.forwarded = await requestDuel(p.a, p.b);
  if (!r.forwarded) return r;
  const since = { a: p.a.mark, b: p.b.mark };
  acceptDuel(p.b, p.a);
  [r.tpA, r.tpB] = await Promise.all([waitTeleport(p.a, AREA.duelArena, 8000, since.a), waitTeleport(p.b, AREA.duelArena, 8000, since.b)]);
  r.startedAt = r.tpA?.at ?? r.tpB?.at;
  await sleep(1500);
  const st = (c: GameClient, s: number) => framesOf(c, s, Op.StartTime).map((f) => P.parseStandardParm(f.body))[0];
  r.startTimeA = st(p.a, since.a);
  r.startTimeB = st(p.b, since.b);
  p.ctx.log.info('duelo', { ...r });
  return r;
}

const started = (d: DuelStart) => near(d.tpA, DUEL.requesterSpawn) && near(d.tpB, DUEL.accepterSpawn);

/** A encosta em B dentro da arena (B fica no spawn dele). */
async function closeIn(p: Pair): Promise<boolean> {
  const b = p.b.self!;
  await walkTo(p.a, b.x - 1, b.y);
  return seeEachOther(p.a, p.b);
}

/** Espera o fim do duelo: o teleporte de saída de A (e de B, se `both`). */
async function waitDuelEnd(p: Pair, timeoutMs: number, since = { a: p.a.mark, b: p.b.mark }, both = true) {
  const exitBox = { x1: DUEL.exit.x - 3, y1: DUEL.exit.y - 3, x2: DUEL.exit.x + 3, y2: DUEL.exit.y + 3 };
  const [exitA, exitB] = await Promise.all([
    waitTeleport(p.a, exitBox, timeoutMs, since.a),
    both && !p.b.isClosed ? waitTeleport(p.b, exitBox, timeoutMs, since.b) : Promise.resolve(undefined),
  ]);
  return { exitA, exitB };
}

const textsOf = (m: { texts: { text: string }[] }) => m.texts.map((t) => t.text);
const has = (m: { texts: { text: string }[] }, re: RegExp) => m.texts.some((t) => re.test(t.text));
const noticesOf = (m: { notices: { code: number }[] }) => m.notices.map((n) => n.code);

// ---------------------------------------------------------------- casos

function pvpInPlace(where: Place, o: { kA: boolean; kB: boolean; swings: number }, judge: (s: Awaited<ReturnType<typeof strike>>) => { pass: boolean; expected: string }) {
  return (ctx: CaseCtx): Promise<CaseResult> =>
    withPair(ctx, victimSeed(), async (p) => {
      const pos = await place(p, where);
      const s = await strike(p, o);
      const j = judge(s);
      return {
        pass: j.pass,
        evidence: { pos, ...s },
        note: `esperado (legado): ${j.expected}; golpes (eco:hp) ${fmtSwings(s.swings)}; Guilty A ${s.guilty.a} B ${s.guilty.b}; PKInfo A ${s.pkInfoA ?? '—'} B ${s.pkInfoB ?? '—'}`,
      };
    });
}

const quest: QuestSpec = {
  id: '15',
  name: 'PvP em Armia e duelo 1x1',
  cases: [
    // ------------------------------------------------ PvP em Armia
    {
      id: 'PV-01',
      title: 'Arena de Armia: A sem K golpeia B sem K',
      type: 'controle',
      seed: attackerSeed(),
      run: pvpInPlace('armiaArena', { kA: false, kB: false, swings: 5 }, (s) => ({ pass: !s.landed, expected: 'nenhum golpe tira HP (tile 0x40, alvo sem K)' })),
    },
    {
      id: 'PV-02',
      title: 'Arena de Armia: A com K golpeia B sem K',
      type: 'controle',
      seed: attackerSeed(),
      // Legado: _MSG_Attack.cpp:405-419 bloqueia (tile do atacante 0x40, alvo sem PKMode e sem Guilty).
      // Go: combat.go:223 só olha o K do atacante → o golpe entra.
      run: pvpInPlace('armiaArena', { kA: true, kB: false, swings: 5 }, (s) => ({ pass: !s.landed, expected: 'nenhum golpe tira HP (tile 0x40, alvo sem K)' })),
    },
    {
      id: 'PV-03',
      title: 'Arena de Armia: A e B com K, A golpeia B',
      type: 'feliz',
      seed: attackerSeed(),
      run: pvpInPlace('armiaArena', { kA: true, kB: true, swings: 4 }, (s) => ({ pass: s.landed, expected: 'o golpe tira HP (alvo com K libera o tile 0x40)' })),
    },
    {
      id: 'PV-04',
      title: 'Arena de Armia: golpe com K dos dois não deixa ninguém Guilty',
      type: 'controle',
      seed: attackerSeed(),
      // Legado: o "PK - War - Miss" só roda fora de cidade (BASE_GetVillage = 5); a arena está nos limites de Armia.
      // Go: combat.go:313 marca os dois Guilty em qualquer lugar.
      run: pvpInPlace('armiaArena', { kA: true, kB: true, swings: 4 }, (s) => ({
        pass: s.landed && !s.guilty.a && !s.guilty.b,
        expected: 'o golpe entra e nenhum CreateMob de A/B chega com MobName[12] = 0 (sem nick vermelho)',
      })),
    },
    {
      id: 'PV-05',
      title: 'Arena de Armia: A mata B (os dois com K)',
      type: 'feliz',
      seed: attackerSeed(),
      timeoutMs: 6 * 60_000,
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'armiaArena');
          await setPkMode(p.a, true);
          await setPkMode(p.b, true);
          const msgA = recordMessages(p.a), msgB = recordMessages(p.b);
          const expBefore = Number(p.b.self!.exp);
          const k = await killPlayer(p.a, p.b);
          await sleep(4000);
          const aPkSeen = p.a.self!.pkPoint;
          // Vítima revive: MSG_Restart → HP 2 na cidade (legado _MSG_Restart.cpp).
          let revive: { hp: number; x: number; y: number } | undefined;
          if (k.killed) {
            const since = p.b.mark;
            p.b.send(Op.Restart, Buffer.alloc(0));
            await p.b.waitType([Op.UpdateScore, Op.SetHpMp], { timeoutMs: 8000, since }).catch(() => undefined);
            await sleep(2000);
            revive = { hp: p.b.self!.hp, x: p.b.self!.x, y: p.b.self!.y };
          }
          msgA.stop(); msgB.stop();
          const saved = await savedAfterLogout(p);
          const wantPk = PK_NEUTRAL + lostPkArena(PK_NEUTRAL);
          const crit = {
            morreu: k.killed,
            semPerdaDeExp: saved.bExp === expBefore,
            avisoSemPerda: has(msgB, TEXT.noExpLoss),
            cpDoMatador: saved.aPk === wantPk,
            revive: !!revive && revive.hp > 0 && inArea(AREA.armia, revive.x, revive.y),
          };
          return {
            pass: Object.values(crit).every(Boolean),
            evidence: { pos, crit, swings: k.swings, expBefore, saved, aPkSeen, revive, textsA: msgA.texts, textsB: msgB.texts, noticesB: msgB.notices },
            note: `esperado (legado, MobKilled.cpp:3131-3228): B recebe "Na arena não há perda de EXP" e não perde EXP; A fica com CP ${wantPk} (${lostPkArena(PK_NEUTRAL)}); B revive em Armia. ` +
              `Visto: ${JSON.stringify(crit)}; EXP de B ${expBefore} → ${saved.bExp}; pk_point de A ${saved.aPk}; textos de B ${JSON.stringify(textsOf(msgB))}; textos de A ${JSON.stringify(textsOf(msgA))}`,
          };
        }),
    },
    {
      id: 'PV-06',
      title: 'Praça de Armia (fora da arena): A com K golpeia B sem K',
      type: 'borda',
      seed: attackerSeed(),
      // Legado: a praça é tile 0x01 (sem o 0x40), então o servidor não bloqueia; e na cidade ninguém fica Guilty.
      // Go: o golpe entra (#67) e combat.go:313 marca os dois Guilty.
      run: pvpInPlace('armiaPlaza', { kA: true, kB: false, swings: 4 }, (s) => ({
        pass: s.landed && !s.guilty.a && !s.guilty.b,
        expected: 'o golpe entra (tile 0x01) e ninguém fica Guilty (dentro da cidade)',
      })),
    },
    {
      id: 'PV-07',
      title: 'Campo fora de Armia: A com K golpeia B neutro',
      type: 'feliz',
      seed: attackerSeed(),
      run: pvpInPlace('field', { kA: true, kB: false, swings: 4 }, (s) => ({
        pass: s.landed && s.guilty.a && s.guilty.b,
        expected: 'o golpe entra e os dois ficam Guilty (CreateMob com MobName[12] = 0 de A e de B)',
      })),
    },
    {
      id: 'PV-08',
      title: 'Campo: A com CP ≤ 10 golpeia B neutro',
      type: 'borda',
      seed: attackerSeed({ pk_point: 10 }),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'field');
          const msgA = recordMessages(p.a);
          const s = await strike(p, { kA: true, kB: false, swings: 4 });
          msgA.stop();
          const told = has(msgA, TEXT.cantKillUser);
          return {
            pass: !s.landed && told,
            evidence: { pos, ...s, textsA: msgA.texts },
            note: `esperado (legado, _MSG_Attack.cpp:1373-1378): dano 0 e "_DN_CantKillUser"; golpes ${fmtSwings(s.swings)}; textos de A ${JSON.stringify(textsOf(msgA))}`,
          };
        }),
    },
    {
      id: 'PV-09',
      title: 'Ligar o K com a troca aberta',
      type: 'borda',
      seed: attackerSeed(),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'armiaPlaza');
          const idA = p.a.self!.clientId, idB = p.b.self!.clientId;
          // A abre a troca e B responde: os dois ficam com Trade.OpponentID um do outro.
          const sinceB = p.b.mark;
          p.a.send(Op.Trade, P.trade({ items: [], money: 1, check: false, opponentId: idB }));
          const opened = await p.b.waitType(Op.Trade, { timeoutMs: 5000, since: sinceB }).then(() => true, () => false);
          const sinceA0 = p.a.mark;
          p.b.send(Op.Trade, P.trade({ items: [], money: 1, check: false, opponentId: idA }));
          const answered = await p.a.waitType(Op.Trade, { timeoutMs: 5000, since: sinceA0 }).then(() => true, () => false);
          const msgA = recordMessages(p.a), msgB = recordMessages(p.b);
          const since = { a: p.a.mark, b: p.b.mark };
          const pkOn = await setPkMode(p.a, true);
          await sleep(1500);
          const pkOff = await setPkMode(p.a, false);
          msgA.stop(); msgB.stop();
          const quitA = framesOf(p.a, since.a, Op.QuitTrade).length > 0, quitB = framesOf(p.b, since.b, Op.QuitTrade).length > 0;
          const tradeMsg = /troca n.o fica dispon.vel com o modo PK/;
          const crit = { trocaAberta: opened && answered, pkInfoLigado: pkOn === 1, pkInfoDesligado: pkOff === 0, fechouA: quitA, fechouB: quitB, avisoA: has(msgA, tradeMsg), avisoB: has(msgB, tradeMsg) };
          return {
            pass: Object.values(crit).every(Boolean),
            evidence: { pos, crit, textsA: msgA.texts, textsB: msgB.texts },
            note: `esperado (legado, _MSG_PKMode.cpp): "_NN_Cant_trade_pkmode" aos dois, troca fechada e PKInfo 1/0; visto ${JSON.stringify(crit)}`,
          };
        }),
    },

    // ------------------------------------------------ duelo 1x1
    {
      id: 'DU-01',
      title: 'Declaração de duelo 1x1 fora da cidade',
      type: 'feliz',
      seed: attackerSeed(),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'field');
          const fw = await requestDuel(p.a, p.b);
          const idA = p.a.self!.clientId, idB = p.b.self!.clientId;
          const pass = !!fw && fw.parm1 === idA && fw.parm2 === P.DUEL_REQUEST;
          return {
            pass,
            evidence: { pos, forwarded: fw, idA, idB },
            note: `esperado (legado, _MSG_ReqRanking.cpp:42-49): B recebe 0x039F com Parm1 = ${idA} (A), Parm2 = 0; recebido ${fw ? JSON.stringify(fw) : 'nada'}`,
          };
        }),
    },
    {
      id: 'DU-02',
      title: 'Aceite do duelo: arena, aviso e contador',
      type: 'feliz',
      seed: attackerSeed(),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'field');
          const msgA = recordMessages(p.a), msgB = recordMessages(p.b);
          const d = await startDuel(p);
          await sleep(1000);
          msgA.stop(); msgB.stop();
          const crit = {
            teleporteA: near(d.tpA, DUEL.requesterSpawn),
            teleporteB: near(d.tpB, DUEL.accepterSpawn),
            startTime: d.startTimeA === DUEL.startTime && d.startTimeB === DUEL.startTime,
            avisoInicio: has(msgA, TEXT.battleStarted) && has(msgB, TEXT.battleStarted),
          };
          return {
            pass: Object.values(crit).every(Boolean),
            evidence: { pos, ...d, crit, textsA: msgA.texts, textsB: msgB.texts },
            note: `esperado (legado, DoRanking Server.cpp:8991-9019): A em (147,4044), B em (189,4044), StartTime ${DUEL.startTime} e "Batalha entre … foi iniciada" aos dois. ` +
              `Visto: A ${JSON.stringify(d.tpA)}, B ${JSON.stringify(d.tpB)}, StartTime ${d.startTimeA}/${d.startTimeB}, textos A ${JSON.stringify(textsOf(msgA))} B ${JSON.stringify(textsOf(msgB))}`,
          };
        }),
    },
    {
      id: 'DU-03',
      title: 'Duelo: A com K golpeia B sem K',
      type: 'borda',
      seed: attackerSeed(),
      timeoutMs: 6 * 60_000,
      // Legado: a arena do duelo é tile 0x44 (tem o 0x40): sem o K do alvo o golpe é zerado como na arena de Armia.
      // Go: dueling() libera o golpe sem olhar o alvo (combat.go:223).
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const d = await startDuel(p);
          if (!started(d)) return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` };
          if (!(await closeIn(p))) throw new Error('A não chegou ao lado de B na arena');
          const s = await strike(p, { kA: true, kB: false, swings: 5 });
          return {
            pass: !s.landed,
            evidence: { ...d, ...s },
            note: `esperado (legado): nenhum golpe tira HP (tile 0x44, alvo sem K); golpes ${fmtSwings(s.swings)}`,
          };
        }),
    },
    {
      id: 'DU-04',
      title: 'Duelo: A mata B',
      type: 'feliz',
      seed: attackerSeed(),
      timeoutMs: 6 * 60_000,
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const d = await startDuel(p);
          if (!started(d)) return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` };
          if (!(await closeIn(p))) throw new Error('A não chegou ao lado de B na arena');
          await setPkMode(p.a, true);
          await setPkMode(p.b, true);
          const msgA = recordMessages(p.a), msgB = recordMessages(p.b);
          const expBefore = Number(p.b.self!.exp);
          const since = { a: p.a.mark, b: p.b.mark };
          const k = await killPlayer(p.a, p.b);
          const killedAt = Date.now();
          // Legado: a liveness roda a cada ~10 s; o ClearAreaTeleport vem logo depois.
          const end = await waitDuelEnd(p, 30_000, since);
          await sleep(2000);
          const bHp = p.b.self!.hp;
          msgA.stop(); msgB.stop();
          const saved = await savedAfterLogout(p);
          const winRe = (w: string, l: string) => (t: string) => { const m = TEXT.winBy.exec(t); return !!m && m[1] === w && m[2] === l; };
          const crit = {
            morreu: k.killed,
            saidaA: !!end.exitA,
            saidaB: !!end.exitB,
            hpDeBApos: bHp > 0,
            avisoVencedor: textsOf(msgA).some(winRe(p.aName, p.bName)) && textsOf(msgB).some(winRe(p.aName, p.bName)),
            avisoSemPerda: has(msgB, TEXT.noExpLoss),
            semPerdaDeExp: saved.bExp === expBefore,
          };
          return {
            pass: Object.values(crit).every(Boolean),
            evidence: { ...d, crit, swings: k.swings, endS: end.exitA ? (Date.parse(end.exitA.at) - killedAt) / 1000 : undefined, ...end, bHp, expBefore, saved, textsA: msgA.texts, textsB: msgB.texts, noticesA: msgA.notices, noticesB: msgB.notices },
            note: `esperado (legado, ProcessRanking/ClearAreaTeleport): "${p.aName} é o vencedor, ${p.bName} é o perdedor" aos dois, os dois em (2572,1752), B com HP 1 e sem perda de EXP ("Na arena não há perda de EXP"). ` +
              `Visto: ${JSON.stringify(crit)}; HP de B ${bHp}; avisos Go A ${JSON.stringify(noticesOf(msgA))} B ${JSON.stringify(noticesOf(msgB))}; textos B ${JSON.stringify(textsOf(msgB))}`,
          };
        }),
    },
    {
      id: 'DU-05',
      title: 'Duelo: B sai do jogo no meio',
      type: 'controle',
      seed: attackerSeed(),
      timeoutMs: 6 * 60_000,
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const d = await startDuel(p);
          if (!started(d)) return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` };
          const msgA = recordMessages(p.a);
          const since = { a: p.a.mark, b: p.b.mark };
          p.b.close();
          const end = await waitDuelEnd(p, 30_000, since, false);
          await sleep(1000);
          msgA.stop();
          const won = textsOf(msgA).some((t) => { const m = TEXT.winBy.exec(t); return !!m && m[1] === p.aName; });
          return {
            pass: !!end.exitA && won,
            evidence: { ...d, ...end, textsA: msgA.texts, noticesA: msgA.notices },
            note: `esperado (legado): A vence ("${p.aName} é o vencedor…") e vai para (2572,1752); visto saída ${JSON.stringify(end.exitA)}, textos ${JSON.stringify(textsOf(msgA))}, avisos Go ${JSON.stringify(noticesOf(msgA))}`,
          };
        }),
    },
    {
      id: 'DU-06',
      title: 'Duelo: B sai da caixa da arena',
      type: 'controle',
      seed: attackerSeed(),
      timeoutMs: 6 * 60_000,
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const d = await startDuel(p);
          if (!started(d)) return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` };
          const msgA = recordMessages(p.a);
          const since = { a: p.a.mark, b: p.b.mark };
          // Para de andar se o servidor tirar B do mapa do duelo (fim do duelo) ou depois de 40 s (muro/tile bloqueado).
          const walkUntil = Date.now() + 40_000;
          const leftMap = () => Math.abs(p.b.self!.y - DUEL.accepterSpawn.y) > 200 || Date.now() > walkUntil;
          await walkTo(p.b, AREA.duelArena.x2 + 6, DUEL.accepterSpawn.y, { abort: leftMap }).catch(() => false);
          const end = await waitDuelEnd(p, 30_000, since, false);
          await sleep(1000);
          msgA.stop();
          const won = textsOf(msgA).some((t) => { const m = TEXT.winBy.exec(t); return !!m && m[1] === p.aName; });
          return {
            pass: !!end.exitA && won,
            evidence: { ...d, ...end, bPos: { x: p.b.self!.x, y: p.b.self!.y }, textsA: msgA.texts, noticesA: msgA.notices },
            note: `esperado (legado, ProcessRanking conta só quem está na caixa): A vence e vai para (2572,1752); visto saída ${JSON.stringify(end.exitA)}, textos ${JSON.stringify(textsOf(msgA))}, avisos Go ${JSON.stringify(noticesOf(msgA))}`,
          };
        }),
    },
    {
      id: 'DU-07',
      title: 'Duelo com a arena ocupada',
      type: 'controle',
      seed: attackerSeed(),
      timeoutMs: 8 * 60_000,
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const d = await startDuel(p);
          if (!started(d)) return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` };
          // Segundo par (C desafia D) enquanto A e B estão na arena.
          const c = await secondChar(ctx, victimSeed());
          const dd = await secondChar(ctx, victimSeed());
          try {
            const q: Pair = { a: c.c, b: dd.c, aName: c.name, bName: dd.name, ctx };
            await place(q, 'field');
            const msgC = recordMessages(c.c), msgD = recordMessages(dd.c);
            const fw = await requestDuel(c.c, dd.c);
            const since = { c: c.c.mark, d: dd.c.mark };
            acceptDuel(dd.c, c.c);
            const tp = await waitTeleport(c.c, AREA.duelArena, 6000, since.c);
            msgC.stop(); msgD.stop();
            const crit = { pedidoRepassado: !!fw, semTeleporte: !tp, avisoC: has(msgC, TEXT.battleInProgress), avisoD: has(msgD, TEXT.battleInProgress) };
            return {
              pass: Object.values(crit).every(Boolean),
              evidence: { ...d, crit, forwarded: fw, tpC: tp, textsC: msgC.texts, textsD: msgD.texts, noticesC: msgC.notices, noticesD: msgD.notices },
              note: `esperado (legado, _MSG_ReqRanking.cpp:62-67): "Há uma partida em progresso." para C e D, sem teleporte; visto ${JSON.stringify(crit)}, avisos Go C ${JSON.stringify(noticesOf(msgC))} (Go: ${GO_NOTICE.battleInProgress})`,
            };
          } finally {
            c.c.close();
            dd.c.close();
          }
        }),
    },
    {
      id: 'DU-08',
      title: 'Declarar e aceitar o duelo dentro de Armia',
      type: 'borda',
      seed: attackerSeed(),
      // Legado: _MSG_ReqRanking.cpp não olha a posição. Go: duel.go:110/140 recusa na cidade (NoticeDuelInCity, #118 "UNVERIFIED").
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'armiaPlaza');
          const msgA = recordMessages(p.a);
          const d = await startDuel(p);
          msgA.stop();
          return {
            pass: !!d.forwarded && started(d),
            evidence: { pos, ...d, noticesA: msgA.notices, textsA: msgA.texts },
            note: `esperado (legado): o pedido chega a B e o aceite leva os dois à arena; visto pedido ${JSON.stringify(d.forwarded)}, A ${JSON.stringify(d.tpA)}, B ${JSON.stringify(d.tpB)}, avisos Go A ${JSON.stringify(noticesOf(msgA))} (Go cidade: ${GO_NOTICE.duelInCity})`,
          };
        }),
    },
    {
      id: 'DU-09',
      title: 'Aceite forjado sem pedido',
      type: 'controle',
      seed: attackerSeed(),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'field');
          const since = { a: p.a.mark, b: p.b.mark };
          // B "aceita" um duelo que A nunca pediu.
          acceptDuel(p.b, p.a);
          const [tpA, tpB] = await Promise.all([waitTeleport(p.a, AREA.duelArena, 6000, since.a), waitTeleport(p.b, AREA.duelArena, 6000, since.b)]);
          return {
            pass: !tpA && !tpB,
            evidence: { pos, tpA, tpB },
            note: `esperado (legado, RankingTarget != conn → return): ninguém vai para a arena; visto A ${JSON.stringify(tpA)}, B ${JSON.stringify(tpB)}`,
          };
        }),
    },
    {
      id: 'DU-10',
      title: 'Duelo sem vencedor até o fim do tempo',
      type: 'borda',
      seed: attackerSeed(),
      timeoutMs: 10 * 60_000,
      // Legado: RankingTime 121 com um decremento a cada 2 s (≈242 s), muro com SetHpDam 0x018A e EnvEffect 32,
      // empate "_SS_S_S_Draw" aos dois. Go: duelTicks 121 a 1 s (≈121 s), muro só com SetHpMp, aviso 37.
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          await place(p, 'field');
          const since = { a: p.a.mark, b: p.b.mark };
          const msgA = recordMessages(p.a), msgB = recordMessages(p.b);
          const d = await startDuel(p);
          if (!started(d)) { msgA.stop(); msgB.stop(); return { pass: false, evidence: { ...d }, note: `o duelo não começou: ${JSON.stringify(d)}` }; }
          const t0 = Date.parse(d.startedAt!);
          // Os dois ficam parados no spawn; o resultado chega como texto (legado) ou aviso (Go).
          const deadline = Date.now() + 330_000;
          const isEnd = () => has(msgA, TEXT.draw) || has(msgA, TEXT.winBy) || msgA.notices.some((n) => n.code >= GO_NOTICE.duelWin && n.code <= GO_NOTICE.duelDraw);
          while (Date.now() < deadline && !isEnd()) await sleep(2000);
          const endAt = msgA.texts.find((t) => TEXT.draw.test(t.text) || TEXT.winBy.test(t.text))?.t ?? msgA.notices.find((n) => n.code >= GO_NOTICE.duelWin)?.t;
          await sleep(3000);
          msgA.stop(); msgB.stop();
          const durationS = endAt ? Math.round((Date.parse(endAt) - t0) / 1000) : undefined;
          const env = framesOf(p.a, since.a, Op.EnvEffect).map((f) => P.parseEnvEffect(f.body).effect);
          const hpDam = framesOf(p.a, since.a, Op.SetHpDam).length + framesOf(p.b, since.b, Op.SetHpDam).length;
          const crit = {
            empateA: has(msgA, TEXT.draw),
            empateB: has(msgB, TEXT.draw),
            duracao: durationS !== undefined && Math.abs(durationS - DUEL.legacyDurationS) <= 15,
            muro: env.includes(DUEL.wallEffect),
          };
          return {
            pass: Object.values(crit).every(Boolean),
            evidence: { ...d, crit, durationS, envEffects: env.length, hpDamFrames: hpDam, textsA: msgA.texts, noticesA: msgA.notices, noticesB: msgB.notices },
            note: `esperado (legado): empate "Este jogo com … finalizou em empate" aos dois em ≈${DUEL.legacyDurationS} s, com o muro (EnvEffect ${DUEL.wallEffect}); ` +
              `visto ${JSON.stringify(crit)}, ${durationS ?? '—'} s, ${env.length} EnvEffect, ${hpDam} SetHpDam, avisos Go A ${JSON.stringify(noticesOf(msgA))}`,
          };
        }),
    },
    {
      id: 'DU-11',
      title: 'Desafiar quem bloqueou sussurros',
      type: 'controle',
      seed: attackerSeed(),
      run: (ctx) =>
        withPair(ctx, victimSeed(), async (p) => {
          const pos = await place(p, 'field');
          // B digita /whisper: o chat "whisper" alterna o bloqueio (_MSG_MessageChat.cpp:105, chat.go:26).
          p.b.send(Op.MessageChat, P.chat('whisper'));
          await sleep(1500);
          const msgA = recordMessages(p.a);
          const fw = await requestDuel(p.a, p.b, 4000);
          msgA.stop();
          return {
            pass: !fw && has(msgA, TEXT.denyWhisper),
            evidence: { pos, forwarded: fw, textsA: msgA.texts, noticesA: msgA.notices },
            note: `esperado (legado, _MSG_ReqRanking.cpp:31-35): sem repasse e "Não é possível sussurrar para este jogador." para A; visto repasse ${JSON.stringify(fw)}, textos ${JSON.stringify(textsOf(msgA))}, avisos Go ${JSON.stringify(noticesOf(msgA))} (Go: ${GO_NOTICE.denyWhisper})`,
          };
        }),
    },
  ],
};

export default quest;
