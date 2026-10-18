// Quest 12 — Pedra Ideal e Arch → Celestial (docs/quests/12-celestial.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Pedra Ideal no Rei: _MSG_Quest.cpp:769-840 — com confirm ≠ 0, Equip[10] = 1742, Equip[11] ∈
//   1760–1763 e as quatro Pedras Secretas no inventário, a 5334 vira 5338, as 5335–5337 somem e o
//   Equip[10]/[11] ficam vazios, ANTES da criação do Arch (:842). Qualquer ClassMaster. No Go, kingQuest
//   (handler/misc.go:262) não tem esse ramo (comentário em misc.go:514-524): o Mortal ≥ 299 vai direto
//   para o kingArch e o Arch cai no serviço de capa.
// - Celestial: _MSG_UseItem.cpp:3003-3159 (Vol 211 = 5338 Pedra_Ideal no ItemList). Arch com
//   CurrentScore.Level ≥ 355, Equip[1] vazio e QuestInfo.Arch.MortalLevel ≥ 99. No Go, useIdealStone
//   (handler/item.go:1525) é disparado pela 1742 (Pedra_da_Imortalidade, item.go:509, issue #222);
//   a 5338 não tem caso. A Cythera do Go também exige Cristal 4 para a 3501/3502 (penalidade pedida
//   no #327); o legado olha só o nível.
// - Rei: Rei_Glantuar (cenário 5, src/world/arch.ts); Clan 0 passa em qualquer rei.
import type { NpcSpec } from '../../bot/npc.ts';
import { NPC as ARCH_NPC, ROUTE_TO_KING } from '../arch.ts';

export { ROUTE_TO_KING };

export const ITEM = {
  pedraImortalidade: 1742,
  sephirotTK: 1760,
  /** Pedras Secretas: Água 5334, Terra 5335, Sol 5336, Vento 5337. */
  pedraSecreta: [5334, 5335, 5336, 5337],
  pedraIdeal: 5338,
  /** Elmo_de_Aço (TK, Equip[1]): a "armadura" que trava o Celestial. */
  elmo: 100,
  cytheraPrateada: 3500,
  cytheraArcana: 3501,
  cytheraMistica: 3502,
  capaMestreHekalotia: 3197,
  capaMestreAkelonia: 3198,
  capaMestreSemReino: 3199,
} as const;

export const EQUIP_SLOT = { cythera: 1, imortalidade: 10, sephirot: 11, capa: 15 } as const;

/** Bit 30 do LearnedSkill (Alma): a única skill do Celestial novo. */
export const SOUL_BIT = 1 << 30;

export const CELESTIAL_SPECIAL_BONUS = 855;

/** Exp mínima dos níveis armazenados usados (level/nextlevel.go). */
export const EXP_AT: Record<number, number> = {
  299: 593_702_090,
  354: 2_000_000_000,
  355: 2_039_000_000,
  399: 4_000_000_000,
};

export const NPC = {
  rei: ARCH_NPC.rei,
} as const satisfies Record<string, NpcSpec>;

/** Atributos e HP de um personagem de nível alto (o Go não recalcula HP pelo nível). */
export const HIGH_SEED = { str: 900, dex: 250, con: 600, int: 10, max_hp: 25000, hp: 25000, max_mp: 3000, mp: 3000 } as const;
