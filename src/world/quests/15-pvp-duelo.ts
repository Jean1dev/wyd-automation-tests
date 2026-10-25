// Suíte 15 — PvP em Armia e duelo 1x1 (docs/quests/15-pvp-duelo.md).
// Regras do legado (Source/Code/TMSrv) comparadas com o Go (tmserver/internal/handler, main 55cbf4a3).
//
// - Ataque entre jogadores: _MSG_Attack.cpp:405-419 zera o golpe quando o tile do ATACANTE tem o bit 0x40 do
//   AttributeMap e o alvo está sem K (PKMode) e sem Guilty. O 0x40 marca as áreas PK: a arena de Armia (abaixo)
//   e a arena do duelo; a praça de Armia é 0x01 (cidade) e o campo é 0x00, onde o servidor não bloqueia.
//   Go: combat.go:223 exige o K do atacante em todo lugar e não lê o AttributeMap (#67).
// - "PK - War - Miss" (_MSG_Attack.cpp:1344-1405): fora de arena de guerra/cidade (BASE_GetArena/BASE_GetVillage = 5)
//   e fora do mapa (1,31), atacante com PKPoint ≤ 10 contra alvo > 10 leva _DN_CantKillUser e dano 0; acertar alvo
//   com PKPoint > 10 deixa os dois Guilty 8 (nick vermelho). Dentro de uma cidade (a arena de Armia está nos
//   limites de Armia) nada disso roda. Go: combat.go:231 e :313 sem geografia.
// - Morte (MobKilled.cpp:3131-3228): em arena/cidade a vítima recebe _NN_In_Arena_No_Exp_Loss e não perde EXP;
//   o matador perde 3*PKPoint/-20 de CP (no máximo 9) se a vítima não estava Guilty. O `if (killed_x==1 &&
//   killed_y==31)` sem corpo é o ZoneUnk = 1 perdido na descompilação (a intenção: o mapa da arena de duelo
//   também é "sem perda de EXP"). Go: pvpkilled.go:50 tira EXP em qualquer lugar.
// - Duelo: _MSG_ReqRanking.cpp (pedido Parm2 0 repassado ao alvo com Parm1 = desafiante; aceite Parm2 4) e
//   DoRanking (Server.cpp:8991): aceitante em (189,4044), desafiante em (147,4044), _NN_Battle_Started e
//   StartTime 240 (2*121-2). ProcessRanking (Server.cpp:8786) a cada ~2 s, liveness a cada ~10 s; resultado
//   _SS_S_WinBy_S / _SS_S_S_Draw e ClearAreaTeleport para (2572,1752) com HP 1 para quem morreu.
//   Go: handler/duel.go.
export const AREA = {
  /** Limites de Armia (Basedef.cpp:56 CityLimit; world/city.go). */
  armia: { x1: 2052, y1: 2052, x2: 2171, y2: 2163 },
  /** Arena PvP de Armia: as células 0x40 do AttributeMap dentro da cidade (Release/TMsrv/run/AttributeMap.dat). */
  armiaArena: { x1: 2124, y1: 2140, x2: 2147, y2: 2155 },
  /** Arena do duelo (legado kRanking1/2; duel.go duelBox). */
  duelArena: { x1: 142, y1: 4007, x2: 195, y2: 4082 },
} as const;

export type Area = { x1: number; y1: number; x2: number; y2: number };

export const inArea = (a: Area, x: number, y: number) => x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2;

/** Onde os dois jogadores ficam lado a lado (A no ponto, B um tile a leste). */
export const SPOT = {
  /** Meio da arena de Armia: tile 0x40. */
  armiaArena: { x: 2135, y: 2147 },
  /** Praça de Armia, fora da arena: tile 0x01. */
  armiaPlaza: { x: 2110, y: 2095 },
  /** Campo a leste de Armia, saindo pela rua de y 2100: tile 0x00, fora dos limites da cidade. */
  field: { x: 2185, y: 2100 },
} as const;

/** Caminho da praça até a arena de Armia e até o campo (só tiles 0x01 no caminho). */
export const PATH = {
  armiaArena: [{ x: 2110, y: 2110 }, { x: 2120, y: 2130 }, { x: 2135, y: 2147 }],
  field: [{ x: 2140, y: 2100 }, { x: 2168, y: 2100 }, { x: 2185, y: 2100 }],
} as const;

export const DUEL = {
  /** Aceitante (legado Ranking2X/Y). */
  accepterSpawn: { x: 189, y: 4044 },
  /** Desafiante (legado Ranking1X/Y). */
  requesterSpawn: { x: 147, y: 4044 },
  /** ClearAreaTeleport / duel.go duelExit. */
  exit: { x: 2572, y: 1752 },
  /** StartTime do legado: SendClientSignalParm(…, _MSG_StartTime, 2 * 121 - 2). */
  startTime: 240,
  /** Parm do StartTime no Go (duelTicks). */
  startTimeGo: 121,
  /** Efeito do muro (SendEnvEffect(…, 32, 0)). */
  wallEffect: 32,
  /** Tempo do legado até o empate: RankingTime 121 com um decremento a cada 2 s ≈ 242 s. */
  legacyDurationS: 242,
} as const;

/** Language.txt (Release/TMsrv/run), como o cliente decodifica (latin1/cp1252). */
export const TEXT = {
  denyWhisper: /sussurrar para este jogador/, // _NN_Deny_Whisper (165)
  battleInProgress: /partida em progresso/, // _NN_Battle_In_Progress (193)
  battleStarted: /^Batalha entre (.+) e (.+) foi iniciada/, // _NN_Battle_Started (194)
  winBy: /^(.+) . o vencedor, (.+) . o perdedor/, // _SS_S_WinBy_S (196)
  draw: /^Este jogo com (.+) e (.+) finalizou em empate/, // _SS_S_S_Draw (197)
  noExpLoss: /Na arena n.o h. perda de EXP/, // _NN_In_Arena_No_Exp_Loss (143)
  loseExp: /perdeu (\d+) pontos de experi/, // _DN_lose_D_exp (142) e o chat do Go
  pkPointMinus: /Seu ponto caos . (-?\d+) \(Menos_(-?\d+)\)/, // _DD_PKPointMinus (208)
  cantKillUser: /n.o pode mais derrotar jogadores|nao pode atacar este jogador/i, // _DN_CantKillUser (209) / Go
} as const;

/** Códigos do MessageBoxOk do Go (handler/notice.go, iota). */
export const GO_NOTICE = { denyWhisper: 12, battleInProgress: 34, duelWin: 35, duelLose: 36, duelDraw: 37, duelInCity: 38 } as const;

/** Ponto caos neutro (MobName[12] = 75) e o valor do nick vermelho (Guilty). */
export const PK_NEUTRAL = 75;
export const PK_GUILTY_NICK = 0;

/** CP que o matador perde (MobKilled.cpp:3207-3220, arena/cidade): 3 * PKPoint da vítima / -20, entre -9 e 0. */
export const lostPkArena = (victimPk: number) => Math.max(-9, Math.min(0, Math.trunc((3 * victimPk) / -20))) || 0;

/**
 * Personagens semeados. O atacante é um TK forte (mata em poucos golpes); a vítima é nível 50 (armazenado 49)
 * com EXP no meio da faixa, para a perda de EXP aparecer (Go pvpExpLoss ≈ 1322 nesse nível).
 */
export const SEED = {
  attacker: { level: 299, str: 1000, dex: 200, con: 400, int: 50 },
  victim: { level: 49, exp: 590_000, str: 60, dex: 60, con: 60, int: 50 },
} as const;
