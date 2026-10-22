// Quest 14 — Sub-Celestial e troca de subclasse (Urnammu) (docs/quests/14-sub-celestial.md).
//
// Cada caso é um personagem novo semeado pelo banco já como Celestial (ou CELESTIALCS) no nível armazenado
// do caso, com a exp da curva do Celestial do Go, a Fama, a Sephirot no Equip[11] e a 5338 num slot alto.
// Criar o Sub: MSG_UseItem (botão direito) na 5338 e confere no banco ClassMaster, Equip[11] e a pedra.
// Urnammu: o ponto da Gema Estelar vai para o lado dele (save_x/save_y) e o bot usa o Pergaminho_do_Teleporte;
// fala com confirm 1 e confere Fama, Equip[11] e ClassMaster no banco depois do relog. A ficha 2 (SaveCelestial[1])
// é lida do blob save_celestial (layout de world/celestial_sheet.go, nunca semeado à mão): no SC-06 ela é criada
// jogando (5338) antes do Urnammu. Os controles exigem a recusa do legado: SendItem calado da 5338 e as falas do
// Urnammu (_SN_NEEDCLASS, _DN_NEEDFAME).
import type { GameClient } from '../../client/GameClient.ts';
import { isSelfTeleport } from '../../bot/movement.ts';
import { talkQuest, type QuestTalk } from '../../bot/npc.ts';
import { sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import { Op } from '../../protocol/opcodes.ts';
import * as P from '../../protocol/packets.ts';
import { CEL_SEED, celExp } from '../../world/quests/13-celestial-destravas.ts';
import { EQUIP_SLOT, ITEM, NPC, URNAMMU_FAME, URNAMMU_SAVE } from '../../world/quests/14-sub-celestial.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

interface Seed {
  /** Nível ARMAZENADO (exibido − 1). */
  level: number;
  classMaster?: number;
  fame?: number;
  sephirot?: number;
  /** Inventário: slot → índice. */
  carry?: Record<number, number>;
  /** Ponto da Gema Estelar ao lado do Urnammu e o Pergaminho_do_Teleporte no inventário. */
  urnammu?: boolean;
}

const STONE_SLOT = 20;
const SCROLL_SLOT = 21;

async function seedChar(db: Db, name: string, s: Seed): Promise<void> {
  await db.setCharacter(name, {
    ...CEL_SEED,
    level: s.level,
    exp: celExp(s.level),
    class_master: s.classMaster ?? CLASS_MASTER.CELESTIAL,
    celestial_lv40: 1,
    celestial_lv90: 1,
    fame: s.fame ?? 0,
    clan: 0,
    ...(s.urnammu ? { save_x: URNAMMU_SAVE.x, save_y: URNAMMU_SAVE.y } : {}),
  });
  if (s.sephirot) await db.putItem(name, 'equip', EQUIP_SLOT.sephirot, { index: s.sephirot });
  const carry: Record<number, number> = { ...(s.carry ?? {}) };
  if (s.urnammu) carry[SCROLL_SLOT] = ITEM.pergaminhoTeleporte;
  for (const [slot, index] of Object.entries(carry)) await db.putItem(name, 'carry', Number(slot), { index });
}

// ---------------------------------------------------------------- estado no banco

interface Saved {
  classMaster: number;
  level: number;
  fame: number;
  sephirot: number;
  stone: boolean;
  sub?: Sheet;
}

/** SaveCelestial[1] do blob save_celestial (versão 1, 96 B por ficha: world/celestial_sheet.go). */
interface Sheet {
  cls: number;
  level: number;
  ac: number;
  maxHp: number;
  maxMp: number;
  str: number;
  int: number;
  dex: number;
  con: number;
  specialBonus: number;
}

function parseSub(b: Buffer): Sheet | undefined {
  if (b.length !== 1 + 2 * 96 || b[0] !== 1) return undefined;
  const p = b.subarray(1 + 96);
  return {
    cls: p.readInt32LE(0), level: p.readInt32LE(16), ac: p.readInt32LE(20), maxHp: p.readInt32LE(28), maxMp: p.readInt32LE(32),
    str: p.readInt16LE(44), int: p.readInt16LE(46), dex: p.readInt16LE(48), con: p.readInt16LE(50), specialBonus: p.readUInt16LE(70),
  };
}

/** BaseSIDCHM (Basedef.cpp:44-50): Str, Int, Dex, Con, HP, MP por classe. */
const BASE_SIDCHM = [[8, 4, 7, 6, 80, 45], [5, 8, 5, 5, 60, 65], [6, 6, 9, 5, 70, 55], [8, 9, 13, 6, 75, 60]] as const;
/** Classe do personagem do cenário (charClass padrão do runner: TK). */
const ACTIVE_CLASS = 0;

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const r = await db.character(ch);
    const carry = await db.items(ch, 'carry');
    const eq = (await db.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.sephirot);
    return {
      classMaster: Number(r.class_master), level: Number(r.level), fame: Number(r.fame), sephirot: eq?.index ?? 0,
      stone: carry.some((x) => x.index === ITEM.pedraIdeal),
      sub: parseSub(await db.saveCelestial(ch)),
    };
  });
}

