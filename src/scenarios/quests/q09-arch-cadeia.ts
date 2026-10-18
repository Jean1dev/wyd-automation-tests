// Quest 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei
// (docs/quests/09-arch-cadeia.md).
//
// Cada caso é um mortal novo de nível exibido 300 (armazenado 299, class_master MORTAL) semeado pelo
// banco com os itens raros (almas, safiras, pedras de boss, Pedras Arch, Pedra da Imortalidade e
// Sephirot) e o gold. O bot anda até o RedOracle (ao lado do Rei_Glantuar, pela rota do cenário 5),
// até o mestre de skill em Armia ou até o Rei, fala (MSG_Quest, com o confirm do caso) ou arrasta a
// poeira sobre a pedra (MSG_UseItem com DestPos), e confere o efeito no inventário e no gold, no
// cliente e no banco depois do relog. O AR-12 refaz o cenário 5 no runner: o Arch nasce no banco.
import type { GameClient } from '../../client/GameClient.ts';
import { walkPath, walkTo } from '../../bot/movement.ts';
import { approachNpc, type NpcSpec, talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { isInArmia } from '../../bot/travel.ts';
import { dist, sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { ROUTE_TO_ARMIA, ROUTE_TO_KING } from '../../world/arch.ts';
import {
  EQUIP_SLOT, ITEM, LORDE_ORC_RESULT, MASTERS, MORTAL_SEED, NPC, PEDRAS_ARCH, PRICE, ROUTE_TO_ORACLE,
} from '../../world/quests/09-arch-cadeia.ts';
import { carryOf, diffSlots, type SlotItem } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestCase, QuestSpec } from './runner.ts';

interface Seed {
  coin?: number;
  /** Inventário: índice do item por slot (0, 1, 2…). */
  carry?: number[];
  equip?: Record<number, number>;
}

async function mortal(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, { ...MORTAL_SEED, exp: 0, coin: s.coin ?? 0, class_master: CLASS_MASTER.MORTAL });
  for (const [slot, index] of (s.carry ?? []).entries()) if (index) await db.putItem(name, 'carry', slot, { index });
  for (const [slot, index] of Object.entries(s.equip ?? {})) await db.putItem(name, 'equip', Number(slot), { index });
}

const repeat = (index: number, n: number) => Array.from({ length: n }, () => index);
const SOULS = [ITEM.almaUnicornio, ITEM.almaFenix];

// ---------------------------------------------------------------- ações

async function goTo(ctx: CaseCtx, npc: NpcSpec): Promise<void> {
  const c = ctx.c;
  const me = c.self!;
  if (dist(me.x, me.y, npc.pos.x, npc.pos.y) <= 30) { await walkTo(c, npc.stand.x, npc.stand.y); return; }
  if (npc === NPC.redOracle) await walkPath(c, ROUTE_TO_ORACLE, { abort: () => me.hp <= 0 });
  else if (npc === NPC.rei) await walkPath(c, ROUTE_TO_KING, { abort: () => me.hp <= 0 });
  else {
    if (!isInArmia(me.x, me.y)) await walkPath(c, ROUTE_TO_ARMIA);
    await walkTo(c, npc.stand.x, npc.stand.y);
  }
  if (me.hp <= 0) throw new Error(`morreu no caminho do ${npc.name}`);
}

interface State {
  coin: number;
  carry: SlotItem[];
}

const live = (c: GameClient): State => ({ coin: c.self!.coin, carry: carryOf(c) });

async function saved(ctx: CaseCtx): Promise<State> {
  return ctx.query(async (db, ch) => ({
    coin: Number((await db.character(ch)).coin),
    carry: (await db.items(ch, 'carry')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index, eff: x.eff })),
  }));
}

interface Talk {
  talk: QuestTalk;
  before: State;
  after: State;
  db: State;
}

/** Vai até o NPC, fala (MSG_Quest com `confirm`), lê o estado e confere o banco depois do relog. */
async function talk(ctx: CaseCtx, npc: NpcSpec, confirm = 0): Promise<Talk> {
  await goTo(ctx, npc);
  const before = live(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 4000, confirm);
  await sleep(1500);
  const after = live(ctx.c);
  await ctx.relog();
  return { talk: t, before, after, db: await saved(ctx) };
}

const idx = (l: SlotItem[]) => l.map((x) => `${x.slot}:${x.index}`).join(' ') || 'vazio';
const answer = (t: QuestTalk) => (t.notices.length ? `notices ${t.notices.join(',')}` : t.texts.length ? `"${t.texts.join(' | ')}"` : 'sem resposta');
const fmt = (s: State) => `gold ${s.coin}, inventário [${idx(s.carry)}]`;
const same = (a: State, b: State) => a.coin === b.coin && idx(a.carry) === idx(b.carry);
const note = (r: Talk) => `${r.talk.npc}: ${answer(r.talk)}; antes ${fmt(r.before)} → depois ${fmt(r.after)}; banco depois do relog: ${fmt(r.db)}`;
const count = (l: SlotItem[], index: number) => l.filter((x) => x.index === index).length;

