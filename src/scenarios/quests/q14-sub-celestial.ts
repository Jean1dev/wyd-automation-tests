// Quest 14 — Sub-Celestial e troca de subclasse (Urnammu) (docs/quests/14-sub-celestial.md).
//
// Cada caso é um personagem novo semeado pelo banco já como Celestial (ou CELESTIALCS) no nível armazenado
// do caso, com a exp da curva do Celestial do Go, a Fama, a Sephirot no Equip[11] e a 5338 num slot alto.
// Criar o Sub: MSG_UseItem (botão direito) na 5338 e confere no banco ClassMaster, Equip[11] e a pedra.
// Urnammu: o ponto da Gema Estelar vai para o lado dele (save_x/save_y) e o bot usa o Pergaminho_do_Teleporte;
// fala com confirm 1 e confere Fama, Equip[11] e ClassMaster no banco depois do relog. O banco do Go não tem a
// ficha 2 (SaveCelestial[1]): a classe/nível do Sub não dá para conferir.
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
}

async function saved(ctx: CaseCtx): Promise<Saved> {
  return ctx.query(async (db, ch) => {
    const r = await db.character(ch);
    const carry = await db.items(ch, 'carry');
    const eq = (await db.items(ch, 'equip')).find((x) => x.slot === EQUIP_SLOT.sephirot);
    return {
      classMaster: Number(r.class_master), level: Number(r.level), fame: Number(r.fame), sephirot: eq?.index ?? 0,
      stone: carry.some((x) => x.index === ITEM.pedraIdeal),
    };
  });
}

const fmtS = (s: Saved) => `master ${s.classMaster} nível ${s.level} Fame ${s.fame} Equip[11] ${s.sephirot} 5338 ${s.stone ? 'sim' : 'não'}`;
const same = (a: Saved, b: Saved) => fmtS(a) === fmtS(b);

// ---------------------------------------------------------------- 5338

interface Use {
  t: string;
  notices: number[];
  texts: string[];
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
  await ctx.relog();
  const u: Use = { t, notices, texts, before, after: await saved(ctx) };
  ctx.log.info('usou a 5338', u as unknown as Record<string, unknown>);
  return u;
}

const noteU = (u: Use) => `5338 (${u.t}): ${[...u.texts.map((x) => `"${x}"`), ...u.notices.map((n) => `notice ${n}`)].join(', ') || 'sem resposta'}; banco ${fmtS(u.before)} → ${fmtS(u.after)}`;

function stoneRefused(u: Use): CaseResult {
  return { pass: same(u.before, u.after) && u.after.stone, evidence: { ...u }, note: noteU(u) };
}

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

/** Controle: falou com o Urnammu e nada mudou. */
function urnammuRefused(t: Talk): CaseResult {
  return { pass: !!t.talk && same(t.before, t.after), evidence: { ...t }, note: noteT(t) };
}

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
        // Legado: CELESTIALCS, a Sephirot e a 5338 somem (a ficha 2, BM nível 0, não existe no banco do Go).
        const u = await useStone(ctx);
        const pass = u.after.classMaster === CLASS_MASTER.CELESTIAL_CS && u.after.sephirot === 0 && !u.after.stone;
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
      run: async (ctx) => urnammuRefused(await talkUrnammu(ctx)),
    },
    {
      id: 'SC-06',
      title: 'Trocar a subclasse',
      type: 'feliz',
      seed: (db, ch) => seedChar(db, ch, { level: 120, classMaster: CLASS_MASTER.CELESTIAL_CS, sephirot: ITEM.sephirot.ht, fame: 2500, urnammu: true }),
      run: async (ctx) => {
        // Legado: Fama −2000 e a Sephirot some (a classe da ficha 2 não existe no banco do Go).
        const t = await talkUrnammu(ctx);
        const pass = !!t.talk && t.after.fame === t.before.fame - URNAMMU_FAME && t.after.sephirot === 0 && t.after.classMaster === CLASS_MASTER.CELESTIAL_CS;
        return { pass, evidence: { ...t }, note: noteT(t) };
      },
    },
    {
      id: 'SC-07',
      title: 'Urnammu para Celestial puro',
      type: 'controle',
      seed: (db, ch) => seedChar(db, ch, { level: 120, sephirot: ITEM.sephirot.ht, fame: 2500, urnammu: true }),
      run: async (ctx) => urnammuRefused(await talkUrnammu(ctx)),
    },
  ],
};

export default quest;
