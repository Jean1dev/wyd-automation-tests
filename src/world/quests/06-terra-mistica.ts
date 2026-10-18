// Quest 06 — Terra Mística (Defendendo a Terra Mística) (docs/quests/06-terra-mistica.md).
// NPCs, mobs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Cap.Mercenario (AMU_MISTICO, MOB.Merchant 10, CurrentScore 10): _MSG_Quest.cpp:253-291;
//   Go handler/misc.go:705 amuMistico (Mortal, TerraMistica 0, confirm ≠ 0, líder com membro → flag 1).
// - Passo 2 (kill de rosto 239/241, 1 em 20, flag 1 → 2): MobKilled.cpp:2909-2921; sem hook no Go.
// - Cap.Explor. (EXPLOIT_LEADER, MOB.Merchant 11, CurrentScore 11): _MSG_Quest.cpp:1626-1743;
//   sem rota no Go (misc.go:259 "quest NPC not implemented").
// - Posições: NPCGener.txt Cap.Mercenario (2445,1721) e Cap.Explor. (2398,1602); grupos de
//   Draco_Lich / Dracorich / Basilisco / Basilisco_Ifrit em (2380–2404,1560–1568). Templates em npc/*.
import type { NpcSpec } from '../../bot/npc.ts';
import type { Point } from '../coveiro.ts';
import { GRIFF_WARP } from '../quest256.ts';
import { type Area, isInArea } from './03-capa-verde.ts';

export type { Area, Point };
export { GRIFF_WARP, isInArea };

/** Valores de QuestInfo.Mortal.TerraMistica (coluna terra_mistica). */
export const FLAG = { nada: 0, aceita: 1, concluida: 2, recompensada: 3 } as const;

/** Amuletos (Release/Common/ItemList.csv) por faixa de nível ARMAZENADO (_MSG_Quest.cpp:1645-1665). */
export const AMULET = {
  /** Amuleto_de_Prata 551–554: armazenado < 50. */
  prata: { min: 551, max: 554 },
  /** Amuleto_de_Ouro 555–558: armazenado 50–79. */
  ouro: { min: 555, max: 558 },
  /** Amuleto_Místico 559–562: armazenado ≥ 80. */
  mistico: { min: 559, max: 562 },
} as const;

/** stEffect[0] do amuleto (EF 43, sem valor) e os dois adicionais sorteados. */
export const AMULET_EF0 = 43;

/** Limites de nível ARMAZENADO do Cap.Explor.: ≥ 80 dá o Místico, < 50 dá o de Prata. */
export const AMULET_LEVEL = { ouro: 50, mistico: 80 } as const;

export const NPC = {
  capMercenario: { name: 'Cap.Mercenario', merchant: 10, pos: { x: 2445, y: 1721 }, stand: { x: 2443, y: 1719 } },
  capExplor: { name: 'Cap.Explor.', merchant: 11, pos: { x: 2398, y: 1602 }, stand: { x: 2400, y: 1604 } },
} satisfies Record<string, NpcSpec>;

/**
 * Arena da Quest 256 passo 2 (Jardineiro) a leste da chegada do Grifo: quem entra sem a QuestFlag é
 * mandado para Armia (misc.go:854, {2228,1700,2257,1728}). As rotas saem para o norte antes de ir a leste.
 */
export const JARDIM_ARENA: Area = { x1: 2228, y1: 1700, x2: 2257, y2: 1728 };

/** Da chegada do Grifo no Jardim dos Deuses (2220,1714) até o Cap.Mercenario (oeste de Azran). */
export const ROUTE_TO_MERCENARIO: Point[] = [{ x: 2222, y: 1690 }, { x: 2300, y: 1690 }, { x: 2400, y: 1718 }, NPC.capMercenario.stand];

/** Da chegada do Grifo no Jardim dos Deuses até o Cap.Explor., ao norte de Azran. */
export const ROUTE_TO_EXPLOR: Point[] = [{ x: 2222, y: 1690 }, { x: 2300, y: 1650 }, { x: 2380, y: 1620 }, NPC.capExplor.stand];

/**
 * Mobs que contam no passo 2 (rosto 239/241, npc/*): Draco_Lich (nv 94, HP 6000, dano 300),
 * Dracorich (nv 85, HP 4500), Basilisco (nv 81, HP 4000, rosto 241) e Basilisco_Ifrit (nv 89, HP 5000).
 */
export const DRAGON_MOBS = ['Draco_Lich', 'Dracorich', 'Basilisco', 'Basilisco_Ifrit'] as const;

/** Spawns dos grupos de dragões (StartX/StartY). */
export const DRAGON_SPAWNS: Point[] = [
  { x: 2380, y: 1568 }, { x: 2394, y: 1568 }, { x: 2400, y: 1564 }, { x: 2380, y: 1560 },
  { x: 2404, y: 1560 }, { x: 2388, y: 1560 }, { x: 2398, y: 1560 },
];

/** Área de caça dos dragões (spawns com folga). */
export const DRAGON_AREA: Area = { x1: 2370, y1: 1550, x2: 2414, y2: 1578 };

/** Onde descansar fora da área de caça (perto do Cap.Explor.). */
export const REST_SPOT: Point = { x: 2398, y: 1598 };

/**
 * Equipamento de caça (Equip[] slot → item), o mesmo da quest 05: Elmo_Mortal (1225), Set
 * Melpômene (1230–1233) e Hrotti (3766). O Go não confere o requisito ao calcular o score.
 */
export const HUNT_GEAR: Record<number, number> = { 1: 1225, 2: 1230, 3: 1231, 4: 1232, 5: 1233, 6: 3766 };

/** Atributos de um TK forte o bastante para o Draco_Lich (nv 94, dano 300). */
export const HUNT_ATTRS = { str: 900, dex: 250, con: 600, int: 10 } as const;

/** BaseMaxHP semeado (o Go não recalcula HP pelo nível). */
export const HUNT_HP = 25000;
