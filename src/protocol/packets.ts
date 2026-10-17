// Builders (C→S) e parsers (S→C) dos corpos de pacote, no layout do servidor Go
// (tmserver/internal/protocol/*.go). Todos os offsets são relativos ao CORPO, isto é,
// depois do header de 12 bytes (offset absoluto = offset do corpo + 12).
import { MAX_USER } from './opcodes.ts';

function cstr(b: Buffer, off: number, len: number): string {
  const s = b.subarray(off, off + len);
  const nul = s.indexOf(0);
  return s.subarray(0, nul < 0 ? s.length : nul).toString('latin1');
}

function putCstr(b: Buffer, off: number, len: number, text: string): void {
  const src = Buffer.from(text, 'latin1');
  src.copy(b, off, 0, Math.min(src.length, len));
}

// ---------------------------------------------------------------- C→S

/** MSG_AccountLogin (0x020D), 104 B: Password[12]@0, Name[16]@12, ClientVersion@80. */
export function accountLogin(account: string, password: string, clientVersion: number): Buffer {
  if (Buffer.byteLength(password, 'latin1') > 12) throw new Error('senha com mais de 12 bytes não cabe no pacote');
  if (Buffer.byteLength(account, 'latin1') > 16) throw new Error('conta com mais de 16 bytes não cabe no pacote');
  const b = Buffer.alloc(104);
  putCstr(b, 0, 12, password);
  putCstr(b, 12, 16, account);
  b.writeInt32LE(clientVersion, 80);
  return b;
}

/** MSG_AccountSecure (0x0FDE), 20 B: Token[6]@0, ChangeNumeric@16 (0 = verificar, 1 = definir). */
export function accountSecure(pin: string, change = false): Buffer {
  const b = Buffer.alloc(20);
  putCstr(b, 0, 6, pin);
  b.writeInt32LE(change ? 1 : 0, 16);
  return b;
}

/** MSG_CreateCharacter (0x020F), 24 B: Slot@0, Name[16]@4, Class@20. */
export function createCharacter(slot: number, name: string, cls: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeInt32LE(slot, 0);
  putCstr(b, 4, 16, name);
  b.writeInt32LE(cls, 20);
  return b;
}

/** MSG_DeleteCharacter (0x0211), 32 B: Slot@0, Name[16]@4, Password[12]@20. */
export function deleteCharacter(slot: number, name: string, password: string): Buffer {
  const b = Buffer.alloc(32);
  b.writeInt32LE(slot, 0);
  putCstr(b, 4, 16, name);
  putCstr(b, 20, 12, password);
  return b;
}

/** MSG_CharacterLogin (0x0213), 8 B: Slot@0, Force@4. */
export function characterLogin(slot: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeInt32LE(slot, 0);
  return b;
}

export interface ActionBody {
  posX: number;
  posY: number;
  effect: number; // 0 = andando, 1 = teleporte
  speed: number;
  route?: Uint8Array; // até 24 direções
  targetX: number;
  targetY: number;
}

/** MSG_Action (0x036C), 40 B: PosX@0 PosY@2 Effect@4 Speed@8 Route[24]@12 TargetX@36 TargetY@38. */
export function action(a: ActionBody): Buffer {
  const b = Buffer.alloc(40);
  b.writeInt16LE(a.posX, 0);
  b.writeInt16LE(a.posY, 2);
  b.writeInt32LE(a.effect, 4);
  b.writeInt32LE(a.speed, 8);
  if (a.route) Buffer.from(a.route).copy(b, 12, 0, 24);
  b.writeInt16LE(a.targetX, 36);
  b.writeInt16LE(a.targetY, 38);
  return b;
}

/** Valor de Dam.Damage que o cliente envia para pedir um golpe corpo a corpo (damMelee). */
export const DAM_MELEE = -2;

export interface AttackRequest {
  attackerId: number;
  posX: number;
  posY: number;
  targetId: number;
  targetX: number;
  targetY: number;
  motion?: number;
}

