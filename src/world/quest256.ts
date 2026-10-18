// Quest 256, passos 2–5: Jardineiro, Kaizen, Hidra e Elfos. NPCs, itens, arenas, viagem e
// equipamento, como estão no servidor (Jean1dev/w2pp-OpenWYD, main d896ae2f).
//
// - As quatro NPCs são Merchant 100 com EF_GRADE0 1–4 (handler/misc.go:170-196). Cada uma aceita
//   o nível armazenado em [min, max), consome o seu item e teleporta para a entrada da arena
//   com QuestFlag = passo (misc.go:852 quest256Steps, :875 quest256NPC; _MSG_Quest.cpp:338-520).
// - Quem está numa arena sem o QuestFlag dela é chamado de volta (mobai.go:133 guardQuest256Areas).
// - O reset limpa as cinco arenas a cada 600 s contados do boot, chamando de volta até quem está
//   morto (quest_area_reset.go:25-81, o ClearAreaQuest do legado).
// - Os itens 4039–4042 saem de graça na Aki (Carry[29..32]) no Railway. No npc/Aki do repositório o
//   slot 32 é o 4043; ali o 4042 só cai do Argos (slot 60), do Argos_Errante (18, 23) e do
//   Troll_Ghoul (21–23), o farm de reserva do cenário.
import type { NpcSpec } from '../bot/npc.ts';
import { NPC as COVEIRO_NPC, type Point } from './coveiro.ts';

export interface Area {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Comparação estrita, como questArea.contains (mobai.go). */
export function isInArea(a: Area, x: number, y: number): boolean {
  return x > a.x1 && y > a.y1 && x < a.x2 && y < a.y2;
}

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  velaDoCoveiro: 4038,
  colheitaDoJardineiro: 4039,
  curaDoBatedor: 4040,
  manaDoBatedor: 4041,
  emblemaDoGuarda: 4042,
  /** Emblema_da_Proteção (:5713): o slot 32 da Aki no npc/Aki do repositório. */
  emblemaDaProtecao: 4043,
  poeiraDeFada: 4142,
} as const;

/** Viagem do Mestre Grifo (MSG_MasterGriff, WarpID 1-based; misc.go:916 masterGriffDestinations). */
export const GRIFF_WARP = {
  defensorDeAlmas: 1,
  jardimDosDeuses: 2,
  calabouco: 3,
  submundo: 4,
} as const;

/** Onde cada viagem do Grifo chega (misc.go:916-921). */
export const GRIFF_DEST: Record<number, Point> = {
  1: { x: 2372, y: 2099 },
  2: { x: 2220, y: 1714 },
  3: { x: 2365, y: 2279 },
  4: { x: 1826, y: 1771 },
};

/**
 * Tiles de teleporte (world/teleport.go): pisar em (x&~3, y&~3) e mandar MSG_ReqTeleport.
 * O destino de cada um também é um tile de volta, então o bot sai dele sem mandar nada.
 */
export const TELEPORT = {
  /** Armia → Noatum, 700 de gold. */
  armiaToNoatum: { tile: { x: 2117, y: 2101 }, dest: { x: 1044, y: 1724 }, cost: 700 },
  /** Noatum → Armia, de graça. */
  noatumToArmia: { tile: { x: 1045, y: 1725 }, dest: { x: 2116, y: 2100 }, cost: 0 },
  /** Armia Field (onde o Grifo "Calabouço" deixa) → Dungeon 1. */
  fieldToDungeon: { tile: { x: 2365, y: 2285 }, dest: { x: 144, y: 3788 }, cost: 0 },
  /** Azran Field (onde o Grifo "Submundo" deixa) → Underworld. */
  fieldToUnderworld: { tile: { x: 1825, y: 1773 }, dest: { x: 1172, y: 4080 }, cost: 0 },
} as const;

