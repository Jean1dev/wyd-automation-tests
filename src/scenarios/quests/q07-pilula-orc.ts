// Quest 07 — Pílula do Poder Mágico (docs/quests/07-pilula-orc.md).
//
// A pílula 470 vem pelo banco (o drop do Orc Lord não é o objeto dos casos). PO-01/01b: o bot larga a
// pílula aos pés (MSG_DropItem) e a pega de volta (MSG_GetItem), o caminho do chão do legado. PO-02..04:
// usa a pílula (MSG_UseItem). Cada caso confere o efeito: SkillBonus do UpdateEtc, a 470 no inventário
// (no cliente e no banco depois do relog) e o que o servidor respondeu.
import type { GameClient } from '../../client/GameClient.ts';
import { dropAtFeet, GROUND_ID_OFFSET, pickUpNear } from '../../bot/ground.ts';
import { useItem } from '../../bot/npc.ts';
import { sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { ITEM, LEVEL, PILULA_BONUS } from '../../world/quests/07-pilula-orc.ts';
import type { CaseCtx, QuestSpec } from './runner.ts';

/** Slots onde as pílulas são semeadas. */
const PILL_SLOTS = [10, 11] as const;

async function char(db: Db, name: string, pills: number, pilulaOrc = 0): Promise<void> {
  await db.setCharacter(name, { level: LEVEL, exp: 0, coin: 1000, class_master: CLASS_MASTER.MORTAL, max_hp: 2000, hp: 2000, pilula_orc: pilulaOrc });
  for (let i = 0; i < pills; i++) await db.putItem(name, 'carry', PILL_SLOTS[i], { index: ITEM.pilula });
}

const bonus = (c: GameClient) => c.self!.skillBonus;
const pills = (c: GameClient) => c.countItem(ITEM.pilula);

function firstEmpty(c: GameClient, from = 20): number {
  for (let i = from; i < P.BASE_CARRY_SLOTS; i++) if (!c.self!.carry[i]?.index) return i;
  throw new Error('inventário sem slot livre');
}

/** Notices (MessageBoxOk), textos e tipos dos frames depois de `since`. */
function replies(c: GameClient, since: number) {
  const fr = c.framesSince(since);
  const counts: Record<string, number> = {};
  for (const f of fr) { const k = `0x${f.header.type.toString(16)}`; counts[k] = (counts[k] ?? 0) + 1; }
  return {
    notices: fr.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: fr.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    etc: fr.filter((f) => f.header.type === Op.UpdateEtc).map((f) => P.parseUpdateEtc(f.body).skillBonus),
    frames: counts,
  };
}

interface Step {
  how: 'chão' | 'uso';
  bonus: { before: number; after: number };
  pills: { before: number; after: number };
  /** No caminho do chão: a pílula voltou para o inventário (CNFGetItem)? */
  toCarry?: boolean;
  groundId?: number;
  probed?: number;
  notices: number[];
  texts: string[];
  etc: number[];
  frames: Record<string, number>;
}

/** Larga a pílula do slot `slot` aos pés e a pega de volta (MSG_GetItem). */
async function groundPill(ctx: CaseCtx, slot: number, stopWhen?: (since: number) => boolean): Promise<Step> {
  const c = ctx.c;
  const b0 = bonus(c), p0 = pills(c);
  if (c.self!.carry[slot]?.index !== ITEM.pilula) throw new Error(`a 470 não está no slot ${slot}`);
  if (!(await dropAtFeet(c, slot, ctx.log))) throw new Error('o servidor não aceitou largar a 470');
  const dest = firstEmpty(c);
  const mark = c.mark;
  const r = await pickUpNear(c, dest, { log: ctx.log, stopWhen: () => bonus(c) !== b0 || (stopWhen?.(mark) ?? false) });
  if (r.cnfSlot !== undefined) c.self!.carry[r.cnfSlot] = { ...c.self!.carry[r.cnfSlot], index: ITEM.pilula, eff: [] };
  const rep = replies(c, r.since);
  return { how: 'chão', bonus: { before: b0, after: bonus(c) }, pills: { before: p0, after: pills(c) }, toCarry: r.cnfSlot !== undefined, groundId: r.groundId, probed: r.probed, ...rep, frames: rep.frames };
}

const DONE_RE = /completou esta Quest/;
const doneSince = (c: GameClient, since: number) => replies(c, since).texts.some((t) => DONE_RE.test(t));

/**
 * Depois da recusa no chão: pede de novo cada id perto do que respondeu. Se algum id responde outra vez
 * _NN_Youve_Done_It_Already (e não DecayItem), a pílula continua no chão com esse id.
 */
async function stillOnGround(c: GameClient, hitId: number | undefined): Promise<number | undefined> {
  if (hitId === undefined) return undefined;
  for (let id = hitId; id >= Math.max(1, hitId - 12); id--) {
    const since = c.mark;
    c.send(Op.GetItem, P.getItem(id + GROUND_ID_OFFSET, firstEmpty(c)));
    await sleep(700);
    if (doneSince(c, since)) return id;
  }
  return undefined;
}

/** Usa a pílula (MSG_UseItem) do primeiro slot que a tiver. */
async function usePill(ctx: CaseCtx): Promise<Step> {
  const c = ctx.c;
  const slot = c.findItem(ITEM.pilula);
  if (slot < 0) throw new Error('a 470 não está no inventário');
  const b0 = bonus(c), p0 = pills(c);
  const since = useItem(c, slot);
  try {
    await c.waitFor((f) => (f.header.type === Op.SendItem && P.parseSendItem(f.body).slot === slot) || f.header.type === Op.UpdateEtc || f.header.type === Op.MessageBoxOk, { timeoutMs: 5000, since, what: 'resposta à 470' });
  } catch {
    // sem resposta: o legado não responde à segunda pílula (return seco)
  }
  await sleep(2000);
  return { how: 'uso', bonus: { before: b0, after: bonus(c) }, pills: { before: p0, after: pills(c) }, ...replies(c, since) };
}

/** Pílulas no banco e SkillBonus depois do relog. */
async function afterRelog(ctx: CaseCtx) {
  await ctx.relog();
  const c = ctx.c;
  const db = await ctx.query(async (d, ch) => ({ pills: (await d.items(ch, 'carry')).filter((x) => x.index === ITEM.pilula).length, flag: Number((await d.character(ch)).pilula_orc) }));
  return { bonus: bonus(c), pills: pills(c), db };
}

/** A pílula aplicou: +9 e uma unidade a menos (no chão: não foi para o inventário). */
const applied = (s: Step) => s.bonus.after === s.bonus.before + PILULA_BONUS && s.pills.after === s.pills.before - 1 && !s.toCarry;
/** Recusou: nada muda. */
const refusedUse = (s: Step) => s.bonus.after === s.bonus.before && s.pills.after === s.pills.before;
/** SkillBonus derivado no nível LEVEL (nível*3; +9 com a PilulaOrc gravada — Basedef.cpp:865). */
const BASE_BONUS = LEVEL * 3;
const fmt = (s: Step) => `${s.how}: SkillBonus ${s.bonus.before}→${s.bonus.after}, 470 ${s.pills.before}→${s.pills.after}` +
  (s.toCarry !== undefined ? (s.toCarry ? ', voltou ao inventário' : ', não voltou ao inventário') : '') +
  (s.notices.length ? `, notices ${s.notices.join(',')}` : '') + (s.texts.length ? `, "${s.texts.join(' | ')}"` : '');

const quest: QuestSpec = {
  id: '07',
  name: 'Pílula do Poder Mágico (Conquista do Castelo Orc)',
  cases: [
    {
      id: 'PO-01',
      title: 'Pegar a pílula',
      type: 'feliz',
      timeoutMs: 4 * 60_000,
      seed: (db, ch) => char(db, ch, 1),
      run: async (ctx) => {
        const s = await groundPill(ctx, PILL_SLOTS[0]);
        const r = await afterRelog(ctx);
        const pass = applied(s) && r.db.pills === 0 && r.db.flag === 1 && r.bonus === BASE_BONUS + PILULA_BONUS;
        return { pass, evidence: { step: s, relog: r }, note: `${fmt(s)}; banco depois do relog: 470 ×${r.db.pills}, pilula_orc ${r.db.flag}, SkillBonus ${r.bonus}` };
      },
    },
    {
      id: 'PO-01b',
      title: 'Pegar com a flag já gravada',
      type: 'controle',
      timeoutMs: 5 * 60_000,
      // PilulaOrc 1 vem do banco (coluna pilula_orc, migração do #411).
      seed: (db, ch) => char(db, ch, 1, 1),
      run: async (ctx) => {
        const base = bonus(ctx.c);
        const s = await groundPill(ctx, PILL_SLOTS[0], (since) => doneSince(ctx.c, since));
        // Esperado: _NN_Youve_Done_It_Already; a pílula fica no chão (o mesmo id recusa de novo), sem bônus.
        const refusedMsg = s.texts.some((t) => DONE_RE.test(t));
        const onGround = await stillOnGround(ctx.c, s.groundId);
        const pillsNow = pills(ctx.c);
        const r = await afterRelog(ctx);
        const pass = base === BASE_BONUS + PILULA_BONUS && refusedMsg && onGround !== undefined && !s.toCarry && pillsNow === 0 &&
          s.bonus.after === s.bonus.before && r.db.flag === 1 && r.db.pills === 0 && r.bonus === base;
        return { pass, evidence: { base, step: s, onGround, relog: r }, note: `pilula_orc 1 semeado, base ${base}; ${fmt(s)}; ${onGround !== undefined ? `id ${onGround} do chão recusa de novo (continua no chão)` : 'pílula não achada no chão'}; relog: SkillBonus ${r.bonus}, 470 ×${r.db.pills}, pilula_orc ${r.db.flag}` };
      },
    },
    {
      id: 'PO-02',
      title: 'Usar a pílula',
      type: 'feliz',
      seed: (db, ch) => char(db, ch, 1),
      run: async (ctx) => {
        const s = await usePill(ctx);
        const r = await afterRelog(ctx);
        const pass = applied(s) && r.db.pills === 0 && r.db.flag === 1 && r.bonus === BASE_BONUS + PILULA_BONUS;
        return { pass, evidence: { step: s, relog: r }, note: `${fmt(s)}; banco depois do relog: 470 ×${r.db.pills}, pilula_orc ${r.db.flag}, SkillBonus ${r.bonus}` };
      },
    },
    {
      id: 'PO-03',
      title: 'Segunda pílula',
      type: 'controle',
      // PilulaOrc 1 vem do banco (coluna pilula_orc, migração do #411).
      seed: (db, ch) => char(db, ch, 1, 1),
      run: async (ctx) => {
        const base = bonus(ctx.c);
        const s = await usePill(ctx);
        const r = await afterRelog(ctx);
        const pass = base === BASE_BONUS + PILULA_BONUS && refusedUse(s) && r.db.pills === 1 && r.db.flag === 1 && r.bonus === base;
        return { pass, evidence: { base, step: s, relog: r }, note: `pilula_orc 1 semeado, base ${base}; ${fmt(s)}; relog: 470 ×${r.db.pills}, SkillBonus ${r.bonus}` };
      },
    },
    {
      id: 'PO-04',
      title: 'Persistência',
      type: 'borda',
      seed: (db, ch) => char(db, ch, 2),
      run: async (ctx) => {
        const base = bonus(ctx.c);
        const first = await usePill(ctx);
        const r = await afterRelog(ctx);
        const second = await usePill(ctx);
        const pass = applied(first) && r.bonus === base + PILULA_BONUS && r.db.flag === 1 && refusedUse(second) && second.bonus.after === base + PILULA_BONUS;
        return { pass, evidence: { base, first, relog: r, second }, note: `base ${base}; 1ª ${fmt(first)}; relog: SkillBonus ${r.bonus}, 470 ×${r.pills}, pilula_orc ${r.db.flag}; 2ª ${fmt(second)}` };
      },
    },
  ],
};

export default quest;
