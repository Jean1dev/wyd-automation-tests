// Pontos de atributo: como um jogador comum, o bot distribui os pontos livres que ganha a
// cada nível (5 por nível). Nos cenários 1 a 3, tudo em Str, porque ele só ataca corpo a corpo
// e o dano soma Str/2. A build por classe fica em build.ts.
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { ALL_STR, spendBuild } from './build.ts';

/** Gasta os pontos livres em Str (veja spendBuild). */
export function spendStatPoints(c: GameClient, log: Logger): Promise<number> {
  return spendBuild(c, log, ALL_STR);
}
