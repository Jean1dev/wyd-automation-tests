// Quest 02 — Quest 256: as cinco arenas e os troféus (docs/quests/02-quest256-tickets.md).
// NPCs, tickets, arenas e troféus como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
// As rotas e as arenas vêm de coveiro.ts (passo 1) e quest256.ts (passos 2–5).
//
// - NPCs: _MSG_Quest.cpp:293-512; Go handler/misc.go:875 quest256NPC (classe Mortal/Arch, nível
//   armazenado em [min,max), ticket em qualquer slot; o slot inteiro some; QuestFlag = passo).
// - Troféus (Vol 191): _MSG_UseItem.cpp:2344-2490; Go item.go:996 useQuestReward, com o exp, o
//   gold e as faixas de Release/Common/Settings/QuestsRate.txt (content/rates.go).
// - Ticket com o botão direito: só no Go (item.go:627 useQuest256Ticket).
// - Mestre_Grifo (MSG_Quest no Merchant 23): só no Go (misc.go:927 mestreGrifo).
import type { NpcSpec } from '../../bot/npc.ts';
import {
  ARENA as COVEIRO_ARENA, ARENA_ENTRY as COVEIRO_ENTRY, ARENA_SAFE_SPOT as COVEIRO_SAFE, ARENA_SPAWNS as COVEIRO_SPAWNS,
  INTRUDER_PROBE as COVEIRO_PROBE, NPC as COVEIRO_NPC, type Point, ROUTE_TO_ARMIA, ROUTE_TO_COVEIRO,
} from '../coveiro.ts';
import { type Area, isInArea, ITEM as Q256_ITEM, NPC as Q256_NPC, stepByNumber } from '../quest256.ts';

export { isInArea, type Area, type Point, ROUTE_TO_ARMIA, ROUTE_TO_COVEIRO };

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  ...Q256_ITEM,
  /** Troféus Vol 191 (:5781-5785), um por passo: 4117 + (passo − 1). */
  caixaDaSabedoria: 4117,
  lagrimaAngelical: 4118,
  coracaoDoKaizen: 4119,
  olhoDeSangue: 4120,
  pedraEspiritualDosElfos: 4121,
} as const;

export interface TrophyRate {
  /** Exp do mortal e do arch (QuestsRate.txt "Exp N mortal arch"). */
  exp: { mortal: number; arch: number };
  coin: number;
  /** Nível ARMAZENADO [min,max) (QuestsRate.txt "Level N mmin mmax amin amax"). */
  level: { min: number; max: number };
}

export interface Arena {
  step: 1 | 2 | 3 | 4 | 5;
  name: string;
  npc: NpcSpec;
  ticket: number;
  /** Nível ARMAZENADO aceito pelo NPC: [min, max). */
  level: { min: number; max: number };
  entry: Point;
  area: Area;
  spawns: Point[];
  safeSpot: Point;
  /** Mobs da arena que soltam o troféu. */
  mobs: string[];
  trophy: number;
  rate: TrophyRate;
}

/** QuestsRate.txt (Release/Common/Settings), linha por passo. */
const RATES: TrophyRate[] = [
  { exp: { mortal: 30_000, arch: 30_000 }, coin: 10_000, level: { min: 39, max: 115 } },
  { exp: { mortal: 60_000, arch: 60_000 }, coin: 20_000, level: { min: 115, max: 190 } },
  { exp: { mortal: 200_000, arch: 200_000 }, coin: 100_000, level: { min: 190, max: 265 } },
  { exp: { mortal: 500_000, arch: 500_000 }, coin: 250_000, level: { min: 265, max: 320 } },
  { exp: { mortal: 780_000, arch: 780_000 }, coin: 500_000, level: { min: 320, max: 350 } },
];

/** Os mobs que soltam o troféu (npc/*: Carry[56] do líder = sempre; Carry[8,9] do seguidor = 1/4 cada). */
const MOBS: string[][] = [
  ['Aparicao', 'Esqueleto'],
  ['Grande_Carb', 'Servo_Carbuncle'],
  ['Cav._Kaizen', 'Cav._Servo'],
  ['Hidra_Dourada', 'Hidra_Imortal'],
  ['Mestre_Elfo', 'Servo_Elfo'],
];

const coveiro: Arena = {
  step: 1,
  name: 'Coveiro (Defensor da Alma)',
  npc: COVEIRO_NPC.coveiro,
  ticket: ITEM.velaDoCoveiro,
  level: { min: 39, max: 115 },
  entry: COVEIRO_ENTRY,
  area: COVEIRO_ARENA,
  spawns: COVEIRO_SPAWNS,
  safeSpot: COVEIRO_SAFE,
  mobs: MOBS[0],
  trophy: ITEM.caixaDaSabedoria,
  rate: RATES[0],
};

export const ARENAS: Arena[] = [
  coveiro,
  ...[2, 3, 4, 5].map((n): Arena => {
    const s = stepByNumber(n);
    return {
      step: s.step, name: s.quest, npc: s.npc, ticket: s.ticket, level: s.level, entry: s.entry, area: s.area, spawns: s.spawns,
      safeSpot: { x: s.entry.x, y: s.entry.y }, mobs: MOBS[n - 1], trophy: ITEM.caixaDaSabedoria + n - 1, rate: RATES[n - 1],
    };
  }),
];

export const COVEIRO = coveiro;

/** Controle de intruso do Coveiro: de fora até logo dentro da arena. */
export const INTRUDER_PROBE = COVEIRO_PROBE;

export const NPC = { ...Q256_NPC, coveiro: COVEIRO_NPC.coveiro } as const;

/**
 * Equipamento do TransKnight semeado no banco para caçar na arena do Coveiro no exibido 115
 * (Equip[] slot → item; quest256.ts TK_GEAR). O Go não confere o requisito ao calcular o score.
 */
export const HUNT_GEAR: Record<number, number> = { 2: 1230, 3: 1231, 4: 1232, 5: 1233, 6: 3766 };

/** Atributos de um TK no exibido 115 (≈ 5 pontos por nível) para aguentar a Aparição (nv 98). */
export const HUNT_ATTRS = { str: 320, dex: 120, con: 200, int: 10 } as const;

/** BaseMaxHP semeado para a caça (um TK no exibido 115 com Con 200 fica nessa ordem). */
export const HUNT_HP = 3000;
