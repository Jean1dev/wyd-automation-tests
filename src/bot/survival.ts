// Sobrevivência no grind: recuar para regenerar HP e reviver após a morte.
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import { ROUTE } from '../world/trainingField.ts';
import { walkPath } from './movement.ts';
import { sleep } from './util.ts';

/** Volta para Armia (zona segura) e espera o HP regenerar. */
export async function retreatAndRest(c: GameClient, log: Logger, targetRatio = 0.9, maxWaitMs = 180_000): Promise<void> {
  const me = c.self!;
  log.info('HP baixo; recuando para Armia', { hp: me.hp, maxHp: me.maxHp, x: me.x, y: me.y });
  await walkPath(c, [ROUTE.fieldEntry, ROUTE.armiaEdge, ROUTE.armia]);
  const t0 = Date.now();
  while (me.hp > 0 && me.hp < me.maxHp * targetRatio && Date.now() - t0 < maxWaitMs) await sleep(2000);
  log.info('descansou', { hp: me.hp, maxHp: me.maxHp, waitedMs: Date.now() - t0 });
}

/** Revive (MSG_Restart) e espera o servidor devolver o personagem à cidade. */
export async function reviveAfterDeath(c: GameClient, log: Logger): Promise<void> {
  const me = c.self!;
  log.warn('personagem morreu; revivendo', { x: me.x, y: me.y, level: me.level, exp: me.exp });
  await sleep(3000);
  const since = c.mark;
  c.send(Op.Restart, Buffer.alloc(0));
  try {
    await c.waitType([Op.UpdateScore, Op.SetHpMp], { timeoutMs: 10_000, since });
  } catch {
    log.warn('sem resposta ao Restart');
  }
  await sleep(2000);
  log.info('revivido', { hp: me.hp, x: me.x, y: me.y });
}