/**
 * MSG_Attack (0x0367) com um alvo. Layout: CurrentHp@4 CurrentExp@12 PosX@22 PosY@24
 * TargetX@26 TargetY@28 AttackerID@30 Progress@32 Motion@34 DoubleCritical@36 CurrentMp@40
 * SkillIndex@44 ReqMp@46 Dam[]@48 {TargetID i32, Damage i32}. O dano é calculado pelo servidor.
 */
export function attack(r: AttackRequest): Buffer {
  const b = Buffer.alloc(48 + 8);
  b.writeUInt16LE(r.posX, 22);
  b.writeUInt16LE(r.posY, 24);
  b.writeUInt16LE(r.targetX, 26);
  b.writeUInt16LE(r.targetY, 28);
  b.writeUInt16LE(r.attackerId, 30);
  b[34] = r.motion ?? 4;
  b.writeInt16LE(-1, 44); // SkillIndex -1 = ataque normal
  b.writeInt32LE(r.targetId, 48);
  b.writeInt32LE(DAM_MELEE, 52);
  return b;
}

/** MSG_ApplyBonus (0x0277), 6 B: BonusType i16@0 (0 = atributo), Detail i16@2 (0 Str, 1 Int, 2 Dex, 3 Con), TargetID u16@4. */
export const BONUS_SCORE = 0;
export const STAT = { str: 0, int: 1, dex: 2, con: 3 } as const;
export function applyBonus(detail: number, bonusType = BONUS_SCORE): Buffer {
  const b = Buffer.alloc(6);
  b.writeInt16LE(bonusType, 0);
  b.writeInt16LE(detail, 2);
  return b;
}

/** ITEM_PLACE_EQUIP / ITEM_PLACE_CARRY: equipamento e inventário (shop.go). */
export const PLACE_EQUIP = 0;
export const PLACE_CARRY = 1;

/** MSG_REQShopList (0x027B), 2 B: TargetID u16@0 (o NPC mercador). */
export function reqShopList(npcId: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(npcId, 0);
  return b;
}

/**
 * MSG_Buy (0x0379), 12 B: TargetID u16@0, TargetInvenPos i16@2 (slot do Carry do NPC),
 * MyInvenPos i16@4 (slot livre do inventário), Coin i32@8 (o eco do servidor traz o gold novo).
 */
export function buy(npcId: number, npcSlot: number, myPos: number): Buffer {
  const b = Buffer.alloc(12);
  b.writeUInt16LE(npcId, 0);
  b.writeInt16LE(npcSlot, 2);
  b.writeInt16LE(myPos, 4);
  return b;
}

/**
 * MSG_UseItem (0x0373), 22 B: SourType@0 SourPos@4 DestType@8 DestPos@12 GridX u16@16
 * GridY u16@18 WarpID u16@20 (messages.go MsgUseItemBody).
 */
export function useItem(slot: number, gridX = 0, gridY = 0): Buffer {
  const b = Buffer.alloc(22);
  b.writeInt32LE(PLACE_CARRY, 0);
  b.writeInt32LE(slot, 4);
  b.writeUInt16LE(gridX, 16);
  b.writeUInt16LE(gridY, 18);
  return b;
}

/** MSG_Quest (0x028B), MSG_STANDARDPARM2: Parm1 = id do NPC @0, Parm2 = confirmação @4. */
export function quest(npcId: number, confirm = 0): Buffer {
  const b = Buffer.alloc(8);
  b.writeInt32LE(npcId, 0);
  b.writeInt32LE(confirm, 4);
  return b;
}

/**
 * MSG_TradingItem (0x0376), 8 B: DestPlace u8@0 DestSlot u8@1 SrcPlace u8@2 SrcSlot u8@3
 * WarpID i32@4 (messages.go MsgTradingItemBody). O servidor troca os dois slots e ecoa o corpo.
 */