const fmtSub = (x?: Sheet) => (x ? `ficha 2 classe ${x.cls} nível ${x.level} AC ${x.ac} HP ${x.maxHp} MP ${x.maxMp} SID ${x.str}/${x.int}/${x.dex}/${x.con} pontos ${x.specialBonus}` : 'sem ficha 2');
const fmtS = (s: Saved) => `master ${s.classMaster} nível ${s.level} Fame ${s.fame} Equip[11] ${s.sephirot} 5338 ${s.stone ? 'sim' : 'não'} ${fmtSub(s.sub)}`;
const same = (a: Saved, b: Saved) => fmtS(a) === fmtS(b);

// ---------------------------------------------------------------- 5338

interface Use {
  t: string;
  notices: number[];
  texts: string[];
  /** SendItem do inventário (slot:índice). */
  carrySlots: string[];
  before: Saved;
  after: Saved;
}

async function useStone(ctx: CaseCtx): Promise<Use> {
  const before = await saved(ctx);
  const c = ctx.c;
  const since = c.mark;
  c.send(Op.UseItem, P.useItem(STONE_SLOT, c.self!.x, c.self!.y));
  await sleep(3000);
  const frames = c.framesSince(since);
  const t = new Date().toISOString();
  const notices = frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body));
  const texts = frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body));
  const carrySlots = frames.filter((f) => f.header.type === Op.SendItem).map((f) => P.parseSendItem(f.body))
    .filter((x) => x.place === P.PLACE_CARRY).map((x) => `${x.slot}:${x.item.index}`);
  await ctx.relog();
  const u: Use = { t, notices, texts, carrySlots, before, after: await saved(ctx) };
  ctx.log.info('usou a 5338', u as unknown as Record<string, unknown>);
  return u;
}

const noteU = (u: Use) => `5338 (${u.t}): ${[...u.texts.map((x) => `"${x}"`), ...u.notices.map((n) => `notice ${n}`), u.carrySlots.length ? `SendItem [${u.carrySlots.join(' ')}]` : ''].filter(Boolean).join(', ') || 'sem resposta'}; banco ${fmtS(u.before)} → ${fmtS(u.after)}`;

/** Controle: recusa do legado (_MSG_UseItem.cpp:3005-3035): só o SendItem do slot da 5338, calado; nada muda. */
function stoneRefused(u: Use): CaseResult {
  const silentResync = u.carrySlots.includes(`${STONE_SLOT}:${ITEM.pedraIdeal}`) && !u.texts.length && !u.notices.length;
  return { pass: silentResync && same(u.before, u.after) && u.after.stone, evidence: { ...u }, note: `esperado (legado): SendItem do slot ${STONE_SLOT} calado; ${noteU(u)}` };
}

