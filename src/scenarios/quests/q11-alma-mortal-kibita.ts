// Quest 11 — Alma do Mortal (Kibita) (docs/quests/11-alma-mortal-kibita.md).
//
// Cada caso é um personagem novo semeado pelo banco (class_master, nível armazenado com a exp mínima,
// clan, LearnedSkill, a Pedra Secreta num slot alto e a capa). O bot anda até a Kibita em Armia, manda o
// MSG_Quest e espera o _MSG_SendArchEffect; depois reconecta e confere no banco a pedra, o bit 30 do
// LearnedSkill e a capa (Equip[15]), e a capa também no cliente.
import { walkPath, walkTo } from '../../bot/movement.ts';
import { approachNpc } from '../../bot/npc.ts';
import { isInArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { ROUTE_TO_ARMIA } from '../../world/arch.ts';
import { EQUIP_SLOT, EXP_AT, ITEM, KIBITA_MIN_LEVEL, MORTAL_SEED, NPC, SOUL_BIT } from '../../world/quests/11-alma-mortal-kibita.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

/** Slot da pedra no inventário (alto: o 1º login põe os itens iniciais nos primeiros vazios). */
const STONE_SLOT = 20;

interface Seed {
  /** Nível ARMAZENADO (exibido − 1). */
  level?: number;
  classMaster?: number;
  clan?: number;
  soul?: boolean;
  stone: number;
  cape?: number;
}

async function seedChar(db: Db, name: string, s: Seed): Promise<void> {
  const level = s.level ?? KIBITA_MIN_LEVEL;
  await db.setCharacter(name, {
    ...MORTAL_SEED,
    level,
    exp: EXP_AT[level],
    class_master: s.classMaster ?? CLASS_MASTER.MORTAL,
    clan: s.clan ?? 0,
    learned_skill: s.soul ? SOUL_BIT : 0,
  });
  await db.putItem(name, 'carry', STONE_SLOT, { index: s.stone });
  if (s.cape) await db.putItem(name, 'equip', EQUIP_SLOT.capa, { index: s.cape });
}

interface Saved {
  soul: boolean;
  learned: number;
  stones: number;
  capa: number;
}

const ALL_STONES: readonly number[] = ITEM.pedraSecreta;

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const r = await db.character(ch);
    const learned = Number(r.learned_skill);
    const stones = (await db.items(ch, 'carry')).filter((x) => ALL_STONES.includes(x.index)).length;
    const capa = (await db.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.capa)?.index ?? 0;
    return { soul: (learned & SOUL_BIT) !== 0, learned, stones, capa };
  });
}

interface Talk {
  t: string;
  npcId: number;
  notices: number[];
  texts: string[];
  logout: boolean;
  archEffectSlot?: number;
  /** Capa no cliente antes da fala e depois do relog. */
  capaBefore: number;
  capaAfterRelog: number;
  before: Saved;
  db: Saved;
}

const fmtS = (s: Saved) => `bit30 ${s.soul ? 1 : 0} (LearnedSkill ${s.learned}), pedras ${s.stones}, capa ${s.capa}`;
const answer = (t: Talk) => [
  t.archEffectSlot !== undefined ? `SendArchEffect slot ${t.archEffectSlot}` : 'sem SendArchEffect',
  t.logout ? 'CNFCharacterLogout' : '',
  ...t.texts.map((x) => `"${x}"`),
  ...t.notices.map((n) => `notice ${n}`),
].filter(Boolean).join(', ');
const note = (t: Talk) => `Kibita: ${answer(t)}; banco antes ${fmtS(t.before)} → depois do relog ${fmtS(t.db)}; capa no cliente ${t.capaBefore} → ${t.capaAfterRelog}`;

async function goToKibita(ctx: CaseCtx): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, NPC.kibita.pos.x, NPC.kibita.pos.y) > 30 && !isInArmia(me.x, me.y)) await walkPath(c, ROUTE_TO_ARMIA);
  await walkTo(c, NPC.kibita.stand.x, NPC.kibita.stand.y);
  if (me.hp <= 0) throw new Error('morreu no caminho da Kibita');
}

