// Árvores de skills da Foema (classe 1): as skills, o mestre que as ensina e o campo onde o bot
// as testa, como estão no servidor (Jean1dev/w2pp-OpenWYD).
//
// - Magia Branca (árvore 1): skills 24–31, bits 0–7 do LearnedSkill, maestria Special[1].
// - Magia Negra (árvore 2): skills 32–39, bits 8–15, maestria Special[2].
// - Magia Especial (árvore 3): skills 40–47, bits 16–23, maestria Special[3].
// - Dados: Release/Common/SkillData.csv. Requisitos para aprender: ItemList.csv 5000 + skill,
//   "ReqLvl.ReqStr.ReqInt.ReqDex.ReqCon", em que ReqInt/ReqDex/ReqCon são comparados com
//   Special[1]/[2]/[3] (handler/skill.go learnSkill; legado _MSG_ApplyBonus.cpp:131-249). A 8ª
//   skill de cada árvore exige ainda as 7 anteriores e 50M de gold, e só uma 8ª por personagem.
// - Pontos: +3 de skill por nível (+4 a partir do 200) e +2 de maestria (handler/mobkilled.go).
import type { NpcSpec } from '../bot/npc.ts';
import type { Point } from './coveiro.ts';

export const FOEMA = 1;

/**
 * Como o bot testa o cast:
 * - damage/area: dano em 1 ou mais mobs;
 * - thunder: buff que dispara Relâmpagos sozinho (Trovão);
 * - heal: cura em si mesma (dano negativo no eco);
 * - detox: tira debuffs (InstanceType 8) — em si mesma;
 * - flash: tira os mobs de combate (InstanceType 7), sem dano;
 * - judgment: dano + o HP da Foema, que fica com HP/6 + 1 (Julgamento Divino);
 * - buff: affect em si mesma (SendAffect) e o efeito dele no score (velocidade, AC, dano, maestria);
 * - teleport: puxa o alvo para a posição da Foema (InstanceType 9);
 * - eighth: a 8ª skill, que só tem a recusa sem os 50M de gold.
 */
export type SkillKind = 'damage' | 'area' | 'thunder' | 'heal' | 'detox' | 'flash' | 'judgment' | 'buff' | 'teleport' | 'eighth';

export interface SkillDef {
  id: number;
  name: string;
  /** SkillPoint: pontos de skill que custa aprender. */
  points: number;
  /** ManaSpent: MP base (o servidor escala pela maestria). */
  mana: number;
  range: number;
  kind: SkillKind;
  /** Maior índice de Dam[] aceito (MaxTarget do SkillData; não é contagem). */
  maxTarget: number;
  /** Requisitos do ItemList: nível ARMAZENADO e Special[árvore]. */
  reqLevel: number;
  reqSpecial: number;
  /** InstanceValue: a base da fórmula de dano ou de cura. */
  base: number;
  /** AffectType e AffectValue do SkillData, para as skills de buff. */
  affect?: { type: number; value: number };
}

export interface SkillTree {
  key: 'negra' | 'branca' | 'especial';
  label: string;
  /** Índice da árvore: Special[tree] e (skill % 24) ÷ 8 + 1. */
  tree: number;
  skills: SkillDef[];
}

export const BLACK_MAGIC: SkillTree = {
  key: 'negra',
  label: 'Magia Negra',
  tree: 2,
  skills: [
    { id: 32, name: 'Ataque de Fogo', points: 18, mana: 7, range: 5, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 20 },
    { id: 33, name: 'Relâmpago', points: 51, mana: 10, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 65 },
    { id: 34, name: 'Lança de Gelo', points: 69, mana: 15, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 29, reqSpecial: 0, base: 95 },
    { id: 35, name: 'Tempestade de Meteoros', points: 72, mana: 25, range: 6, kind: 'area', maxTarget: 13, reqLevel: 45, reqSpecial: 0, base: 55 },
    { id: 36, name: 'Nevasca', points: 72, mana: 35, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 75, reqSpecial: 112, base: 200 },
    { id: 37, name: 'Trovão', points: 90, mana: 75, range: 0, kind: 'thunder', maxTarget: 1, reqLevel: 99, reqSpecial: 148, base: 0 },
    { id: 38, name: 'Fênix de Fogo', points: 81, mana: 85, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 139, reqSpecial: 190, base: 350 },
    { id: 39, name: 'Inferno', points: 224, mana: 220, range: 6, kind: 'eighth', maxTarget: 13, reqLevel: 219, reqSpecial: 200, base: 340 },
  ],
};

