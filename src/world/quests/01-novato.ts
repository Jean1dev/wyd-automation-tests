// Quest 01 — Novato: os quatro treinadores do Campo de Treino (docs/quests/01-novato-treinadores.md).
// NPCs, itens e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Legado: _MSG_Quest.cpp:1895-2100 (TREINADORNEWBIE1..4). Cada passo exige ClassMaster MORTAL,
//   nível armazenado < FREEEXP (35, Server.cpp:50) e QuestInfo.Mortal.Newbie == passo − 1
//   (Basedef.h:637); a chave/emblema pode estar em qualquer slot do inventário.
// - Go (desde w2pp-OpenWYD#411, 2866b8c): handler/newbiequest.go roteia pelo byte Merchant do
//   template (36/40/41, Chefe 100 grade 16) antes do Coveiro; a flag fica na coluna newbie_quest.
import type { NpcSpec } from '../../bot/npc.ts';

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  /** :753, solta pelo Gremlin_Artif. */
  chave1: 451,
  /** :755, solta pelo Krill_Gigante. */
  chave2: 452,
  /** :757, solta pelo Orc_Sniper. */
  chave3: 453,
  /** :891, solta pelo Orc_Guerreiro; o passo 4 consome. */
  emblemaOrc: 524,
  /** :1141, recompensa do passo 1 (EF_AMOUNT 20) e uma das do passo 4. */
  kitDeCura: 682,
  /** :811, uma das recompensas do passo 4. */
  olhoCrescente: 481,
  /** :1089, uma das recompensas do passo 4. */
  rubiDoCarbunkle: 652,
  /** Vela_do_Coveiro (:5703): o item que o Coveiro consome (NOV-12). */
  velaDoCoveiro: 4038,
  poeiraDeFada: 4142,
} as const;

/** Item do passo N (1..4). */
export const STEP_ITEM = [0, ITEM.chave1, ITEM.chave2, ITEM.chave3, ITEM.emblemaOrc] as const;

/** Recompensas possíveis do passo 4 (rand()%3). */
export const STEP4_REWARDS: readonly number[] = [ITEM.kitDeCura, ITEM.olhoCrescente, ITEM.rubiDoCarbunkle];

/** FREEEXP (Server.cpp:50): os treinadores aceitam nível ARMAZENADO < 35 (exibido ≤ 35). */
export const FREEEXP = 35;

/** NPCs (NPCGener.txt [3137]–[3140]) e o ponto ao lado de cada um, dentro do campo. */
export const NPC = {
  treinador1: { name: 'Treinador1', merchant: 100, pos: { x: 2080, y: 2018 }, stand: { x: 2080, y: 2020 } },
  treinador2: { name: 'Treinador2', merchant: 104, pos: { x: 2142, y: 1990 }, stand: { x: 2142, y: 1992 } },
  treinador3: { name: 'Treinador3', merchant: 105, pos: { x: 2078, y: 1966 }, stand: { x: 2078, y: 1968 } },
  /** Anda entre (2121,2040) e (2125,2037). */
  chefe: { name: 'Chefe_de_Treino', merchant: 100, pos: { x: 2123, y: 2039 }, stand: { x: 2123, y: 2042 } },
} as const satisfies Record<string, NpcSpec>;

/** NPC do passo N (1..4). */
export const STEP_NPC: readonly NpcSpec[] = [NPC.treinador1, NPC.treinador1, NPC.treinador2, NPC.treinador3, NPC.chefe];

/** Equipamento de TransKnight para os passos 2 e 3 (ItemList.csv: índice, ReqLvl). */
export const GEAR = {
  /** Equip[1..5]: conjunto do Artesão (115–119), ReqLvl 0. */
  artesao: { 1: 115, 2: 116, 3: 117, 4: 118, 5: 119 } as Record<number, number>,
  /** Lança_Curva (:847), ReqLvl 23: o passo 2 refaz os adicionais. */
  lancaCurva: 847,
  /** Lança_do_Vento (:848), ReqLvl 43: o passo 2 sai antes do SetItemBonus. */
  lancaDoVento: 848,
  /** Broquel_de_Aço (:1702), ReqLvl 18, Equip[7]. */
  broquel: 1702,
} as const;

/** Arena do Coveiro (coveiro.ts), para onde o Go manda quem fala com o Treinador1 tendo a Vela. */
export const COVEIRO_ARENA = { x1: 2379, y1: 2076, x2: 2426, y2: 2133 };
