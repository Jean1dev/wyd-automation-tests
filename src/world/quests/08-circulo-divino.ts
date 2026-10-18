// Quest 08 — Círculo Divino (Jeffi e Shama) (docs/quests/08-circulo-divino.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Jeffi (JEFFI, MOB.Merchant 12): _MSG_Quest.cpp:514-610 — purifica o pedaço do Equip[13].
// - Shaman (SHAMA, MOB.Merchant 13): _MSG_Quest.cpp:612-691 — devolve Special e apaga uma árvore.
// - Go: sem rota para os Merchants 12 e 13 (handler/misc.go:259 "quest NPC not implemented").
// - Posições: NPCGener.txt [986] Shaman (2506,1727) e [987] Jeffi (2517,1727), em Azran.
import type { NpcSpec } from '../../bot/npc.ts';
import type { Point } from '../coveiro.ts';
import { GRIFF_WARP } from '../quest256.ts';

export type { Point };
export { GRIFF_WARP };

export const NPC = {
  jeffi: { name: 'Jeffi', merchant: 12, pos: { x: 2517, y: 1727 }, stand: { x: 2515, y: 1729 } },
  shama: { name: 'Shaman', merchant: 13, pos: { x: 2506, y: 1727 }, stand: { x: 2508, y: 1729 } },
} satisfies Record<string, NpcSpec>;

/** Equip[13]: onde fica o pedaço/círculo. */
export const CIRCLE_SLOT = 13;

export const ITEM = {
  /** Pedaço_do_Círculo_Divino: Jeffi cobra 1M e sorteia 448–450. */
  pedaco: 447,
  /** Pedaço_do_Círc_Div_Comp: Jeffi cobra 5M e sorteia 693–695. */
  pedacoComp: 692,
} as const;

/** Círculo_Divino_Puro (comum): 448 + árvore (0, 1, 2). */
export const PURO = { min: 448, max: 450 } as const;
/** Círculo_Divino_Comp_Puro (completo): 693 + árvore. */
export const PURO_COMP = { min: 693, max: 695 } as const;

export const PRICE = { pedaco: 1_000_000, pedacoComp: 5_000_000 } as const;

/** Teto devolvido por Special: 50 (comum) ou 100 (completo). */
export const RESET = { comum: 50, completo: 100 } as const;

/** Bits do LearnedSkill apagados por árvore (ncircle 0, 1, 2): 0–7, 8–15, 16–23. */
export const TREE_MASK = [0xff, 0xff00, 0xff0000] as const;

/** Mensagens do legado (Language.h) — para a nota; o caso confere o efeito. */
export const MSG = { need1M: '_NN_Need_1000000_Gold', needPure: '_NN_Need_Pure_Divine', doneAlready: '_NN_Youve_Done_It_Already' } as const;

/**
 * Da chegada do Grifo no Jardim dos Deuses (2220,1714) até o Jeffi e a Shaman (leste de Azran),
 * saindo pelo norte da arena do Jardineiro {2228,1700,2257,1728} (expulsa quem entra sem QuestFlag).
 */
export const ROUTE_TO_AZRAN: Point[] = [{ x: 2222, y: 1690 }, { x: 2300, y: 1690 }, { x: 2400, y: 1718 }, { x: 2460, y: 1724 }, { x: 2510, y: 1730 }];