const KING_BLESS = /Que a luz de Sephira o ilumine/;

// ---------------------------------------------------------------- Urnammu

interface Talk {
  teleport: { x: number; y: number; ok: boolean };
  talk?: QuestTalk;
  error?: string;
  before: Saved;
  after: Saved;
}

/** Pergaminho_do_Teleporte até o ponto salvo ao lado do Urnammu e MSG_Quest com confirm 1. */
async function talkUrnammu(ctx: CaseCtx): Promise<Talk> {
  const before = await saved(ctx);
  const c: GameClient = ctx.c;
  const since = c.mark;
  c.send(Op.UseItem, P.useItem(SCROLL_SLOT, c.self!.x, c.self!.y));
  let ok = true;
  try {
    await c.waitFor((f) => isSelfTeleport(c, f), { timeoutMs: 8000, since, what: 'teleporte do pergaminho' });
    await sleep(1500);
  } catch {
    ok = false;
  }
  const teleport = { x: c.self!.x, y: c.self!.y, ok };
  let talk: QuestTalk | undefined;
  let error: string | undefined;
  if (ok) {
    try {
      talk = await talkQuest(c, ctx.log, NPC.urnammu, 5000, 1);
    } catch (e) {
      error = (e as Error).message;
    }
  } else error = 'o pergaminho não teleportou';
  await ctx.relog();
  const r: Talk = { teleport, talk, error, before, after: await saved(ctx) };
  ctx.log.info('Urnammu', r as unknown as Record<string, unknown>);
  return r;
}

const noteT = (t: Talk) => `pergaminho → (${t.teleport.x},${t.teleport.y})${t.teleport.ok ? '' : ' sem teleporte'}; `
  + (t.talk ? `Urnammu id ${t.talk.npcId} (${t.talk.t}): ${[...t.talk.texts.map((x) => `"${x}"`), ...t.talk.notices.map((n) => `notice ${n}`)].join(', ') || 'sem resposta'}` : `erro: ${t.error}`)
  + `; banco ${fmtS(t.before)} → ${fmtS(t.after)}`;

/** Controle: o Urnammu recusa com a fala do legado (`want`) e nada muda. */
function urnammuRefused(t: Talk, want: RegExp): CaseResult {
  const said = !!t.talk && t.talk.texts.some((x) => want.test(x));
  return { pass: said && same(t.before, t.after), evidence: { ...t }, note: `esperado (legado): "${want.source}"; ${noteT(t)}` };
}

/** _DN_NEEDFAME (Language.txt 523) e _SN_NEEDCLASS (524), como o legado formata (_MSG_Quest.cpp:1252/1264). */
const NEED_FAME = /precisa de 2000 pontos de fama/;
const NEED_CLASS = /Somente personagem Sub Celestial/;

// ---------------------------------------------------------------- casos

const STONE = { [STONE_SLOT]: ITEM.pedraIdeal };