/** NPCs de Armia e Noatum usados pelo cenário (NPCGener.txt) e onde o bot para ao lado. */
export const NPC = {
  aki: COVEIRO_NPC.aki,
  evolucao: COVEIRO_NPC.evolucao,
  /** Bloco [4512], Merchant 23. */
  mestreGrifo: { name: 'Mestre_Grifo', merchant: 23, pos: { x: 2116, y: 2080 }, stand: { x: 2116, y: 2082 } },
  /** Bloco [6093]: Set Melpômene do TK (Carry[0..3]). */
  setTk: { name: 'Set_TK', merchant: 1, pos: { x: 2098, y: 2090 }, stand: { x: 2098, y: 2092 } },
  /** Bloco [6109]: armas L310–319 (Hrotti no Carry[1]). */
  armaSemiDeus: { name: 'Arma_SemiDeus', merchant: 1, pos: { x: 2088, y: 2107 }, stand: { x: 2088, y: 2105 } },
  /** Bloco [3378], Noatum: armas L117–130 (Espada em Cruz no Carry[4]). */
  berlund: { name: 'Berlund', merchant: 1, pos: { x: 1055, y: 1739 }, stand: { x: 1055, y: 1737 } },
} as const satisfies Record<string, NpcSpec>;

export type Travel = 'jardim' | 'dungeon' | 'underworld';

export interface QuestStep {
  /** Passo da Quest 256 (o QuestFlag que a NPC dá). */
  step: 2 | 3 | 4 | 5;
  quest: string;
  npc: NpcSpec;
  /** Item que a NPC pede. */
  ticket: number;
  /** Itens errados para o controle (a NPC não pode aceitar). */
  wrongTickets: number[];
  /** Nível ARMAZENADO aceito: [min, max). */
  level: { min: number; max: number };
  /** Teleporte da NPC: entrada ± rand(5) − 3. */
  entry: Point;
  area: Area;
  /** Centros de spawn dos mobs da arena (StartX/StartY, StartRange ≤ 3). */
  spawns: Point[];
  travel: Travel;
  /** Pontos a pé depois da chegada (Grifo ou tile) até o lado da NPC. */
  route: Point[];
  /** Controle de intruso: de fora até logo dentro da arena. */
  intruder: { from: Point; to: Point };
}

