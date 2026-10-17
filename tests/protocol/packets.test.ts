import { describe, expect, it } from 'vitest';
import * as P from '../../src/protocol/packets.ts';

// Tamanhos e offsets conferidos contra tmserver/internal/protocol/*.go (corpo = pacote − 12).
describe('builders C→S', () => {
  it('AccountLogin: 104 B, senha@0, conta@12, versão@80', () => {
    const b = P.accountLogin('conta', 'senha123', 12000);
    expect(b.length).toBe(104);
    expect(b.subarray(0, 8).toString()).toBe('senha123');
    expect(b.subarray(12, 17).toString()).toBe('conta');
    expect(b.readInt32LE(80)).toBe(12000);
    expect(() => P.accountLogin('c', 'x'.repeat(13), 1)).toThrow();
  });

  it('AccountSecure: 20 B, token@0, ChangeNumeric@16', () => {
    const b = P.accountSecure('123456');
    expect(b.length).toBe(20);
    expect(b.subarray(0, 6).toString()).toBe('123456');
    expect(b.readInt32LE(16)).toBe(0);
  });

  it('CreateCharacter / CharacterLogin / DeleteCharacter', () => {
    const c = P.createCharacter(2, 'botabc', 3);
    expect([c.length, c.readInt32LE(0), c.subarray(4, 10).toString(), c.readInt32LE(20)]).toEqual([24, 2, 'botabc', 3]);
    expect(P.characterLogin(1).length).toBe(8);
    const d = P.deleteCharacter(1, 'botabc', 'pw');
    expect([d.length, d.readInt32LE(0), d.subarray(20, 22).toString()]).toEqual([32, 1, 'pw']);
  });

  it('TradingItem: 8 B, Dest@0..1, Src@2..3, WarpID@4 (messages.go MsgTradingItemBody)', () => {
    const b = P.tradingItem({ place: P.PLACE_CARRY, slot: 7 }, { place: P.PLACE_EQUIP, slot: 6 });
    expect([b.length, b[0], b[1], b[2], b[3], b.readInt32LE(4)]).toEqual([8, 0, 6, 1, 7, 0]);
    expect(P.parseTradingItem(b)).toEqual({ src: { place: 1, slot: 7 }, dst: { place: 0, slot: 6 } });
  });

  it('Sell: 6 B, TargetID@0, MyType@2 = 1, MyPos@4 (shop.go sell)', () => {
    const b = P.sell(1234, 9);
    expect([b.length, b.readUInt16LE(0), b.readInt16LE(2), b.readInt16LE(4)]).toEqual([6, 1234, 1, 9]);
  });

  it('MasterGriff: STANDARDPARM2, WarpID@0, Ty@4', () => {
    const b = P.masterGriff(2);
    expect([b.length, b.readInt32LE(0), b.readInt32LE(4)]).toEqual([8, 2, 0]);
  });

  it('Action: 40 B e ida e volta', () => {
    const a = { posX: 2100, posY: 2080, effect: 0, speed: 2, targetX: 2100, targetY: 2076 };
    const b = P.action(a);
    expect(b.length).toBe(40);
    const r = P.parseAction(b);
    expect([r.posX, r.posY, r.effect, r.speed, r.targetX, r.targetY]).toEqual([2100, 2080, 0, 2, 2100, 2076]);
  });

  it('Attack: Dam[0]@48 = {alvo, damMelee}', () => {
    const b = P.attack({ attackerId: 7, posX: 1, posY: 2, targetId: 1234, targetX: 3, targetY: 4 });
    expect(b.length).toBe(56);
    const e = P.parseAttack(b);
    expect(e.attackerId).toBe(7);
    expect(e.dam).toEqual([{ targetId: 1234, damage: P.DAM_MELEE }]);
    expect(b.readInt16LE(44)).toBe(-1);
  });

  it('Attack com skill: SkillIndex@44, CurrentMp@40, Dam = damSkill em cada alvo (skill_test.go skillAttackFrame)', () => {
    const one = P.attack({ attackerId: 7, posX: 1, posY: 2, targetId: 1234, targetX: 3, targetY: 4, skillIndex: 32, currentMp: 90 });
    expect([one.length, one.readInt16LE(44), one.readInt32LE(40), one.readInt32LE(48), one.readInt32LE(52)]).toEqual([56, 32, 90, 1234, P.DAM_SKILL]);
    const area = P.attack({ attackerId: 7, posX: 1, posY: 2, targetId: 1001, targetX: 3, targetY: 4, skillIndex: 35, moreTargets: [1002, 1003] });
    expect(area.length).toBe(48 + 3 * 8);
    const e = P.parseAttack(area);
    expect(e.skillIndex).toBe(35);
    expect(e.dam).toEqual([1001, 1002, 1003].map((targetId) => ({ targetId, damage: P.DAM_SKILL })));
    expect(() => P.attack({ attackerId: 7, posX: 1, posY: 2, targetId: 1, targetX: 3, targetY: 4, skillIndex: 35, moreTargets: Array(13).fill(2) })).toThrow();
  });

  it('ApplyBonus: aprender skill = BonusType 2, Detail 5000 + skill, TargetID do mestre (skill_test.go learnBody)', () => {
    const b = P.learnSkill(33, 1234);
    expect([b.length, b.readInt16LE(0), b.readInt16LE(2), b.readUInt16LE(4)]).toEqual([6, 2, 5033, 1234]);
    const m = P.applyBonus(2, P.BONUS_SPECIAL);
    expect([m.readInt16LE(0), m.readInt16LE(2), m.readUInt16LE(4)]).toEqual([1, 2, 0]);
  });

  it('SendAffect: STRUCT_AFFECT[32] de 8 B, só os ocupados', () => {
    const b = Buffer.alloc(256);
    b[8] = 1; b[9] = 2; b.writeUInt16LE(30, 10); b.writeUInt32LE(4, 12);
    expect(P.parseSendAffect(b)).toEqual([{ type: 1, value: 2, level: 30, time: 4 }]);
  });

  it('REQShopList: 2 B, TargetID@0', () => {
    const b = P.reqShopList(1234);
    expect([b.length, b.readUInt16LE(0)]).toEqual([2, 1234]);
  });

  it('Buy: 12 B, TargetID@0, TargetInvenPos@2, MyInvenPos@4, Coin@8', () => {
    const b = P.buy(1234, 28, 5);
    expect([b.length, b.readUInt16LE(0), b.readInt16LE(2), b.readInt16LE(4), b.readInt32LE(8)]).toEqual([12, 1234, 28, 5, 0]);
    b.writeInt32LE(4321, 8);
    expect(P.parseBuy(b)).toEqual({ npcId: 1234, npcSlot: 28, myPos: 5, coin: 4321 });
  });

  it('UseItem: 22 B, SourType=1 (Carry)@0, SourPos@4, GridX@16, GridY@18', () => {
    const b = P.useItem(7, 2100, 2080);
    expect([b.length, b.readInt32LE(0), b.readInt32LE(4), b.readInt32LE(8), b.readUInt16LE(16), b.readUInt16LE(18), b.readUInt16LE(20)]).toEqual([22, 1, 7, 0, 2100, 2080, 0]);
  });

  it('Quest: 8 B, Parm1 = NPC@0, Parm2 = confirmação@4', () => {
    const b = P.quest(2001, 1);
    expect([b.length, b.readInt32LE(0), b.readInt32LE(4)]).toEqual([8, 2001, 1]);
  });

  it('ApplyBonus: 6 B, BonusType@0, Detail@2', () => {
    const b = P.applyBonus(P.STAT.str);
    expect(b.length).toBe(6);
    expect([b.readInt16LE(0), b.readInt16LE(2), b.readUInt16LE(4)]).toEqual([P.BONUS_SCORE, 0, 0]);
  });
});

