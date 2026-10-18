// Utilidades comuns aos casos das quests: retrato do inventário/equipamento e diferenças entre
// dois retratos, para conferir o efeito de uma fala de NPC sem depender do texto da mensagem.
import type { GameClient } from '../../client/GameClient.ts';
import type { BotConfig } from '../../config.ts';
import { signupAccount } from '../../bot/account.ts';
import { createCharacter, enterWorld, login } from '../../bot/session.ts';
import { sleep } from '../../bot/util.ts';
import type { Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { newCharName } from '../common.ts';
import type { CaseCtx } from './runner.ts';

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

// ---------------------------------------------------------------- segundo jogador e grupo

/** Segunda conta NOVA (nunca as do .env) com um personagem semeado por `seed`, já no mundo. */
export async function secondChar(ctx: CaseCtx, seed: (db: Db, name: string) => Promise<void>, charClass = 0): Promise<{ c: GameClient; name: string }> {
  const acc = await signupAccount();
  const cfg: BotConfig = { ...ctx.cfg, ...acc, charClass };
  const name = newCharName(cfg.charPrefix);
  ctx.log.info('segunda conta', { account: acc.account, char: name });
  const sel = await login(cfg, ctx.log);
  await createCharacter(sel, name, charClass, ctx.log);
  sel.close();
  await ctx.query(async (db) => seed(db, name));
  const c = await login(cfg, ctx.log);
  await enterWorld(c, name, ctx.log);
  return { c, name };
}

/**
 * O líder convida e o outro aceita (MSG_SendReqParty → MSG_AcceptParty). `formed` diz se o líder
 * recebeu o MSG_CNFAddParty (0x037D) do membro, ou seja, se o servidor montou o grupo.
 */
export async function makeParty(leader: GameClient, member: GameClient): Promise<{ invited: boolean; formed: boolean; frames: string[] }> {
  const L = leader.self!, M = member.self!;
  const since = member.mark;
  leader.send(Op.SendReqParty, P.sendReqParty(L.clientId, M.clientId, { name: L.name, cls: L.cls, level: L.level, hp: L.hp, maxHp: L.maxHp }));
  let invited = true;
  try {
    await member.waitType(Op.SendReqParty, { timeoutMs: 5000, since });
  } catch {
    invited = false;
  }
  const lsince = leader.mark;
  member.send(Op.AcceptParty, P.acceptParty(L.clientId, L.name));
  await sleep(2000);
  const types = leader.framesSince(lsince).map((f) => f.header.type);
  return { invited, formed: types.includes(0x037d), frames: types.map((t) => `0x${t.toString(16)}`) };
}
