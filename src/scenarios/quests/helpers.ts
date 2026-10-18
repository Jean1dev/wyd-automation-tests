// Utilidades comuns aos casos das quests: retrato do inventário/equipamento e diferenças entre
// dois retratos, para conferir o efeito de uma fala de NPC sem depender do texto da mensagem.
import type { GameClient } from '../../client/GameClient.ts';
import * as P from '../../protocol/packets.ts';

export interface SlotItem {
  slot: number;
  index: number;
  eff: [number, number][];
}

/** EF_SANC (ItemEffect.h:100): refinação do item. */
export const EF_SANC = 43;

/** Slots não vazios do inventário (até BASE_CARRY_SLOTS) no estado atual do cliente. */
export function carryOf(c: GameClient): SlotItem[] {
  const carry = c.self?.carry ?? [];
  const out: SlotItem[] = [];
  for (let i = 0; i < P.BASE_CARRY_SLOTS; i++) if (carry[i]?.index) out.push({ slot: i, index: carry[i].index, eff: carry[i].eff.map(([e, v]) => [e, v]) });
  return out;
}

/** Slots não vazios do equipamento. */
export function equipOf(c: GameClient): SlotItem[] {
  const equip = c.self?.equip ?? [];
  const out: SlotItem[] = [];
  for (let i = 0; i < P.MAX_EQUIP; i++) if (equip[i]?.index) out.push({ slot: i, index: equip[i].index, eff: equip[i].eff.map(([e, v]) => [e, v]) });
  return out;
}

const same = (a: SlotItem, b: SlotItem) => a.index === b.index && JSON.stringify(a.eff) === JSON.stringify(b.eff);

/** O que mudou de `before` para `after`: slots novos/alterados (`gained`) e esvaziados/alterados (`lost`). */
export function diffSlots(before: SlotItem[], after: SlotItem[]): { gained: SlotItem[]; lost: SlotItem[] } {
  const at = (l: SlotItem[], s: number) => l.find((x) => x.slot === s);
  return {
    gained: after.filter((a) => { const b = at(before, a.slot); return !b || !same(a, b); }),
    lost: before.filter((b) => { const a = at(after, b.slot); return !a || !same(a, b); }),
  };
}

/** Valor do efeito `ef` do item (0 se não tiver). */
export function effValue(it: { eff: [number, number][] } | undefined, ef: number): number {
  return it?.eff.find(([e]) => e === ef)?.[1] ?? 0;
}

/** Os efeitos 0..2 do item, sem o EF_SANC (para ver se os adicionais foram refeitos). */
export function bonusEffs(it: { eff: [number, number][] } | undefined): [number, number][] {
  return (it?.eff ?? []).filter(([e]) => e !== 0 && e !== EF_SANC);
}

export function hasItem(l: SlotItem[], index: number): boolean {
  return l.some((x) => x.index === index);
}
