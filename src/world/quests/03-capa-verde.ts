// Quest 03 — Capa Verde (Formatura Aprendiz) (docs/quests/03-capa-verde.md).
// NPCs, arena, mobs e itens como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Diretor_Treina. (CAPAVERDE_TELEPORT, Merchant 100 grade 14): _MSG_Quest.cpp:2167-2186;
//   Go handler/misc.go:635 capaverdeTeleport (Mortal, armazenado [99,150), teleporte 2245±3,1576±3).
// - Chefe_Treina. (CAPAVERDE_TRADE, Merchant 8): _MSG_Quest.cpp:2188-2234; Go misc.go:662
//   capaverdeTrade (4080 no Equip[13] e Equip[15] vazio → o 4080 some e o 4006 vai para o Equip[15]).
// - Lider_Aprendiz (LIDER_APRENDIZ, Merchant 100 grade 5): _MSG_Quest.cpp:2625-2662 (Arch,
//   BaseScore.Level 99–149, Equip[15] vazio → 4006 no Equip[15]); sem rota no Go (misc.go:259).
// - Posições: NPCGener.txt [3691] Diretor, [3749] Chefe_Treina., [3141] Lider_Aprendiz,
//   [3655-3666] Taurus_Maligno, [3836] Chefe_Taurus. Templates em npc/*.
// - Reset da arena: Go quest_area_reset.go:27 {2232,1564,2263,1592} (ProcessSecMinTimer.cpp:560-577).
import type { NpcSpec } from '../../bot/npc.ts';
import type { Point } from '../coveiro.ts';
import { GRIFF_WARP } from '../quest256.ts';

export type { Point };
export { GRIFF_WARP };

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  /** 4006 Manto_do_Aprendiz (:5639): capa, EF_AC 30, EF_HP 50. */
  mantoDoAprendiz: 4006,
  /** 4080 Emblema_da_Aprendizagem (:5743): nPos 8192 = Equip[13], EF_NOTRADE. */
  emblemaDaAprendizagem: 4080,
} as const;

export const EQUIP_SLOT = { emblema: 13, capa: 15 } as const;

/** Faixa de nível ARMAZENADO do Diretor e do Chefe_Treina.: [99,150) = exibido 100–150. */
export const LEVEL = { min: 99, max: 150 } as const;

/** Faixa de BaseScore.Level do Lider_Aprendiz (inclusiva): 99–149. */
export const ARCH_LEVEL = { min: 99, max: 149 } as const;

export const NPC = {
  diretor: { name: 'Diretor_Treina.', merchant: 100, pos: { x: 2244, y: 1595 }, stand: { x: 2244, y: 1597 } },
  chefeTreina: { name: 'Chefe_Treina.', merchant: 8, pos: { x: 2234, y: 1566 }, stand: { x: 2236, y: 1567 } },
  liderAprendiz: { name: 'Lider_Aprendiz', merchant: 100, pos: { x: 1705, y: 1724 }, stand: { x: 1707, y: 1726 } },
} satisfies Record<string, NpcSpec>;

export interface Area {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Arena da Capa Verde (bordas inclusivas, como o ClearAreaQuest). */
export const ARENA: Area = { x1: 2232, y1: 1564, x2: 2263, y2: 1592 };

export const isInArea = (a: Area, x: number, y: number) => x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2;

/** Onde o Diretor manda: (2245,1576) com rand()%5 − 3 em cada eixo, ou seja [−3,+1]. */
export const TELEPORT_DEST: Point = { x: 2245, y: 1576 };
export const TELEPORT_SPREAD = { lo: -3, hi: 1 } as const;

/** Da chegada do Grifo no Jardim dos Deuses (2220,1714) até o lado do Diretor (sul de Azran). */
export const ROUTE_TO_DIRETOR: Point[] = [{ x: 2230, y: 1680 }, { x: 2240, y: 1630 }, NPC.diretor.stand];

/** De Armia até o Lider_Aprendiz (centro dos reinos, ao lado da Lindy), pelo caminho do Rei (arch.ts). */
export const ROUTE_TO_LIDER: Point[] = [{ x: 2052, y: 2060 }, { x: 1900, y: 1960 }, { x: 1760, y: 1800 }, NPC.liderAprendiz.stand];

/** Da porta do Diretor até dentro da arena, a pé (não há guarda de QuestFlag). */
export const WALK_INTO_ARENA: Point[] = [{ x: 2244, y: 1590 }, { x: 2240, y: 1580 }];

/** Spawns dos Taurus_Maligno (NPCGener.txt [3655-3666]) e do Chefe_Taurus [3836]. */
export const TAURUS_SPAWNS: Point[] = [
  { x: 2251, y: 1584 }, { x: 2251, y: 1572 }, { x: 2245, y: 1577 }, { x: 2237, y: 1587 }, { x: 2241, y: 1577 }, { x: 2235, y: 1570 },
  { x: 2240, y: 1571 }, { x: 2246, y: 1571 }, { x: 2258, y: 1577 }, { x: 2244, y: 1583 }, { x: 2233, y: 1577 }, { x: 2244, y: 1588 },
];

/**
 * Mobs que soltam o 4080 e a chance por kill no Go (loot.go EffectiveDropRate, nível 107):
 * - Taurus_Maligno: Carry 0,1 (1/891), 16,17 (1/19800) e 58 (1/500) → ≈ 1/225 por kill;
 * - Chefe_Taurus: Carry 0,1 (1/891) e 10 (forçado a 1/4) → ≈ 1/4 por kill (HP 20000, dano 1000).
 */
export const EMBLEM_MOBS = ['Chefe_Taurus', 'Taurus_Maligno'] as const;

/** Canto da arena longe dos spawns, para esperar o reset. */
export const ARENA_SAFE_SPOT: Point = { x: 2261, y: 1590 };

/**
 * Equipamento de caça semeado no banco (Equip[] slot → item), o mesmo HUNT_GEAR da quest 02 (Hrotti
 * e Set Melpômene). O Go não confere o requisito ao calcular o score.
 */
export const HUNT_GEAR: Record<number, number> = { 2: 1230, 3: 1231, 4: 1232, 5: 1233, 6: 3766 };

/** Atributos de um TK no exibido ~140, para aguentar o Taurus_Maligno (nv 107, dano 228). */
export const HUNT_ATTRS = { str: 400, dex: 150, con: 250, int: 10 } as const;

/** BaseMaxHP semeado (o Go não recalcula HP pelo nível). */
export const HUNT_HP = 6000;
