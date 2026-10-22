// Interação com NPCs como o cliente: abrir a loja (MSG_REQShopList), comprar (MSG_Buy),
// usar item do inventário (MSG_UseItem) e falar com NPC de quest (MSG_Quest).
import type { GameClient, Mob, Received } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { isSelfTeleport, selfTeleportIn, walkTo } from './movement.ts';
import { dist, sleep } from './util.ts';

export interface NpcSpec {
  name: string;
  merchant: number;
  pos: { x: number; y: number };
  stand: { x: number; y: number };
}

export class NpcError extends Error {}

/** Anda até o lugar do NPC e devolve a entidade dele (pelo nome, ou pelo Merchant mais perto). */
export async function approachNpc(c: GameClient, npc: NpcSpec): Promise<Mob> {
  await walkTo(c, npc.stand.x, npc.stand.y);
  for (let i = 0; i < 10; i++) {
    const near = [...c.mobs.values()].filter((m) => !m.isPlayer && dist(m.x, m.y, npc.pos.x, npc.pos.y) <= 6);
    const found = near.find((m) => m.name === npc.name) ?? near.find((m) => m.merchant === npc.merchant);
    if (found) return found;
    await sleep(500);
  }
  throw new NpcError(`NPC ${npc.name} não apareceu perto de (${npc.pos.x},${npc.pos.y})`);
}

export interface Purchase {
  npc: string;
  item: number;
  npcSlot: number;
  slot: number;
  amount: number;
  coinBefore: number;
  coinAfter: number;
}

/** Abre a loja do NPC, compra o item `index` para um slot livre e espera ele chegar no inventário. */
export async function buyItem(c: GameClient, log: Logger, npc: NpcSpec, index: number): Promise<Purchase> {
  const me = c.self!;
  const ent = await approachNpc(c, npc);
  let since = c.mark;
  c.send(Op.ReqShopList, P.reqShopList(ent.id));
  const list = P.parseShopList((await c.waitType(Op.ShopList, { timeoutMs: 5000, since })).body);
  const offer = list.items.find((it) => it.index === index);
  if (!offer) throw new NpcError(`${npc.name} não vende o item ${index} (loja: ${list.items.map((it) => it.index).join(',')})`);
  const slot = c.freeCarrySlot();
  if (slot < 0) throw new NpcError('inventário cheio');

  const coinBefore = me.coin;
  since = c.mark;
  c.send(Op.Buy, P.buy(ent.id, offer.npcSlot, slot));
  try {
    await c.waitFor((f) => f.header.type === Op.SendItem && P.parseSendItem(f.body).slot === slot, { timeoutMs: 5000, since, what: `item ${index} no slot ${slot}` });
  } catch {
    const msgs = textsIn(c.framesSince(since));
    throw new NpcError(`compra do item ${index} na ${npc.name} sem resposta (gold ${coinBefore}${msgs.length ? `; servidor: ${msgs.join(' | ')}` : ''})`);
  }
  const got = me.carry[slot];
  if (got?.index !== index) throw new NpcError(`compra do item ${index} entregou ${got?.index ?? 0} no slot ${slot}`);
  const p: Purchase = { npc: npc.name, item: index, npcSlot: offer.npcSlot, slot, amount: P.itemAmount(got), coinBefore, coinAfter: me.coin };
  log.info('compra', p as unknown as Record<string, unknown>);
  return p;
}

/** Usa (clique direito) o item do slot; o resultado aparece nos frames seguintes. */
export function useItem(c: GameClient, slot: number): number {
  const me = c.self!;
  const since = c.mark;
  c.send(Op.UseItem, P.useItem(slot, me.x, me.y));
  return since;
}

export interface QuestTalk {
  t: string;
  npc: string;
  npcId: number;
  from: { x: number; y: number };
  teleport?: { from: { x: number; y: number }; to: { x: number; y: number } };
  /** Códigos de MessageBoxOk (NoticeReqNotMet etc.) recebidos. */
  notices: number[];
  texts: string[];
  /** Slots do inventário esvaziados pelo servidor. */
  clearedSlots: number[];
}

/**
 * Fala com o NPC de quest (MSG_Quest) e observa a reação por `waitMs`. `confirm` vai no Parm2: o
 * Rei, o COMP_SEPHI e o Cap.Mercenario só agem com confirm ≠ 0.
 */
export async function talkQuest(c: GameClient, log: Logger, npc: NpcSpec, waitMs = 5000, confirm = 0): Promise<QuestTalk> {
  const me = c.self!;
  const ent = await approachNpc(c, npc);
  await sleep(500);
  const from = { x: me.x, y: me.y };
  const since = c.mark;
  c.send(Op.Quest, P.quest(ent.id, confirm));
  try {
    await c.waitFor((f) => isSelfTeleport(c, f), { timeoutMs: waitMs, since, what: 'teleporte da quest' });
    await sleep(1000); // SendItem e CreateMob do destino
  } catch {
    // sem teleporte: a resposta (se houver) já está nos frames
  }
  const frames = c.framesSince(since);
  const r: QuestTalk = {
    t: new Date().toISOString(),
    npc: npc.name,
    npcId: ent.id,
    from,
    teleport: selfTeleportIn(c, frames),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: textsIn(frames),
    clearedSlots: frames.filter((f) => f.header.type === Op.SendItem).map((f) => P.parseSendItem(f.body)).filter((s) => s.place === P.PLACE_CARRY && s.item.index === 0).map((s) => s.slot),
  };
  log.info(`falou com ${npc.name}`, r as unknown as Record<string, unknown>);
  return r;
}

function textsIn(frames: Received[]): string[] {
  return frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body));
}
