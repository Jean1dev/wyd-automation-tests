// Grind no Campo de Treino: distribui os pontos de atributo, escolhe a área de spawn e o alvo
// pela exp por segundo que o dano atual rende, cuida do HP e da morte e para ao atingir o nível
// pedido ou estourar o orçamento.
import type { GameClient, Mob } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { expRate, isInTrainingField, MAX_SWINGS, MOB_STATS, ROUTE, spawnsForLevel, type SpawnPoint } from '../world/trainingField.ts';
import { fight } from './combat.ts';
import { walkPath, walkTo } from './movement.ts';
import { spendStatPoints } from './stats.ts';
import { retreatAndRest, reviveAfterDeath } from './survival.ts';
import { dist, shownLevel, sleep } from './util.ts';

export interface KillRecord {
  t: string;
  mob: string;
  mobLevel: number;
  level: number;
  expGain: string;
  x: number;
  y: number;
}

export interface LevelUpRecord {
  t: string;
  from: number;
  to: number;
  exp: string;
  x: number;
  y: number;
  inTrainingField: boolean;
}

export interface GrindOptions {
  /** Nível ARMAZENADO alvo (o cliente exibe +1). */
  targetLevel: number;
  /** Fim do orçamento desta execução (epoch ms). */
  deadline: number;
  /** Falha se ficar este tempo sem ganhar exp. */
  stallMs: number;
  onKill?: (k: KillRecord) => void;
  onLevelUp?: (l: LevelUpRecord) => void | Promise<void>;
}

export type GrindStatus = 'reached' | 'budget';

export class StallError extends Error {}

const MAX_TARGET_DIST = 14;
const LOW_HP = 0.35;
/** Segundos por tile andado até o alvo. */
const WALK_S_PER_TILE = 0.3;

/** Garante que o personagem está dentro do campo, andando a partir de Armia se preciso. */
export async function enterTrainingField(c: GameClient): Promise<void> {
  const me = c.self!;
  if (isInTrainingField(me.x, me.y)) return;
  await walkPath(c, [ROUTE.armiaEdge, ROUTE.fieldEntry]);
}

function pickSpawn(spawns: SpawnPoint[], x: number, y: number, avoid?: SpawnPoint): SpawnPoint {
  const pool = spawns.filter((s) => s !== avoid);
  const list = pool.length ? pool : spawns;
  // Prefere os pontos mais próximos, com algum acaso para não grudar num ponto vazio.
  const sorted = [...list].sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
  return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
}

