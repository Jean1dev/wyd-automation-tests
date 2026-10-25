// PvP entre dois bots: tecla K (MSG_PKMode), golpe corpo a corpo num jogador (MSG_AttackOne) e o duelo 1x1
// (MSG_ReqRanking). O HP da vítima é lido do cliente DELA (SetHpMp/eco do ataque), que é o que o servidor
// afirmou; o eco do atacante só diz o dano que o servidor escreveu no Dam[].
import type { GameClient, Received } from '../client/GameClient.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { type Area, inArea } from '../world/quests/15-pvp-duelo.ts';
import { isSelfTeleport, walkPath, walkTo } from './movement.ts';
import { sleep } from './util.ts';

/** O servidor recusa golpes com menos de 800 ms entre si; folga como no combat.ts. */
const SWING_MS = 1100;
const lastTick = new WeakMap<GameClient, number>();

/** Liga/desliga o K e devolve o Parm do PKInfo (0x0166) que o servidor mandou para o próprio personagem. */
export async function setPkMode(c: GameClient, on: boolean): Promise<number | undefined> {
  const me = c.self!;
  const since = c.mark;
  c.send(Op.PKMode, P.pkMode(on));
  try {
    const f = await c.waitFor((x) => x.header.type === Op.PKInfo && x.header.id === me.clientId, { timeoutMs: 5000, since, what: 'PKInfo' });
    return P.parseStandardParm(f.body);
  } catch {
    return undefined;
  }
}

/** Leva A ao ponto (pelo caminho) e B um tile a leste; espera um ver o outro. */
export async function placePair(a: GameClient, b: GameClient, spot: { x: number; y: number }, path: readonly { x: number; y: number }[] = []): Promise<boolean> {
  await Promise.all([
    walkPath(a, [...path.slice(0, -1), spot]),
    walkPath(b, [...path.slice(0, -1).map((p) => ({ x: p.x + 1, y: p.y })), { x: spot.x + 1, y: spot.y }]),
  ]);
  return seeEachOther(a, b);
}

/** Espera A e B se verem (CreateMob de um no cliente do outro). */
export async function seeEachOther(a: GameClient, b: GameClient, timeoutMs = 8000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (a.mobs.has(b.self!.clientId) && b.mobs.has(a.self!.clientId)) return true;
    await sleep(300);
  }
  return false;
}

export interface Swing {
  t: string;
  /** Dano que o servidor escreveu no Dam[] do eco (undefined: sem eco ou sem a entrada do alvo). */
  echoDamage?: number;
  /** TargetID que voltou no eco (o legado zera o TargetID do golpe bloqueado). */
  echoTarget?: number;
  /** HP da vítima no cliente dela antes e depois do golpe. */
  hpBefore: number;
  hpAfter: number;
}

/** Um golpe corpo a corpo de A em B, como o cliente: MSG_AttackOne com Dam = damMelee. */
export async function hitPlayer(a: GameClient, b: GameClient): Promise<Swing> {
  const me = a.self!, them = b.self!;
  const hpBefore = them.hp;
  let tick = a.tick();
  const prev = lastTick.get(a) ?? 0;
  if (tick < prev + 850) tick = prev + 850;
  lastTick.set(a, tick);
  const since = a.mark;
  a.send(Op.AttackOne, P.attack({ attackerId: me.clientId, posX: me.x, posY: me.y, targetId: them.clientId, targetX: them.x, targetY: them.y }), { tick });
  const s: Swing = { t: new Date().toISOString(), hpBefore, hpAfter: hpBefore };
  try {
    const echo = await a.waitFor(
      (f) => (f.header.type === Op.Attack || f.header.type === Op.AttackOne || f.header.type === Op.AttackTwo) && f.body.length >= 56 && f.body.readUInt16LE(30) === me.clientId,
      { timeoutMs: 3000, since, what: 'eco do ataque' },
    );
    const dam = P.parseAttack(echo.body).dam;
    const d = dam.find((x) => x.targetId === them.clientId) ?? dam[0];
    s.echoDamage = d?.damage;
    s.echoTarget = d?.targetId;
  } catch {
    // Sem eco: o servidor descartou o golpe inteiro.
  }
  // O SetHpMp da vítima chega logo depois do eco.
  await sleep(600);
  s.hpAfter = them.hp;
  return s;
}

