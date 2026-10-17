// Troca entre dois jogadores como o cliente faz (MSG_Trade, handler/trade.go):
//   1. A abre a troca com a sua oferta; o servidor repassa para B (OpponentID = A);
//   2. B responde com a oferta dele; o servidor repassa para A;
//   3. A confirma (MyCheck = 1, mesma oferta): A recebe CNFCheck e B recebe a oferta marcada;
//   4. B confirma: o servidor troca tudo de uma vez, manda o UpdateCarry (inventário + gold)
//      aos dois e fecha a troca com QuitTrade.
// Um QuitTrade antes do passo 4 é recusa do servidor.
import type { GameClient, Received } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';

export interface TradeSide {
  c: GameClient;
  /** Slots do inventário oferecidos. */
  slots: number[];
  money: number;
}

export type TradeStep = 'open' | 'answer' | 'checkA' | 'checkB';

export interface TradeResult {
  completed: boolean;
  /** Passo em que o servidor cancelou a troca ou parou de responder. */
  failedAt?: TradeStep;
  reason?: string;
  /** O que cada lado recebeu do servidor como oferta do outro (o repasse). */
  forwardedToA?: P.TradeOffer;
  forwardedToB?: P.TradeOffer;
  /** Os dois receberam UpdateCarry depois da última confirmação. */
  carryUpdated: { a: boolean; b: boolean };
}

export class TradeError extends Error {}

const STEP_TIMEOUT = 5000;

function offerOf(side: TradeSide, opponentId: number, check: boolean): P.TradeOffer {
  const carry = side.c.self!.carry;
  return {
    items: side.slots.map((slot) => {
      if (!carry[slot]?.index) throw new TradeError(`slot ${slot} vazio no inventário de ${side.c.self!.name}`);
      return { slot, item: carry[slot] };
    }),
    money: side.money,
    check,
    opponentId,
  };
}

/**
 * Espera `pred` em `on`, ou um QuitTrade de recusa em qualquer um dos dois lados. O QuitTrade que
 * vem depois do UpdateCarry é o fechamento normal da troca concluída, não recusa.
 */
async function expect(on: GameClient, other: GameClient, since: [number, number], pred: (f: Received) => boolean, what: string): Promise<Received | 'quit'> {
  const refused = (c: GameClient, s: number) => (f: Received) =>
    f.header.type === Op.QuitTrade && !c.framesSince(s).some((x) => x.header.type === Op.UpdateCarry && x.seq < f.seq);
  const quit = (c: GameClient, s: number) => c.waitFor(refused(c, s), { timeoutMs: STEP_TIMEOUT, since: s, what: 'QuitTrade' }).then(() => 'quit' as const);
  const hit = on.waitFor(pred, { timeoutMs: STEP_TIMEOUT, since: since[0], what });
  // O QuitTrade só conta se chegar antes do frame esperado; os timeouts dele são ignorados.
  const quits = Promise.any([quit(on, since[0]), quit(other, since[1])]).catch(() => new Promise<never>(() => {}));
  return Promise.race([hit, quits]);
}

/** Faz a troca completa entre A e B e devolve o que o servidor respondeu em cada passo. */
export async function performTrade(a: TradeSide, b: TradeSide, log: Logger): Promise<TradeResult> {
  const idA = a.c.self!.clientId;
  const idB = b.c.self!.clientId;
  const result: TradeResult = { completed: false, carryUpdated: { a: false, b: false } };
  const isTradeFrom = (id: number, check?: boolean) => (f: Received) =>
    f.header.type === Op.Trade && f.body.length >= P.TRADE_BODY_SIZE && P.parseTrade(f.body).opponentId === id && (check === undefined || P.parseTrade(f.body).check === check);

  const step = async (name: TradeStep, from: TradeSide, to: TradeSide, offer: P.TradeOffer, pred: (f: Received) => boolean, on: GameClient): Promise<Received | undefined> => {
    const since: [number, number] = on === a.c ? [a.c.mark, b.c.mark] : [b.c.mark, a.c.mark];
    from.c.send(Op.Trade, P.trade(offer));
    log.info('troca: enviado', { step: name, by: from.c.self!.name, items: offer.items.map((it) => ({ slot: it.slot, index: it.item.index })), money: offer.money, check: offer.check });
    try {
      const r = await expect(on, on === a.c ? b.c : a.c, since, pred, `troca ${name}`);
      if (r === 'quit') {
        Object.assign(result, { failedAt: name, reason: 'o servidor cancelou a troca (QuitTrade)' });
        return undefined;
      }
      return r;
    } catch (e) {
      Object.assign(result, { failedAt: name, reason: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  };

  const opened = await step('open', a, b, offerOf(a, idB, false), isTradeFrom(idA), b.c);
  if (!opened) return result;
  result.forwardedToB = P.parseTrade(opened.body);

  const answered = await step('answer', b, a, offerOf(b, idA, false), isTradeFrom(idB), a.c);
  if (!answered) return result;
  result.forwardedToA = P.parseTrade(answered.body);

  const checked = await step('checkA', a, b, offerOf(a, idB, true), (f) => f.header.type === Op.CNFCheck, a.c);
  if (!checked) return result;

  const sinceA = a.c.mark;
  const sinceB = b.c.mark;
  const done = await step('checkB', b, a, offerOf(b, idA, true), (f) => f.header.type === Op.UpdateCarry, b.c);
  if (!done) return result;
  result.carryUpdated.b = true;
  try {
    await a.c.waitType(Op.UpdateCarry, { timeoutMs: STEP_TIMEOUT, since: sinceA });
    result.carryUpdated.a = true;
  } catch {
    Object.assign(result, { failedAt: 'checkB', reason: `${a.c.self!.name} não recebeu o UpdateCarry depois da troca` });
    return result;
  }
  // A troca fecha com QuitTrade nos dois lados; a falta dele só é registrada.
  for (const [c, since] of [[a.c, sinceA], [b.c, sinceB]] as const) {
    await c.waitType(Op.QuitTrade, { timeoutMs: STEP_TIMEOUT, since }).catch(() => log.warn('troca concluída sem QuitTrade', { char: c.self!.name }));
  }
  result.completed = true;
  log.info('troca concluída', { a: a.c.self!.name, b: b.c.self!.name, coinA: a.c.self!.coin, coinB: b.c.self!.coin });
  return result;
}