export function tradingItem(src: { place: number; slot: number }, dst: { place: number; slot: number }, warpId = 0): Buffer {
  const b = Buffer.alloc(8);
  b[0] = dst.place;
  b[1] = dst.slot;
  b[2] = src.place;
  b[3] = src.slot;
  b.writeInt32LE(warpId, 4);
  return b;
}

export function parseTradingItem(body: Buffer): { src: { place: number; slot: number }; dst: { place: number; slot: number } } {
  return { dst: { place: body[0], slot: body[1] }, src: { place: body[2], slot: body[3] } };
}

/** MSG_Sell (0x037A), 6 B: TargetID u16@0 (o NPC), MyType i16@2 (1 = Carry), MyPos i16@4 (shop.go sell). */
export function sell(npcId: number, slot: number): Buffer {
  const b = Buffer.alloc(6);
  b.writeUInt16LE(npcId, 0);
  b.writeInt16LE(PLACE_CARRY, 2);
  b.writeInt16LE(slot, 4);
  return b;
}

/** MSG_MasterGriff (0x0AD9), MSG_STANDARDPARM2: WarpID i32@0 (1-based, misc.go masterGriffDestinations), Ty i32@4. */
export function masterGriff(warpId: number, ty = 0): Buffer {
  const b = Buffer.alloc(8);
  b.writeInt32LE(warpId, 0);
  b.writeInt32LE(ty, 4);
  return b;
}

/** MSG_MessageChat (0x0333): String[96]. */
export function chat(text: string): Buffer {
  const b = Buffer.alloc(96);
  putCstr(b, 0, 95, text);
  return b;
}

// ---------------------------------------------------------------- S→C

export interface SelCharSlot {
  slot: number;
  name: string;
  /** Nível armazenado (o cliente exibe +1). */
  level: number;
  exp: bigint;
}

/** STRUCT_SELCHAR (840 B): Name[4][16]@16, Score[4]@80 (48 B cada, Level@0), Exp[4]@808. */
function parseSelChar(b: Buffer, base: number): SelCharSlot[] {
  const out: SelCharSlot[] = [];
  for (let s = 0; s < 4; s++) {
    const name = cstr(b, base + 16 + s * 16, 16);
    if (!name) continue;
    out.push({
      slot: s,
      name,
      level: b.readInt32LE(base + 80 + s * 48),
      exp: b.readBigInt64LE(base + 808 + s * 8),
    });
  }
  return out;
}

/** CNFAccountLogin (0x010A): SELCHAR @20. */
export function parseCNFAccountLogin(body: Buffer): SelCharSlot[] {
  return parseSelChar(body, 20);
}

/** CNFNewCharacter (0x0110) / CNFDeleteCharacter (0x0112): SELCHAR @4. */
export function parseCNFNewCharacter(body: Buffer): SelCharSlot[] {
  return parseSelChar(body, 4);
}

/** STRUCT_ITEM (8 B): sIndex u16@0, stEffect[3] {cEffect u8, cValue u8}@2. */
export interface Item {
  index: number;
  eff: [number, number][];
}

/** EF_AMOUNT: o efeito que guarda o tamanho da pilha. */
export const EF_AMOUNT = 61;

export function parseItem(b: Buffer, off: number): Item {
  return { index: b.readUInt16LE(off), eff: [0, 1, 2].map((i) => [b[off + 2 + i * 2], b[off + 3 + i * 2]] as [number, number]) };
}

/** Tamanho da pilha (EF_AMOUNT), ou 1 para item sem pilha; 0 para slot vazio. */
export function itemAmount(it: Item | undefined): number {
  if (!it || it.index === 0) return 0;
  const a = it.eff.find(([e]) => e === EF_AMOUNT);
  return a && a[1] > 0 ? a[1] : 1;
}

export function writeItem(b: Buffer, off: number, it: Item): void {
  b.writeUInt16LE(it.index, off);
  for (let i = 0; i < 3; i++) {
    b[off + 2 + i * 2] = it.eff[i]?.[0] ?? 0;
    b[off + 3 + i * 2] = it.eff[i]?.[1] ?? 0;
  }
}