/** `n` golpes de A em B, parando se B morrer. */
export async function swingAt(a: GameClient, b: GameClient, n: number): Promise<Swing[]> {
  const out: Swing[] = [];
  for (let i = 0; i < n && b.self!.hp > 0; i++) {
    out.push(await hitPlayer(a, b));
    await sleep(SWING_MS - 600);
  }
  return out;
}

/** Algum golpe tirou HP da vítima. */
export const landed = (ss: Swing[]) => ss.some((s) => s.hpAfter < s.hpBefore || (s.echoDamage ?? 0) > 0);

/** Golpeia até B morrer (HP 0 no cliente dela). */
export async function killPlayer(a: GameClient, b: GameClient, maxSwings = 25): Promise<{ killed: boolean; swings: Swing[] }> {
  const swings = await swingAt(a, b, maxSwings);
  return { killed: b.self!.hp <= 0, swings };
}

/** Grava textos (MessagePanel/MessageChat) e avisos (MessageBoxOk) que chegam ao cliente. */
export function recordMessages(c: GameClient): { texts: { t: string; text: string }[]; notices: { t: string; code: number }[]; stop: () => void } {
  const texts: { t: string; text: string }[] = [];
  const notices: { t: string; code: number }[] = [];
  const onText = (e: { text: string }) => texts.push({ t: new Date().toISOString(), text: e.text });
  const onNotice = (e: { code: number }) => notices.push({ t: new Date().toISOString(), code: e.code });
  c.on('text', onText);
  c.on('notice', onNotice);
  return { texts, notices, stop: () => { c.off('text', onText); c.off('notice', onNotice); } };
}

/** Pedido de duelo de A para B; devolve o 0x039F que o servidor repassou a B (ou undefined). */
export async function requestDuel(a: GameClient, b: GameClient, timeoutMs = 5000): Promise<{ id: number; parm1: number; parm2: number } | undefined> {
  const since = b.mark;
  a.send(Op.ReqRanking, P.reqRanking(b.self!.clientId, P.DUEL_REQUEST));
  try {
    const f = await b.waitType(Op.ReqRanking, { timeoutMs, since });
    return { id: f.header.id, ...P.parseStandardParm2(f.body) };
  } catch {
    return undefined;
  }
}

/** B aceita o duelo que A pediu (Parm1 = A, Parm2 = 4). */
export function acceptDuel(b: GameClient, a: GameClient): void {
  b.send(Op.ReqRanking, P.reqRanking(a.self!.clientId, P.DUEL_ACCEPT));
}

/** Espera um teleporte forçado do próprio personagem que termine dentro de `area`. */
export async function waitTeleport(c: GameClient, area: Area, timeoutMs: number, since = c.mark): Promise<{ x: number; y: number; at: string } | undefined> {
  try {
    const f = await c.waitFor((x) => isSelfTeleport(c, x) && inArea(area, P.parseAction(x.body).targetX, P.parseAction(x.body).targetY), { timeoutMs, since, what: 'teleporte' });
    const a = P.parseAction(f.body);
    return { x: a.targetX, y: a.targetY, at: new Date(f.at).toISOString() };
  } catch {
    return undefined;
  }
}

/** Frames de um tipo desde `since`, com a hora de chegada. */
export function framesOf(c: GameClient, since: number, type: number): Received[] {
  return c.framesSince(since).filter((f) => f.header.type === type);
}

/** Anda até o ponto (atalho para quando só um dos dois se move). */
export async function goTo(c: GameClient, p: { x: number; y: number }): Promise<void> {
  await walkTo(c, p.x, p.y);
}
