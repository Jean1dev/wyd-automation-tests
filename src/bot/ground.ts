// Itens no chão: largar do inventário (MSG_DropItem) e pegar de volta (MSG_GetItem).
//
// O servidor Go não manda o MSG_CreateItem do item largado (item.go dropItem: "UNVERIFIED ... deferred"),
// então o bot não sabe o id do chão. `pickUpNear` sonda os ids em ordem: o Go devolve DecayItem para id
// vazio/estático, ignora item longe (> 3 tiles) e responde CNFGetItem ao pegar. Ids são alocados do menor
// livre (world/items.go CreateGroundItem), depois dos portões estáticos do InitItem.csv.
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

export const GROUND_ID_OFFSET = 10000;

/** Larga o item do slot `slot` aos pés do personagem. Devolve true se veio o CNFDropItem. */
export async function dropAtFeet(c: GameClient, slot: number, log?: Logger): Promise<boolean> {
  const me = c.self!;
  const since = c.mark;
  c.send(Op.DropItem, P.dropItem(slot, me.x, me.y));
  try {
    await c.waitFor((f) => f.header.type === Op.CNFDropItem, { timeoutMs: 4000, since, what: 'CNFDropItem' });
    me.carry[slot] = { ...me.carry[slot], index: 0, eff: [] };
    log?.info('item largado no chão', { slot, x: me.x, y: me.y });
    return true;
  } catch {
    log?.warn('sem CNFDropItem', { slot });
    return false;
  }
}

export interface PickUp {
  /** Id do chão (sem o offset) que respondeu, se algum. */
  groundId?: number;
  /** Slot do inventário no CNFGetItem (se o servidor pôs o item no inventário). */
  cnfSlot?: number;
  /** Ids sondados. */
  probed: number;
  /** Seq antes da sonda, para ler os frames depois. */
  since: number;
}

/**
 * Sonda ids do chão 1..maxId pedindo cada um para `destSlot`. Para no primeiro CNFGetItem. `stopWhen` permite
 * parar por outro sinal (ex.: UpdateEtc com SkillBonus novo, que é o caminho da pílula no legado).
 */
export async function pickUpNear(c: GameClient, destSlot: number, o: { maxId?: number; log?: Logger; stopWhen?: () => boolean } = {}): Promise<PickUp> {
  const maxId = o.maxId ?? 800;
  const since = c.mark;
  let cnfSlot: number | undefined;
  let hitId: number | undefined;
  let probed = 0;
  const onFrame = (f: { header: { type: number }; body: Buffer }) => {
    if (f.header.type === Op.CNFGetItem && cnfSlot === undefined && f.body.length >= 4) cnfSlot = f.body.readUInt32LE(0);
  };
  c.on('frame', onFrame);
  try {
    for (let id = 1; id <= maxId; id++) {
      c.send(Op.GetItem, P.getItem(id + GROUND_ID_OFFSET, destSlot));
      probed++;
      await sleep(25);
      if (cnfSlot !== undefined || o.stopWhen?.()) { hitId = id; break; }
    }
    await sleep(1500);
  } finally {
    c.off('frame', onFrame);
  }
  if (cnfSlot !== undefined) {
    // O CNFGetItem só traz o slot; o item é o que foi largado (o chamador sabe qual).
    o.log?.info('item pego do chão', { groundId: hitId, slot: cnfSlot });
  }
  return { groundId: hitId, cnfSlot, probed, since };
}