export const STEPS: QuestStep[] = [
  {
    step: 2,
    quest: 'Jardineiro (Colheita do Jardineiro)',
    // Bloco [3446], EF_GRADE0 1: fica a oeste da arena.
    npc: { name: 'Jardineiro', merchant: 100, pos: { x: 2222, y: 1714 }, stand: { x: 2224, y: 1716 } },
    ticket: ITEM.colheitaDoJardineiro,
    wrongTickets: [ITEM.velaDoCoveiro],
    level: { min: 115, max: 190 },
    entry: { x: 2234, y: 1714 },
    area: { x1: 2228, y1: 1700, x2: 2257, y2: 1728 },
    // Grande_Carb [3466-3470] (nv 170) e Servo_Carbuncle [3471-3475] (nv 240).
    spawns: [
      { x: 2250, y: 1722 }, { x: 2242, y: 1719 }, { x: 2233, y: 1721 }, { x: 2233, y: 1706 }, { x: 2244, y: 1708 },
      { x: 2233, y: 1712 }, { x: 2234, y: 1710 }, { x: 2237, y: 1717 }, { x: 2250, y: 1714 }, { x: 2252, y: 1710 },
    ],
    travel: 'jardim',
    route: [{ x: 2224, y: 1716 }],
    intruder: { from: { x: 2225, y: 1726 }, to: { x: 2231, y: 1726 } },
  },
  {
    step: 3,
    quest: 'Kaizen (Cura do Batedor)',
    // Bloco [3447] "Patrulha_", EF_GRADE0 2, no Dungeon 1.
    npc: { name: 'Patrulha_', merchant: 100, pos: { x: 454, y: 3910 }, stand: { x: 456, y: 3912 } },
    ticket: ITEM.curaDoBatedor,
    wrongTickets: [ITEM.colheitaDoJardineiro],
    level: { min: 190, max: 265 },
    entry: { x: 464, y: 3902 },
    area: { x1: 459, y1: 3887, x2: 497, y2: 3916 },
    // Cav._Kaizen [3476-3481] (nv 241) e Cav._Servo [3482-3487] (nv 230).
    spawns: [
      { x: 489, y: 3910 }, { x: 489, y: 3895 }, { x: 477, y: 3911 }, { x: 466, y: 3908 }, { x: 467, y: 3893 }, { x: 477, y: 3896 },
      { x: 486, y: 3901 }, { x: 471, y: 3909 }, { x: 466, y: 3902 }, { x: 473, y: 3891 }, { x: 491, y: 3891 }, { x: 492, y: 3910 },
    ],
    travel: 'dungeon',
    route: [{ x: 300, y: 3850 }, { x: 456, y: 3912 }],
    intruder: { from: { x: 456, y: 3914 }, to: { x: 461, y: 3914 } },
  },
  {
    step: 4,
    quest: 'Hidra (Mana do Batedor)',
    // Bloco [3448] "Patrulha", EF_GRADE0 3, no Dungeon 1, ao sul da arena.
    npc: { name: 'Patrulha', merchant: 100, pos: { x: 668, y: 3768 }, stand: { x: 666, y: 3766 } },
    ticket: ITEM.manaDoBatedor,
    wrongTickets: [ITEM.curaDoBatedor],
    level: { min: 265, max: 320 },
    entry: { x: 668, y: 3756 },
    area: { x1: 658, y1: 3728, x2: 703, y2: 3762 },
    // Hidra_Dourada [3489-3499] (nv 310) e Hidra_Imortal [3500-3508] (nv 311).
    spawns: [
      { x: 672, y: 3752 }, { x: 674, y: 3758 }, { x: 686, y: 3752 }, { x: 691, y: 3759 }, { x: 699, y: 3752 }, { x: 664, y: 3732 },
      { x: 668, y: 3737 }, { x: 674, y: 3733 }, { x: 699, y: 3737 }, { x: 690, y: 3734 }, { x: 686, y: 3740 }, { x: 693, y: 3736 },
      { x: 685, y: 3740 }, { x: 664, y: 3739 }, { x: 673, y: 3739 }, { x: 665, y: 3752 }, { x: 673, y: 3753 }, { x: 685, y: 3758 },
      { x: 692, y: 3754 },
    ],
    travel: 'dungeon',
    route: [{ x: 400, y: 3780 }, { x: 666, y: 3766 }],
    intruder: { from: { x: 661, y: 3764 }, to: { x: 661, y: 3760 } },
  },
  {
    step: 5,
    quest: 'Elfos (Emblema do Guarda)',
    // Bloco [3449] "Guarda", EF_GRADE0 4, no Submundo.
    npc: { name: 'Guarda', merchant: 100, pos: { x: 1303, y: 4036 }, stand: { x: 1305, y: 4036 } },
    ticket: ITEM.emblemaDoGuarda,
    wrongTickets: [ITEM.manaDoBatedor],
    level: { min: 320, max: 350 },
    entry: { x: 1322, y: 4041 },
    area: { x1: 1312, y1: 4027, x2: 1348, y2: 4055 },
    // Mestre_Elfo [3509-3512] e Servo_Elfo [3513-3515] (nv 330).
    spawns: [
      { x: 1342, y: 4044 }, { x: 1340, y: 4035 }, { x: 1335, y: 4042 }, { x: 1322, y: 4048 },
      { x: 1325, y: 4050 }, { x: 1320, y: 4043 }, { x: 1331, y: 4036 },
    ],
    travel: 'underworld',
    // Do Underworld (1172,4080) para leste, por baixo dos spawns do Argos (y ≤ 4068).
    route: [{ x: 1240, y: 4078 }, { x: 1305, y: 4036 }],
    intruder: { from: { x: 1309, y: 4030 }, to: { x: 1315, y: 4030 } },
  },
];

export function stepByNumber(n: number): QuestStep {
  const s = STEPS.find((x) => x.step === n);
  if (!s) throw new Error(`passo inválido: ${n} (use 2 a 5)`);
  return s;
}

/** O mob só puxa briga num raio de 4 tiles (world/tick.go FindEnemyFromView) e anda até 3 do centro. */
const AGGRO = 4 + 3;

const cheb = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Ponto dentro da arena mais longe de todos os centros de spawn (Chebyshev), com 1 tile de folga da borda. */
export function safeSpot(s: Pick<QuestStep, 'area' | 'spawns'>): Point & { margin: number } {
  let best = { x: 0, y: 0, margin: -1 };
  for (let x = s.area.x1 + 2; x <= s.area.x2 - 2; x++) {
    for (let y = s.area.y1 + 2; y <= s.area.y2 - 2; y++) {
      const margin = Math.min(...s.spawns.map((p) => cheb({ x, y }, p)));
      if (margin > best.margin) best = { x, y, margin };
    }
  }
  return best;
}

/** O ponto seguro deixa o personagem fora do alcance de um mob parado no spawn? */
export const isOutOfAggro = (margin: number) => margin > AGGRO;

