// Magia Negra da Foema (árvore 2 da classe 1): as skills, o mestre que as ensina e o campo onde
// o bot as testa, como estão no servidor (Jean1dev/w2pp-OpenWYD).
//
// - Skills 32–39 (Release/Common/SkillData.csv): bits 8–15 do LearnedSkill, maestria Special[2].
// - Requisitos para aprender: ItemList.csv 5032–5039, "ReqLvl.ReqStr.ReqInt.ReqDex.ReqCon", em
//   que o 4º campo é comparado com Special[2] (handler/skill.go learnSkill; legado
//   _MSG_ApplyBonus.cpp:131-249). A 8ª skill (Inferno) exige ainda as 7 anteriores e 50M de gold.
// - Pontos: +3 de skill por nível (+4 a partir do 200) e +2 de maestria (handler/mobkilled.go).
import type { NpcSpec } from '../bot/npc.ts';
import type { Point } from './coveiro.ts';

export const FOEMA = 1;
/** Árvore da Magia Negra: Special[2] e skills (32–39) % 24 ÷ 8 = 1. */
export const BLACK_TREE = 2;

export type SkillTarget = 'single' | 'area' | 'self';

export interface BlackSkill {
  id: number;
  name: string;
  /** SkillPoint: pontos de skill que custa aprender. */
  points: number;
  /** ManaSpent: MP base (o servidor escala pela maestria). */
  mana: number;
  range: number;
  target: SkillTarget;
  /** Maior índice de Dam[] aceito (MaxTarget do SkillData; não é contagem). */
  maxTarget: number;
  /** Requisitos do ItemList: nível ARMAZENADO e Special[2]. */
  reqLevel: number;
  reqSpecial: number;
  /** InstanceType (2 fogo, 3 gelo, 5 raio) e InstanceValue: entram na fórmula de dano. */
  element: number;
  base: number;
}

export const BLACK_SKILLS: BlackSkill[] = [
  { id: 32, name: 'Ataque de Fogo', points: 18, mana: 7, range: 5, target: 'single', maxTarget: 1, reqLevel: 0, reqSpecial: 0, element: 2, base: 20 },
  { id: 33, name: 'Relâmpago', points: 51, mana: 10, range: 6, target: 'single', maxTarget: 1, reqLevel: 0, reqSpecial: 0, element: 5, base: 65 },
  { id: 34, name: 'Lança de Gelo', points: 69, mana: 15, range: 6, target: 'single', maxTarget: 1, reqLevel: 29, reqSpecial: 0, element: 3, base: 95 },
  { id: 35, name: 'Tempestade de Meteoros', points: 72, mana: 25, range: 6, target: 'area', maxTarget: 13, reqLevel: 45, reqSpecial: 0, element: 2, base: 55 },
  { id: 36, name: 'Nevasca', points: 72, mana: 35, range: 6, target: 'single', maxTarget: 1, reqLevel: 75, reqSpecial: 112, element: 3, base: 200 },
  { id: 37, name: 'Trovão', points: 90, mana: 75, range: 0, target: 'self', maxTarget: 1, reqLevel: 99, reqSpecial: 148, element: 0, base: 0 },
  { id: 38, name: 'Fênix de Fogo', points: 81, mana: 85, range: 6, target: 'single', maxTarget: 1, reqLevel: 139, reqSpecial: 190, element: 2, base: 350 },
  { id: 39, name: 'Inferno', points: 224, mana: 220, range: 6, target: 'area', maxTarget: 13, reqLevel: 219, reqSpecial: 200, element: 2, base: 340 },
];

export const INFERNO = BLACK_SKILLS[7];
/** Gold que a 8ª skill de uma árvore custa (handler/skill.go eighthSkillCoin). */
export const EIGHTH_SKILL_COIN = 50_000_000;

export const skillById = (id: number): BlackSkill => {
  const s = BLACK_SKILLS.find((x) => x.id === id);
  if (!s) throw new Error(`skill ${id} não é da Magia Negra`);
  return s;
};

/** Bit da skill no LearnedSkill. */
export const learnBit = (id: number) => 1 << (id % 24);

/** Pontos de skill que o nível armazenado dá (BASE_GetBonusSkillPoint, handler/skill.go deriveSkillBonus). */
export const skillPointsAt = (level: number) => 3 * level + Math.max(0, level - 199);

/** Teto de maestria por árvore no nível (skill.go applySpecialBonus): 3×(nível+1)/2 e 200. */
export const masteryCapAt = (level: number) => Math.min((3 * (level + 1)) >> 1, 200);

/** Custo de MP do cast (BASE_GetManaSpent, combat/skill.go ManaSpent), sem SaveMana. */
export const manaCost = (mana: number, special: number, saveMana = 0) => Math.trunc(((100 - saveMana) * Math.trunc((mana * (Math.trunc(special / 2) + 100)) / 100)) / 100);

/** Pontos de skill acumulados até a skill `id`, aprendendo na ordem da árvore. */
export const cumulativePoints = (id: number) => BLACK_SKILLS.filter((s) => s.id <= id).reduce((n, s) => n + s.points, 0);

/**
 * Menor nível armazenado em que a skill pode ser aprendida, na ordem da árvore: o requisito de
 * nível, os pontos acumulados e o teto de maestria que alcança o requisito de Special[2]
 * (a maestria começa em `special0` e ganha 2 pontos por nível).
 */
export function learnLevel(id: number, special0 = 0): number {
  const s = skillById(id);
  for (let lv = s.reqLevel; lv < 400; lv++) {
    const mastery = Math.min(masteryCapAt(lv), special0 + 2 * lv);
    if (skillPointsAt(lv) >= cumulativePoints(id) && mastery >= s.reqSpecial) return lv;
  }
  throw new Error(`skill ${id} sem nível possível`);
}

/** Foema_Ancian (NPCGener.txt [3407], Merchant 19): o mestre de skills da Foema, em Armia. */
export const SKILL_MASTER: NpcSpec = { name: 'Foema_Ancian', merchant: 19, pos: { x: 2094, y: 2126 }, stand: { x: 2094, y: 2124 } };

/**
 * Onde testar as magias: a grade de Gremlins logo a leste de Armia (NPCGener.txt, spawns de 8 em
 * 8 tiles em x 2184–2224, y 2073–2129). Parado aqui, há 4 spawns a até 5 tiles.
 */
export const CAST_SPOT: Point = { x: 2196, y: 2109 };
export const ROUTE_TO_CAST_SPOT: Point[] = [{ x: 2150, y: 2100 }, { x: 2176, y: 2106 }, CAST_SPOT];
export const ROUTE_TO_MASTER: Point[] = [{ x: 2176, y: 2106 }, { x: 2140, y: 2110 }, SKILL_MASTER.stand];
