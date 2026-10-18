// Quest 14 — Sub-Celestial e troca de subclasse (Urnammu) (docs/quests/14-sub-celestial.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Criar o Sub: _MSG_UseItem.cpp:3029-3085, ramo CELESTIAL do Vol 211 (5338 Pedra_Ideal): Sephirot
//   1760–1763 no Equip[11], CurrentScore.Level ≥ 120 → CELESTIALCS, SaveCelestial[1] montado, a Sephirot
//   e uma 5338 somem, _NN_My_King_Bless1. No Go a 5338 não tem caso (#407) e o useIdealStone (1742) só
//   aceita Arch (handler/item.go:509).
// - Urnammu: _MSG_Quest.cpp:1247-1311 (CELESTIALCS, Sephirot no Equip[11], Fame ≥ 2000). NPCGener [4235]
//   (3232,1685), no "Continente desconhecido": no legado só se chega pelo teleporte Deserto → Kefra
//   (GetFunc.cpp:1006-1010, com o Kefra morto) ou pelo /kefra. O Go não tem esse teleporte (world/teleport.go)
//   e o /kefra vai para (2365,3884) (handler/chat.go:261). O bot grava o ponto da Gema Estelar (save_x/save_y)
//   ao lado do Urnammu e usa o Pergaminho_do_Teleporte (699, Vol 13, usePortalScroll item.go:929).
import type { NpcSpec } from '../../bot/npc.ts';

export const ITEM = {
  pedraIdeal: 5338,
  /** Sephirot TK 1760, FM 1761, BM 1762, HT 1763 (classe = índice − 1760). */
  sephirot: { tk: 1760, fm: 1761, bm: 1762, ht: 1763 },
  pergaminhoTeleporte: 699,
} as const;

export const EQUIP_SLOT = { sephirot: 11 } as const;

export const NPC = {
  urnammu: { name: 'Urnammu', merchant: 76, pos: { x: 3232, y: 1685 }, stand: { x: 3234, y: 1687 } },
} as const satisfies Record<string, NpcSpec>;

/** Ponto da Gema Estelar semeado: ao lado do Urnammu. */
export const URNAMMU_SAVE = { x: 3235, y: 1688 } as const;

/** Fama que o Urnammu cobra. */
export const URNAMMU_FAME = 2000;