/** Controle: nada mudou no cliente nem no banco. */
function untouched(r: Talk): CaseResult {
  return { pass: same(r.before, r.after) && same(r.before, r.db), evidence: { ...r }, note: note(r) };
}

/** Oráculo feliz: as almas e as safiras somem e aparece uma 1742. */
function oracleMerged(r: Talk, spent: number): CaseResult {
  const ok = (s: State) => count(s.carry, ITEM.almaUnicornio) === 0 && count(s.carry, ITEM.almaFenix) === 0 && count(s.carry, spent) === 0
    && count(s.carry, ITEM.pedraImortalidade) === 1 && s.coin === r.before.coin;
  return { pass: ok(r.after) && ok(r.db), evidence: { ...r }, note: note(r) };
}

/** Sephirot feliz: as 8 Pedras Arch e os 30M somem e aparece a Sephirot `expected`. */
function sephirotMade(r: Talk, expected: number): { ok: boolean; got: number[] } {
  const got = diffSlots(r.before.carry, r.after.carry).gained.map((x) => x.index);
  const ok = (s: State) => PEDRAS_ARCH.every((p) => count(s.carry, p) === 0) && s.coin === r.before.coin - PRICE.sephirot && count(s.carry, expected) === 1;
  return { ok: ok(r.after) && ok(r.db), got };
}

const SEPHI_SEED: Seed = { carry: PEDRAS_ARCH, coin: PRICE.sephirot + 1000 };

// ---------------------------------------------------------------- refino da pedra de boss

interface Refine {
  t: string;
  /** Onde estava a pedra: inventário (slot 0) ou Equip[11] (nPos 2048 das pedras de boss). */
  dest: 'carry' | 'equip';
  before: SlotItem[];
  after: SlotItem[];
  db: SlotItem[];
  texts: string[];
  notices: number[];
}

/** Inventário + Equip[11] (o equipamento entra com slot 100 + n para não colidir). */
const withEq = (carry: SlotItem[], eq11: number): SlotItem[] => (eq11 ? [...carry, { slot: 100 + EQUIP_SLOT.sephirot, index: eq11, eff: [] }] : carry);

/** Arrasta a poeira (slot `src`) sobre a pedra (slot 0 do inventário ou Equip[11]) e confere o inventário e o banco. */
async function refine(ctx: CaseCtx, src: number, dest: Refine['dest']): Promise<Refine> {
  const c = ctx.c;
  const snap = () => withEq(carryOf(c), c.self!.equip[EQUIP_SLOT.sephirot]?.index ?? 0);
  const before = snap();
  const since = c.mark;
  c.send(Op.UseItem, dest === 'carry' ? P.useItemOn(src, 0) : P.useItemOn(src, EQUIP_SLOT.sephirot, P.PLACE_EQUIP));
  await sleep(3000);
  const frames = c.framesSince(since);
  const after = snap();
  await ctx.relog();
  const db = await ctx.query(async (d, ch) => {
    const eq = (await d.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.sephirot)?.index ?? 0;
    return withEq((await saved(ctx)).carry, eq);
  });
  const r: Refine = {
    t: new Date().toISOString(),
    dest,
    before,
    after,
    db,
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
  };
  ctx.log.info('poeira sobre a pedra de boss', r as unknown as Record<string, unknown>);
  return r;
}

// ---------------------------------------------------------------- Rei

interface KingTalk {
  t: string;
  notices: number[];
  texts: string[];
  logout: boolean;
  newCharList: boolean;
  archEffectSlot?: number;
  selChars: { slot: number; name: string; level: number; face: number }[];
}

/** Fala com o Rei (confirm 1) e espera as respostas que só a criação do Arch manda (como o talkKing do cenário 5). */
async function talkKing(ctx: CaseCtx): Promise<KingTalk> {
  const c = ctx.c;
  await goTo(ctx, NPC.rei);
  const ent = await approachNpc(c, NPC.rei);
  await sleep(500);
  const since = c.mark;
  c.send(Op.Quest, P.quest(ent.id, 1));
  try {
    await c.waitType(Op.SendArchEffect, { timeoutMs: 8000, since, what: 'SendArchEffect' });
    await sleep(1000);
  } catch {
    // sem Arch: as respostas (se houver) já estão nos frames
  }
  const frames = c.framesSince(since);
  const effect = frames.find((f) => f.header.type === Op.SendArchEffect);
  const r: KingTalk = {
    t: new Date().toISOString(),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    logout: frames.some((f) => f.header.type === Op.CNFCharacterLogout),
    newCharList: frames.some((f) => f.header.type === Op.CNFNewCharacter),
    archEffectSlot: effect && effect.body.length >= 4 ? effect.body.readInt32LE(0) : undefined,
    selChars: c.selChars.map((s) => ({ slot: s.slot, name: s.name, level: s.level, face: s.face })),
  };
  ctx.log.info(`falou com ${NPC.rei.name}`, r as unknown as Record<string, unknown>);
  return r;
}