export const WHITE_MAGIC: SkillTree = {
  key: 'branca',
  label: 'Magia Branca',
  tree: 1,
  skills: [
    { id: 24, name: 'Flecha Mágica', points: 12, mana: 5, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 15 },
    { id: 25, name: 'Desintoxicar', points: 42, mana: 12, range: 6, kind: 'detox', maxTarget: 1, reqLevel: 19, reqSpecial: 0, base: 0 },
    { id: 26, name: 'Flash', points: 66, mana: 40, range: 0, kind: 'flash', maxTarget: 13, reqLevel: 33, reqSpecial: 0, base: 8 },
    { id: 27, name: 'Cura', points: 48, mana: 15, range: 6, kind: 'heal', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 100 },
    { id: 28, name: 'Choque Divino', points: 78, mana: 30, range: 5, kind: 'damage', maxTarget: 2, reqLevel: 57, reqSpecial: 86, base: 155 },
    { id: 29, name: 'Recuperar', points: 48, mana: 30, range: 6, kind: 'heal', maxTarget: 13, reqLevel: 68, reqSpecial: 102, base: 150 },
    { id: 30, name: 'Julgamento Divino', points: 102, mana: 150, range: 1, kind: 'judgment', maxTarget: 5, reqLevel: 132, reqSpecial: 180, base: 200 },
    { id: 31, name: 'Renascimento', points: 281, mana: 0, range: 5, kind: 'eighth', maxTarget: 1, reqLevel: 219, reqSpecial: 200, base: 0 },
  ],
};

/**
 * Magia Especial. O SkillData troca os nomes de 41 e 42 ("Teleporte"/"Velocidade"); o ItemList
 * (5041 Velocidade, 5042 Teleporte) e os dados batem com a 41 = Velocidade (AffectType 2, grupo) e
 * a 42 = Teleporte (InstanceType 9, sem MP). Os requisitos vêm do ItemList 5000 + skill.
 */
export const SPECIAL_MAGIC: SkillTree = {
  key: 'especial',
  label: 'Magia Especial',
  tree: 3,
  skills: [
    { id: 40, name: 'Névoa Venenosa', points: 24, mana: 9, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 20 },
    { id: 41, name: 'Velocidade', points: 39, mana: 52, range: 5, kind: 'buff', maxTarget: 13, reqLevel: 21, reqSpecial: 0, base: 0, affect: { type: 2, value: 1 } },
    { id: 42, name: 'Teleporte', points: 54, mana: 0, range: 0, kind: 'teleport', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0 },
    { id: 43, name: 'Escudo Mágico', points: 63, mana: 52, range: 6, kind: 'buff', maxTarget: 1, reqLevel: 33, reqSpecial: 0, base: 0, affect: { type: 11, value: 15 } },
    { id: 44, name: 'Arma Mágica', points: 75, mana: 78, range: 5, kind: 'buff', maxTarget: 13, reqLevel: 60, reqSpecial: 60, base: 0, affect: { type: 9, value: 90 } },
    { id: 45, name: 'Toque de Athena', points: 72, mana: 98, range: 6, kind: 'buff', maxTarget: 1, reqLevel: 76, reqSpecial: 76, base: 0, affect: { type: 15, value: 7 } },
    { id: 46, name: 'Controle de Mana', points: 81, mana: 130, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 140, reqSpecial: 0, base: 0, affect: { type: 18, value: 0 } },
    { id: 47, name: 'Cancelamento', points: 269, mana: 34, range: 5, kind: 'eighth', maxTarget: 5, reqLevel: 219, reqSpecial: 200, base: 0 },
  ],
};

