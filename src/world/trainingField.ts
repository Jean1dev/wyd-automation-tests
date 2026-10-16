// Campo de Treino: células com o bit 0x80 ("Newbie Zone") do AttributeMap.dat do servidor.
// Dados gerados por `npm run zone:extract` em data/newbie-zone.json.
import zone from './data/newbie-zone.json' with { type: 'json' };

export interface SpawnPoint {
  gen: number;
  leader: string;
  follower: string;
  x: number;
  y: number;
  range: number;
  maxNumMob: number;
  level?: number;
  exp?: number;
}

const rows = zone.rows as unknown as Record<string, [number, number][]>;

export const TRAINING_FIELD = {
  bbox: zone.bbox,
  spawns: zone.spawns as SpawnPoint[],
};

/** O tile (x, y) está dentro do Campo de Treino? */
export function isInTrainingField(x: number, y: number): boolean {
  const r = rows[String(Math.floor(y / 4))];
  if (!r) return false;
  const cx = Math.floor(x / 4);
  return r.some(([a, b]) => cx >= a && cx <= b);
}

/**
 * Pontos fixos da rota Armia ↔ Campo. Armia fica ao sul do campo (y maior):
 * a cidade é {2052,2052}-{2171,2163} e o campo termina em y≈2051.
 */
export const ROUTE = {
  /** Dentro de Armia, perto do spawn (2086,2093)+rand(15). */
  armia: { x: 2100, y: 2080 },
  /** Ainda em Armia, colado à borda do campo. */
  armiaEdge: { x: 2100, y: 2058 },
  /** Primeiro ponto dentro do campo. */
  fieldEntry: { x: 2100, y: 2046 },
};

/** Área de Armia para onde a regra legada joga quem não pode entrar: (2091–2093, 2101–2103). */
export function isLegacyKickSpot(x: number, y: number): boolean {
  return x >= 2090 && x <= 2094 && y >= 2100 && y <= 2104;
}

/** Texto #46 de Language.txt (_NN_Newbie_zone). Comparação tolerante a acentos/codificação. */
export const NEWBIE_ZONE_MESSAGE = 'Somente nível 35 ou inferior pode entrar no campo de treinamento.';

export function isNewbieZoneMessage(text: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[^\x20-\x7e]/g, '').toLowerCase();
  const t = norm(text);
  return t.includes('campo de treinamento') || (t.includes('35') && t.includes('treina'));
}

export interface MobStats {
  level: number;
  exp: number;
  ac: number;
  maxHp: number;
}

/** Atributos dos templates (npc/<Nome>) dos mobs do campo, por nome. */
export const MOB_STATS = zone.mobs as Record<string, MobStats>;

/** Golpes que o bot dá antes de desistir de um alvo (grind.ts). */
export const MAX_SWINGS = 40;
/** Segundos por golpe: intervalo de ataque (1,1 s) mais o eco do servidor. */
const SWING_S = 1.25;
/** Segundos fixos por kill: encostar no mob, esperar a exp. */
const KILL_OVERHEAD_S = 3;
/** Mínimo de pontos de spawn devolvidos por spawnsForLevel. */
const MIN_SPAWNS = 6;

/**
 * Dano médio de um golpe corpo a corpo: BASE_GetDamage (tmserver/internal/combat/combat.go)
 * sem maestria, com o fator aleatório 99–110% na média. A AC mitiga metade do seu valor.
 */
export function expectedHit(damage: number, ac: number): number {
  let t = damage - Math.trunc(ac / 2);
  t = Math.trunc((104.5 * t) / 100);
  if (t < -50) t = 0;
  else if (t < 0) t = Math.trunc((t + 50) / 7);
  else if (t <= 50) t = Math.trunc((5 * t) / 4) + 7;
  return Math.max(1, t);
}

export function swingsToKill(damage: number, ac: number, hp: number): number {
  return Math.ceil(hp / expectedHit(damage, ac));
}

/**
 * Exp relativa de um kill: a exp do template escalada pela razão de níveis, como o
 * GetExpApply dos mortais (tmserver/internal/level/level.go ExpApply, teto de 200%).
 * Os demais fatores do servidor dependem só do nível do personagem e não mudam a ordem.
 */
export function killValue(storedLevel: number, mob: { level: number; exp: number }): number {
  return (mob.exp * Math.min(200, Math.trunc(((mob.level + 1) * 100) / (storedLevel + 1)))) / 100;
}

/** Exp relativa por segundo de luta contra um mob, ou 0 se ele não morre em MAX_SWINGS golpes. */
export function expRate(storedLevel: number, damage: number, mob: { level: number; exp: number; ac: number; hp: number }, walkS = 0): number {
  const swings = swingsToKill(damage, mob.ac, mob.hp);
  if (swings > MAX_SWINGS) return 0;
  return killValue(storedLevel, mob) / (swings * SWING_S + KILL_OVERHEAD_S + walkS);
}

/**
 * Escolhe os pontos de spawn onde o personagem ganha mais exp por segundo com o dano que
 * tem agora: mobs até 4 níveis acima do exibido que ele mata em até MAX_SWINGS golpes,
 * ficando com os que rendem pelo menos metade do melhor (e no mínimo MIN_SPAWNS pontos). Mobs de AC alta (Chefe Krill,
 * Orc Arqueiro) só entram quando o dano der conta deles.
 */
export function spawnsForLevel(storedLevel: number, damage: number): SpawnPoint[] {
  const cap = storedLevel + 1 + 4;
  const rate = (s: SpawnPoint) => {
    const m = MOB_STATS[s.leader];
    return m && m.level <= cap ? expRate(storedLevel, damage, { ...m, hp: m.maxHp }) : 0;
  };
  const rated = TRAINING_FIELD.spawns.map((s) => ({ s, r: rate(s) })).filter((x) => x.r > 0);
  if (!rated.length) {
    // Nada morre no limite de golpes: fica com os mobs mais fracos do campo.
    const min = Math.min(...TRAINING_FIELD.spawns.map((s) => s.level ?? 99));
    return TRAINING_FIELD.spawns.filter((s) => (s.level ?? 99) === min);
  }
  // Os mobs que mais rendem costumam ter um gerador só: completa com os próximos da lista
  // até MIN_SPAWNS pontos, para o bot ter outra área quando aquela esvaziar.
  rated.sort((a, b) => b.r - a.r);
  const best = rated[0].r;
  return rated.filter((x, i) => x.r >= best / 2 || i < MIN_SPAWNS).map((x) => x.s);
}