export function sameItem(a: Item | undefined, b: Item | undefined): boolean {
  if (!a || !b || a.index !== b.index) return false;
  return [0, 1, 2].every((i) => (a.eff[i]?.[0] ?? 0) === (b.eff[i]?.[0] ?? 0) && (a.eff[i]?.[1] ?? 0) === (b.eff[i]?.[1] ?? 0));
}

/** Equip[16] do STRUCT_MOB. O slot de destino de um item é o bit mais baixo do seu nPos (item.go canEquipSlot). */
export const MAX_EQUIP = 16;

/** Slots do Carry: 64 no STRUCT_MOB, 30 acessíveis sem bolsa (carry.go baseCarrySlots). */
export const MAX_CARRY = 64;
export const BASE_CARRY_SLOTS = 30;

export interface CharacterSnapshot {
  x: number;
  y: number;
  name: string;
  exp: bigint;
  coin: number;
  level: number;
  ac: number;
  damage: number;
  maxHp: number;
  hp: number;
  /** Str/Int/Dex/Con do CurrentScore (com o equipamento). */
  attrs: Attributes;
  clientId: number;
  slot: number;
  equip: Item[];
  carry: Item[];
}

/**
 * CNFCharacterLogin (0x0114), 1820 B: PosX@0 PosY@2, STRUCT_MOB@4 (Name@0, Coin@28, Exp@32,
 * BaseScore@44, CurrentScore@92 {Level@0 Ac@4 Damage@8 MaxHp@16 Hp@24 Str/Int/Dex/Con i16@32}, Equip[16]@140, Carry[64]@268), Slot@1028,
 * ClientID@1030.
 */
export function parseCNFCharacterLogin(body: Buffer): CharacterSnapshot {
  const mob = 4;
  const score = mob + 92;
  const equip: Item[] = [];
  for (let i = 0; i < MAX_EQUIP; i++) equip.push(parseItem(body, mob + 140 + i * 8));
  const carry: Item[] = [];
  for (let i = 0; i < MAX_CARRY; i++) carry.push(parseItem(body, mob + 268 + i * 8));
  return {
    x: body.readInt16LE(0),
    y: body.readInt16LE(2),
    name: cstr(body, mob, 12),
    coin: body.readInt32LE(mob + 28),
    exp: body.readBigInt64LE(mob + 32),
    level: body.readInt32LE(score),
    ac: body.readInt32LE(score + 4),
    damage: body.readInt32LE(score + 8),
    maxHp: body.readInt32LE(score + 16),
    hp: body.readInt32LE(score + 24),
    attrs: { str: body.readInt16LE(score + 32), int: body.readInt16LE(score + 34), dex: body.readInt16LE(score + 36), con: body.readInt16LE(score + 38) },
    slot: body.readUInt16LE(1028),
    clientId: body.readUInt16LE(1030),
    equip,
    carry,
  };
}

/** Slot do Carry do NPC que corresponde à posição i (0–26) da lista da loja (shop.go ShopSlot). */
export const shopSlot = (i: number) => (i % 9) + Math.floor(i / 9) * 27;

/** ShopList (0x017C), 224 B: ShopType@0, List[27]@4 (STRUCT_ITEM), Tax@220. */
export function parseShopList(body: Buffer): { shopType: number; items: (Item & { npcSlot: number })[]; tax: number } {
  const items: (Item & { npcSlot: number })[] = [];
  for (let i = 0; i < 27; i++) {
    const it = parseItem(body, 4 + i * 8);
    if (it.index) items.push({ ...it, npcSlot: shopSlot(i) });
  }
  return { shopType: body.readInt32LE(0), items, tax: body.readInt32LE(220) };
}

