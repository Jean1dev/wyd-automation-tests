import { describe, expect, it } from 'vitest';
import {
  expectedHit, isInTrainingField, isLegacyKickSpot, isNewbieZoneMessage, killValue, MAX_SWINGS, MOB_STATS, ROUTE, spawnsForLevel,
  swingsToKill, TRAINING_FIELD,
} from '../../src/world/trainingField.ts';

describe('Campo de Treino (bit 0x80 do AttributeMap)', () => {
  it('bbox bate com a varredura do AttributeMap.dat', () => {
    expect(TRAINING_FIELD.bbox).toEqual({ minX: 2064, minY: 1932, maxX: 2159, maxY: 2051 });
  });

  it('rota Armia ↔ campo: pontos de Armia fora, pontos do campo dentro', () => {
    expect(isInTrainingField(ROUTE.armia.x, ROUTE.armia.y)).toBe(false);
    expect(isInTrainingField(ROUTE.armiaEdge.x, ROUTE.armiaEdge.y)).toBe(false);
    expect(isInTrainingField(ROUTE.fieldEntry.x, ROUTE.fieldEntry.y)).toBe(true);
    expect(isInTrainingField(2100, 2032)).toBe(true);
    // Spawn de Armia e ponto de expulsão da regra legada ficam fora do campo.
    expect(isInTrainingField(2086, 2093)).toBe(false);
    expect(isInTrainingField(2092, 2102)).toBe(false);
    expect(isLegacyKickSpot(2092, 2102)).toBe(true);
  });

  it('todos os spawns extraídos estão dentro da zona', () => {
    expect(TRAINING_FIELD.spawns.length).toBeGreaterThan(50);
    for (const s of TRAINING_FIELD.spawns) expect(isInTrainingField(s.x, s.y)).toBe(true);
  });

  it('dano esperado segue o BASE_GetDamage (dano − AC/2, faixa baixa e negativa)', () => {
    expect(expectedHit(52, 60)).toBe(34); // 22 → ×1,045 → 5·22/4+7
    expect(expectedHit(52, 100)).toBe(9); // 2 → 5·2/4+7
    expect(expectedHit(52, 130)).toBe(5); // −13 → (−13+50)/7
    expect(expectedHit(10, 300)).toBe(1); // abaixo de −50 → piso 1
    expect(expectedHit(124, 60)).toBe(98); // 94 > 50 → só o fator
  });

  it('o valor do kill escala pela razão de níveis, com teto de 200%', () => {
    expect(killValue(29, { level: 29, exp: 1000 })).toBe(1000);
    expect(killValue(29, { level: 14, exp: 1000 })).toBe(500);
    expect(killValue(9, { level: 34, exp: 1000 })).toBe(2000);
  });

  it('escolhe a área pela exp por segundo que o dano atual rende', () => {
    expect(spawnsForLevel(0, 15).every((s) => (s.level ?? 0) <= 8)).toBe(true);
    // Nível 30 sem pontos distribuídos (dano 52): Chefe Krill e os Orcs não morrem em 40 golpes.
    const weak = spawnsForLevel(29, 52).map((s) => s.leader);
    expect(weak).toContain('Rei_Gremlin_');
    for (const hard of ['Chefe_Krill', 'Orc_Arqueiro_', 'Orc_Sniper']) expect(weak).not.toContain(hard);
    // Com os pontos em Str (dano ~124), o Orc Sniper passa a ser o melhor alvo.
    const strong = spawnsForLevel(29, 124).map((s) => s.leader);
    expect(strong).toContain('Orc_Sniper');
    expect(strong.length).toBeGreaterThanOrEqual(6);
    expect(swingsToKill(124, MOB_STATS.Orc_Sniper.ac, MOB_STATS.Orc_Sniper.maxHp)).toBeLessThanOrEqual(MAX_SWINGS);
  });

  it('reconhece a mensagem #46 em várias codificações', () => {
    expect(isNewbieZoneMessage('Somente nível 35 ou inferior pode entrar no campo de treinamento.')).toBe(true);
    expect(isNewbieZoneMessage('Somente n\xedvel 35 ou inferior pode entrar no campo de treinamento.')).toBe(true);
    expect(isNewbieZoneMessage('+120 de EXP')).toBe(false);
  });
});
