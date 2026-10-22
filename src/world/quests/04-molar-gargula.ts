// Quest 04 — Molar do Gárgula (docs/quests/04-molar-gargula.md).
// NPC, arena, mobs e itens como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Patrulha__ (MOLARGARGULA, Merchant 100 grade 15): _MSG_Quest.cpp:2236-2255; Go handler/misc.go:692
//   molarGargula (Mortal, armazenado [199,254), teleporte 817±3,4062±3).
// - Molar_de_Gárgula 4122 (Vol 194): _MSG_UseItem.cpp:2494-2546 (Equip[1..5] abaixo de +6 → +6,
//   MolarGargula = 1, consome uma unidade). No Go o Vol 194 cai no default do useItem
//   (item.go:584 rejectUnimplementedConsumable).
// - Posições: NPCGener.txt [3837] Patrulha__, [3838-3839] Gargula_Inf + Gargula_Servo,
//   [3841-3843] Gargula_Servo ([3840] tem MinuteGenerate −1). Templates em npc/*.
// - Reset da arena: Go quest_area_reset.go:34 {793,4046,827,4080} (ProcessSecMinTimer.cpp:560-577).
import type { NpcSpec } from '../../bot/npc.ts';
import type { Point } from '../coveiro.ts';
import { GRIFF_WARP, TELEPORT } from '../quest256.ts';
import { type Area, isInArea } from './03-capa-verde.ts';

export type { Area, Point };
export { GRIFF_WARP, isInArea, TELEPORT };

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  /** 4122 Molar_de_Gárgula (:5791): EF_VOLATILE 194, EF_NOTRADE. */
  molarDeGargula: 4122,
} as const;

/** Faixa de nível ARMAZENADO do NPC e do uso do molar: [199,254) = exibido 200–254. */
export const LEVEL = { min: 199, max: 254 } as const;

/** O que o molar refina: Equip[1..5] (elmo, armadura, calça, luvas, botas). */
export const MOLAR_SLOTS = [1, 2, 3, 4, 5] as const;
export const MOLAR_SANC = 6;

export const NPC = {
  patrulha: { name: 'Patrulha__', merchant: 100, pos: { x: 787, y: 4058 }, stand: { x: 789, y: 4060 } },
} satisfies Record<string, NpcSpec>;

/** Arena dos Gárgulas (bordas inclusivas, como o ClearAreaQuest). */
export const ARENA: Area = { x1: 793, y1: 4046, x2: 827, y2: 4080 };

/** Onde a Patrulha__ manda: (817,4062) com rand()%5 − 3 em cada eixo, ou seja [−3,+1]. */
export const TELEPORT_DEST: Point = { x: 817, y: 4062 };
export const TELEPORT_SPREAD = { lo: -3, hi: 1 } as const;

/**
 * Da chegada no Dungeon 1 (144,3788) até o lado da Patrulha__: o caminho do Kaizen (Patrulha_ em
 * (454,3910)) e depois para sudeste, fora da arena. O Go não valida o caminho.
 */
export const ROUTE_TO_PATRULHA: Point[] = [{ x: 300, y: 3850 }, { x: 456, y: 3920 }, { x: 620, y: 3990 }, { x: 760, y: 4050 }, NPC.patrulha.stand];

/** Da Patrulha__ até dentro da arena, a pé (não há guarda de QuestFlag). */
export const WALK_INTO_ARENA: Point[] = [{ x: 796, y: 4060 }];

/** Spawns (StartX/StartY, StartRange 6) dos grupos que nascem. */
export const GARGULA_SPAWNS: Point[] = [
  { x: 817, y: 4071 }, { x: 817, y: 4053 }, { x: 804, y: 4070 }, { x: 817, y: 4059 }, { x: 819, y: 4055 },
];

/**
 * Mobs que soltam o 4122 (npc/*): Gargula_Inf (nv 201, HP 10100, dano 508) traz o 4122 em 10 slots
 * do Carry; Gargula_Servo (nv 201, HP 8100, dano 488) em 4.
 */
export const MOLAR_MOBS = ['Gargula_Inf', 'Gargula_Servo'] as const;

/** Canto da arena longe dos spawns, para esperar o reset. */
export const ARENA_SAFE_SPOT: Point = { x: 795, y: 4048 };

/**
 * Equipamento semeado (Equip[] slot → item): Elmo_Mortal (1225), Set Melpômene (1230–1233) e
 * Hrotti (3766). O Go não confere o requisito ao calcular o score.
 */
export const HUNT_GEAR: Record<number, number> = { 1: 1225, 2: 1230, 3: 1231, 4: 1232, 5: 1233, 6: 3766 };

/** Atributos de um TK no exibido ~250, para aguentar os Gárgulas (nv 201, dano ~500). */
export const HUNT_ATTRS = { str: 600, dex: 200, con: 400, int: 10 } as const;

/** BaseMaxHP semeado (o Go não recalcula HP pelo nível). */
export const HUNT_HP = 12000;

export const inArena = (x: number, y: number) => isInArea(ARENA, x, y);
