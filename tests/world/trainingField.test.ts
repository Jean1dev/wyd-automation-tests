import { describe, expect, it } from 'vitest';
import { isInTrainingField, isLegacyKickSpot, isNewbieZoneMessage, ROUTE, spawnsForLevel, TRAINING_FIELD } from '../../src/world/trainingField.ts';

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

  it('escolhe mobs compatíveis com o nível', () => {
    expect(spawnsForLevel(0).every((s) => (s.level ?? 0) <= 3)).toBe(true);
    const mid = spawnsForLevel(14); // exibido 15
    expect(mid.some((s) => s.leader.startsWith('Rei_Gremlin'))).toBe(true);
    expect(spawnsForLevel(33).some((s) => s.leader === 'Orc_Sniper' || s.leader === 'Orc_Arqueiro_')).toBe(true);
  });

  it('reconhece a mensagem #46 em várias codificações', () => {
    expect(isNewbieZoneMessage('Somente nível 35 ou inferior pode entrar no campo de treinamento.')).toBe(true);
    expect(isNewbieZoneMessage('Somente n\xedvel 35 ou inferior pode entrar no campo de treinamento.')).toBe(true);
    expect(isNewbieZoneMessage('+120 de EXP')).toBe(false);
  });
});
