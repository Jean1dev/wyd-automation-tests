// Repro: "disconnect from server" ao caminhar de Azran até os Coliseus.
// Coliseu: Regions.txt:19 {2589,1671,2681,1785}; os blocos "Coliseu N" do NPCGener.txt (Ciclopes)
// ficam em ~(2627-2635,1726). O Go popula esses geradores no boot (main.go spawnNPCs), e a fila de
// saída por sessão tem 64 frames (world.go enqueue): cheia, o servidor derruba a conexão.
//
// Cada caso: Grifo até o Jardim dos Deuses → Azran → centro do Coliseu → volta para Azran, gravando
// onde a conexão caiu, os frames por segundo antes da queda e os avisos do servidor.
import type { GameClient, Received } from '../../client/GameClient.ts';
import type { Logger } from '../../client/logger.ts';
import { walkPath, type WalkOptions } from '../../bot/movement.ts';
import { griffTravel, isInArmia, returnToArmia } from '../../bot/travel.ts';
import { CLASS_MASTER } from '../../db/seed.ts';
import { Op, opName } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import type { Point } from '../../world/coveiro.ts';
import { GRIFF_WARP, ROUTE_TO_AZRAN } from '../../world/quests/08-circulo-divino.ts';
import type { CaseCtx, CaseResult, QuestCase, QuestSpec } from './runner.ts';

/** Regions.txt:19 — o retângulo do Coliseu. */
const COLISEU = { x1: 2589, y1: 1671, x2: 2681, y2: 1785 };
const NO_DB = process.argv.includes('--no-db');
const inColiseu = (x: number, y: number) => x >= COLISEU.x1 && x <= COLISEU.x2 && y >= COLISEU.y1 && y <= COLISEU.y2;

/** Do fim do ROUTE_TO_AZRAN (2510,1730) até o centro dos geradores do Coliseu. */
const ROUTE_TO_COLISEU: Point[] = [{ x: 2560, y: 1726 }, { x: 2589, y: 1726 }, { x: 2610, y: 1726 }, { x: 2630, y: 1726 }];
const ROUTE_BACK: Point[] = [{ x: 2589, y: 1726 }, { x: 2560, y: 1726 }, { x: 2510, y: 1730 }];

interface Probe {
  /** Frames recebidos por segundo (epoch s → contagem). */
  perSec: Map<number, { n: number; byOp: Record<string, number> }>;
  texts: string[];
  notices: number[];
  closed?: { t: string; at: number; pos: Point; hp: number; leg: string };
  maxMobsInView: number;
}

function attach(c: GameClient, legRef: { leg: string }): Probe {
  const p: Probe = { perSec: new Map(), texts: [], notices: [], maxMobsInView: 0 };
  c.on('frame', (f: Received) => {
    const s = Math.floor(f.at / 1000);
    const b = p.perSec.get(s) ?? { n: 0, byOp: {} };
    b.n++;
    const op = opName(f.header.type);
    b.byOp[op] = (b.byOp[op] ?? 0) + 1;
    p.perSec.set(s, b);
    if (f.header.type === Op.MessageBoxOk && f.body.length >= 4) p.notices.push(P.parseNotice(f.body));
    p.maxMobsInView = Math.max(p.maxMobsInView, c.mobs.size);
  });
  c.on('text', (t: { text: string }) => p.texts.push(t.text));
  c.once('close', () => {
    const me = c.self!;
    p.closed = { t: new Date().toISOString(), at: Date.now(), pos: { x: me.x, y: me.y }, hp: me.hp, leg: legRef.leg };
  });
  return p;
}

function burst(p: Probe) {
  const secs = [...p.perSec.entries()].sort((a, b) => a[0] - b[0]);
  const peak = secs.reduce((m, e) => (e[1].n > (m?.[1].n ?? -1) ? e : m), secs[0]);
  const end = p.closed ? Math.floor(p.closed.at / 1000) : secs.at(-1)?.[0] ?? 0;
  return {
    peak: peak && { t: new Date(peak[0] * 1000).toISOString(), frames: peak[1].n, byOp: peak[1].byOp },
    lastSeconds: secs.filter(([s]) => s > end - 6).map(([s, b]) => ({ t: new Date(s * 1000).toISOString(), frames: b.n, byOp: b.byOp })),
  };
}

interface Variant {
  stepTiles?: number;
  /** Pausa a leitura do socket por N ms ao pisar na borda do Coliseu (cliente lento). */
  slowReadMs?: number;
  /** Como o cliente legado: Action/Attack de uma entidade desconhecida → MSG_NoViewMob(id). */
  noViewMob?: boolean;
}

/** Responde como o cliente legado a frames de entidades que ele não conhece; devolve o contador. */
function emulateNoViewMob(c: GameClient): { sent: number; ids: Set<number> } {
  const st = { sent: 0, ids: new Set<number>() };
  const about = new Set<number>([Op.Action, Op.Action2, Op.Action3, Op.Attack, Op.AttackOne, Op.AttackTwo]);
  c.on('frame', (f: Received) => {
    const id = f.header.id;
    if (!about.has(f.header.type) || c.isClosed || !c.self || id === c.self.clientId || id <= 0 || c.mobs.has(id)) return;
    const b = Buffer.alloc(4);
    b.writeInt32LE(id, 0);
    c.send(Op.NoViewMob, b);
    st.sent++;
    st.ids.add(id);
  });
  return st;
}

