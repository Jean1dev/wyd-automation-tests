// Cenário 3: troca entre jogadores. Duas contas (WYD_ACCOUNT e WYD_ACCOUNT_B), um personagem em
// cada, lado a lado na Aki, em Armia. Verifica que:
//   A) uma troca de item por item (Vela do Coveiro de A pela Colheita do Jardineiro de B, as
//      duas grátis na Aki) troca exatamente os dois itens, sem mexer no gold nem no resto do
//      inventário;
//   B) uma troca só de gold (A oferece um valor, B não oferece nada) tira o valor de A e dá
//      para B, sem mexer nos inventários;
//   C) depois de relogar, os dois personagens continuam com o resultado das trocas (o servidor salvou).
//
// Os personagens ficam em state/player-trade.json e são reaproveitados entre execuções.
//
// Uso:
//   npm run scenario:trade
//   npm run scenario:trade -- --gold 12345     # valor da troca de gold (padrão 12345)
//   npm run scenario:trade -- --fresh | --cleanup
//
// Saída: 0 = passou · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { buyItem, type Purchase } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { createCharacter, deleteCharacter, enterWorld, login } from '../bot/session.ts';
import { performTrade, type TradeResult, type TradeSide } from '../bot/trade.ts';
import { sleep } from '../bot/util.ts';
import * as P from '../protocol/packets.ts';
import { NPC } from '../world/coveiro.ts';
import { flag, newCharName, opt, reportDirFor, runMain, writeReportFile } from './common.ts';

const SCENARIO = 'player-trade';

/** Itens da troca: grátis na Aki (ItemList.csv :5703 e :5704), sem EF_NOTRADE. */
const ITEM_A = 4038; // Vela_do_Coveiro
const ITEM_B = 4039; // Colheita_do_Jardineiro

interface State {
  scenario: string;
  charA?: string;
  charB?: string;
}

const progress = new Progress<State>(SCENARIO, () => ({ scenario: SCENARIO }));
const gold = Number(opt('--gold') ?? 12345);
if (!Number.isInteger(gold) || gold <= 0) throw new Error(`--gold inválido: ${opt('--gold')}`);

const reportDir = reportDirFor(SCENARIO);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));

// ---------------------------------------------------------------- inventário

interface Snapshot {
  coin: number;
  /** Itens do inventário acessível, como "index:e0.v0,e1.v1,e2.v2" → quantidade. */
  items: Record<string, number>;
}

const itemKey = (it: P.Item) => `${it.index}:${it.eff.map(([e, v]) => `${e}.${v}`).join(',')}`;

function snapshot(c: GameClient): Snapshot {
  const items: Record<string, number> = {};
  for (const it of c.self!.carry.slice(0, P.BASE_CARRY_SLOTS)) if (it?.index) items[itemKey(it)] = (items[itemKey(it)] ?? 0) + 1;
  return { coin: c.self!.coin, items };
}

/** O que o inventário deve ter depois de entregar `out` e receber `in_`. */
function expected(before: Snapshot, out: P.Item[], in_: P.Item[], coinDelta: number): Snapshot {
  const items = { ...before.items };
  for (const it of out) items[itemKey(it)] = (items[itemKey(it)] ?? 0) - 1;
  for (const it of in_) items[itemKey(it)] = (items[itemKey(it)] ?? 0) + 1;
  for (const k of Object.keys(items)) if (items[k] === 0) delete items[k];
  return { coin: before.coin + coinDelta, items };
}

/** Diferenças entre o inventário esperado e o real, em texto (vazio = iguais). */
function diff(want: Snapshot, got: Snapshot): string[] {
  const out: string[] = [];
  if (want.coin !== got.coin) out.push(`gold ${got.coin}, esperado ${want.coin}`);
  for (const k of new Set([...Object.keys(want.items), ...Object.keys(got.items)])) {
    const w = want.items[k] ?? 0;
    const g = got.items[k] ?? 0;
    if (w !== g) out.push(`item ${k}: ${g}, esperado ${w}`);
  }
  return out;
}

// ---------------------------------------------------------------- sessão

interface Player {
  label: 'A' | 'B';
  cfg: BotConfig;
  c: GameClient;
  name: string;
}

