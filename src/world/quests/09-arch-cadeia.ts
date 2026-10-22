// Quest 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei
// (docs/quests/09-arch-cadeia.md). NPCs, itens e faixas como estão no servidor
// (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Oráculo (BLACKORACLE, Merchant 78 nos dois bytes): _MSG_Quest.cpp:2257-2340; Go blackOracle
//   (handler/misc.go:736). Junta 1740 + 1741 (slot seguinte) com 10 safiras (697 = 1, 4131 = 10) na 1742.
// - Pedras Arch: _MSG_UseItem.cpp:514-715 — poeira (Vol 4/5) sobre uma pedra de boss 1752–1759 a
//   sorteia numa das 1744–1751. No Go o caminho da poeira (handler/refine.go:125 refineItem) não
//   tem esse caso: as pedras de boss têm EF_NOSANC e caem na recusa "não refina mais".
// - Sephirot (COMP_SEPHI, Merchant 19): _MSG_Quest.cpp:2102-2165 dá 1759 + Class do NPC; Go compSephi
//   (misc.go:802) dá 1760 + Class (issue #390). Class nos templates: Cap.Cavaleiros 1, Foema_Ancian 2,
//   Mestre_Archi 3, ForeLearner 4.
// - Rei: cenário 5 (src/world/arch.ts).
// - Posições: NPCGener.txt RedOracle (1760,1890), ao lado do Rei_Glantuar; mestres de skill em Armia
//   [3416] Cap.Cavaleiros (2144,2120), [3407] Foema_Ancian (2094,2126), [3427] Mestre_Archi (2077,2123),
//   [3417] ForeLearner (2130,2125).
import type { NpcSpec } from '../../bot/npc.ts';
import { BM_MASTER, FOEMA_MASTER } from '../skillTrees.ts';
import { EQUIP_SLOT, KING_MIN_LEVEL, NPC as ARCH_NPC, ROUTE_TO_KING } from '../arch.ts';

export { EQUIP_SLOT, KING_MIN_LEVEL };

export const ITEM = {
  almaUnicornio: 1740,
  almaFenix: 1741,
  pedraImortalidade: 1742,
  /** Pedras Arch 1744 (Inteligência) … 1751 (Reino). */
  pedraArchMin: 1744,
  pedraArchMax: 1751,
  /** Pedras de boss 1752 (Lorde Orc) … 1759 (Rei Demonlord). */
  pedraLordeOrc: 1752,
  sephirotBase: 1760,
  safira: 697,
  pacoteSafiras: 4131,
  poeiraOri: 412,
  poeiraLac: 413,
} as const;

/** Resultado possível da 1752 refinada (legado _MSG_UseItem.cpp:525-538): 1744–1747. */
export const LORDE_ORC_RESULT = { min: 1744, max: 1747 } as const;

export const PEDRAS_ARCH = Array.from({ length: 8 }, (_, i) => ITEM.pedraArchMin + i);

export const PRICE = { sephirot: 30_000_000, safiras: 10 } as const;

export const NPC = {
  rei: ARCH_NPC.rei,
  redOracle: { name: 'RedOracle', merchant: 78, pos: { x: 1760, y: 1890 }, stand: { x: 1758, y: 1888 } },
  capCavaleiros: { name: 'Cap.Cavaleiros', merchant: 19, pos: { x: 2144, y: 2120 }, stand: { x: 2144, y: 2118 } },
  foemaAncian: FOEMA_MASTER,
  mestreArchi: BM_MASTER,
  foreLearner: { name: 'ForeLearner', merchant: 19, pos: { x: 2130, y: 2125 }, stand: { x: 2130, y: 2123 } },
} as const satisfies Record<string, NpcSpec>;

/** Class do template de cada mestre (STRUCT_MOB.Class @20) e a Sephirot que o legado entrega (1759 + Class). */
export const MASTERS = [
  { npc: NPC.capCavaleiros, npcClass: 1, sephirot: 1760 },
  { npc: NPC.foemaAncian, npcClass: 2, sephirot: 1761 },
  { npc: NPC.mestreArchi, npcClass: 3, sephirot: 1762 },
  { npc: NPC.foreLearner, npcClass: 4, sephirot: 1763 },
] as const;

/** De Armia até o RedOracle: a rota do Rei (cenário 5) e o passo final até o oráculo. */
export const ROUTE_TO_ORACLE = [...ROUTE_TO_KING.slice(0, -1), NPC.redOracle.stand];

/** Mortal exibido 300 (armazenado 299): atributos e HP para andar até Akelonia sem morrer. */
export const MORTAL_SEED = { level: KING_MIN_LEVEL, str: 900, dex: 250, con: 600, int: 10, max_hp: 25000, hp: 25000 } as const;