async function walkColiseu(ctx: CaseCtx, v: Variant): Promise<CaseResult> {
  const c = ctx.c;
  const log: Logger = ctx.log;
  const me = c.self!;
  const legRef = { leg: 'grifo' };
  const probe = attach(c, legRef);
  const nvm = v.noViewMob ? emulateNoViewMob(c) : undefined;
  const lowHp = () => me.hp > 0 && me.hp < me.maxHp * 0.3;
  const opts: WalkOptions = { stepTiles: v.stepTiles, abort: () => c.isClosed || me.hp <= 0 || lowHp() };
  const legs: { leg: string; from: Point; to: Point; ok: boolean; t: string }[] = [];

  const leg = async (name: string, pts: Point[], stepTiles?: number): Promise<boolean> => {
    legRef.leg = name;
    const from = { x: me.x, y: me.y };
    let ok = false;
    try {
      ok = await walkPath(c, pts, stepTiles ? { ...opts, stepTiles } : opts);
    } catch (e) {
      // walkTo lança ao enviar com a conexão fechada.
      if (!c.isClosed) throw e;
    }
    legs.push({ leg: name, from, to: { x: me.x, y: me.y }, ok, t: new Date().toISOString() });
    log.info('trecho', { leg: name, ok, x: me.x, y: me.y, hp: me.hp, mobs: c.mobs.size });
    return ok;
  };

  if (!isInArmia(me.x, me.y)) await returnToArmia(c, log);
  await griffTravel(c, log, GRIFF_WARP.jardimDosDeuses);
  // Sem seed (nível 1) o campo do Jardim mata em segundos: salta até Azran (o servidor não valida o caminho).
  let ok = await leg('jardim→azran', ROUTE_TO_AZRAN, NO_DB ? 400 : undefined);
  if (ok) {
    if (v.slowReadMs) {
      ok = await leg('azran→borda', ROUTE_TO_COLISEU.slice(0, 1));
      if (ok) {
        log.info('pausando leitura do socket', { ms: v.slowReadMs });
        c.pauseReading(v.slowReadMs);
        ok = await leg('borda→centro (leitura pausada)', ROUTE_TO_COLISEU.slice(1));
      }
    } else {
      ok = await leg('azran→centro', ROUTE_TO_COLISEU);
    }
  }
  if (ok) ok = await leg('centro→azran', ROUTE_BACK);
  // Dá tempo do servidor derrubar uma fila cheia que ainda esteja drenando.
  if (ok) await new Promise((r) => setTimeout(r, 5000));

  const evidence = {
    variant: v,
    legs,
    closed: probe.closed,
    died: me.hp <= 0,
    lowHp: lowHp(),
    reachedColiseu: legs.some((l) => inColiseu(l.to.x, l.to.y)),
    maxMobsInView: probe.maxMobsInView,
    texts: probe.texts,
    notices: probe.notices,
    frames: burst(probe),
    noViewMob: nvm && { sent: nvm.sent, distinctIds: nvm.ids.size },
  };
  if (probe.closed || c.isClosed) {
    const at = probe.closed;
    return { pass: false, evidence, note: `conexão caiu em ${at?.t} no trecho "${at?.leg}" em (${at?.pos.x},${at?.pos.y}), hp ${at?.hp}` };
  }
  if (me.hp <= 0 || evidence.lowHp) {
    return { pass: false, evidence, note: `inconclusivo: ${me.hp <= 0 ? 'morreu' : 'HP baixo'} em (${me.x},${me.y}) antes de terminar a rota` };
  }
  return { pass: ok, evidence, note: ok ? `ida e volta ao Coliseu sem queda (pico ${evidence.frames.peak?.frames ?? 0} frames/s, até ${probe.maxMobsInView} mobs à vista)` : 'rota interrompida' };
}

async function seedChar(db: Parameters<NonNullable<QuestCase['seed']>>[0], char: string): Promise<void> {
  await db.setCharacter(char, { level: 199, exp: 0, coin: 1_000_000, class_master: CLASS_MASTER.MORTAL, max_hp: 20000, hp: 20000 });
}

const TIMEOUT = 15 * 60_000;
/** --no-db: sem seed (personagem nível 1); a caminhada para se o HP cair. */
const seed = NO_DB ? undefined : seedChar;

const quest: QuestSpec = {
  id: '90',
  name: 'Caminhada até os Coliseus (Azran) sem queda de conexão',
  cases: [
    { id: 'CL-01', title: 'Ritmo normal (passos de 4 tiles) até o centro do Coliseu e volta', type: 'feliz', seed, timeoutMs: TIMEOUT, run: (ctx) => walkColiseu(ctx, {}) },
    { id: 'CL-02', title: 'Passos de 1 tile até o centro do Coliseu e volta', type: 'borda', seed, timeoutMs: TIMEOUT, run: (ctx) => walkColiseu(ctx, { stepTiles: 1 }) },
    { id: 'CL-04', title: 'Como o cliente legado: pede NoViewMob de cada entidade desconhecida', type: 'borda', seed, timeoutMs: TIMEOUT, run: (ctx) => walkColiseu(ctx, { noViewMob: true }) },
    { id: 'CL-05', title: 'Passos de 7 tiles (como o cliente com velocidade 6) até o centro do Coliseu e volta', type: 'borda', seed, timeoutMs: TIMEOUT, run: (ctx) => walkColiseu(ctx, { stepTiles: 7 }) },
    { id: 'CL-03', title: 'Cliente lento: leitura pausada 2 s ao entrar no Coliseu', type: 'borda', seed, timeoutMs: TIMEOUT, run: (ctx) => walkColiseu(ctx, { slowReadMs: 2000 }) },
  ],
};

export default quest;
