// Árvores de skills por classe: as skills, o mestre que as ensina e o campo onde o bot as testa,
// como estão no servidor (Jean1dev/w2pp-OpenWYD). Cada classe tem 24 skills (classe × 24 + 0..23),
// em três árvores de 8: a árvore k usa os bits 8(k−1)..8k−1 do LearnedSkill e a maestria Special[k].
//
// - Foema (classe 1): Magia Branca 24–31, Magia Negra 32–39, Magia Especial 40–47.
// - BeastMaster (classe 2): magias 48–55, evocações 56–63, transformações 64–71.
// - Huntress (classe 3): árvores 72–79, 80–87 e 88–95.
// - Dados: Release/Common/SkillData.csv. Requisitos para aprender: ItemList.csv 5000 + skill,
//   "ReqLvl.ReqStr.ReqInt.ReqDex.ReqCon", em que ReqInt/ReqDex/ReqCon são comparados com
//   Special[1]/[2]/[3] (handler/skill.go learnSkill; legado _MSG_ApplyBonus.cpp:131-249). A 8ª
//   skill de cada árvore exige ainda as 7 anteriores e 50M de gold, e só uma 8ª por personagem.
// - Pontos: +3 de skill por nível (+4 a partir do 200) e +2 de maestria (handler/mobkilled.go).
import type { NpcSpec } from '../bot/npc.ts';
import type { Point } from './coveiro.ts';

export const FOEMA = 1;
export const BEASTMASTER = 2;
export const HUNTRESS = 3;

/** Foema_Ancian (NPCGener.txt [3407], Merchant 19): o mestre de skills da Foema, em Armia. */
export const FOEMA_MASTER: NpcSpec = { name: 'Foema_Ancian', merchant: 19, pos: { x: 2094, y: 2126 }, stand: { x: 2094, y: 2124 } };
/** Mestre_Archi (NPCGener.txt [3427], Merchant 19): o mestre de skills do BeastMaster (Carry 5048–5071), em Armia. */
export const BM_MASTER: NpcSpec = { name: 'Mestre_Archi', merchant: 19, pos: { x: 2077, y: 2123 }, stand: { x: 2079, y: 2123 } };

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
 * - debuff: affect hostil sem dano (Enfraquecer); em mob o SetAffect não pega, como no legado;
 * - ethereal: Chamas Etéreas (InstanceType 12), que só age em jogador; em mob vale o cast;
 * - summon: evocação (InstanceType 11) — o número de bichos é Special[2]/30, /40 ou /80;
 * - transform: transformação do BM (affect 16) — AC e HP máximo pela pTransBonus;
 * - passive: skill passiva — o cast é recusado; a passiva melhora a transformação `boosts` ou,
 *   com `passiveAc`, soma Special[3]/3 + 10 de AC ao ser aprendida (Proteção das Sombras);
 * - illusion: a Ilusão da Huntress, que é um movimento MSG_Action3 com 45 de MP;
 * - utility: usada fora do combate (Alquimia, Extração na combinação de itens): só se aprende;
 * - eighth: a 8ª skill, que só tem a recusa sem os 50M de gold.
 */
export type SkillKind = 'damage' | 'area' | 'thunder' | 'heal' | 'detox' | 'flash' | 'judgment' | 'buff' | 'teleport'
  | 'debuff' | 'ethereal' | 'summon' | 'transform' | 'passive' | 'illusion' | 'utility' | 'eighth';

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
  /** AffectType e AffectValue do SkillData, para as skills de buff, debuff e transformação. */
  affect?: { type: number; value: number };
  /** Trovão / Aura Bestial: a skill que o tick dispara e o MP base dela. */
  tick?: { skill: number; mana: number };
  /** Evocação: o InstanceValue (o tipo de bicho, 1–8). */
  summon?: number;
  /** Passiva: a transformação que ela melhora. */
  boosts?: number;
  /** Passiva que soma Special[3]/3 + 10 de AC com o bit 23 aprendido (Proteção das Sombras). */
  passiveAc?: boolean;
}

