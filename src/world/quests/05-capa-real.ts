// Quest 05 — Capa do Reino (azul / vermelha) e a borda (docs/quests/05-capa-real.md).
// NPCs, área, mobs e itens como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Guarda_Real (QUEST_CAPAREAL, Merchant 100 grade 13): _MSG_Quest.cpp:2342-2361; Go handler/misc.go:649
//   royalCapeQuest (Mortal, armazenado [199,254), teleporte 1740±3,1725±3).
// - Rei_Harabard / Rei_Glantuar (KING, MOB.Merchant 15, CurrentScore 111): _MSG_Quest.cpp:693-1125;
//   Go misc.go:272 kingCapeService (preço em sapphire_balance, pagamento exato, sem o 4081).
// - Posições: NPCGener.txt [8] Rei_Harabard, [9] Rei_Glantuar, [2843] Guarda_Real,
//   [3817-3820] Cav._Mortal___ (4 por grupo), [3821-3823] Cav._Mortal____. Templates em npc/*.
// - A área (1740,1725) não tem reset nem guarda.
import type { NpcSpec } from '../../bot/npc.ts';
import type { Point } from '../coveiro.ts';
import { type Area, isInArea } from './03-capa-verde.ts';

export type { Area, Point };
export { isInArea };

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  /** 4081 Emblema_do_Reino (:5745): nPos 8192 = Equip[13], EF_NOTRADE. */
  emblemaDoReino: 4081,
  /** 697 Safira (:1171): vale 1. */
  safira: 697,
  /** 4131 Pacote_Safiras(10) (:5809): vale 10 e o legado o consome inteiro. */
  pacoteSafiras: 4131,
  /** Capas sem borda (CapeMode 1). */
  mantoHekalotia: 545,
  mantoAkelonia: 546,
  /** Capas com borda (CapeMode 2). */
  mantoDoGuerreiro: 543,
  mantoDeShiner: 544,
} as const;

export const EQUIP_SLOT = { emblema: 13, capa: 15 } as const;

/** Faixa de nível ARMAZENADO do Guarda_Real: [199,254) = exibido 200–254. */
export const GUARD_LEVEL = { min: 199, max: 254 } as const;

/** Nível ARMAZENADO mínimo do Rei para a capa (exibido 220) e para a borda (exibido 256). */
export const KING_LEVEL = { cape: 219, border: 255 } as const;

export const NPC = {
  guardaReal: { name: 'Guarda_Real', merchant: 100, pos: { x: 1754, y: 1583 }, stand: { x: 1756, y: 1585 } },
  reiHarabard: { name: 'Rei_Harabard', merchant: 111, pos: { x: 1750, y: 1574 }, stand: { x: 1752, y: 1576 } },
  reiGlantuar: { name: 'Rei_Glantuar', merchant: 111, pos: { x: 1750, y: 1880 }, stand: { x: 1752, y: 1882 } },
} satisfies Record<string, NpcSpec>;

/** Clan de cada Rei (byte 16 do template). */
export const KING_CLAN = { Rei_Harabard: 7, Rei_Glantuar: 8 } as const;

/**
 * De Armia até o castelo de Hekalotia (Guarda_Real e Rei_Harabard): sai pelo oeste como na rota do
 * Rei_Glantuar e sobe pelo x = 1800, por fora da área dos Cav._Mortal. O Go não valida o caminho.
 */
export const ROUTE_TO_HEKALOTIA: Point[] = [{ x: 2052, y: 2060 }, { x: 1900, y: 1960 }, { x: 1800, y: 1820 }, { x: 1800, y: 1640 }, NPC.guardaReal.stand];

/** De Armia até o Rei_Glantuar (src/world/arch.ts ROUTE_TO_KING). */
export const ROUTE_TO_AKELONIA: Point[] = [{ x: 2052, y: 2060 }, { x: 1900, y: 1960 }, NPC.reiGlantuar.stand];

/** Onde o Guarda_Real manda: (1740,1725) com rand()%5 − 3 em cada eixo, ou seja [−3,+1]. */
export const TELEPORT_DEST: Point = { x: 1740, y: 1725 };
export const TELEPORT_SPREAD = { lo: -3, hi: 1 } as const;

/** Área dos Cavaleiros Mortais (spawns [3817-3823] com folga). */
export const AREA: Area = { x1: 1715, y1: 1708, x2: 1752, y2: 1744 };

/** Do castelo de Hekalotia até a área, a pé (não há guarda). */
export const ROUTE_TO_AREA: Point[] = [{ x: 1790, y: 1640 }, { x: 1760, y: 1700 }, { x: 1742, y: 1722 }];

/** Spawns dos grupos de Cav._Mortal___ / Cav._Mortal____. */
export const CAV_SPAWNS: Point[] = [
  { x: 1726, y: 1732 }, { x: 1725, y: 1718 }, { x: 1740, y: 1718 }, { x: 1740, y: 1734 }, { x: 1724, y: 1725 },
];

/**
 * Mobs que soltam o 4081 (npc/*): Cav._Mortal___ (nv 221, HP 18000, AC 2150, dano 720) traz o 4081
 * em 5 slots do Carry; Cav._Mortal____ (nv 221, HP 22000, dano 750) em 9.
 */
export const EMBLEM_MOBS = ['Cav._Mortal___', 'Cav._Mortal____'] as const;

/**
 * Equipamento semeado (Equip[] slot → item): Elmo_Mortal (1225), Set Melpômene (1230–1233) e
 * Hrotti (3766), como na quest 04. O Go não confere o requisito ao calcular o score.
 */
export const HUNT_GEAR: Record<number, number> = { 1: 1225, 2: 1230, 3: 1231, 4: 1232, 5: 1233, 6: 3766 };

/** Atributos de um TK forte o bastante para os Cav._Mortal (dano ~720, AC 2150). */
export const HUNT_ATTRS = { str: 900, dex: 250, con: 600, int: 10 } as const;

/** BaseMaxHP semeado (o Go não recalcula HP pelo nível). */
export const HUNT_HP = 25000;

export const inArea = (x: number, y: number) => isInArea(AREA, x, y);
