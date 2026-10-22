// Quest 11 — Alma do Mortal (Kibita) (docs/quests/11-alma-mortal-kibita.md).
// NPC, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Kibita (Merchant 74 nos dois bytes): _MSG_Quest.cpp:2518-2558; Go kibitaSoul (handler/misc.go:436).
//   Mortal, nível armazenado ≥ 369, bit 30 do LearnedSkill desligado e a Pedra Secreta da classe no
//   inventário: apaga a pedra, liga o bit 30, troca a capa (Equip[15]) pela Herói do reino e manda o
//   personagem para a seleção com o _MSG_SendArchEffect.
// - Posição: NPCGener.txt [3811] Kibita (2135,2104), Armia.
import type { NpcSpec } from '../../bot/npc.ts';

export const ITEM = {
  /** Pedra Secreta por classe (TK, FM, BM, HT): Água 5334, Sol 5336, Terra 5335, Vento 5337. */
  pedraSecreta: [5334, 5336, 5335, 5337],
  mantoHekalotia: 545,
  heroiHekalotia: 3194,
  heroiAkelonia: 3195,
  heroiAventureiros: 3196,
} as const;

export const EQUIP_SLOT = { capa: 15 } as const;

/** Bit 30 do LearnedSkill: Alma do Mortal. */
export const SOUL_BIT = 1 << 30;

/** Nível armazenado mínimo (exibido 370). */
export const KIBITA_MIN_LEVEL = 369;

/** Exp mínima dos níveis armazenados usados (level/nextlevel.go). */
export const EXP_AT: Record<number, number> = {
  368: 2_546_000_000,
  369: 2_585_000_000,
};

export const NPC = {
  kibita: { name: 'Kibita', merchant: 74, pos: { x: 2135, y: 2104 }, stand: { x: 2133, y: 2104 } },
} as const satisfies Record<string, NpcSpec>;

/** Mortal de nível alto: atributos e HP coerentes (o Go não recalcula HP pelo nível). */
export const MORTAL_SEED = { str: 900, dex: 250, con: 600, int: 10, max_hp: 25000, hp: 25000, max_mp: 3000, mp: 3000 } as const;