export type TreeKey = 'negra' | 'branca' | 'especial' | 'bm-magia' | 'bm-evocacao' | 'bm-transformacao' | 'ht-1' | 'ht-2' | 'ht-3';

export interface SkillTree {
  key: TreeKey;
  label: string;
  /** Classe do personagem (STRUCT_MOB.Class) e a conta do .env do cenário. */
  cls: number;
  account: 'foema' | 'bm' | 'ht';
  /** Nome do estado e da pasta de relatório. */
  scenario: string;
  /** O mestre de skills da classe (Merchant 19), que abre a janela das 24 skills dela. */
  master: NpcSpec;
  /** Índice da árvore: Special[tree] e (skill % 24) ÷ 8 + 1. */
  tree: number;
  skills: SkillDef[];
}

export const BLACK_MAGIC: SkillTree = {
  key: 'negra',
  label: 'Magia Negra',
  cls: FOEMA,
  account: 'foema',
  scenario: 'foema-black-magic',
  master: FOEMA_MASTER,
  tree: 2,
  skills: [
    { id: 32, name: 'Ataque de Fogo', points: 18, mana: 7, range: 5, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 20 },
    { id: 33, name: 'Relâmpago', points: 51, mana: 10, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 65 },
    { id: 34, name: 'Lança de Gelo', points: 69, mana: 15, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 29, reqSpecial: 0, base: 95 },
    { id: 35, name: 'Tempestade de Meteoros', points: 72, mana: 25, range: 6, kind: 'area', maxTarget: 13, reqLevel: 45, reqSpecial: 0, base: 55 },
    { id: 36, name: 'Nevasca', points: 72, mana: 35, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 75, reqSpecial: 112, base: 200 },
    { id: 37, name: 'Trovão', points: 90, mana: 75, range: 0, kind: 'thunder', maxTarget: 1, reqLevel: 99, reqSpecial: 148, base: 0, tick: { skill: 33, mana: 10 } },
    { id: 38, name: 'Fênix de Fogo', points: 81, mana: 85, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 139, reqSpecial: 190, base: 350 },
    { id: 39, name: 'Inferno', points: 224, mana: 220, range: 6, kind: 'eighth', maxTarget: 13, reqLevel: 219, reqSpecial: 200, base: 340 },
  ],
};

