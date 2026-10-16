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

export interface CharacterSnapshot {
  x: number;
  y: number;
  name: string;
  exp: bigint;
  level: number;
  damage: number;
  maxHp: number;
  hp: number;
  clientId: number;
  slot: number;
}

/**
 * CNFCharacterLogin (0x0114), 1820 B: PosX@0 PosY@2, STRUCT_MOB@4 (Name@0, Exp@32,
 * BaseScore@44, CurrentScore@92 {Level@0 MaxHp@16 Hp@24}), Slot@1028, ClientID@1030.
 */
export function parseCNFCharacterLogin(body: Buffer): CharacterSnapshot {
  const mob = 4;
  const score = mob + 92;
  return {
    x: body.readInt16LE(0),
    y: body.readInt16LE(2),
    name: cstr(body, mob, 12),
    exp: body.readBigInt64LE(mob + 32),
    level: body.readInt32LE(score),
    damage: body.readInt32LE(score + 8),
    maxHp: body.readInt32LE(score + 16),
    hp: body.readInt32LE(score + 24),
    slot: body.readUInt16LE(1028),
    clientId: body.readUInt16LE(1030),
  };
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

/** UpdateScore (0x0336), 140 B: Level@0 Ac@4 Damage@8 MaxHp@16 Hp@24 … CurrHp@124. */
export function parseUpdateScore(body: Buffer): { level: number; damage: number; maxHp: number; hp: number } {
  return {
    level: body.readInt32LE(0),
    damage: body.readInt32LE(8),
    maxHp: body.readInt32LE(16),
    hp: body.length >= 128 ? body.readInt32LE(124) : body.readInt32LE(24),
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