export async function grindUntil(c: GameClient, log: Logger, opts: GrindOptions): Promise<GrindStatus> {
  const me = c.self!;
  const blacklist = new Map<number, number>(); // mobId → até quando ignorar
  let lastExp = me.exp;
  let lastGainAt = Date.now();
  let spawn: SpawnPoint | undefined;
  let spawnLevel = -1;

  const onLevel = async (e: { from: number; to: number }) => {
    const rec: LevelUpRecord = {
      t: new Date().toISOString(), from: e.from, to: e.to, exp: me.exp.toString(), x: me.x, y: me.y,
      inTrainingField: isInTrainingField(me.x, me.y),
    };
    log.info('level up', { ...rec, shown: shownLevel(e.to) });
    await opts.onLevelUp?.(rec);
  };
  const levelListener = (e: { from: number; to: number }) => { void onLevel(e); };
  c.on('level', levelListener);

  try {
    await enterTrainingField(c);
    await spendStatPoints(c, log); // descobre o saldo: o login não manda UpdateEtc
    while (true) {
      if (me.level >= opts.targetLevel) return 'reached';
      if (Date.now() >= opts.deadline) return 'budget';
      if (c.isClosed) throw new Error('conexão caiu durante o grind');
      if (me.exp > lastExp) { lastExp = me.exp; lastGainAt = Date.now(); }
      if (Date.now() - lastGainAt > opts.stallMs) {
        throw new StallError(`sem ganho de exp há ${Math.round((Date.now() - lastGainAt) / 60000)} min`);
      }

      if (me.hp <= 0) {
        await reviveAfterDeath(c, log);
        await enterTrainingField(c);
        spawn = undefined;
        continue;
      }
      if (me.hp < me.maxHp * LOW_HP) {
        await retreatAndRest(c, log);
        await enterTrainingField(c);
        spawn = undefined;
        continue;
      }

      if (me.scoreBonus) await spendStatPoints(c, log);

      const spawns = spawnsForLevel(me.level, me.damage);
      if (!spawn || spawnLevel !== me.level) {
        spawn = pickSpawn(spawns, me.x, me.y);
        spawnLevel = me.level;
        log.info('indo para área de spawn', { mob: spawn.leader, mobLevel: spawn.level, x: spawn.x, y: spawn.y, shown: shownLevel(me.level) });
        await walkTo(c, spawn.x, spawn.y + 2);
      }

      const now = Date.now();
      const maxMobLevel = shownLevel(me.level) + 4;
      // Exp por segundo de cada mob ao alcance com o dano atual; 0 = não morre em MAX_SWINGS golpes.
      const rate = (m: Mob) => {
        const st = MOB_STATS[m.name];
        const mob = { level: m.level, exp: st?.exp ?? m.level * 60, ac: m.ac || (st?.ac ?? 0), hp: m.hp };
        return expRate(me.level, me.damage, mob, dist(me.x, me.y, m.x, m.y) * WALK_S_PER_TILE);
      };
      const candidates = c.liveMobs()
        .filter((m) => isInTrainingField(m.x, m.y) && m.level <= maxMobLevel && (blacklist.get(m.id) ?? 0) < now &&
          dist(me.x, me.y, m.x, m.y) <= MAX_TARGET_DIST)
        .map((m) => ({ m, r: rate(m) }))
        .filter((x) => x.r > 0);
      if (!candidates.length) {
        await sleep(2500);
        if (!c.liveMobs().some((m) => isInTrainingField(m.x, m.y) && dist(me.x, me.y, m.x, m.y) <= MAX_TARGET_DIST && rate(m) > 0)) {
          spawn = pickSpawn(spawns, me.x, me.y, spawn);
          log.debug('área sem alvo viável; trocando', { mob: spawn.leader, x: spawn.x, y: spawn.y });
          await walkTo(c, spawn.x, spawn.y + 2);
        }
        continue;
      }
      candidates.sort((a, b) => b.r - a.r);
      // Só sobrou alvo que rende pouco perto da área escolhida: às vezes vale trocar de área.
      const leader = MOB_STATS[spawn.leader];
      const areaRate = leader ? expRate(me.level, me.damage, { ...leader, hp: leader.maxHp }) : 0;
      if (candidates[0].r < areaRate / 3 && spawnLevel === me.level && Math.random() < 0.5) {
        spawn = pickSpawn(spawns, me.x, me.y, spawn);
        await walkTo(c, spawn.x, spawn.y + 2);
        continue;
      }
      const target: Mob = candidates[0].m;
      const expBefore = me.exp;
      const r = await fight(c, target, { minHpRatio: LOW_HP, maxSwings: MAX_SWINGS });
      if (r.result === 'killed' || me.exp > expBefore) {
        // A exp chega no eco do ataque/UpdateEtc logo depois da morte do mob.
        await sleep(300);
        const k: KillRecord = {
          t: new Date().toISOString(), mob: target.name, mobLevel: target.level, level: me.level,
          expGain: (me.exp - expBefore).toString(), x: me.x, y: me.y,
        };
        log.info('kill', { ...k, exp: me.exp, hp: me.hp, maxHp: me.maxHp, damage: me.damage });
        opts.onKill?.(k);
      } else if (r.result === 'gave-up' || (r.result === 'lost' && r.swings > 3)) {
        blacklist.set(target.id, now + 120_000);
        log.debug('alvo ignorado', { id: target.id, mob: target.name, result: r.result, swings: r.swings, hits: r.hits });
      }
    }
  } finally {
    c.off('level', levelListener);
  }
}