// ---------------------------------------------------------------- Emblema do Guarda

/** Mobs que soltam o 4042 e a chance por kill (loot.EffectiveDropRate, bônus de drop 0). */
export const EMBLEM_DROPPERS: Record<string, { level: number; slots: number[]; oddsPerKill: number }> = {
  Argos: { level: 300, slots: [60], oddsPerKill: 1900 },
  Troll_Ghoul: { level: 145, slots: [21, 22, 23], oddsPerKill: 6600 },
  Argos_Errante: { level: 135, slots: [18, 23], oddsPerKill: 9900 },
};

/**
 * Centros de spawn com Argos (seguidor do Argos_Errante) e Troll_Ghoul em volta da entrada
 * do Submundo (NPCGener.txt blocos [2855]–[2875]).
 */
export const EMBLEM_FARM_SPAWNS: Point[] = [
  { x: 1174, y: 4068 }, { x: 1188, y: 4067 }, { x: 1198, y: 4067 }, { x: 1208, y: 4067 }, { x: 1181, y: 4059 },
  { x: 1192, y: 4050 }, { x: 1181, y: 4034 }, { x: 1192, y: 4042 }, { x: 1204, y: 4052 }, { x: 1221, y: 4053 },
  { x: 1221, y: 4040 }, { x: 1195, y: 4023 },
];

/** Onde descansar entre as lutas do farm: ao sul dos spawns, fora do tile de volta (1172,4080). */
export const EMBLEM_FARM_REST: Point = { x: 1190, y: 4084 };

// ---------------------------------------------------------------- equipamento

export interface GearPiece {
  name: string;
  item: number;
  shop: NpcSpec;
  /** Slot do Equip[] (bit mais baixo do nPos). */
  equipSlot: number;
  price: number;
  /** Requisito do ItemList: nível ARMAZENADO e atributos (CurrentScore). */
  req: { level: number; str?: number; dex?: number; con?: number; int?: number };
}

/** Equip[] (item.go): 1 elmo, 2 armadura, 3 calça, 4 luvas, 5 botas, 6 arma, 7 escudo. */
export const EQUIP_SLOT = { helm: 1, body: 2, pants: 3, gloves: 4, boots: 5, weapon: 6, shield: 7 } as const;

/**
 * Equipamento do TransKnight, na ordem de prioridade da compra gulosa: a arma primeiro, porque
 * o dano é o que decide o farm, e depois a armadura do Set Melpômene (AC 246–369, sem atributo).
 */
export const TK_GEAR: GearPiece[] = [
  // ItemList.csv: 866 Espada_em_Cruz 117.132.0.96.0, dano 96, 43000.
  { name: 'Espada_em_Cruz', item: 866, shop: NPC.berlund, equipSlot: EQUIP_SLOT.weapon, price: 43000, req: { level: 117, str: 132, dex: 96 } },
  // 1232 Luvas_Melpômene 264, AC 246, 176000.
  { name: 'Luvas_Melpomene', item: 1232, shop: NPC.setTk, equipSlot: EQUIP_SLOT.gloves, price: 176000, req: { level: 264 } },
  // 3766 Hrotti(Anct) 319, dano 1154, +210 Str, 270000 (a loja do Railway vende o 3766, não o 3765).
  { name: 'Hrotti', item: 3766, shop: NPC.armaSemiDeus, equipSlot: EQUIP_SLOT.weapon, price: 270000, req: { level: 319 } },
  // 1233 Botas_Melpômene 267, AC 251, +24 de dano, 174000.
  { name: 'Botas_Melpomene', item: 1233, shop: NPC.setTk, equipSlot: EQUIP_SLOT.boots, price: 174000, req: { level: 267 } },
  // 1230 Armadura_Melpômene 272, AC 369, 178000.
  { name: 'Armadura_Melpomene', item: 1230, shop: NPC.setTk, equipSlot: EQUIP_SLOT.body, price: 178000, req: { level: 272 } },
  // 1231 Calça_Melpômene 276, AC 320, 178000.
  { name: 'Calca_Melpomene', item: 1231, shop: NPC.setTk, equipSlot: EQUIP_SLOT.pants, price: 178000, req: { level: 276 } },
];

/** Gold guardado para a Poeira de Fada e os teleportes pagos. */
export const GOLD_RESERVE = 10_000;