describe('parsers S→C', () => {
  it('SELCHAR do CNFAccountLogin (@20) e do CNFNewCharacter (@4)', () => {
    const body = Buffer.alloc(1996);
    const sel = 20;
    body.write('botxyz', sel + 16 + 1 * 16, 'latin1');
    body.writeInt32LE(34, sel + 80 + 1 * 48);
    body.writeBigInt64LE(175915n, sel + 808 + 1 * 8);
    expect(P.parseCNFAccountLogin(body)).toEqual([{ slot: 1, name: 'botxyz', level: 34, exp: 175915n, face: 0 }]);
    const nc = Buffer.alloc(844);
    nc.write('abcd', 4 + 16, 'latin1');
    expect(P.parseCNFNewCharacter(nc).map((s) => s.name)).toEqual(['abcd']);
  });

  it('CNFCharacterLogin: posição, mob e ClientID@1030', () => {
    const b = Buffer.alloc(1820);
    b.writeInt16LE(2090, 0); b.writeInt16LE(2095, 2);
    b.write('botq', 4, 'latin1');
    b.writeBigInt64LE(500n, 4 + 32);
    b.writeInt32LE(1, 4 + 92); b.writeInt32LE(12, 4 + 92 + 8); b.writeInt32LE(105, 4 + 92 + 16); b.writeInt32LE(100, 4 + 92 + 24);
    b.writeUInt16LE(3, 1030);
    b.writeInt32LE(7300, 4 + 28);
    // Carry[3] = Poeira de Fada com EF_AMOUNT 255 no segundo efeito.
    const slot3 = 4 + 268 + 3 * 8;
    b.writeUInt16LE(4142, slot3); b[slot3 + 4] = P.EF_AMOUNT; b[slot3 + 5] = 255;
    const s = P.parseCNFCharacterLogin(b);
    expect(s).toMatchObject({ x: 2090, y: 2095, name: 'botq', exp: 500n, coin: 7300, level: 1, damage: 12, maxHp: 105, hp: 100, clientId: 3 });
    expect(s.carry).toHaveLength(64);
    expect(s.carry[3]).toEqual({ index: 4142, eff: [[0, 0], [P.EF_AMOUNT, 255], [0, 0]] });
    expect([P.itemAmount(s.carry[3]), P.itemAmount(s.carry[0])]).toEqual([255, 0]);
  });

  it('CNFCharacterLogin: Equip[16]@mob+140, AC e atributos do CurrentScore', () => {
    const b = Buffer.alloc(1820);
    b.writeInt32LE(250, 4 + 92 + 4);
    b.writeInt16LE(132, 4 + 92 + 32); b.writeInt16LE(10, 4 + 92 + 34); b.writeInt16LE(96, 4 + 92 + 36); b.writeInt16LE(80, 4 + 92 + 38);
    b.writeUInt16LE(866, 4 + 140 + 6 * 8); // Equip[6]: Espada em Cruz
    const s = P.parseCNFCharacterLogin(b);
    expect(s.ac).toBe(250);
    expect(s.attrs).toEqual({ str: 132, int: 10, dex: 96, con: 80 });
    expect(s.equip).toHaveLength(16);
    expect(s.equip[6].index).toBe(866);
  });

  it('ShopList: List[27]@4 mapeada para o Carry do NPC (ShopSlot), Tax@220', () => {
    const b = Buffer.alloc(224);
    b.writeInt32LE(1, 0);
    b.writeUInt16LE(4038, 4 + 10 * 8); // posição 10 da lista = Carry[28] (Aki)
    b.writeUInt16LE(4142, 4 + 19 * 8); // posição 19 = Carry[55] (Evolução)
    b.writeInt32LE(0, 220);
    const l = P.parseShopList(b);
    expect(l.shopType).toBe(1);
    expect(l.items.map((it) => [it.index, it.npcSlot])).toEqual([[4038, 28], [4142, 55]]);
    expect([P.shopSlot(0), P.shopSlot(8), P.shopSlot(9), P.shopSlot(26)]).toEqual([0, 8, 27, 62]);
  });

  it('SendItem: invType@0, Slot@2, STRUCT_ITEM@4', () => {
    const b = Buffer.alloc(12);
    b.writeUInt16LE(P.PLACE_CARRY, 0); b.writeUInt16LE(4, 2); b.writeUInt16LE(4038, 4);
    expect(P.parseSendItem(b)).toEqual({ place: 1, slot: 4, item: { index: 4038, eff: [[0, 0], [0, 0], [0, 0]] } });
    expect(P.parseNotice(Buffer.from([7, 0, 0, 0]))).toBe(7);
  });

  it('CreateMob: id@4, nome@6, score@124', () => {
    const b = Buffer.alloc(220);
    b.writeInt16LE(2120, 0); b.writeInt16LE(2020, 2); b.writeUInt16LE(1500, 4);
    b.write('Porco', 6, 'latin1');
    b.writeInt32LE(3, 124); b.writeInt32LE(2, 124 + 4); b.writeInt32LE(80, 124 + 16); b.writeInt32LE(80, 124 + 24);
    expect(P.parseCreateMob(b)).toMatchObject({ id: 1500, name: 'Porco', x: 2120, y: 2020, level: 3, ac: 2, hp: 80, merchant: 0, isPlayer: false });
  });

  it('SELCHAR: rosto do slot em Equip[4][16]@272 (128 B por slot)', () => {
    const b = Buffer.alloc(4 + 840);
    b.write('botarch', 4 + 16 + 2 * 16, 'latin1');
    b.writeUInt16LE(8, 4 + 272 + 2 * 128);
    expect(P.parseCNFNewCharacter(b)).toEqual([{ slot: 2, name: 'botarch', level: 0, exp: 0n, face: 8 }]);
  });

  it('UpdateScore e UpdateEtc', () => {
    const s = Buffer.alloc(140);
    s.writeInt32LE(35, 0); s.writeInt32LE(12, 4); s.writeInt32LE(57, 8); s.writeInt32LE(400, 16); s.writeInt32LE(390, 124);
    s.writeInt16LE(132, 32); s.writeInt16LE(12, 34); s.writeInt16LE(96, 36); s.writeInt16LE(80, 38);
    s.writeInt32LE(250, 20); s.writeInt32LE(180, 128); s.writeInt16LE(112, 44); s.writeUInt16LE((22 << 8) | 150, 50);
    expect(P.parseUpdateScore(s)).toEqual({
      level: 35, ac: 12, damage: 57, maxHp: 400, hp: 390, maxMp: 250, mp: 180, attrs: { str: 132, int: 12, dex: 96, con: 80 },
      special: [0, 0, 112, 0], affects: [(22 << 8) | 150],
    });
    const e = Buffer.alloc(36);
    e.writeBigInt64LE(192215n, 4); e.writeBigInt64LE(0x7f00n, 12); e.writeUInt16LE(170, 20); e.writeUInt16LE(4, 22); e.writeUInt16LE(224, 24); e.writeInt32LE(1000, 28);
    expect(P.parseUpdateEtc(e)).toEqual({ exp: 192215n, learn: 0x7f00, scoreBonus: 170, specialBonus: 4, skillBonus: 224, coin: 1000 });
  });

  it('UpdateCarry: Carry[64]@0 + Coin@512', () => {
    const b = Buffer.alloc(516);
    b.writeUInt16LE(4039, 5 * 8); b[5 * 8 + 2] = P.EF_AMOUNT; b[5 * 8 + 3] = 3;
    b.writeInt32LE(1012345, 512);
    const u = P.parseUpdateCarry(b);
    expect(u.carry).toHaveLength(64);
    expect(u.carry[5]).toEqual({ index: 4039, eff: [[61, 3], [0, 0], [0, 0]] });
    expect(u.coin).toBe(1012345);
  });
});