const quest: QuestSpec = {
  id: '14',
  name: 'Sub-Celestial e troca de subclasse (Urnammu)',
  cases: [
    {
      id: 'SC-01',
      title: 'Sub sem Sephirot',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 120, carry: STONE }),
      run: async (ctx) => stoneRefused(await useStone(ctx)),
    },
    {
      id: 'SC-02',
      title: 'Sub abaixo do nível',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 119, sephirot: ITEM.sephirot.bm, carry: STONE }),
      run: async (ctx) => stoneRefused(await useStone(ctx)),
    },
    {
      id: 'SC-03',
      title: 'Criar o Sub',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { level: 120, sephirot: ITEM.sephirot.bm, carry: STONE }),
      run: async (ctx) => {
        // Legado: CELESTIALCS, a Sephirot e a 5338 somem; ficha 2 BM nível 0, AC 230, 855 pontos, Str..Con da
        // classe ativa e HP/MP da classe da Sephirot (_MSG_UseItem.cpp:3040-3073).
        const u = await useStone(ctx);
        const x = u.after.sub;
        const bm = ITEM.sephirot.bm - 1760;
        const sheetOk = !!x && x.cls === bm && x.level === 0 && x.ac === 230 && x.specialBonus === 855
          && [x.str, x.int, x.dex, x.con].join() === BASE_SIDCHM[ACTIVE_CLASS].slice(0, 4).join()
          && x.maxHp === BASE_SIDCHM[bm][4] && x.maxMp === BASE_SIDCHM[bm][5];
        const pass = u.after.classMaster === CLASS_MASTER.CELESTIAL_CS && u.after.sephirot === 0 && !u.after.stone && sheetOk
          && u.texts.some((m) => KING_BLESS.test(m));
        return { pass, evidence: { ...u }, note: noteU(u) };
      },
    },
    {
      id: 'SC-04',
      title: 'Sub de novo',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 120, classMaster: CLASS_MASTER.CELESTIAL_CS, sephirot: ITEM.sephirot.bm, carry: STONE }),
      run: async (ctx) => stoneRefused(await useStone(ctx)),
    },
    {
      id: 'SC-05',
      title: 'Urnammu sem Fama',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 120, classMaster: CLASS_MASTER.CELESTIAL_CS, sephirot: ITEM.sephirot.ht, fame: 100, urnammu: true }),
      run: async (ctx) => urnammuRefused(await talkUrnammu(ctx), NEED_FAME),
    },
    {
      id: 'SC-06',
      title: 'Trocar a subclasse',
      type: 'feliz',
      // A ficha 2 nasce jogando: Celestial com a Sephirot BM usa a 5338 (SC-03); depois a HT e a Fama vêm pelo banco.
      seed: (db, ch) => seedChar(db, ch, { level: 120, sephirot: ITEM.sephirot.bm, carry: STONE, urnammu: true }),
      run: async (ctx) => {
        const made = await useStone(ctx);
        if (made.after.classMaster !== CLASS_MASTER.CELESTIAL_CS || !made.after.sub) {
          return { pass: false, evidence: { made }, note: `o Sub não nasceu pela 5338: ${noteU(made)}` };
        }
        await ctx.reseed(async (db, ch) => {
          await db.putItem(ch, 'equip', EQUIP_SLOT.sephirot, { index: ITEM.sephirot.ht });
          await db.setCharacter(ch, { fame: 2500 });
        });
        // Legado: Fama −2000; a ficha 2 vira HT com Str..Con da classe ativa e os pontos devolvidos (Special 0:
        // 855 ficam); a Sephirot some; o ClassMaster e a ficha ativa ficam (_MSG_Quest.cpp:1270-1305).
        const t = await talkUrnammu(ctx);
        const x = t.after.sub;
        const ht = ITEM.sephirot.ht - 1760;
        const sheetOk = !!x && x.cls === ht && x.specialBonus === 855
          && [x.str, x.int, x.dex, x.con].join() === BASE_SIDCHM[ACTIVE_CLASS].slice(0, 4).join();
        const pass = !!t.talk && t.after.fame === t.before.fame - URNAMMU_FAME && t.after.sephirot === 0
          && t.after.classMaster === CLASS_MASTER.CELESTIAL_CS && t.after.level === t.before.level && sheetOk
          && t.talk.texts.some((m) => KING_BLESS.test(m));
        return { pass, evidence: { made, ...t }, note: `Sub criado: ${fmtSub(made.after.sub)}; ${noteT(t)}` };
      },
    },
    {
      id: 'SC-07',
      title: 'Urnammu para Celestial puro',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 120, sephirot: ITEM.sephirot.ht, fame: 2500, urnammu: true }),
      run: async (ctx) => urnammuRefused(await talkUrnammu(ctx), NEED_CLASS),
    },
  ],
};

export default quest;