async function enter(label: 'A' | 'B', cfg: BotConfig, state: State): Promise<Player> {
  const plog = log.child(label);
  const c = await login(cfg, plog);
  const key = label === 'A' ? 'charA' : 'charB';
  let name = state[key];
  if (name && !c.selChars.some((s) => s.name === name)) {
    plog.warn('personagem do estado não existe mais; criando outro', { name });
    name = undefined;
  }
  if (!name) {
    name = newCharName(cfg.charPrefix);
    await createCharacter(c, name, cfg.charClass, plog);
    state[key] = name;
    progress.save(state);
  }
  await enterWorld(c, name, plog);
  return { label, cfg, c, name };
}

/** Garante o item no inventário, comprando na Aki se faltar. */
async function ensureItem(p: Player, index: number): Promise<{ slot: number; purchase?: Purchase }> {
  let slot = p.c.findItem(index);
  if (slot >= 0) return { slot };
  const purchase = await buyItem(p.c, log.child(p.label), NPC.aki, index);
  slot = purchase.slot;
  return { slot, purchase };
}

interface TradeCheck {
  kind: 'item' | 'gold';
  offerA: { items: { slot: number; index: number }[]; money: number };
  offerB: { items: { slot: number; index: number }[]; money: number };
  before: { a: Snapshot; b: Snapshot };
  trade: TradeResult;
  /** O repasse do servidor mostrou ao outro lado exatamente a oferta feita. */
  forwardOk: boolean;
  after: { a: Snapshot; b: Snapshot };
  diffs: { a: string[]; b: string[] };
  ok: boolean;
}

async function runTrade(kind: 'item' | 'gold', a: Player, b: Player, sideA: TradeSide, sideB: TradeSide): Promise<TradeCheck> {
  const before = { a: snapshot(a.c), b: snapshot(b.c) };
  const outA = sideA.slots.map((s) => a.c.self!.carry[s]!);
  const outB = sideB.slots.map((s) => b.c.self!.carry[s]!);
  const describe = (s: TradeSide) => ({ items: s.slots.map((slot) => ({ slot, index: s.c.self!.carry[slot]!.index })), money: s.money });
  const offerA = describe(sideA);
  const offerB = describe(sideB);
  log.info(`troca de ${kind}: início`, { a: a.name, b: b.name, offerA, offerB, coinA: before.a.coin, coinB: before.b.coin });

  const trade = await performTrade(sideA, sideB, log);
  const forwardOk = offerMatchesBefore(sideA, trade.forwardedToB, outA) && offerMatchesBefore(sideB, trade.forwardedToA, outB);
  await sleep(1500);
  const after = { a: snapshot(a.c), b: snapshot(b.c) };
  const diffs = {
    a: diff(expected(before.a, outA, outB, sideB.money - sideA.money), after.a),
    b: diff(expected(before.b, outB, outA, sideA.money - sideB.money), after.b),
  };
  const ok = trade.completed && forwardOk && !diffs.a.length && !diffs.b.length;
  log[ok ? 'info' : 'error'](`troca de ${kind}: ${ok ? 'ok' : 'falhou'}`, { completed: trade.completed, failedAt: trade.failedAt, reason: trade.reason, forwardOk, diffs, coinA: after.a.coin, coinB: after.b.coin });
  return { kind, offerA, offerB, before, trade, forwardOk, after, diffs, ok };
}

/** Confere o repasse contra os itens que o lado tinha antes da troca (o inventário já mudou). */
function offerMatchesBefore(sent: TradeSide, got: P.TradeOffer | undefined, items: P.Item[]): boolean {
  if (!got || got.money !== sent.money || got.items.length !== sent.slots.length) return false;
  return sent.slots.every((slot, i) => got.items.some((it) => it.slot === slot && P.sameItem(it.item, items[i])));
}

async function cleanup(cfgA: BotConfig, cfgB: BotConfig, state: State): Promise<void> {
  for (const [cfg, name] of [[cfgA, state.charA], [cfgB, state.charB]] as const) {
    if (!name) continue;
    const c = await login(cfg, log);
    try {
      await deleteCharacter(c, name, cfg.password, log);
    } finally {
      c.close();
    }
  }
  progress.clear();
  log.info('personagens e estado removidos', { a: state.charA, b: state.charB });
}

// ---------------------------------------------------------------- execução

