// Viagens longas como um jogador: o Mestre Grifo de Armia (MSG_MasterGriff 0x0AD9) e os tiles
// de teleporte (pisar no tile e mandar MSG_ReqTeleport 0x0290, world/teleport.go).
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import type { Point } from '../world/coveiro.ts';
import { GRIFF_DEST, NPC, TELEPORT } from '../world/quest256.ts';
import { isSelfTeleport, selfTeleportIn, walkPath, walkTo } from './movement.ts';
import { approachNpc, NpcError } from './npc.ts';
import { sleep } from './util.ts';

export interface Hop {
  t: string;
  via: string;
  from: Point;
  to: Point;
  coinBefore: number;
  coinAfter: number;
}

const here = (c: GameClient): Point => ({ x: c.self!.x, y: c.self!.y });

/** Armia: a cidade inicial e para onde o recall manda (o retângulo da área segura). */
export function isInArmia(x: number, y: number): boolean {
  return x >= 2052 && x <= 2171 && y >= 2052 && y <= 2150;
}

/** Espera o servidor teleportar o personagem e devolve o salto. */
async function awaitTeleport(c: GameClient, since: number, timeoutMs: number, what: string): Promise<{ from: Point; to: Point }> {
  await c.waitFor((f) => isSelfTeleport(c, f), { timeoutMs, since, what });
  await sleep(1000); // CreateMob do destino
  const tp = selfTeleportIn(c, c.framesSince(since));
  if (!tp) throw new NpcError(`${what}: teleporte sem destino`);
  return tp;
}

/** Fala com o Mestre Grifo de Armia e pede a viagem `warpId` (a chegada demora ~9,5 s). */
export async function griffTravel(c: GameClient, log: Logger, warpId: number): Promise<Hop> {
  const me = c.self!;
  await approachNpc(c, NPC.mestreGrifo);
  const from = here(c);
  const coinBefore = me.coin;
  const since = c.mark;
  c.send(Op.MasterGriff, P.masterGriff(warpId));
  const tp = await awaitTeleport(c, since, 20_000, `viagem do Grifo ${warpId}`);
  const hop: Hop = { t: new Date().toISOString(), via: `Mestre Grifo ${warpId}`, from, to: tp.to, coinBefore, coinAfter: me.coin };
  const want = GRIFF_DEST[warpId];
  if (want && Math.max(Math.abs(tp.to.x - want.x), Math.abs(tp.to.y - want.y)) > 4) {
    log.warn('o Grifo deixou longe do destino esperado', { want, got: tp.to });
  }
  log.info('viagem', hop as unknown as Record<string, unknown>);
  return hop;
}

/** Anda até o tile, pede o teleporte e sai do tile de chegada (que é a volta) sem pedir nada. */
export async function teleportTile(c: GameClient, log: Logger, tp: { tile: Point; dest: Point }, name: string): Promise<Hop> {
  const me = c.self!;
  await walkTo(c, tp.tile.x, tp.tile.y);
  await sleep(500);
  const from = here(c);
  const coinBefore = me.coin;
  const since = c.mark;
  c.send(Op.ReqTeleport, Buffer.alloc(0));
  const jump = await awaitTeleport(c, since, 8000, `teleporte ${name}`);
  // Sai de cima do tile de chegada (o servidor só teleporta quando o cliente pede).
  await walkTo(c, me.x + 3, me.y + 3);
  const hop: Hop = { t: new Date().toISOString(), via: name, from, to: jump.to, coinBefore, coinAfter: me.coin };
  log.info('viagem', hop as unknown as Record<string, unknown>);
  return hop;
}

/** Leva o personagem de volta para Armia a partir do Dungeon, do Submundo, de Noatum ou do continente. */
export async function returnToArmia(c: GameClient, log: Logger): Promise<void> {
  const me = c.self!;
  if (isInArmia(me.x, me.y)) return;
  log.info('voltando para Armia', { x: me.x, y: me.y });
  if (me.y >= 3600 && me.x < 1000) {
    // Dungeon 1: o tile da chegada (144,3788) leva de volta ao Armia Field.
    await teleportTile(c, log, { tile: TELEPORT.fieldToDungeon.dest, dest: TELEPORT.fieldToDungeon.tile }, 'Dungeon 1 → Armia Field');
  } else if (me.y >= 3600) {
    await teleportTile(c, log, { tile: TELEPORT.fieldToUnderworld.dest, dest: TELEPORT.fieldToUnderworld.tile }, 'Underworld → Azran Field');
  } else if (me.x < 1200 && me.y < 1900) {
    await teleportTile(c, log, TELEPORT.noatumToArmia, 'Noatum → Armia');
    return;
  }
  // No continente o servidor não valida o caminho: anda direto até a praça de Armia.
  await walkPath(c, [{ x: 2160, y: 2100 }, { x: 2110, y: 2095 }]);
}
