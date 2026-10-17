// Build de atributos por classe, como um jogador distribui os pontos livres de cada nível.
//
// As metas vêm dos guias da comunidade, para o personagem que só usa o ataque físico:
// - TransKnight misto: Con até ~600, Dex ≥ 400, o resto em Str (wydconexion "Mega Tutorial TK/BM/FM/HT").
// - BeastMaster Natureza: Con 700–1000, Dex 400–700, o resto em Str (mesma fonte).
// - Foema física: Dex cheia, Int ~200, HP 700–1300 (mesma fonte; wydeiros "Dicas Build").
// - Huntress: Con 800–1200, o resto em Dex (mesma fonte).
// Antes da build, os requisitos do próximo equipamento (ItemList Str/Int/Dex/Con).
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

export type Stat = keyof P.Attributes;

export interface Build {
  name: string;
  /** Fração dos pontos que vai para cada atributo enquanto ele está abaixo do teto. */
  share: Partial<Record<Stat, number>>;
  /** Teto de cada atributo (CurrentScore); sem teto, recebe o que sobrar. */
  cap: Partial<Record<Stat, number>>;
}

export const BUILDS: Record<number, Build> = {
  0: { name: 'TransKnight misto', share: { str: 0.6, dex: 0.2, con: 0.2 }, cap: { con: 600, dex: 400 } },
  1: { name: 'Foema física', share: { dex: 0.6, int: 0.1, con: 0.3 }, cap: { int: 200, con: 700 } },
  2: { name: 'BeastMaster Natureza', share: { str: 0.4, dex: 0.3, con: 0.3 }, cap: { con: 800, dex: 550 } },
  3: { name: 'Huntress', share: { dex: 0.6, con: 0.4 }, cap: { con: 1000 } },
};

/** Só Str: a distribuição dos cenários 1 a 3, em que o bot só precisa de dano. */
export const ALL_STR: Build = { name: 'tudo em Str', share: { str: 1 }, cap: {} };

/** Requisitos de atributo que a build precisa cumprir primeiro (o próximo equipamento). */
export type StatReq = Partial<Record<Stat, number>>;

/** O atributo que recebe o próximo clique: primeiro o requisito que falta, depois o mais longe da meta. */
export function nextStat(attrs: P.Attributes, build: Build, req: StatReq = {}): Stat {
  for (const s of ['str', 'dex', 'con', 'int'] as Stat[]) if ((req[s] ?? 0) > attrs[s]) return s;
  const stats = Object.keys(build.share) as Stat[];
  const total = stats.reduce((n, s) => n + attrs[s], 0) + 1;
  let best: Stat | undefined;
  let bestGap = -Infinity;
  for (const s of stats) {
    const cap = build.cap[s];
    if (cap !== undefined && attrs[s] >= cap) continue;
    const goal = Math.min(cap ?? Infinity, build.share[s]! * total);
    const gap = goal - attrs[s];
    if (gap > bestGap) { bestGap = gap; best = s; }
  }
  // Todos os tetos cheios: o resto vai para o atributo sem teto (ou o de maior fração).
  return best ?? stats.find((s) => build.cap[s] === undefined) ?? stats.sort((a, b) => build.share[b]! - build.share[a]!)[0];
}

const MAX_CLICKS = 500;

/**
 * Gasta os pontos livres com MSG_ApplyBonus, um clique por vez, como o cliente. O servidor
 * responde com UpdateEtc (pontos restantes) e UpdateScore (atributos novos); com 0 ponto livre,
 * só com UpdateScore. Por isso o primeiro clique também descobre o saldo quando ele ainda é
 * desconhecido (o login não manda UpdateEtc). Com saldo ≥ 300, cada clique gasta 100.
 */
export async function spendBuild(c: GameClient, log: Logger, build: Build, req: StatReq = {}): Promise<number> {
  const me = c.self!;
  if (me.scoreBonus === 0 || me.hp <= 0) return 0;
  const before = { damage: me.damage, maxHp: me.maxHp, points: me.scoreBonus, ...me.attrs };
  const bySt: Partial<Record<Stat, number>> = {};
  let spent = 0;
  for (let i = 0; i < MAX_CLICKS && me.scoreBonus !== 0; i++) {
    const since = c.mark;
    const pointsBefore = me.scoreBonus;
    const stat = nextStat(me.attrs, build, req);
    c.send(Op.ApplyBonus, P.applyBonus(P.STAT[stat]));
    try {
      await c.waitFor((f) => f.header.type === Op.UpdateScore && f.header.id === me.clientId, { timeoutMs: 3000, since, what: 'UpdateScore do ApplyBonus' });
    } catch {
      log.warn('ApplyBonus sem resposta; tento de novo no próximo ciclo', { points: me.scoreBonus });
      break;
    }
    const etc = c.framesSince(since).some((f) => f.header.type === Op.UpdateEtc);
    if (!etc) { me.scoreBonus = 0; break; } // sem ponto livre: o servidor só reenviou o score
    const n = pointsBefore !== undefined ? pointsBefore - me.scoreBonus! : 1;
    spent += n;
    bySt[stat] = (bySt[stat] ?? 0) + n;
    await sleep(120);
  }
  if (spent > 0) {
    log.info('pontos de atributo distribuídos', {
      build: build.name, spent, byStat: bySt, left: me.scoreBonus, attrs: me.attrs,
      damageBefore: before.damage, damage: me.damage, maxHpBefore: before.maxHp, maxHp: me.maxHp,
    });
  }
  return spent;
}
