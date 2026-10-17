// Pontos de atributo: como um jogador comum, o bot distribui os pontos livres que ganha a
// cada nível (5 por nível). Tudo em Str, porque ele só ataca corpo a corpo e o dano soma Str/2.
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

const MAX_CLICKS = 500;

/**
 * Gasta os pontos livres em Str com MSG_ApplyBonus, um clique por vez, como o cliente.
 * O servidor responde com UpdateEtc (pontos restantes) e UpdateScore; com 0 ponto livre,
 * só com UpdateScore. Por isso o primeiro clique também descobre o saldo quando ele ainda
 * é desconhecido (o login não manda UpdateEtc).
 */
export async function spendStatPoints(c: GameClient, log: Logger): Promise<number> {
  const me = c.self!;
  if (me.scoreBonus === 0 || me.hp <= 0) return 0;
  const before = { damage: me.damage, points: me.scoreBonus };
  let spent = 0;
  for (let i = 0; i < MAX_CLICKS && me.scoreBonus !== 0; i++) {
    const since = c.mark;
    const pointsBefore = me.scoreBonus;
    c.send(Op.ApplyBonus, P.applyBonus(P.STAT.str));
    try {
      await c.waitFor((f) => f.header.type === Op.UpdateScore && f.header.id === me.clientId, { timeoutMs: 3000, since, what: 'UpdateScore do ApplyBonus' });
    } catch {
      log.warn('ApplyBonus sem resposta; tento de novo no próximo ciclo', { points: me.scoreBonus });
      break;
    }
    const etc = c.framesSince(since).some((f) => f.header.type === Op.UpdateEtc);
    if (!etc) { me.scoreBonus = 0; break; } // sem ponto livre: o servidor só reenviou o score
    // Com saldo ≥ 300 o servidor gasta 100 por clique; sem saldo anterior conhecido, conta 1.
    spent += pointsBefore !== undefined ? pointsBefore - me.scoreBonus! : 1;
    await sleep(120);
  }
  if (spent > 0) log.info('pontos de atributo distribuídos', { stat: 'str', spent, damageBefore: before.damage, damage: me.damage, left: me.scoreBonus });
  return spent;
}
