// HEADER.Type usados pelos bots (tmserver/internal/protocol/types.go).
export const Op = {
  // Cliente → servidor
  AccountLogin: 0x020d,
  AccountSecure: 0x0fde, // PIN (também é o ack S→C)
  CreateCharacter: 0x020f,
  DeleteCharacter: 0x0211,
  CharacterLogin: 0x0213,
  CharacterLogout: 0x0215,
  Action: 0x036c, // movimento (C↔S); S→C com Effect=1 é teleporte
  Action2: 0x0366,
  Action3: 0x0368,
  Attack: 0x0367,
  AttackOne: 0x039d,
  AttackTwo: 0x039e,
  Restart: 0x0289, // reviver após a morte
  ApplyBonus: 0x0277, // distribuir ponto de atributo
  MessageChat: 0x0333,
  MessageWhisper: 0x0334,
  Ping: 0x03a0,

  // Servidor → cliente
  MessagePanel: 0x0101,
  MessageBoxOk: 0x0102,
  CNFAccountLogin: 0x010a,
  CNFNewCharacter: 0x0110,
  CNFDeleteCharacter: 0x0112,
  CNFCharacterLogin: 0x0114,
  CNFCharacterLogout: 0x0116,
  CharacterLoginFail: 0x0119,
  NewCharacterFail: 0x011a,
  DeleteCharacterFail: 0x011b,
  AlreadyPlaying: 0x011c,
  StillPlaying: 0x011d,
  AccountSecureFail: 0x0fdf,
  CreateMob: 0x0364,
  CreateMobTrade: 0x0363,
  RemoveMob: 0x0165,
  UpdateScore: 0x0336,
  UpdateEtc: 0x0337,
  SetHpMp: 0x0181,
  SetHpDam: 0x018a,
  Motion: 0x036a,
  ExpPanel: 0x5000,
} as const;

export function opName(type: number): string {
  for (const [k, v] of Object.entries(Op)) if (v === type) return k;
  return `0x${type.toString(16).padStart(4, '0')}`;
}

/** Ids de entidade abaixo disto são jogadores (MAX_USER); acima, mobs e NPCs. */
export const MAX_USER = 1000;

/** Tick que o servidor descarta (SkipCheckTick); nunca enviar. */
export const SKIP_CHECK_TICK = 235543242;
