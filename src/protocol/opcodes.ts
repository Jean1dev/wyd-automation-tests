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
  ReqShopList: 0x027b, // clicar num NPC mercador
  Buy: 0x0379, // comprar do NPC (C↔S; o eco S→C traz o gold novo)
  UseItem: 0x0373, // usar item do inventário (clique direito)
  Quest: 0x028b, // falar com NPC de quest (MSG_STANDARDPARM2)
  TradingItem: 0x0376, // mover item entre inventário e equipamento (C↔S; o servidor ecoa)
  Sell: 0x037a, // vender item do inventário ao NPC (C↔S)
  ReqTeleport: 0x0290, // pisou num tile de teleporte (só header)
  MasterGriff: 0x0ad9, // viagem do Mestre Grifo (MSG_STANDARDPARM2: WarpID, Ty)
  Trade: 0x0383, // troca entre jogadores (C↔S; o servidor repassa a oferta ao outro lado)
  QuitTrade: 0x0384, // cancela a troca (C↔S; S→C também fecha a janela depois da troca)
  SendReqParty: 0x037f, // convite de grupo (C↔S; o servidor repassa ao convidado)
  AcceptParty: 0x03ab, // aceitar o convite de grupo
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
  ShopList: 0x017c, // lista da loja (o Carry do NPC)
  SendItem: 0x0182, // atualiza um slot do inventário
  UpdateCarry: 0x0185, // inventário inteiro (Carry[64]) + gold, depois da troca
  CNFCheck: 0x0386, // troca: o servidor aceitou a minha confirmação
  StartTime: 0x03a1, // contador das arenas de quest (legado)
  SendArchEffect: 0x03b4, // Arch criado: STANDARDPARM com o slot do novo personagem
  SendAffect: 0x03b9, // buffs/debuffs do personagem: STRUCT_AFFECT[32] {Type u8, Value u8, Level u16, Time u32}
} as const;

export function opName(type: number): string {
  for (const [k, v] of Object.entries(Op)) if (v === type) return k;
  return `0x${type.toString(16).padStart(4, '0')}`;
}

/** Ids de entidade abaixo disto são jogadores (MAX_USER); acima, mobs e NPCs. */
export const MAX_USER = 1000;

/** Tick que o servidor descarta (SkipCheckTick); nunca enviar. */
export const SKIP_CHECK_TICK = 235543242;
