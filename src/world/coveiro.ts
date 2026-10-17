// Quest do Coveiro (passo 1 da Quest 256): NPCs, itens, a arena e o reset, como estão no
// servidor (Jean1dev/w2pp-OpenWYD, main 4181ce3).
//
// - Coveiro: NPCGener.txt bloco [3445], Merchant 100 / EF_GRADE0 0. Aceita nível armazenado
//   39–114 (exibido 40–115), consome a Vela do Coveiro e teleporta para (2398,2105)±
//   com QuestFlag = 1 (_MSG_Quest.cpp:293-336; Go handler/misc.go quest256NPC).
// - Arena: (2379,2076)–(2426,2133), comparação estrita. Quem está lá sem QuestFlag é
//   chamado de volta à cidade (ProcessSecMinTimer.cpp:1659; Go mobai.go guardQuest256Areas).
// - Reset: o legado limpa a arena a cada 1200 ticks de 500 ms, isto é, a cada 10 min
//   contados do boot do servidor: ClearAreaQuest faz DoRecall e zera o QuestFlag de todos
//   (ProcessSecMinTimer.cpp:560-577, Server.cpp:6263-6285). O Go não tem esse timer.

export interface Point {
  x: number;
  y: number;
}

/** Itens (Release/Common/ItemList.csv). */
export const ITEM = {
  /** Vela_do_Coveiro (:5703), preço 0. */
  velaDoCoveiro: 4038,
  /** Poeira_de_Fada (:5831), EF_VOLATILE 7: +1 nível garantido por uso; preço 5000 a pilha. */
  poeiraDeFada: 4142,
} as const;

/** Preço da Poeira de Fada na Evolução (ItemList.csv, sem imposto no Go). */
export const FAIRY_DUST_PRICE = 5000;

/** NPCs (NPCGener.txt) e o ponto ao lado de cada um onde o bot para. */
export const NPC = {
  /** Bloco [3445]: fica a oeste da arena. */
  coveiro: { name: 'Coveiro', merchant: 100, pos: { x: 2375, y: 2104 }, stand: { x: 2373, y: 2104 } },
  /** Bloco [3406], Armia: vende a Vela do Coveiro (Carry[28]). */
  aki: { name: 'Aki', merchant: 1, pos: { x: 2144, y: 2088 }, stand: { x: 2143, y: 2090 } },
  /** Bloco [6071], Armia: vende a Poeira de Fada (Carry[55], pilha de 255). */
  evolucao: { name: 'Evolucao', merchant: 1, pos: { x: 2085, y: 2101 }, stand: { x: 2087, y: 2101 } },
} as const;

export const ARENA = { x1: 2379, y1: 2076, x2: 2426, y2: 2133 };

/** Para onde o Coveiro teleporta: (2398,2105) + rand(5) − 3. */
export const ARENA_ENTRY = { x: 2398, y: 2105 };

/** Nível ARMAZENADO mínimo e o limite (exclusivo) aceitos pelo Coveiro. */
export const QUEST_LEVEL = { min: 39, max: 115 };

/** O tile está dentro da arena (mesma comparação estrita do servidor)? */
export function isInCoveiroArea(x: number, y: number): boolean {
  return x > ARENA.x1 && y > ARENA.y1 && x < ARENA.x2 && y < ARENA.y2;
}

/**
 * Spawns de Aparição (nível 98) e Esqueleto (nível 84) dentro da arena: NPCGener.txt
 * blocos [3453]–[3465] e [3831]–[3835], todos com StartRange ≤ 3.
 */
export const ARENA_SPAWNS: Point[] = [
  { x: 2394, y: 2104 }, { x: 2409, y: 2105 }, { x: 2419, y: 2124 }, { x: 2414, y: 2089 }, { x: 2386, y: 2089 },
  { x: 2387, y: 2120 }, { x: 2398, y: 2120 }, { x: 2419, y: 2112 }, { x: 2416, y: 2099 }, { x: 2406, y: 2089 },
  { x: 2390, y: 2081 }, { x: 2385, y: 2099 }, { x: 2384, y: 2105 }, { x: 2408, y: 2120 }, { x: 2396, y: 2120 },
  { x: 2416, y: 2081 }, { x: 2397, y: 2090 }, { x: 2388, y: 2129 },
];

/**
 * Ponto da arena mais longe dos spawns (distância de Chebyshev 11 do centro mais próximo).
 * O mob só puxa briga num raio de 4 tiles (world/tick.go FindEnemyFromView) e anda até 3
 * do centro, então um mob parado no spawn não vê o personagem aqui.
 */
export const ARENA_SAFE_SPOT = { x: 2403, y: 2131 };

/**
 * Rota de Armia até o Coveiro: sai de Armia pelo leste (a cidade vai até x 2171) e segue
 * em y≈2104, passando por Rei_Gremlin e Javali de nível ≤ 15.
 */
export const ROUTE_TO_COVEIRO: Point[] = [
  { x: 2140, y: 2100 },
  { x: 2240, y: 2104 },
  { x: 2340, y: 2104 },
  NPC.coveiro.stand,
];

/** Rota de volta, do Coveiro até a Aki (Armia). */
export const ROUTE_TO_ARMIA: Point[] = [
  { x: 2340, y: 2104 },
  { x: 2240, y: 2104 },
  { x: 2150, y: 2096 },
  NPC.aki.stand,
];

/** Ponto logo dentro da arena para o controle de intruso (longe dos spawns da borda oeste). */
export const INTRUDER_PROBE = { from: { x: 2373, y: 2112 }, to: { x: 2381, y: 2112 } };

/** Período do reset no legado: 1200 ticks de 500 ms. */
export const LEGACY_RESET_PERIOD_MS = 10 * 60_000;

/**
 * Até quando esperar o reset depois de entrar na arena: o ciclo de 10 min do legado (com
 * folga, 12 min) e também a hipótese de reset na virada da hora (hh:00, com 2 min de folga).
 */
export function resetDeadline(enteredAt: number): number {
  const nextHour = new Date(enteredAt);
  nextHour.setUTCMinutes(60, 0, 0);
  return Math.max(enteredAt + LEGACY_RESET_PERIOD_MS + 2 * 60_000, nextHour.getTime() + 2 * 60_000);
}