// ---------------------------------------------------------------- casos

const sephiCase = (id: string, title: string, type: QuestCase['type'], seed: Seed, confirm: number): QuestCase => ({
  id,
  title,
  type,
  seed: (db, ch) => mortal(db, ch, seed),
  run: async (ctx) => untouched(await talk(ctx, NPC.capCavaleiros, confirm)),
});

const quest: QuestSpec = {
  id: '09',
  name: 'Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei',
  cases: [
    {
      id: 'AR-01',
      title: 'Oráculo sem almas',
      type: 'controle',
      seed: (db, ch) => mortal(db, ch, { carry: repeat(ITEM.safira, PRICE.safiras) }),
      // Esperado: _NN_Set_Soul e nada muda.
      run: async (ctx) => untouched(await talk(ctx, NPC.redOracle)),
    },
    {
      id: 'AR-02',
      title: 'Almas fora de ordem',
      type: 'controle',
      seed: (db, ch) => mortal(db, ch, { carry: [ITEM.almaFenix, ITEM.almaUnicornio, ...repeat(ITEM.safira, PRICE.safiras)] }),
      run: async (ctx) => untouched(await talk(ctx, NPC.redOracle)),
    },
    {
      id: 'AR-03',
      title: 'Sem safiras',
      type: 'controle',
      seed: (db, ch) => mortal(db, ch, { carry: [...SOULS, ...repeat(ITEM.safira, PRICE.safiras - 1)] }),
      // Esperado: _DN_Need_D_Sapphire (10) e nada some.
      run: async (ctx) => untouched(await talk(ctx, NPC.redOracle)),
    },
    {
      id: 'AR-04',
      title: 'Pedra da Imortalidade',
      type: 'feliz',
      seed: (db, ch) => mortal(db, ch, { carry: [...SOULS, ...repeat(ITEM.safira, PRICE.safiras)] }),
      run: async (ctx) => oracleMerged(await talk(ctx, NPC.redOracle), ITEM.safira),
    },
    {
      id: 'AR-05',
      title: 'Pacote de safiras',
      type: 'borda',
      seed: (db, ch) => mortal(db, ch, { carry: [...SOULS, ITEM.pacoteSafiras] }),
      run: async (ctx) => oracleMerged(await talk(ctx, NPC.redOracle), ITEM.pacoteSafiras),
    },
    {
      id: 'AR-06',
      title: 'Refino da pedra de boss',
      type: 'feliz',
      seed: (db, ch) => mortal(db, ch, { carry: [ITEM.pedraLordeOrc, ITEM.poeiraOri] }),
      run: async (ctx) => {
        // Legado (_MSG_UseItem.cpp:153-372): antes do ramo das Pedras Arch (:515) o caminho PO/PL recusa
        // com _NN_Cant_Refine_More todo destino com EF_NOSANC, e as 1752–1759 têm EF_NOSANC 1 no
        // ItemList.csv. Então o efeito do legado é a recusa: a poeira volta e a pedra fica. O bot tenta
        // com a pedra no inventário e no Equip[11] (o único lugar em que o ramo :515 seria alcançável).
        const carry = await refine(ctx, 1, 'carry');
        await ctx.reseed(async (db, ch) => {
          await db.clearItem(ch, 'carry', 0);
          await db.clearItem(ch, 'carry', 1);
          await db.putItem(ch, 'carry', 1, { index: ITEM.poeiraOri });
          await db.putItem(ch, 'equip', EQUIP_SLOT.sephirot, { index: ITEM.pedraLordeOrc });
        });
        const equip = await refine(ctx, 1, 'equip');
        const kept = (r: Refine) => idx(r.before) === idx(r.after) && idx(r.before) === idx(r.db);
        const changed = (r: Refine) => [...r.after, ...r.db].some((x) => x.index >= LORDE_ORC_RESULT.min && x.index <= LORDE_ORC_RESULT.max);
        const answerR = (r: Refine) => (r.texts.length ? `"${r.texts.join(' | ')}"` : r.notices.length ? `notices ${r.notices.join(',')}` : 'sem resposta');
        const line = (r: Refine) => `${r.dest === 'carry' ? 'inventário' : 'Equip[11]'}: ${answerR(r)}; antes [${idx(r.before)}] → depois [${idx(r.after)}]; banco [${idx(r.db)}]`;
        return {
          pass: kept(carry) && kept(equip) && !changed(carry) && !changed(equip),
          evidence: { carry, equip },
          note: `poeira 412 sobre a 1752 — ${line(carry)} | ${line(equip)}`,
        };
      },
    },
    sephiCase('AR-07', 'Sephirot (ask)', 'controle', SEPHI_SEED, 0),
    sephiCase('AR-08', 'Sephirot sem gold', 'controle', { carry: PEDRAS_ARCH, coin: PRICE.sephirot - 1 }, 1),
    sephiCase('AR-09', 'Sephirot faltando pedra', 'controle', { carry: [...PEDRAS_ARCH.slice(0, 7), PEDRAS_ARCH[6]], coin: PRICE.sephirot + 1000 }, 1),
    {
      id: 'AR-10',
      title: 'Sephirot',
      type: 'feliz',
      seed: (db, ch) => mortal(db, ch, SEPHI_SEED),
      run: async (ctx) => {
        const m = MASTERS[0];
        const r = await talk(ctx, m.npc, 1);
        const s = sephirotMade(r, m.sephirot);
        return { pass: s.ok, evidence: { ...r, expected: m.sephirot, gained: s.got }, note: `esperado ${m.sephirot}, recebeu [${s.got.join(',') || 'nada'}]; ${note(r)}` };
      },
    },
    {
      id: 'AR-11',
      title: 'Sephirot de cada mestre',
      type: 'feliz',
      timeoutMs: 15 * 60_000,
      seed: (db, ch) => mortal(db, ch, SEPHI_SEED),
      run: async (ctx) => {
        const out: { npc: string; expected: number; gained: number[]; ok: boolean; talk: Talk }[] = [];
        for (const [i, m] of MASTERS.slice(1).entries()) {
          if (i > 0) await ctx.reseed(async (db, ch) => {
            for (const it of await db.items(ch, 'carry')) await db.clearItem(ch, 'carry', it.slot);
            await mortal(db, ch, SEPHI_SEED);
          });
          const r = await talk(ctx, m.npc, 1);
          const s = sephirotMade(r, m.sephirot);
          out.push({ npc: m.npc.name, expected: m.sephirot, gained: s.got, ok: s.ok, talk: r });
        }
        return {
          pass: out.every((o) => o.ok),
          evidence: { masters: out },
          note: out.map((o) => `${o.npc}: esperado ${o.expected}, recebeu [${o.gained.join(',') || 'nada'}]`).join('; '),
        };
      },
    },
    {
      id: 'AR-12',
      title: 'Rei',
      type: 'feliz',
      seed: (db, ch) => mortal(db, ch, { equip: { [EQUIP_SLOT.imortalidade]: ITEM.pedraImortalidade, [EQUIP_SLOT.sephirot]: ITEM.sephirotBase } }),
      run: async (ctx) => {
        const k = await talkKing(ctx);
        await sleep(3000);
        const rows = await ctx.query(async (db, ch) => {
          const list = await db.charactersNamed(ch);
          return Promise.all(list.map(async (r) => ({
            id: r.id, slot: r.slot, class: Number(r.class), classMaster: Number(r.class_master), level: Number(r.level),
            equip: (await db.itemsById(r.id, 'equip')).filter((x) => x.index).map((x) => ({ slot: x.slot, index: x.index })),
          })));
        });
        const arch = rows.find((r) => r.classMaster === CLASS_MASTER.ARCH);
        const mort = rows.find((r) => r.classMaster === CLASS_MASTER.MORTAL);
        const mortEq = (slot: number) => mort?.equip.find((x) => x.slot === slot)?.index ?? 0;
        const pass = k.logout && k.newCharList && k.archEffectSlot !== undefined && !!arch && arch.class === 0 && arch.level === 0
          && arch.slot === k.archEffectSlot && !!mort && mortEq(EQUIP_SLOT.imortalidade) === 0 && mortEq(EQUIP_SLOT.sephirot) === 0;
        return {
          pass,
          evidence: { king: k, rows },
          note: `Rei: logout ${k.logout}, lista nova ${k.newCharList}, SendArchEffect slot ${k.archEffectSlot ?? '-'}; banco: ${rows.map((r) => `slot ${r.slot} class ${r.class} master ${r.classMaster} nível ${r.level} equip [${r.equip.map((x) => `${x.slot}:${x.index}`).join(' ')}]`).join(' | ')}`,
        };
      },
    },
  ],
};

export default quest;