async function main(): Promise<number> {
  const cfgA = loadConfig('a');
  const cfgB = loadConfig('b');
  if (cfgA.account === cfgB.account) throw new Error('WYD_ACCOUNT_B precisa ser outra conta (npm run account:create -- --second)');
  let state = progress.load();
  if (flag('--cleanup') || flag('--fresh')) {
    await cleanup(cfgA, cfgB, state);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }

  const startedAt = new Date().toISOString();
  const failures: string[] = [];
  const report: Record<string, unknown> = {
    scenario: SCENARIO,
    description: 'Duas contas trocam um item por um item e depois um valor de gold; confere os dois inventários e o gold, ao vivo e depois de relogar.',
  };
  let a: Player | undefined;
  let b: Player | undefined;
  let outcome: 'done' | 'error' = 'done';
  let error: string | undefined;
  try {
    [a, b] = await Promise.all([enter('A', cfgA, state), enter('B', cfgB, state)]);
    report.characters = { a: { name: a.name, clientId: a.c.self!.clientId }, b: { name: b.name, clientId: b.c.self!.clientId } };

    // Os dois compram o item na Aki e ficam lado a lado.
    const [itemA, itemB] = await Promise.all([ensureItem(a, ITEM_A), ensureItem(b, ITEM_B)]);
    report.setup = { a: itemA, b: itemB };
    const seen = { aSeesB: a.c.mobs.has(b.c.self!.clientId), bSeesA: b.c.mobs.has(a.c.self!.clientId) };
    log.info('jogadores lado a lado', { ...seen, a: { x: a.c.self!.x, y: a.c.self!.y }, b: { x: b.c.self!.x, y: b.c.self!.y } });
    report.visibility = seen;

    // A) item por item.
    const itemTrade = await runTrade('item', a, b, { c: a.c, slots: [itemA.slot], money: 0 }, { c: b.c, slots: [itemB.slot], money: 0 });
    report.itemTrade = itemTrade;
    if (!itemTrade.ok) failures.push(describeFailure(itemTrade));
    await sleep(1000);

    // B) só gold, de A para B.
    const goldTrade = await runTrade('gold', a, b, { c: a.c, slots: [], money: gold }, { c: b.c, slots: [], money: 0 });
    report.goldTrade = goldTrade;
    if (!goldTrade.ok) failures.push(describeFailure(goldTrade));

    // C) o resultado sobrevive ao relogin.
    const want = { a: snapshot(a.c), b: snapshot(b.c) };
    a.c.close();
    b.c.close();
    await sleep(3000);
    [a, b] = await Promise.all([enter('A', cfgA, state), enter('B', cfgB, state)]);
    const got = { a: snapshot(a.c), b: snapshot(b.c) };
    const relogin = { want, got, diffs: { a: diff(want.a, got.a), b: diff(want.b, got.b) }, ok: false };
    relogin.ok = !relogin.diffs.a.length && !relogin.diffs.b.length;
    report.relogin = relogin;
    if (!relogin.ok) failures.push(`depois de relogar o inventário/gold não bate: A [${relogin.diffs.a.join('; ')}] B [${relogin.diffs.b.join('; ')}]`);
    log[relogin.ok ? 'info' : 'error']('relogin', { diffs: relogin.diffs });
  } catch (e) {
    outcome = 'error';
    error = e instanceof Error ? e.message : String(e);
    log.error('execução interrompida', { err: e instanceof Error ? e.stack : error });
  } finally {
    a?.c.close();
    b?.c.close();
  }

  const verdict = outcome === 'error' ? undefined : failures.length ? 'fail' : 'pass';
  writeReportFile(reportDir, { ...report, run: { startedAt, endedAt: new Date().toISOString(), outcome, error, gold }, verdict, failures }, log);
  if (outcome === 'error') return 3;
  if (verdict === 'fail') {
    log.error('FALHOU', { failures });
    return 1;
  }
  log.info('PASSOU');
  return 0;
}

function describeFailure(t: TradeCheck): string {
  if (!t.trade.completed) return `troca de ${t.kind} não concluiu no passo ${t.trade.failedAt}: ${t.trade.reason}`;
  const parts: string[] = [];
  if (!t.forwardOk) parts.push('o servidor repassou ao outro jogador uma oferta diferente da enviada');
  if (t.diffs.a.length) parts.push(`A: ${t.diffs.a.join('; ')}`);
  if (t.diffs.b.length) parts.push(`B: ${t.diffs.b.join('; ')}`);
  return `troca de ${t.kind} concluída com resultado errado: ${parts.join(' | ')}`;
}

runMain(main, log);
