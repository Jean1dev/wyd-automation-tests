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

/**
 * Escolhe pontos de spawn adequados ao nível (armazenado) do personagem: mobs com nível
 * entre um piso e um pouco acima do personagem, priorizando os mais fortes que ele aguenta.
 */
export function spawnsForLevel(storedLevel: number): SpawnPoint[] {
  const shown = storedLevel + 1;
  const cap = Math.max(3, Math.min(shown + 3, 34));
  const ok = TRAINING_FIELD.spawns.filter((s) => (s.level ?? 99) <= cap);
  const best = Math.max(...ok.map((s) => s.level ?? 0));
  // Faixa de até 10 níveis abaixo do melhor mob viável: os mobs fortes do campo têm poucos
  // geradores (MaxNumMob 1), então incluir os grupos médios (Rei Gremlin, Chefe Krill) garante
  // alvos suficientes sem cair para os mobs que quase não dão exp.
  const floor = best - 10;
  const chosen = ok.filter((s) => (s.level ?? 0) >= floor);
  return chosen.length ? chosen : ok;
}

/**
 * Nível mínimo de mob que vale a pena caçar: abaixo disso a exp por kill cai demais
 * (SoloExpReward escala pela razão nível do mob / nível do jogador).
 */
export function minWorthMobLevel(storedLevel: number): number {
  return Math.max(1, storedLevel + 1 - 8);
}
