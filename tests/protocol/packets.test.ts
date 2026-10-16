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
    expect(P.parseCNFAccountLogin(body)).toEqual([{ slot: 1, name: 'botxyz', level: 34, exp: 175915n }]);
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
    expect(P.parseCNFCharacterLogin(b)).toMatchObject({ x: 2090, y: 2095, name: 'botq', exp: 500n, level: 1, damage: 12, maxHp: 105, hp: 100, clientId: 3 });
  });

  it('CreateMob: id@4, nome@6, score@124', () => {
    const b = Buffer.alloc(220);
    b.writeInt16LE(2120, 0); b.writeInt16LE(2020, 2); b.writeUInt16LE(1500, 4);
    b.write('Porco', 6, 'latin1');
    b.writeInt32LE(3, 124); b.writeInt32LE(2, 124 + 4); b.writeInt32LE(80, 124 + 16); b.writeInt32LE(80, 124 + 24);
    expect(P.parseCreateMob(b)).toMatchObject({ id: 1500, name: 'Porco', x: 2120, y: 2020, level: 3, ac: 2, hp: 80, merchant: 0, isPlayer: false });
  });

  it('UpdateScore e UpdateEtc', () => {
    const s = Buffer.alloc(140);
    s.writeInt32LE(35, 0); s.writeInt32LE(57, 8); s.writeInt32LE(400, 16); s.writeInt32LE(390, 124);
    expect(P.parseUpdateScore(s)).toEqual({ level: 35, damage: 57, maxHp: 400, hp: 390 });
    const e = Buffer.alloc(36);
    e.writeBigInt64LE(192215n, 4); e.writeUInt16LE(170, 20); e.writeInt32LE(1000, 28);
    expect(P.parseUpdateEtc(e)).toEqual({ exp: 192215n, scoreBonus: 170, coin: 1000 });
  });
});
