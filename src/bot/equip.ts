// Equipamento como o cliente: comprar na loja, arrastar do inventário para o slot do
// equipamento (MSG_TradingItem 0x0376) e vender a peça que saiu (MSG_Sell 0x037A).
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { approachNpc, NpcError, type NpcSpec } from './npc.ts';

export interface EquipResult {
  t: string;
  item: number;
  fromSlot: number;
  equipSlot: number;
  /** Item que estava no slot e voltou para o inventário (0 = nenhum). */
  replaced: number;
  before: { damage: number; ac: number; maxHp: number; attrs: P.Attributes };
  after: { damage: number; ac: number; maxHp: number; attrs: P.Attributes };
  /** Avisos (MessageBoxOk) recebidos: o servidor recusa com NoticeReqNotMet. */
  notices: number[];
  ok: boolean;
}

const snapshot = (c: GameClient) => {
  const me = c.self!;
  return { damage: me.damage, ac: me.ac, maxHp: me.maxHp, attrs: { ...me.attrs } };
};

/**
 * Move o item do slot `fromSlot` do inventário para o Equip[`equipSlot`]. O servidor confere
 * nPos e requisito (item.go tradingItem), troca os dois slots, ecoa o pedido e manda o score novo.
 */
export async function equipFromCarry(c: GameClient, log: Logger, fromSlot: number, equipSlot: number): Promise<EquipResult> {
  const me = c.self!;
  const item = me.carry[fromSlot]?.index ?? 0;
  if (!item) throw new NpcError(`slot ${fromSlot} do inventário está vazio`);
  const replaced = me.equip[equipSlot]?.index ?? 0;
  const before = snapshot(c);
  const since = c.mark;
  c.send(Op.TradingItem, P.tradingItem({ place: P.PLACE_CARRY, slot: fromSlot }, { place: P.PLACE_EQUIP, slot: equipSlot }));
  try {
    // O servidor pode mandar o UpdateScore antes do eco do TradingItem: espera o eco (ou o aviso de recusa).
    const first = await c.waitFor((f) => f.header.type === Op.MessageBoxOk || f.header.type === Op.TradingItem, {
      timeoutMs: 5000, since, what: `equipar o item ${item}`,
    });
    if (first.header.type === Op.TradingItem) {
      await c.waitFor((f) => f.header.type === Op.UpdateScore && f.header.id === me.clientId, {
        timeoutMs: 2000, since, what: `score depois de equipar o item ${item}`,
      });
    }
  } catch {
    // sem resposta: registrado abaixo
  }
  const frames = c.framesSince(since);
  const notices = frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body));
  const r: EquipResult = {
    t: new Date().toISOString(), item, fromSlot, equipSlot, replaced, before, after: snapshot(c), notices,
    ok: me.equip[equipSlot]?.index === item && frames.some((f) => f.header.type === Op.TradingItem),
  };
  log.info(r.ok ? 'item equipado' : 'equipar recusado', r as unknown as Record<string, unknown>);
  return r;
}

export interface Sale {
  npc: string;
  item: number;
  slot: number;
  coinBefore: number;
  coinAfter: number;
}

/** Vende o item do slot do inventário para o NPC mercador e espera o slot esvaziar. */
export async function sellItem(c: GameClient, log: Logger, npc: NpcSpec, slot: number): Promise<Sale> {
  const me = c.self!;
  const item = me.carry[slot]?.index ?? 0;
  if (!item) throw new NpcError(`slot ${slot} do inventário está vazio`);
  const ent = await approachNpc(c, npc);
  const coinBefore = me.coin;
  const since = c.mark;
  c.send(Op.Sell, P.sell(ent.id, slot));
  try {
    await c.waitFor((f) => f.header.type === Op.UpdateEtc, { timeoutMs: 5000, since, what: `venda do item ${item}` });
  } catch {
    throw new NpcError(`venda do item ${item} na ${npc.name} sem resposta`);
  }
  const s: Sale = { npc: npc.name, item, slot, coinBefore, coinAfter: me.coin };
  log.info('venda', s as unknown as Record<string, unknown>);
  return s;
}