export const WHITE_MAGIC: SkillTree = {
  key: 'branca',
  label: 'Magia Branca',
  cls: FOEMA,
  account: 'foema',
  scenario: 'foema-white-magic',
  master: FOEMA_MASTER,
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
  cls: FOEMA,
  account: 'foema',
  scenario: 'foema-special-magic',
  master: FOEMA_MASTER,
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

/**
 * BeastMaster, árvore 1 (magias). O ItemList chama a 54 de "Força_Elemental"; o SkillData, de Aura
 * Bestial (TickType 23: dispara Fúria de Gaia sozinha, handler/affect_tick.go applyBeastAuraTick).
 */
export const BM_MAGIC: SkillTree = {
  key: 'bm-magia',
  label: 'BeastMaster: magias',
  cls: BEASTMASTER,
  account: 'bm',
  scenario: 'bm-magic',
  master: BM_MASTER,
  tree: 1,
  skills: [
    { id: 48, name: 'Fera Flamejante', points: 24, mana: 8, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 25 },
    { id: 49, name: 'Chamas Etéreas', points: 36, mana: 35, range: 6, kind: 'ethereal', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0 },
    { id: 50, name: 'Som das Fadas', points: 69, mana: 20, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 38, reqSpecial: 0, base: 115 },
    { id: 51, name: 'Enfraquecer', points: 45, mana: 35, range: 6, kind: 'debuff', maxTarget: 13, reqLevel: 45, reqSpecial: 0, base: 0, affect: { type: 10, value: 10 } },
    { id: 52, name: 'Fúria de Gaia', points: 75, mana: 25, range: 5, kind: 'area', maxTarget: 13, reqLevel: 63, reqSpecial: 63, base: 220 },
    { id: 53, name: 'Proteção Elemental', points: 78, mana: 105, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 81, reqSpecial: 81, base: 0, affect: { type: 25, value: 10 } },
    { id: 54, name: 'Aura Bestial', points: 90, mana: 128, range: 0, kind: 'thunder', maxTarget: 1, reqLevel: 135, reqSpecial: 135, base: 0, tick: { skill: 52, mana: 25 } },
    { id: 55, name: 'Espírito Vingador', points: 239, mana: 160, range: 4, kind: 'eighth', maxTarget: 5, reqLevel: 219, reqSpecial: 200, base: 180 },
  ],
};

/**
 * BeastMaster, árvore 2 (evocações, InstanceType 11). O InstanceValue v evoca o modelo v − 1 de
 * BaseSummon (content/basesummon.go): Condor, Javali, Lobo, Urso, Tigre, Gorila, Dragao_Negro,
 * Succubus. O SkillData chama a 59 de Grande Tigre e a 60 de Urso Selvagem, mas a 59 evoca o Urso
 * e a 60 o Tigre, como diz o ItemList; os nomes aqui seguem o bicho. Os pontos das 8 somam 727:
 * a recusa da Succubus sem gold só vem depois do nível exibido 233.
 */
export const BM_SUMMON: SkillTree = {
  key: 'bm-evocacao',
  label: 'BeastMaster: evocações',
  cls: BEASTMASTER,
  account: 'bm',
  scenario: 'bm-summon',
  master: BM_MASTER,
  tree: 2,
  skills: [
    { id: 56, name: 'Evocar Condor', points: 33, mana: 30, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 1, summon: 1 },
    { id: 57, name: 'Evocar Javali Selvagem', points: 51, mana: 55, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 2, summon: 2 },
    { id: 58, name: 'Evocar Lobo', points: 72, mana: 75, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 46, reqSpecial: 0, base: 3, summon: 3 },
    { id: 59, name: 'Evocar Urso Selvagem', points: 72, mana: 90, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 53, reqSpecial: 0, base: 4, summon: 4 },
    { id: 60, name: 'Evocar Grande Tigre', points: 84, mana: 120, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 72, reqSpecial: 86, base: 5, summon: 5 },
    { id: 61, name: 'Evocar Gorila Gigante', points: 93, mana: 130, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 94, reqSpecial: 112, base: 6, summon: 6 },
    { id: 62, name: 'Evocar Dragão Negro', points: 102, mana: 155, range: 0, kind: 'summon', maxTarget: 1, reqLevel: 139, reqSpecial: 166, base: 7, summon: 7 },
    { id: 63, name: 'Evocar Succubus', points: 220, mana: 240, range: 0, kind: 'eighth', maxTarget: 1, reqLevel: 219, reqSpecial: 200, base: 8, summon: 8 },
  ],
};

/**
 * BeastMaster, árvore 3 (transformações, affect 16, e as passivas que as melhoram: bits 17, 19 e 21
 * = Lobo, Urso e Astaroth, Basedef.cpp:4112-4114). O ItemList chama a 65 de "Armadura_Elemental"
 * e a 69 de "Metamorfose_Superior"; os nomes aqui são os do SkillData.
 */
export const BM_TRANSFORM: SkillTree = {
  key: 'bm-transformacao',
  label: 'BeastMaster: transformações',
  cls: BEASTMASTER,
  account: 'bm',
  scenario: 'bm-transform',
  master: BM_MASTER,
  tree: 3,
  skills: [
    { id: 64, name: 'Lobisomem', points: 33, mana: 72, range: 0, kind: 'transform', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0, affect: { type: 16, value: 1 } },
    { id: 65, name: 'Coração de Lobo', points: 45, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 0, reqSpecial: 0, base: 0, boosts: 64 },
    { id: 66, name: 'Homem-Urso', points: 66, mana: 144, range: 0, kind: 'transform', maxTarget: 1, reqLevel: 43, reqSpecial: 0, base: 0, affect: { type: 16, value: 2 } },
    { id: 67, name: 'Escudo do Tormento', points: 45, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 43, reqSpecial: 0, base: 0, boosts: 66 },
    { id: 68, name: 'Astaroth', points: 99, mana: 260, range: 0, kind: 'transform', maxTarget: 1, reqLevel: 88, reqSpecial: 88, base: 0, affect: { type: 16, value: 3 } },
    { id: 69, name: 'Asas do Inferno', points: 45, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 88, reqSpecial: 88, base: 0, boosts: 68 },
    { id: 70, name: 'Titã', points: 132, mana: 300, range: 0, kind: 'transform', maxTarget: 1, reqLevel: 140, reqSpecial: 140, base: 0, affect: { type: 16, value: 4 } },
    { id: 71, name: 'Éden', points: 212, mana: 300, range: 0, kind: 'eighth', maxTarget: 1, reqLevel: 219, reqSpecial: 200, base: 0, affect: { type: 16, value: 5 } },
  ],
};

/** ForeLearner (NPCGener.txt [3417], Merchant 19): o mestre de skills da Huntress (Carry 5072–5095), em Armia. */
export const HT_MASTER: NpcSpec = { name: 'ForeLearner', merchant: 19, pos: { x: 2130, y: 2125 }, stand: { x: 2130, y: 2123 } };

/**
 * Huntress, árvore 1. Os nomes seguem o SkillData e docs/migration/skills/huntress.md do servidor (o
 * ItemList troca 74/75). A Ilusão (73) não é cast: é o MSG_Action3, que cobra 45 de MP
 * (_MSG_Action.cpp:72-99, handler/movement.go consumeIllusion).
 */
export const HT_T1: SkillTree = {
  key: 'ht-1',
  label: 'Huntress: árvore 1',
  cls: HUNTRESS,
  account: 'ht',
  scenario: 'ht-tree1',
  master: HT_MASTER,
  tree: 1,
  skills: [
    { id: 72, name: 'Ataque Fatal', points: 21, mana: 15, range: 2, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 30 },
    { id: 73, name: 'Ilusão', points: 39, mana: 45, range: 0, kind: 'illusion', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0 },
    { id: 74, name: 'Encantar Gelo', points: 66, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 34, reqSpecial: 0, base: 0 },
    { id: 75, name: 'Agressividade', points: 51, mana: 30, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 47, reqSpecial: 0, base: 0, affect: { type: 27, value: 1 } },
    { id: 76, name: 'Imunidade', points: 84, mana: 42, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 60, reqSpecial: 90, base: 0, affect: { type: 19, value: 15 } },
    { id: 77, name: 'Meditação', points: 87, mana: 90, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 82, reqSpecial: 123, base: 0, affect: { type: 21, value: 15 } },
    { id: 78, name: 'Lança de Ferro', points: 96, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 139, reqSpecial: 162, base: 0 },
    { id: 79, name: 'Tempestade de Raios', points: 233, mana: 75, range: 6, kind: 'eighth', maxTarget: 6, reqLevel: 219, reqSpecial: 200, base: 0 },
  ],
};

/**
 * Huntress, árvore 2. A 85 aplica o affect 31 ("Escudo Dourado": AC + Level/2 + 150) e cobra
 * 100 × Special[2] de gold (_MSG_Attack.cpp:223-232); a 86 é dano em área. Alquimia (83) e Extração
 * (84) são usadas pela combinação de itens, não por cast.
 */
export const HT_T2: SkillTree = {
  key: 'ht-2',
  label: 'Huntress: árvore 2',
  cls: HUNTRESS,
  account: 'ht',
  scenario: 'ht-tree2',
  master: HT_MASTER,
  tree: 2,
  skills: [
    { id: 80, name: 'Golpe Felino', points: 18, mana: 10, range: 2, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 30 },
    { id: 81, name: 'Ligação Espectral', points: 39, mana: 108, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0, affect: { type: 37, value: 0 } },
    { id: 82, name: 'Perícia do Caçador', points: 69, mana: 15, range: 0, kind: 'passive', maxTarget: 1, reqLevel: 33, reqSpecial: 0, base: 0 },
    { id: 83, name: 'Alquimia', points: 54, mana: 30, range: 0, kind: 'utility', maxTarget: 1, reqLevel: 48, reqSpecial: 0, base: 0 },
    { id: 84, name: 'Extração', points: 84, mana: 30, range: 0, kind: 'utility', maxTarget: 1, reqLevel: 61, reqSpecial: 61, base: 0 },
    { id: 85, name: 'Explosão Etérea', points: 90, mana: 120, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 82, reqSpecial: 82, base: 0, affect: { type: 31, value: 150 } },
    { id: 86, name: 'Escudo Dourado', points: 81, mana: 25, range: 6, kind: 'area', maxTarget: 10, reqLevel: 131, reqSpecial: 131, base: 35 },
    { id: 87, name: 'Troca de Espíritos', points: 242, mana: 90, range: 0, kind: 'eighth', maxTarget: 1, reqLevel: 219, reqSpecial: 200, base: 160 },
  ],
};

/**
 * Huntress, árvore 3. A Proteção das Sombras (94) soma Special[3]/3 + 10 de AC, mas o legado confere
 * o bit 23 (Basedef.cpp:3867, `LearnedSkill & (1 << 23) // 22`), que é a Invisibilidade (95), e
 * não o bit 22 da própria 94; o Go copia (handler/score_derive.go:331). Sem a 8ª, a AC não muda.
 */
export const HT_T3: SkillTree = {
  key: 'ht-3',
  label: 'Huntress: árvore 3',
  cls: HUNTRESS,
  account: 'ht',
  scenario: 'ht-tree3',
  master: HT_MASTER,
  tree: 3,
  skills: [
    { id: 88, name: 'Lâmina das Sombras', points: 24, mana: 9, range: 6, kind: 'damage', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0 },
    { id: 89, name: 'Evasão Aprimorada', points: 42, mana: 24, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 0, reqSpecial: 0, base: 0, affect: { type: 26, value: 1 } },
    { id: 90, name: 'Toxina da Serpente', points: 51, mana: 35, range: 0, kind: 'passive', maxTarget: 1, reqLevel: 32, reqSpecial: 0, base: 0 },
    { id: 91, name: 'Visão Caçadora', points: 69, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 50, reqSpecial: 0, base: 0 },
    { id: 92, name: 'Olhos de Águia', points: 75, mana: 30, range: 0, kind: 'buff', maxTarget: 1, reqLevel: 61, reqSpecial: 92, base: 0, affect: { type: 36, value: 1 } },
    { id: 93, name: 'Lâmina Aérea', points: 90, mana: 0, range: 0, kind: 'passive', maxTarget: 1, reqLevel: 82, reqSpecial: 123, base: 0 },
    { id: 94, name: 'Proteção das Sombras', points: 96, mana: 0, range: 0, kind: 'passive', maxTarget: 0, reqLevel: 139, reqSpecial: 166, base: 0, passiveAc: true },
    { id: 95, name: 'Invisibilidade', points: 233, mana: 90, range: 0, kind: 'eighth', maxTarget: 1, reqLevel: 219, reqSpecial: 200, base: 160 },
  ],
};

export const TREES: Record<TreeKey, SkillTree> = {
  negra: BLACK_MAGIC, branca: WHITE_MAGIC, especial: SPECIAL_MAGIC,
  'bm-magia': BM_MAGIC, 'bm-evocacao': BM_SUMMON, 'bm-transformacao': BM_TRANSFORM,
  'ht-1': HT_T1, 'ht-2': HT_T2, 'ht-3': HT_T3,
};

/** Bichos de uma evocação (_MSG_Attack.cpp:818-828, handler/summon.go summonCount). */
export function summonCount(value: number, special: number): number {
  if (value === 1 || value === 2) return Math.trunc(special / 30);
  if (value >= 3 && value <= 5) return Math.trunc(special / 40);
  if (value === 6 || value === 7) return Math.trunc(special / 80);
  return value === 8 ? 1 : 0;
}

/** Modelo de BaseSummon de cada InstanceValue (1–8). */
export const SUMMON_MOB = ['', 'Condor', 'Javali', 'Lobo', 'Urso', 'Tigre', 'Gorila', 'Dragao_Negro', 'Succubus'];

/** Menor Special[2] que evoca ao menos um bicho. */
export const summonMinSpecial = (value: number) => (value <= 2 ? 30 : value <= 5 ? 40 : value <= 7 ? 80 : 0);

/**
 * pTransBonus[5] (Basedef.cpp:759-767): MinAc, MaxAc, MinHp, MaxHp e RunSpeed de cada fera (Lobo,
 * Urso, Astaroth, Titã, Éden), e o que a passiva de cada uma soma (AcAdd, HpAdd), com o bit que
 * ela exige (Titã e Éden somam sem bit).
 */
export const TRANS_BONUS = [
  { minAc: 95, maxAc: 105, minHp: 95, maxHp: 105, run: 1, acAdd: 3, hpAdd: 5, bit: 0x20000 },
  { minAc: 100, maxAc: 110, minHp: 110, maxHp: 140, run: 0, acAdd: 0, hpAdd: 15, bit: 0x80000 },
  { minAc: 105, maxAc: 115, minHp: 100, maxHp: 120, run: 1, acAdd: 5, hpAdd: 5, bit: 0x200000 },
  { minAc: 110, maxAc: 125, minHp: 105, maxHp: 110, run: 0, acAdd: 10, hpAdd: 5, bit: 0 },
  { minAc: 110, maxAc: 120, minHp: 105, maxHp: 115, run: 3, acAdd: 5, hpAdd: 10, bit: 0 },
];

/**
 * AC, HP máximo e corrida de um BM transformado, como o legado calcula (Basedef.cpp:4160-4206):
 * multi = (max − min)×Level/200 + min; AC = AC×multi/100 (+5 no Lobo); MaxHp = MaxHp×multi/100;
 * a corrida ganha o RunSpeed da fera (teto 6).
 */
export function transformScore(value: number, level: number, learn: number, base: { ac: number; maxHp: number; run: number }): { ac: number; maxHp: number; run: number } {
  const b = TRANS_BONUS[value - 1];
  const gated = b.bit === 0 || (learn & b.bit) !== 0;
  const acAdd = gated ? b.acAdd : 0;
  const hpAdd = gated ? b.hpAdd : 0;
  const multi = (lo: number, hi: number) => Math.trunc(((hi - lo) * level) / 200) + lo;
  const ac = Math.trunc((base.ac * multi(acAdd + b.minAc, acAdd + b.maxAc)) / 100) + (value === 1 ? 5 : 0);
  const maxHp = Math.trunc((base.maxHp * multi(hpAdd + b.minHp, hpAdd + b.maxHp)) / 100);
  return { ac, maxHp, run: Math.min(6, base.run + b.run) };
}

/**
 * O que um buff muda no score (BASE_GetCurrentScore, Basedef.cpp:3950-4090; handler/affect_score.go),
 * com `level` = a maestria da Foema no cast (o Level do affect):
 * - 2 Velocidade: corrida + Value;
 * - 11 Escudo Mágico: AC + Level/3 + Value;
 * - 9 Arma Mágica: dano + (Level×5/20 + Value)×3/2, ×3 numa Foema com o bit 19 (Escudo Mágico);
 * - 15 Toque de Athena: cada Special + Level/10 + Value;
 * - 25 Proteção Elemental: três resistências + (Value + Level/4)/10 (handler/affect_score.go);
 * - 21 Meditação: AC − (Level/3 + 10) (Basedef.cpp:4214-4222);
 * - 31 "Escudo Dourado" (skill 85): AC + Level/2 + Value (Basedef.cpp:4430-4434).
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
    case 25: return Math.trunc((value + Math.trunc(level / 4)) / 10) + (level >= 255 ? 20 : 0);
    case 21: return -(Math.trunc(level / 3) + 10);
    case 31: return Math.trunc(level / 2) + value;
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


/**
 * Onde testar as magias: a grade de Gremlins logo a leste de Armia (NPCGener.txt, spawns de 8 em
 * 8 tiles em x 2184–2224, y 2073–2129). Parado aqui, há 4 spawns a até 5 tiles.
 */
export const CAST_SPOT: Point = { x: 2196, y: 2109 };
export const ROUTE_TO_CAST_SPOT: Point[] = [{ x: 2150, y: 2100 }, { x: 2176, y: 2106 }, CAST_SPOT];