/** Fala com a Kibita, espera o efeito do Arch (ou a recusa), reconecta e lê o banco. */
async function talkKibita(ctx: CaseCtx): Promise<Talk> {
  const before = await saved(ctx);
  await goToKibita(ctx);
  const c = ctx.c;
  const capaBefore = c.self!.equip[EQUIP_SLOT.capa]?.index ?? 0;
  const ent = await approachNpc(c, NPC.kibita);
  await sleep(500);
  const since = c.mark;
  c.send(Op.Quest, P.quest(ent.id, 0));
  try {
    await c.waitType(Op.SendArchEffect, { timeoutMs: 6000, since, what: 'SendArchEffect' });
    await sleep(1000);
  } catch {
    // recusa: as respostas (se houver) já estão nos frames
  }
  const frames = c.framesSince(since);
  const effect = frames.find((f) => f.header.type === Op.SendArchEffect);
  const r = {
    t: new Date().toISOString(),
    npcId: ent.id,
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    logout: frames.some((f) => f.header.type === Op.CNFCharacterLogout),
    archEffectSlot: effect && effect.body.length >= 4 ? effect.body.readInt32LE(0) : undefined,
  };
  ctx.log.info('falou com a Kibita', r as unknown as Record<string, unknown>);
  const c2 = await ctx.relog();
  const capaAfterRelog = c2.self!.equip[EQUIP_SLOT.capa]?.index ?? 0;
  return { ...r, capaBefore, capaAfterRelog, before, db: await saved(ctx) };
}

/** Controle: a pedra fica, o bit 30 e a capa não mudam, sem efeito do Arch. */
function refused(t: Talk): CaseResult {
  const pass = t.archEffectSlot === undefined && !t.logout && t.db.stones === t.before.stones && t.db.soul === t.before.soul && t.db.capa === t.before.capa;
  return { pass, evidence: { ...t }, note: note(t) };
}

/** Feliz: a pedra some, o bit 30 liga e a capa vira `cape` (no banco e no cliente), com o efeito do Arch. */
function granted(t: Talk, cape: number): CaseResult {
  const pass = t.archEffectSlot !== undefined && t.db.stones === 0 && t.db.soul && t.db.capa === cape && t.capaAfterRelog === cape;
  return { pass, evidence: { ...t }, note: note(t) };
}

const TK_STONE = ITEM.pedraSecreta[0];

const quest: QuestSpec = {
  id: '11',
  name: 'Alma do Mortal (Kibita)',
  cases: [
    {
      id: 'KB-01',
      title: 'Abaixo do nível',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: KIBITA_MIN_LEVEL - 1, stone: TK_STONE, clan: 7, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => refused(await talkKibita(ctx)),
    },
    {
      id: 'KB-02',
      title: 'Pedra de outra classe',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { stone: ITEM.pedraSecreta[1], clan: 7, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => refused(await talkKibita(ctx)),
    },
    {
      id: 'KB-03',
      title: 'Alma do Mortal',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { stone: TK_STONE, clan: 7, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => granted(await talkKibita(ctx), ITEM.heroiHekalotia),
    },
    {
      id: 'KB-04',
      title: 'Depois do relogin',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { stone: TK_STONE, clan: 7, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => {
        const t = await talkKibita(ctx);
        // Segundo relogin: o bit 30 e a capa continuam.
        const c = await ctx.relog();
        const capa2 = c.self!.equip[EQUIP_SLOT.capa]?.index ?? 0;
        const db2 = await saved(ctx);
        const g = granted(t, ITEM.heroiHekalotia);
        const pass = g.pass && db2.soul && db2.capa === ITEM.heroiHekalotia && capa2 === ITEM.heroiHekalotia;
        return { pass, evidence: { ...t, second: { db: db2, capa: capa2 } }, note: `${g.note}; 2º relog: ${fmtS(db2)}, capa no cliente ${capa2}` };
      },
    },
    {
      id: 'KB-05',
      title: 'Repetir',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { stone: TK_STONE, clan: 7, soul: true, cape: ITEM.heroiHekalotia }),
      run: async (ctx) => refused(await talkKibita(ctx)),
    },
    {
      id: 'KB-06',
      title: 'Arch',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { classMaster: CLASS_MASTER.ARCH, stone: TK_STONE, clan: 7, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => refused(await talkKibita(ctx)),
    },
    {
      id: 'KB-07',
      title: 'Sem reino',
      type: 'borda',
      seed: (db, ch) => seedChar(db, ch, { stone: TK_STONE, clan: 0, cape: ITEM.mantoHekalotia }),
      run: async (ctx) => granted(await talkKibita(ctx), ITEM.heroiAventureiros),
    },
  ],
};

export default quest;