/** SendItem (0x0182), 12 B: invType u16@0 (0 = Equip, 1 = Carry), Slot u16@2, STRUCT_ITEM@4 (sIndex 0 = slot vazio). */
export function parseSendItem(body: Buffer): { place: number; slot: number; item: Item } {
  return { place: body.readUInt16LE(0), slot: body.readUInt16LE(2), item: parseItem(body, 4) };
}

/** Eco do MSG_Buy: o mesmo corpo do pedido com o gold novo em Coin@8. */
export function parseBuy(body: Buffer): { npcId: number; npcSlot: number; myPos: number; coin: number } {
  return { npcId: body.readUInt16LE(0), npcSlot: body.readInt16LE(2), myPos: body.readInt16LE(4), coin: body.length >= 12 ? body.readInt32LE(8) : -1 };
}

/** MessageBoxOk (0x0102): código do aviso i32@0 (notice.go). */
export function parseNotice(body: Buffer): number {
  return body.length >= 4 ? body.readInt32LE(0) : -1;
}

export interface MobView {
  id: number;
  name: string;
  x: number;
  y: number;
  level: number;
  ac: number;
  maxHp: number;
  hp: number;
  merchant: number;
  isPlayer: boolean;
}

/**
 * CreateMob (0x0364), 220 B: PosX@0 PosY@2 MobID@4 Name[16]@6, Score@124
 * {Level@0 Merchant@12 MaxHp@16 Hp@24}.
 */
export function parseCreateMob(body: Buffer): MobView {
  const id = body.readUInt16LE(4);
  const score = 124;
  return {
    id,
    name: cstr(body, 6, id < MAX_USER ? 12 : 16),
    x: body.readInt16LE(0),
    y: body.readInt16LE(2),
    level: body.readInt32LE(score),
    ac: body.readInt32LE(score + 4),
    merchant: body[score + 12],
    maxHp: body.readInt32LE(score + 16),
    hp: body.readInt32LE(score + 24),
    isPlayer: id < MAX_USER,
  };
}

export function parseAction(body: Buffer): ActionBody {
  return {
    posX: body.readInt16LE(0),
    posY: body.readInt16LE(2),
    effect: body.readInt32LE(4),
    speed: body.readInt32LE(8),
    route: body.subarray(12, 36),
    targetX: body.readInt16LE(36),
    targetY: body.readInt16LE(38),
  };
}

export interface AttackEcho {
  attackerId: number;
  /** HP e EXP do atacante depois do golpe (o servidor reescreve). */
  currentHp: number;
  currentExp: bigint;
  dam: { targetId: number; damage: number }[];
}

export function parseAttack(body: Buffer): AttackEcho {
  const dam: AttackEcho['dam'] = [];
  for (let off = 48; off + 8 <= body.length && dam.length < 13; off += 8) {
    dam.push({ targetId: body.readInt32LE(off), damage: body.readInt32LE(off + 4) });
  }
  return {
    attackerId: body.readUInt16LE(30),
    currentHp: body.readInt32LE(4),
    currentExp: body.readBigInt64LE(12),
    dam,
  };
}

export interface Attributes {
  str: number;
  int: number;
  dex: number;
  con: number;
}

/**
 * UpdateScore (0x0336), 140 B: Level@0 Ac@4 Damage@8 MaxHp@16 Hp@24, Str@32 Int@34 Dex@36 Con@38
 * (i16, CurrentScore: com o equipamento) … CurrHp@124 (protocol/score.go EncodeUpdateScore).
 */
export function parseUpdateScore(body: Buffer): { level: number; ac: number; damage: number; maxHp: number; hp: number; attrs?: Attributes } {
  return {
    level: body.readInt32LE(0),
    ac: body.readInt32LE(4),
    damage: body.readInt32LE(8),
    maxHp: body.readInt32LE(16),
    hp: body.length >= 128 ? body.readInt32LE(124) : body.readInt32LE(24),
    attrs: body.length >= 40 ? { str: body.readInt16LE(32), int: body.readInt16LE(34), dex: body.readInt16LE(36), con: body.readInt16LE(38) } : undefined,
  };
}