export const TREES: Record<SkillTree['key'], SkillTree> = { negra: BLACK_MAGIC, branca: WHITE_MAGIC, especial: SPECIAL_MAGIC };

/**
 * O que um buff muda no score (BASE_GetCurrentScore, Basedef.cpp:3950-4090; handler/affect_score.go),
 * com `level` = a maestria da Foema no cast (o Level do affect):
 * - 2 Velocidade: corrida + Value;
 * - 11 Escudo Mágico: AC + Level/3 + Value;
 * - 9 Arma Mágica: dano + (Level×5/20 + Value)×3/2, ×3 numa Foema com o bit 19 (Escudo Mágico);
 * - 15 Toque de Athena: cada Special + Level/10 + Value.
 */
export function buffGain(type: number, value: number, level: number, learn = 0): number {
  switch (type) {
    case 2: return value;
    case 11: return Math.trunc(level / 3) + value;
    case 9: {
      const add = Math.trunc(((Math.trunc((level * 5) / 20) + value) * 3) / 2);
      return learn & 0x80000 ? add * 3 : add;
    }
    case 15: return Math.trunc(level / 10) + value;
    default: return 0;
  }
}

/** Gold que a 8ª skill de uma árvore custa (handler/skill.go eighthSkillCoin). */
export const EIGHTH_SKILL_COIN = 50_000_000;

/** Bit da skill no LearnedSkill. */
export const learnBit = (id: number) => 1 << (id % 24);

/** Pontos de skill que o nível armazenado dá (BASE_GetBonusSkillPoint, handler/skill.go deriveSkillBonus). */
export const skillPointsAt = (level: number) => 3 * level + Math.max(0, level - 199);

/** Teto de maestria por árvore no nível (skill.go applySpecialBonus): 3×(nível+1)/2 e 200. */
export const masteryCapAt = (level: number) => Math.min((3 * (level + 1)) >> 1, 200);

/** Custo de MP do cast (BASE_GetManaSpent, combat/skill.go ManaSpent). */
export const manaCost = (mana: number, special: number, saveMana = 0) => Math.trunc(((100 - saveMana) * Math.trunc((mana * (Math.trunc(special / 2) + 100)) / 100)) / 100);

/**
 * Cura de um mortal (_MSG_Attack.cpp:624-645, handler/combat.go resolveSkillHit): Cura (27) é
 * 2×Special + base, as outras 3×Special/2 + base; no máximo 1100 e no mínimo 6.
 */
export function healAmount(s: SkillDef, special: number): number {
  const heal = s.id === 27 ? 2 * special + s.base : Math.trunc((3 * special) / 2) + s.base;
  return Math.max(6, Math.min(1100, heal));
}

/** HP da Foema depois do Julgamento Divino em `n` alvos: HP/6 + 1 a cada alvo (_MSG_Attack.cpp:1032). */
export function judgmentHp(hp: number, n: number): number {
  for (let i = 0; i < n; i++) hp = Math.trunc(hp / 6) + 1;
  return hp;
}

export const skillIn = (t: SkillTree, id: number): SkillDef => {
  const s = t.skills.find((x) => x.id === id);
  if (!s) throw new Error(`skill ${id} não é da ${t.label}`);
  return s;
};

/** Pontos de skill acumulados até a skill `id`, aprendendo na ordem da árvore. */
export const cumulativePoints = (t: SkillTree, id: number) => t.skills.filter((s) => s.id <= id).reduce((n, s) => n + s.points, 0);

/**
 * Menor nível armazenado em que a skill pode ser aprendida, na ordem da árvore: o requisito de
 * nível, os pontos acumulados e o teto de maestria que alcança o requisito de Special
 * (a maestria começa em `special0` e ganha 2 pontos por nível).
 */
export function learnLevel(t: SkillTree, id: number, special0 = 0): number {
  const s = skillIn(t, id);
  for (let lv = s.reqLevel; lv < 400; lv++) {
    const mastery = Math.min(masteryCapAt(lv), special0 + 2 * lv);
    if (skillPointsAt(lv) >= cumulativePoints(t, id) && mastery >= s.reqSpecial) return lv;
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
