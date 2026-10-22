// Quest 10 — Destravas do Arch: Lindy 355/370 e Cristais (docs/quests/10-arch-destravas.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Lindy: _MSG_CombineItemLindy.cpp:46-112; Go combineItemLindy (handler/combine_variants.go:177) e
//   combine.MatchLindy (combine/match.go:170). Nenhum dos dois confere a distância até a Lindy: a
//   combinação vale em qualquer lugar. O bot ainda anda até ela, mas NÃO clica (MSG_Quest): no Go o
//   byte 104 da Lindy é Merchant 74 (Kibita) e o clique roda a Alma do Mortal (docs/quests/README.md).
// - Cristais 4106–4109: _MSG_UseItem.cpp:3366-3467 (checagem de Arch/355 comentada); Go
//   useArchCrystal (handler/arch_progression.go:15), roteado em item.go:501 pelo índice.
// - Trava de exp do Arch: Go archExpLocked (mobkilled.go:345) — nível armazenado ≥ 354 sem Level355,
//   ou ≥ 369 sem Level370; a Poeira de Fada recusa com "Conclua a liberacao de nivel na Lindy".
// - Posição: NPCGener.txt [3142] Lindy (1705,1727), ao lado do Lider_Aprendiz (1705,1724).
import type { NpcSpec } from '../../bot/npc.ts';
import { NPC as Q03_NPC, ROUTE_TO_LIDER, type Point } from './03-capa-verde.ts';

export const ITEM = {
  poeiraLac: 413,
  pergaminhoSelado: 4127,
  poeiraFada: 4142,
  /** Cristal_Elime 4106, Sylphed 4107, Thelion 4108, Noas 4109. */
  cristal: [4106, 4107, 4108, 4109],
  capaClan7: 3191,
  capaClan8: 3192,
  capaSemReino: 3193,
} as const;

export const EQUIP_SLOT = { capa: 15 } as const;

/**
 * Exp mínima de cada nível ARMAZENADO na curva mortal/Arch (level/nextlevel.go: nível L ⇔
 * exp ≥ nextLevel[L]). Exibido = armazenado + 1.
 */
export const EXP_AT: Record<number, number> = {
  353: 1_870_373_305,
  354: 2_000_000_000,
  355: 2_039_000_000,
  356: 2_078_000_000,
  359: 2_195_000_000,
  369: 2_585_000_000,
};

/** Custo de cada etapa dos cristais. */
export const CRYSTAL_EXP = 100_000_000;

/** BaseScore ganho em cada etapa (legado _MSG_UseItem.cpp:3407-3421). */
export const CRYSTAL_REWARD = [
  { mp: 80, ac: 0, hp: 0 },
  { mp: 0, ac: 30, hp: 0 },
  { mp: 0, ac: 0, hp: 80 },
  { mp: 60, ac: 20, hp: 60 },
] as const;

export const NPC = {
  /** Lindy [3142]: só referência de posição (o bot não clica, ver o cabeçalho). */
  lindy: { name: 'Lindy', merchant: 74, pos: { x: 1705, y: 1727 }, stand: { x: 1707, y: 1728 } },
  liderAprendiz: Q03_NPC.liderAprendiz,
} as const satisfies Record<string, NpcSpec>;

/** De Armia até a Lindy (centro dos reinos), pela rota a pé do Lider_Aprendiz (cenário 3). */
export const ROUTE_TO_LINDY: Point[] = [...ROUTE_TO_LIDER.slice(0, -1), NPC.lindy.stand];

/** Atributos e HP de um Arch de nível alto (o Go não recalcula HP pelo nível). */
export const ARCH_SEED = { str: 900, dex: 250, con: 600, int: 10, max_hp: 25000, hp: 25000, max_mp: 3000, mp: 3000 } as const;