/** UpdateEtc (0x0337), 36 B: Hold@0 Exp i64@4 Learn u64@12 ScoreBonus u16@20 … Coin@28. */
export function parseUpdateEtc(body: Buffer): { exp: bigint; scoreBonus: number; coin: number } {
  return { exp: body.readBigInt64LE(4), scoreBonus: body.readUInt16LE(20), coin: body.readInt32LE(28) };
}

/** SetHpMp (0x0181): Hp@0 Mp@4 · SetHpDam (0x018A): Hp@0 Dam@4. */
export function parseHp(body: Buffer): number {
  return body.readInt32LE(0);
}

/** MessageChat (0x0333, String[96]) e MessagePanel (0x0101, String[128]). */
export function parseText(body: Buffer): string {
  return cstr(body, 0, body.length);
}

/** ExpPanel (0x5000): Msg[96] + cor. */
export function parseExpPanel(body: Buffer): string {
  return cstr(body, 0, Math.min(96, body.length));
}

// ---------------------------------------------------------------- troca entre jogadores

/** Entradas da oferta de troca (MAX_TRADE). */
export const MAX_TRADE = 15;
/** InvenPos de uma entrada vazia da oferta (o char -1 do legado). */
export const TRADE_EMPTY_POS = 0xff;
/** MSG_Trade: Item[15]@0 (8 B cada), InvenPos[15]@120, TradeMoney i32@135, MyCheck u8@139, OpponentID u16@140. */
export const TRADE_BODY_SIZE = MAX_TRADE * 8 + MAX_TRADE + 4 + 1 + 2;

export interface TradeOffer {
  /** Itens oferecidos e o slot do inventário de onde saem. */
  items: { slot: number; item: Item }[];
  money: number;
  check: boolean;
  /** Na ida (C→S), o outro jogador; no repasse (S→C), quem fez a oferta. */
  opponentId: number;
}

/** MSG_Trade (0x0383), 142 B, layout de messages.go MsgTradeBody. */
export function trade(o: TradeOffer): Buffer {
  if (o.items.length > MAX_TRADE) throw new Error(`oferta com ${o.items.length} itens (máximo ${MAX_TRADE})`);
  const b = Buffer.alloc(TRADE_BODY_SIZE);
  b.fill(TRADE_EMPTY_POS, MAX_TRADE * 8, MAX_TRADE * 9);
  o.items.forEach(({ slot, item }, i) => {
    writeItem(b, i * 8, item);
    b[MAX_TRADE * 8 + i] = slot;
  });
  b.writeInt32LE(o.money, MAX_TRADE * 9);
  b[MAX_TRADE * 9 + 4] = o.check ? 1 : 0;
  b.writeUInt16LE(o.opponentId, MAX_TRADE * 9 + 5);
  return b;
}

export function parseTrade(body: Buffer): TradeOffer {
  const items: TradeOffer['items'] = [];
  for (let i = 0; i < MAX_TRADE; i++) {
    const item = parseItem(body, i * 8);
    const slot = body[MAX_TRADE * 8 + i];
    if (item.index !== 0 && slot !== TRADE_EMPTY_POS) items.push({ slot, item });
  }
  return {
    items,
    money: body.readInt32LE(MAX_TRADE * 9),
    check: body[MAX_TRADE * 9 + 4] === 1,
    opponentId: body.readUInt16LE(MAX_TRADE * 9 + 5),
  };
}

/** UpdateCarry (0x0185), 516 B: Carry[64]@0 (8 B cada) + Coin i32@512 (carry.go EncodeUpdateCarryBody). */
export function parseUpdateCarry(body: Buffer): { carry: Item[]; coin: number } {
  const carry: Item[] = [];
  for (let i = 0; i < MAX_CARRY; i++) carry.push(parseItem(body, i * 8));
  return { carry, coin: body.readInt32LE(MAX_CARRY * 8) };
}
