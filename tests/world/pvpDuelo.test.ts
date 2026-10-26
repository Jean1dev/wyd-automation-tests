import { describe, expect, it } from 'vitest';
import { AREA, inArea, lostPkArena, SPOT } from '../../src/world/quests/15-pvp-duelo.ts';

describe('suíte 15: geometria e fórmulas', () => {
  it('os pontos caem nas áreas certas', () => {
    expect(inArea(AREA.armiaArena, SPOT.armiaArena.x, SPOT.armiaArena.y)).toBe(true);
    expect(inArea(AREA.armiaArena, SPOT.armiaArena.x + 1, SPOT.armiaArena.y)).toBe(true);
    expect(inArea(AREA.armia, SPOT.armiaArena.x, SPOT.armiaArena.y)).toBe(true);
    expect(inArea(AREA.armiaArena, SPOT.armiaPlaza.x, SPOT.armiaPlaza.y)).toBe(false);
    expect(inArea(AREA.armia, SPOT.armiaPlaza.x, SPOT.armiaPlaza.y)).toBe(true);
    expect(inArea(AREA.armia, SPOT.field.x, SPOT.field.y)).toBe(false);
  });

  it('CP do matador na arena: 3 * PKPoint / -20, entre -9 e 0 (MobKilled.cpp:3207-3214)', () => {
    expect(lostPkArena(75)).toBe(-9);
    expect(lostPkArena(40)).toBe(-6);
    expect(lostPkArena(5)).toBe(0);
  });
});
