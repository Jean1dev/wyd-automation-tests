// Quest 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub (docs/quests/13-celestial-destravas.md).
// Itens, receitas e faixas como estão no servidor (Jean1dev/w2pp-OpenWYD, main b392705).
//
// - Lv40 no Alquimista Odin: _MSG_CombineItemOdin.cpp:530-555 (receita 4, g_pOdinRate[4] = 40); Go
//   combineOdin (handler/combine_odin.go:92 pré-checagem Level 39 / CelLv40 0 / Celestial, :223 a rolagem)
//   e combine.MatchOdin (combine/odin.go:76). Nenhum dos dois confere a distância até o Odin.
// - Pedra da Fúria 3020 (sem EF_VOLATILE no ItemList): _MSG_UseItem.cpp:3470-3690 trata pelo sIndex
//   (Arcana/Reset para Celestial ≥ 199, Lv90 para Celestial ≥ 89). No Go a 3020 cai no vol == 0
//   (item.go:525, caminho de equipar).
// - Comandos: /destravar40, /destravar90, /arcana (handler/chat.go:359-370, destravarCelestialFor :474).
// - Adds do Sub-Celestial: SetCircletSubGod (Server.cpp:9794-9850), chamado do CheckGetLevel no level up.
//   No Go o comentário em combine_variants.go:291 diz que ele está adiado.
// - Curva de exp do Celestial no Go (level/nextlevel.go:77): placeholder c[i] = c[i-1] + 1M + i·100k.
import { DRAGON_AREA, DRAGON_MOBS, DRAGON_SPAWNS, GRIFF_WARP, HUNT_GEAR, NPC as Q06_NPC, REST_SPOT, ROUTE_TO_EXPLOR } from './06-terra-mistica.ts';

export { DRAGON_AREA, DRAGON_MOBS, DRAGON_SPAWNS, GRIFF_WARP, HUNT_GEAR, REST_SPOT, ROUTE_TO_EXPLOR };
export const NPC = { capExplor: Q06_NPC.capExplor } as const;

export const ITEM = {
  pergaminhoSelado: 4127,
  seloMagico: 5135,
  fehu: 5113,
  mannaz: 5129,
  thurisaz: 5112,
  ansuz: 5110,
  pedraFuria: 3020,
  /** Pedras Secretas: Água 5334, Terra 5335, Sol 5336, Vento 5337. */
  pedraSecreta: [5334, 5335, 5336, 5337],
  cytheraPrateada: 3500,
  cytheraMistica: 3502,
  cytheraArcana: 3507,
  poeiraFada: 4142,
} as const;

/** Receita 4 do Odin (Destrave Lv40), na ordem das posições 0..6. */
export const LV40_RECIPE = [
  ITEM.pergaminhoSelado, ITEM.pergaminhoSelado, ITEM.seloMagico, ITEM.fehu, ITEM.mannaz, ITEM.thurisaz, ITEM.ansuz,
] as const;

export const EQUIP_SLOT = { cythera: 1 } as const;

/** EF_AC / EF_HP (ItemEffect.h:5-6): os adds do Sub-Celestial no diadema (stEffect[1]/[2]). */
export const EF_AC = 3;
export const EF_HP = 4;

/** Adds do Sub-Celestial por nível armazenado (Server.cpp:9796-9850). */
export const SUB_ADDS: Record<number, { ac: number; hp: number }> = {
  120: { ac: 30, hp: 40 },
  150: { ac: 35, hp: 50 },
  180: { ac: 45, hp: 60 },
  199: { ac: 50, hp: 70 },
};

/** Exp mínima do nível ARMAZENADO `level` na curva do Celestial do Go (placeholder de nextlevel.go). */
export function celExp(level: number): number {
  return 1_000_000 * level + 50_000 * level * (level + 1);
}

/** Exp que a Pedra da Fúria tira no Reset (_MSG_UseItem.cpp:3586). */
export const RESET_EXP = 20_000_000;

/** Fama que a Pedra da Fúria cobra (Lv90, Arcana, Reset). */
export const FURY_FAME = 500;

/** Atributos e HP de um Celestial que caça dragões (o Go não recalcula HP pelo nível). */
export const CEL_SEED = { str: 900, dex: 250, con: 600, int: 10, max_hp: 25000, hp: 25000, max_mp: 3000, mp: 3000 } as const;
