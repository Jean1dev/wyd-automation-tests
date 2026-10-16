// Ataque corpo a corpo a um mob, como o cliente: MSG_AttackOne (0x039D) com um alvo e
// Dam = damMelee; o servidor calcula o dano e devolve o eco com HP/EXP do atacante.
import type { GameClient, Mob } from '../client/GameClient.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { stepTo } from './movement.ts';
import { dist, sleep } from './util.ts';

/** O servidor recusa ataques com menos de 800 ms entre si (crack 107). */
const ATTACK_INTERVAL_MS = 1100;

export type FightResult = 'killed' | 'lost' | 'gave-up' | 'low-hp' | 'dead';

export interface FightOptions {
  /** Para a luta se o HP cair abaixo desta fração do máximo. */
  minHpRatio: number;
  maxSwings: number;
}

/** Fica ao lado do mob e golpeia até ele morrer, sumir da visão ou a luta ficar inviável. */
export async function fight(c: GameClient, mob: Mob, opts: FightOptions): Promise<{ result: FightResult; swings: number; hits: number }> {
  const me = c.self!;
  let swings = 0;
  let hits = 0;
  let lastAttackTick = 0;
  while (swings < opts.maxSwings) {
    if (me.hp <= 0) return { result: 'dead', swings, hits };
    if (me.hp < me.maxHp * opts.minHpRatio) return { result: 'low-hp', swings, hits };
    const m = c.mobs.get(mob.id);
    // O mob some da visão (RemoveMob) quando morre; sem golpe acertado, ele só saiu do alcance.
    if (!m) return { result: hits > 0 ? 'killed' : 'lost', swings, hits };
    if (m.hp <= 0) return { result: 'killed', swings, hits };

    // Encosta no mob (1 tile) se ele estiver longe.
    if (dist(me.x, me.y, m.x, m.y) > 1.5) {
      const dx = Math.sign(me.x - m.x), dy = Math.sign(me.y - m.y);
      stepTo(c, m.x + dx, m.y + dy);
      await sleep(400);
    }

    const since = c.mark;
    let tick = c.tick();
    if (tick < lastAttackTick + 850) tick = lastAttackTick + 850;
    lastAttackTick = tick;
    c.send(Op.AttackOne, P.attack({ attackerId: me.clientId, posX: me.x, posY: me.y, targetId: m.id, targetX: m.x, targetY: m.y }), { tick });
    swings++;
    try {
      const echo = await c.waitFor(
        (f) => (f.header.type === Op.Attack || f.header.type === Op.AttackOne || f.header.type === Op.AttackTwo) && f.body.length >= 56 && f.body.readUInt16LE(30) === me.clientId,
        { timeoutMs: 3000, since, what: 'eco do ataque' },
      );
      const d = P.parseAttack(echo.body).dam.find((x) => x.targetId === m.id);
      if (d && d.damage > 0) hits++;
    } catch {
      // Sem eco: o servidor descartou o golpe (ex.: alvo já morto). Segue o laço.
    }
    await sleep(ATTACK_INTERVAL_MS);
  }
  return { result: 'gave-up', swings, hits };
}
