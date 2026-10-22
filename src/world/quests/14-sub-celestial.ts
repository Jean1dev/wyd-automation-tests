// Quest 14 — Sub-Celestial e troca de subclasse (Urnammu) (docs/quests/14-sub-celestial.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Criar o Sub: _MSG_UseItem.cpp:3029-3085, ramo CELESTIAL do Vol 211 (5338 Pedra_Ideal): Sephirot
//   1760–1763 no Equip[11], CurrentScore.Level ≥ 120 → CELESTIALCS, SaveCelestial[1] montado, a Sephirot
//   e uma 5338 somem, _NN_My_King_Bless1. No Go a 5338 não tem caso (#407) e o useIdealStone (1742) só
//   aceita Arch (handler/item.go:509).
// - Urnammu: _MSG_Quest.cpp:1247-1311 (CELESTIALCS, Sephirot no Equip[11], Fame ≥ 2000). NPCGener [4235]
//   (3232,1685), no "Continente desconhecido": no legado só se chega pelo teleporte Deserto → Kefra
//   (GetFunc.cpp:1006-1010, com o Kefra morto) ou pelo /kefra (w2pp-OpenWYD#415, KEFRA abaixo). Nos casos do
//   Urnammu que não são sobre o caminho, o bot grava o ponto da Gema Estelar (save_x/save_y) ao lado dele e usa o
//   Pergaminho_do_Teleporte (699, Vol 13, usePortalScroll item.go:929).
import type { NpcSpec } from '../../bot/npc.ts';

export const ITEM = {
  pedraIdeal: 5338,
  /** Sephirot TK 1760, FM 1761, BM 1762, HT 1763 (classe = índice − 1760). */
  sephirot: { tk: 1760, fm: 1761, bm: 1762, ht: 1763 },
  pergaminhoTeleporte: 699,
  /** Pedra Misteriosa: alterna Celestial ↔ Sub-Celestial dentro de uma cidade (_MSG_UseItem.cpp:3186-3289). */
  pedraMisteriosa: 4148,
} as const;

export const EQUIP_SLOT = { sephirot: 11 } as const;

export const NPC = {
  urnammu: { name: 'Urnammu', merchant: 76, pos: { x: 3232, y: 1685 }, stand: { x: 3234, y: 1687 } },
} as const satisfies Record<string, NpcSpec>;

/** Ponto da Gema Estelar semeado: ao lado do Urnammu. */
export const URNAMMU_SAVE = { x: 3235, y: 1688 } as const;

/** Fama que o Urnammu cobra. */
export const URNAMMU_FAME = 2000;

/**
 * Caminho ao Urnammu (w2pp-OpenWYD#415):
 * - portal do Deserto (2364,3924) → (3250..3252,1703..1705), só com o Kefra derrotado (GetFunc.cpp:1006-1010);
 * - /kefra (_MSG_MessageWhisper.cpp:836-850): Kefra vivo → (2365..2367,3884..3886) + "O kefra ainda esta vivo, precisa
 *   ser derrotado"; derrotado → (3250..3252,1695..1697) + _NN_TP_KEFRA "Teleportado para Kefra.".
 * O estado do Kefra é global (tabela kefra_state), o tmServer só o lê no boot e ele muda o EXP de todos: não se semeia.
 */
export const KEFRA = {
  desertTile: { x: 2364, y: 3924 },
  desertDest: { x: 3250, y: 1703 },
  aliveDest: { x: 2365, y: 3884 },
  defeatedDest: { x: 3250, y: 1695 },
  aliveText: 'O kefra ainda esta vivo, precisa ser derrotado',
  tpText: 'Teleportado para Kefra.',
} as const;

/** Cidades de BASE_GetVillage (world/city.go): Armia é a 0. */
export const ARMIA_LIMIT = { x1: 2052, y1: 2052, x2: 2171, y2: 2163 } as const;