describe('troca entre jogadores (MsgTradeBody)', () => {
  const vela: P.Item = { index: 4038, eff: [[0, 0], [0, 0], [0, 0]] };

  it('Trade: 142 B, Item[15]@0, InvenPos[15]@120 (0xFF = vazio), Money@135, MyCheck@139, OpponentID@140', () => {
    const b = P.trade({ items: [{ slot: 5, item: vela }], money: 12345, check: true, opponentId: 2 });
    expect(b.length).toBe(142);
    expect(b.readUInt16LE(0)).toBe(4038);
    expect(b[120]).toBe(5);
    expect([...b.subarray(121, 135)].every((x) => x === 0xff)).toBe(true);
    expect(b.readInt32LE(135)).toBe(12345);
    expect(b[139]).toBe(1);
    expect(b.readUInt16LE(140)).toBe(2);
    expect(() => P.trade({ items: Array(16).fill({ slot: 0, item: vela }), money: 0, check: false, opponentId: 1 })).toThrow();
  });

  it('parseTrade lê de volta a oferta e ignora entradas vazias', () => {
    const offer = { items: [{ slot: 5, item: vela }], money: 0, check: false, opponentId: 1 };
    expect(P.parseTrade(P.trade(offer))).toEqual(offer);
    expect(P.parseTrade(P.trade({ items: [], money: 7, check: false, opponentId: 9 })).items).toEqual([]);
  });

  it('sameItem compara índice e os três efeitos', () => {
    expect(P.sameItem(vela, { index: 4038, eff: [[0, 0], [0, 0], [0, 0]] })).toBe(true);
    expect(P.sameItem(vela, { index: 4038, eff: [[61, 2], [0, 0], [0, 0]] })).toBe(false);
    expect(P.sameItem(vela, undefined)).toBe(false);
  });
});
