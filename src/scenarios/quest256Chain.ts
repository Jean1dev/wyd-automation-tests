// Cenário 4: Quest 256, passos 2–5 (Jardineiro, Kaizen, Hidra e Elfos) com um personagem só,
// subindo em cadeia com a Poeira de Fada. Em cada passo, como um jogador:
//   1. sobe até um nível abaixo do mínimo do passo, distribuindo os pontos pela build da classe;
//   2. compra e equipa o que o nível e o gold permitem;
//   3. vai à NPC só com o item errado (controle: não teleporta) e entra a pé na arena (controle
//      de intruso: é mandado de volta para a cidade);
//   4. compra o item do passo na Aki (grátis);
//   5. volta à NPC: um nível abaixo do mínimo ela recusa (controle de nível); com +1 Poeira,
//      a entrega teleporta para a arena e consome o item (verificação A);
//   6. fica na arena até o reset mandar de volta para a cidade (verificação B).
//
// O Emblema do Guarda (passo 5) sai da Aki no Railway. Se ela não vender, o bot farma os mobs
// que soltam o item (--emblem-farm, padrão 30 min); sem o item, a entrega fica "blocked" e a
// arena é testada pelo Mestre Grifo (que dá o QuestFlag do nível, misc.go:927).
//
// É retomável: o estado fica em state/quest256-chain.json. A entrega e a espera do reset não
// sobrevivem ao relogin (o QuestFlag é volátil): a tentativa recomeça na compra do item.
//
// Uso:
//   npm run scenario:quest256                         # até 60 min nesta execução
//   npm run scenario:quest256 -- --until-done
//   npm run scenario:quest256 -- --adopt <nome>       # usa um personagem já existente da conta
//   npm run scenario:quest256 -- --step 3             # repete um passo (exige o nível)
//   npm run scenario:quest256 -- --emblem-farm 30m | --reset-wait 12m | --fresh | --cleanup
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { ALL_STR, BUILDS, spendBuild, type StatReq } from '../bot/build.ts';
import { fight } from '../bot/combat.ts';
import { equipFromCarry, sellItem, type EquipResult, type Sale } from '../bot/equip.ts';
import { walkPath, walkTo } from '../bot/movement.ts';
import { buyItem, NpcError, talkQuest, type Purchase, type QuestTalk } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { FAIRY_DUST, probeIntruder, useDustUntil, waitForReset, type DustUse, type IntruderProbe, type ResetWait } from '../bot/quest.ts';
import { enterWorld, login, SessionError } from '../bot/session.ts';
import { reviveAfterDeath } from '../bot/survival.ts';
import { griffTravel, isInArmia, returnToArmia, teleportTile, type Hop } from '../bot/travel.ts';
import { dist, shownLevel, sleep } from '../bot/util.ts';
import * as P from '../protocol/packets.ts';
import { FAIRY_DUST_PRICE, resetDeadline } from '../world/coveiro.ts';
import {
  EMBLEM_DROPPERS, EMBLEM_FARM_REST, EMBLEM_FARM_SPAWNS, GOLD_RESERVE, GRIFF_WARP, isInArea, ITEM, NPC, safeSpot, STEPS, stepByNumber, TELEPORT, TK_GEAR,
  type GearPiece, type QuestStep,
} from '../world/quest256.ts';
import { cleanupScenario, ensureCharacter, flag, opt, parseDuration, PlayClock, reportDirFor, runMain, runWithReconnect, writeReportFile, type CharacterState } from './common.ts';

const SCENARIO = 'quest256-chain';
/** Tentativas de entrega + reset por passo antes de desistir (queda de conexão na arena). */
const MAX_ATTEMPTS = 3;
/** Mortes seguidas numa viagem antes de desistir dela. */
const MAX_TRAVEL_DEATHS = 3;
/** Uma pilha de Poeira de Fada (EF_AMOUNT). */
const DUST_STACK = 255;

type StepPhase = 'level' | 'gear' | 'probe' | 'ticket' | 'handin' | 'reset' | 'done';

interface Handin extends QuestTalk {
  level: number;
  shownLevel: number;
  ticketSlot: number;
  ticketConsumed: boolean;
  inArena: boolean;
  ok: boolean;
}

interface EmblemFarm {
  startedAt: string;
  endedAt?: string;
  kills: Record<string, number>;
  dropped: boolean;
  deaths: number;
}

interface StepState {
  phase: StepPhase;
  attempts: number;
  wrongTicket?: QuestTalk & { items: number[]; kept: boolean; ok: boolean };
  intruder?: IntruderProbe;
  ticket?: Purchase & { free: boolean };
  emblemFarm?: EmblemFarm;
  belowLevel?: QuestTalk & { level: number; shownLevel: number; ticketKept: boolean; ok: boolean; skipped?: string };
  handin?: Handin;
  /** Passo 5 sem Emblema: entrada pelo Mestre Grifo para testar o reset mesmo assim. */
  griffEntry?: Hop & { inArena: boolean };
  reset?: ResetWait;
  verdict?: 'pass' | 'fail' | 'blocked';
  failures: string[];
}

interface State extends CharacterState {
  scenario: string;
  runs: number;
  playMs: number;
  /** Passo atual (2–5) ou 6 = cadeia concluída. */
  current: number;
  steps: Record<string, StepState>;
  adopted?: boolean;
  dust: { purchases: Purchase[]; uses: number; failed?: DustUse };
  gear: { bought: Purchase[]; equipped: EquipResult[]; sold: Sale[]; skipped: Record<string, string> };
  travel: Hop[];
  levelCurve: { t: string; shown: number; step: number }[];
  /** Execução em que o --step já foi aplicado. */
  runsAtStep?: number;
  verdict?: 'pass' | 'fail';
  failures: string[];
}

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  runs: 0,
  playMs: 0,
  current: 2,
  steps: {},
  dust: { purchases: [], uses: 0 },
  gear: { bought: [], equipped: [], sold: [], skipped: {} },
  travel: [],
  levelCurve: [],
  failures: [],
}));

// ---------------------------------------------------------------- CLI

const budgetMs = flag('--until-done') ? Infinity : parseDuration(opt('--budget') ?? '60m');
const resetWaitMs = opt('--reset-wait') ? parseDuration(opt('--reset-wait')!) : undefined;
const emblemFarmMs = parseDuration(opt('--emblem-farm') ?? '30m');
const onlyStep = opt('--step') ? Number(opt('--step')) : undefined;
if (onlyStep !== undefined) stepByNumber(onlyStep);
const adopt = opt('--adopt');

const reportDir = reportDirFor(SCENARIO);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));
const clock = new PlayClock();

// ---------------------------------------------------------------- helpers

const here = (c: GameClient) => ({ x: c.self!.x, y: c.self!.y });

function stepState(state: State, n: number): StepState {
  return (state.steps[n] ??= { phase: 'level', attempts: 0, failures: [] });
}

function fail(state: State, st: StepState, step: QuestStep, msg: string): void {
  const full = `passo ${step.step} (${step.quest}): ${msg}`;
  st.failures.push(msg);
  st.verdict = 'fail';
  state.failures.push(full);
  state.verdict = 'fail';
  log.error('verificação falhou', { failure: full });
}

/** Requisito de atributo do próximo equipamento ainda não vestido: a build cumpre isso antes. */
function nextGearReq(c: GameClient, state: State): StatReq {
  if ((state.charClass ?? 0) !== 0) return {};
  const me = c.self!;
  const hasStatReq = (p: GearPiece) => [p.req.str, p.req.dex, p.req.con, p.req.int].some((v) => v !== undefined);
  const g = TK_GEAR.find((p) => hasStatReq(p) && me.equip[p.equipSlot]?.index !== p.item && !hasBetterWeapon(c, p));
  return g ? { str: g.req.str, dex: g.req.dex, con: g.req.con, int: g.req.int } : {};
}

/** A arma vestida já é uma das que vêm depois desta na lista (ex.: Hrotti no lugar da Espada). */
function hasBetterWeapon(c: GameClient, p: GearPiece): boolean {
  const i = TK_GEAR.indexOf(p);
  return TK_GEAR.slice(i + 1).some((q) => q.equipSlot === p.equipSlot && c.self!.equip[q.equipSlot]?.index === q.item);
}

async function spend(c: GameClient, state: State): Promise<void> {
  await spendBuild(c, log, BUILDS[state.charClass ?? 0] ?? ALL_STR, nextGearReq(c, state));
}

/** Gasta as Poeiras de Fada até o nível armazenado `target`, comprando pilhas na Evolução quando faltar. */
async function levelTo(c: GameClient, state: State, step: QuestStep, target: number): Promise<boolean> {
  const me = c.self!;
  if (me.level >= target) return true;
  const have = c.countItem(FAIRY_DUST) ? me.carry.reduce((n, it) => n + (it.index === FAIRY_DUST ? P.itemAmount(it) : 0), 0) : 0;
  const need = target - me.level;
  if (have < need) {
    await returnToArmia(c, log);
    for (let stacks = Math.ceil((need - have) / DUST_STACK); stacks > 0; stacks--) {
      if (me.coin < FAIRY_DUST_PRICE) throw new Error(`sem gold para a Poeira de Fada (${me.coin})`);
      state.dust.purchases.push(await buyItem(c, log, NPC.evolucao, FAIRY_DUST));
      progress.save(state);
    }
  }
  const bad = await useDustUntil(c, log, target, async (use) => {
    if (use.ok) {
      state.dust.uses++;
      state.levelCurve.push({ t: use.t, shown: shownLevel(use.to), step: step.step });
      await spend(c, state);
    }
    progress.save(state);
  });
  if (bad) {
    state.dust.failed = bad;
    fail(state, stepState(state, step.step), step, `Poeira de Fada no nível exibido ${shownLevel(bad.from)} levou ao ${shownLevel(bad.to)} (esperado +1)${bad.texts?.length ? `; servidor: ${bad.texts.join(' | ')}` : ''}`);
    return false;
  }
  return true;
}

/** Leva até a loja (a Berlund fica em Noatum: vai pelo teleporte de Armia e volta). */
async function withShop<T>(c: GameClient, state: State, piece: GearPiece, fn: () => Promise<T>): Promise<T> {
  await returnToArmia(c, log);
  if (piece.shop !== NPC.berlund) return fn();
  state.travel.push(await teleportTile(c, log, TELEPORT.armiaToNoatum, 'Armia → Noatum'));
  try {
    return await fn();
  } finally {
    state.travel.push(await teleportTile(c, log, TELEPORT.noatumToArmia, 'Noatum → Armia'));
  }
}

/**
 * Compra gulosa, na ordem de TK_GEAR: cada peça que o nível permite e o gold paga (guardando
 * GOLD_RESERVE) é comprada e vestida; a peça que sai do slot é vendida na mesma loja.
 */
async function upgradeGear(c: GameClient, state: State, step: QuestStep): Promise<void> {
  const me = c.self!;
  if ((state.charClass ?? 0) !== 0) {
    state.gear.skipped.all = `a lista de equipamento é de TransKnight; classe ${state.charClass}`;
    return;
  }
  for (const piece of TK_GEAR) {
    if (me.equip[piece.equipSlot]?.index === piece.item || hasBetterWeapon(c, piece)) continue;
    if (me.level < piece.req.level) { state.gear.skipped[piece.name] = `nível exibido ${shownLevel(piece.req.level)} (está no ${shownLevel(me.level)})`; continue; }
    const short = (['str', 'dex', 'con', 'int'] as const).filter((s) => (piece.req[s] ?? 0) > me.attrs[s]);
    if (short.length) { state.gear.skipped[piece.name] = `atributos abaixo do requisito: ${short.map((s) => `${s} ${me.attrs[s]}/${piece.req[s]}`).join(', ')}`; continue; }
    let slot = c.findItem(piece.item);
    if (slot < 0) {
      if (me.coin - piece.price < GOLD_RESERVE) { state.gear.skipped[piece.name] = `gold ${me.coin} < preço ${piece.price} + reserva ${GOLD_RESERVE}`; continue; }
      await withShop(c, state, piece, async () => {
        const p = await buyItem(c, log, piece.shop, piece.item);
        state.gear.bought.push(p);
        slot = p.slot;
      });
      progress.save(state);
    } else {
      await returnToArmia(c, log);
    }
    const r = await equipFromCarry(c, log, slot, piece.equipSlot);
    state.gear.equipped.push(r);
    delete state.gear.skipped[piece.name];
    if (!r.ok) {
      fail(state, stepState(state, step.step), step, `o servidor recusou equipar ${piece.name} (${piece.item}) no nível exibido ${shownLevel(me.level)} com ${JSON.stringify(me.attrs)} (avisos: ${r.notices.join(',') || 'nenhum'})`);
      continue;
    }
    // A peça antiga voltou para o slot do inventário de onde saiu a nova: vende.
    if (r.replaced && me.carry[slot]?.index === r.replaced) {
      try {
        state.gear.sold.push(await sellItem(c, log, piece.shop === NPC.berlund ? NPC.setTk : piece.shop, slot));
      } catch (e) {
        log.warn('não vendeu a peça antiga', { item: r.replaced, err: String(e) });
      }
    }
    progress.save(state);
  }
  log.info('equipamento', { shown: shownLevel(me.level), coin: me.coin, damage: me.damage, ac: me.ac, maxHp: me.maxHp, attrs: me.attrs, equip: me.equip.map((it, i) => ({ i, index: it.index })).filter((x) => x.index), skipped: state.gear.skipped });
}

/** Vai de onde estiver até o lado da NPC do passo. Revive e tenta de novo se morrer no caminho. */
async function goToStepNpc(c: GameClient, state: State, step: QuestStep): Promise<void> {
  const me = c.self!;
  for (let deaths = 0; ; deaths++) {
    if (dist(me.x, me.y, step.npc.stand.x, step.npc.stand.y) <= 20 && !isInArea(step.area, me.x, me.y)) {
      await walkTo(c, step.npc.stand.x, step.npc.stand.y);
      return;
    }
    if (isInArea(step.area, me.x, me.y)) {
      await walkTo(c, step.npc.stand.x, step.npc.stand.y);
      return;
    }
    await returnToArmia(c, log);
    if (step.travel === 'jardim') {
      state.travel.push(await griffTravel(c, log, GRIFF_WARP.jardimDosDeuses));
    } else if (step.travel === 'dungeon') {
      state.travel.push(await griffTravel(c, log, GRIFF_WARP.calabouco));
      state.travel.push(await teleportTile(c, log, TELEPORT.fieldToDungeon, 'Armia Field → Dungeon 1'));
    } else {
      state.travel.push(await griffTravel(c, log, GRIFF_WARP.submundo));
      state.travel.push(await teleportTile(c, log, TELEPORT.fieldToUnderworld, 'Azran Field → Underworld'));
    }
    progress.save(state);
    await walkPath(c, step.route, { abort: () => me.hp <= 0 });
    if (me.hp > 0) return;
    if (deaths + 1 >= MAX_TRAVEL_DEATHS) throw new Error(`morreu ${MAX_TRAVEL_DEATHS} vezes indo até ${step.npc.name}`);
    log.warn('morreu no caminho da NPC; revivendo e tentando de novo', { step: step.step, x: me.x, y: me.y });
    await reviveAfterDeath(c, log);
  }
}

/** Compra na Aki o que faltar dos itens; tira do inventário o item certo do passo (vendendo por 0). */
async function prepareWrongTickets(c: GameClient, step: QuestStep): Promise<void> {
  await returnToArmia(c, log);
  for (let slot = c.findItem(step.ticket); slot >= 0; slot = c.findItem(step.ticket)) await sellItem(c, log, NPC.aki, slot);
  for (const t of step.wrongTickets) if (c.findItem(t) < 0) await buyItem(c, log, NPC.aki, t);
}

/** Farm de reserva do Emblema do Guarda: mata os mobs que soltam o 4042 até ele cair ou o tempo acabar. */
async function farmEmblem(c: GameClient, state: State, st: StepState, deadline: number): Promise<boolean> {
  const me = c.self!;
  const farm: EmblemFarm = (st.emblemFarm ??= { startedAt: new Date().toISOString(), kills: {}, dropped: false, deaths: 0 });
  const until = Math.min(deadline, Date.parse(farm.startedAt) + emblemFarmMs);
  log.info('farm do Emblema do Guarda', { until: new Date(until).toISOString(), droppers: EMBLEM_DROPPERS });
  while (Date.now() < until && c.findItem(ITEM.emblemaDoGuarda) < 0) {
    if (c.isClosed) throw new Error('conexão caiu no farm do Emblema');
    if (me.hp <= 0) {
      farm.deaths++;
      await reviveAfterDeath(c, log);
      continue;
    }
    if (me.y < 3600) {
      // Fora do Submundo: vai pelo Grifo e pelo tile, como na viagem do passo 5.
      await returnToArmia(c, log);
      state.travel.push(await griffTravel(c, log, GRIFF_WARP.submundo));
      state.travel.push(await teleportTile(c, log, TELEPORT.fieldToUnderworld, 'Azran Field → Underworld'));
    }
    if (me.hp < me.maxHp * 0.4) {
      await walkTo(c, EMBLEM_FARM_REST.x, EMBLEM_FARM_REST.y);
      const t0 = Date.now();
      while (me.hp > 0 && me.hp < me.maxHp * 0.9 && Date.now() - t0 < 120_000) await sleep(2000);
      continue;
    }
    const targets = c.liveMobs().filter((m) => EMBLEM_DROPPERS[m.name] && dist(me.x, me.y, m.x, m.y) <= 14)
      .sort((a, b) => EMBLEM_DROPPERS[a.name].oddsPerKill - EMBLEM_DROPPERS[b.name].oddsPerKill || dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y));
    if (!targets.length) {
      const p = EMBLEM_FARM_SPAWNS[Math.floor(Math.random() * EMBLEM_FARM_SPAWNS.length)];
      await walkTo(c, p.x, p.y + 2, { abort: () => me.hp <= 0 });
      await sleep(1500);
      continue;
    }
    const target = targets[0];
    const r = await fight(c, target, { minHpRatio: 0.35, maxSwings: 60 });
    if (r.result === 'killed') {
      farm.kills[target.name] = (farm.kills[target.name] ?? 0) + 1;
      await sleep(500);
    }
    progress.save(state);
  }
  farm.endedAt = new Date().toISOString();
  farm.dropped = c.findItem(ITEM.emblemaDoGuarda) >= 0;
  log.info('fim do farm do Emblema', farm as unknown as Record<string, unknown>);
  return farm.dropped;
}

function writeReport(state: State, run: Record<string, unknown>): void {
  writeReportFile(reportDir, {
    scenario: SCENARIO,
    description: 'Quest 256 passos 2–5 (Colheita do Jardineiro, Cura do Batedor, Mana do Batedor e Emblema do Guarda) com um personagem só, subindo com a Poeira de Fada, distribuindo os pontos pela build da classe e comprando equipamento.',
    run,
    character: { name: state.charName, class: state.charClass, createdAt: state.createdAt, adopted: state.adopted },
    current: state.current,
    verdict: state.verdict ?? (state.current > 5 ? 'pass' : 'in-progress'),
    failures: state.failures,
    steps: Object.fromEntries(STEPS.map((s) => [s.step, { quest: s.quest, ...state.steps[s.step] }])),
    dust: state.dust,
    gear: state.gear,
    travel: state.travel,
    playMinutes: +(state.playMs / 60000).toFixed(1),
    levelCurve: state.levelCurve,
  }, log);
}

// ---------------------------------------------------------------- execução

async function runStep(c: GameClient, state: State, step: QuestStep, deadline: number): Promise<'done' | 'in-progress'> {
  const me = c.self!;
  const st = stepState(state, step.step);
  const inArena = () => isInArea(step.area, me.x, me.y);
  // A entrega e o reset não sobrevivem ao relogin.
  if (st.phase === 'handin' || st.phase === 'reset') {
    log.warn('tentativa anterior interrompida; recomeçando na compra do item', { step: step.step, phase: st.phase });
    st.phase = 'ticket';
  }

  while (st.phase !== 'done') {
    if (Date.now() >= deadline) return 'in-progress';
    log.info('fase', { step: step.step, phase: st.phase, shown: shownLevel(me.level), coin: me.coin, x: me.x, y: me.y });
    switch (st.phase) {
      case 'level': {
        if (me.level >= step.level.max) throw new Error(`nível exibido ${shownLevel(me.level)} já passou da faixa do passo ${step.step}; use --fresh`);
        if (me.level < step.level.min - 1 && !(await levelTo(c, state, step, step.level.min - 1))) { st.phase = 'done'; break; }
        await spend(c, state);
        st.phase = 'gear';
        break;
      }
      case 'gear':
        await upgradeGear(c, state, step);
        st.phase = 'probe';
        break;
      case 'probe': {
        await prepareWrongTickets(c, step);
        await goToStepNpc(c, state, step);
        const items = step.wrongTickets.filter((t) => c.findItem(t) >= 0);
        const talk = await talkQuest(c, log, step.npc);
        const kept = items.every((t) => c.findItem(t) >= 0);
        st.wrongTicket = { ...talk, items, kept, ok: !talk.teleport && kept };
        if (talk.teleport) fail(state, st, step, `${step.npc.name} teleportou com o item errado (${items.join(',')}) para (${talk.teleport.to.x},${talk.teleport.to.y})`);
        else if (!kept) fail(state, st, step, `${step.npc.name} consumiu o item errado (${items.join(',')}) sem teleportar`);
        if (inArena()) {
          // Com o item errado não devia ter entrado; o reset/recall resolve, mas sai a pé por segurança.
          await walkTo(c, step.npc.stand.x, step.npc.stand.y);
        }
        st.intruder = await probeIntruder(c, log, step.intruder, inArena);
        if (!st.intruder.ok) {
          fail(state, st, step, `entrou na arena a pé sem QuestFlag e ficou em (${me.x},${me.y}) sem ser mandado para a cidade`);
          await walkTo(c, step.npc.stand.x, step.npc.stand.y);
        }
        st.phase = 'ticket';
        break;
      }
      case 'ticket': {
        if (st.attempts >= MAX_ATTEMPTS) throw new Error(`${MAX_ATTEMPTS} tentativas de entrega + reset do passo ${step.step} interrompidas; veja events.jsonl`);
        if (inArena()) await walkTo(c, step.npc.stand.x, step.npc.stand.y);
        if (c.findItem(step.ticket) < 0) {
          await returnToArmia(c, log);
          try {
            const p = await buyItem(c, log, NPC.aki, step.ticket);
            st.ticket = { ...p, free: p.coinAfter === p.coinBefore };
            if (!st.ticket.free) log.warn('o item da quest não saiu de graça', { item: step.ticket, coinBefore: p.coinBefore, coinAfter: p.coinAfter });
          } catch (e) {
            if (!(e instanceof NpcError) || step.ticket !== ITEM.emblemaDoGuarda) throw e;
            log.warn('a Aki não vende o Emblema do Guarda; farm de reserva', { err: e.message });
            if (!(await farmEmblem(c, state, st, deadline))) {
              if (Date.now() >= deadline) return 'in-progress';
              await griffArena(c, state, st, step);
              break;
            }
          }
        }
        st.phase = 'handin';
        break;
      }
      case 'handin': {
        await goToStepNpc(c, state, step);
        st.attempts++;
        const ticketSlot = c.findItem(step.ticket);
        if (ticketSlot < 0) { st.phase = 'ticket'; break; }
        // Controle de nível: um abaixo do mínimo, com o item, a NPC recusa e o item fica.
        if (me.level === step.level.min - 1) {
          const low = await talkQuest(c, log, step.npc);
          const ticketKept = c.findItem(step.ticket) >= 0;
          st.belowLevel = { ...low, level: me.level, shownLevel: shownLevel(me.level), ticketKept, ok: !low.teleport && ticketKept };
          if (low.teleport) {
            fail(state, st, step, `${step.npc.name} aceitou o item no nível exibido ${shownLevel(me.level)}, abaixo do mínimo ${shownLevel(step.level.min)}`);
            st.phase = 'reset';
          } else if (!ticketKept) {
            fail(state, st, step, `${step.npc.name} consumiu o item no nível exibido ${shownLevel(me.level)} sem teleportar`);
            st.phase = 'ticket';
            break;
          }
          if (st.phase !== 'reset' && !(await levelTo(c, state, step, step.level.min))) { st.phase = 'done'; break; }
        } else if (!st.belowLevel) {
          st.belowLevel = { t: new Date().toISOString(), npc: step.npc.name, npcId: 0, from: here(c), notices: [], texts: [], clearedSlots: [], level: me.level, shownLevel: shownLevel(me.level), ticketKept: true, ok: true, skipped: `personagem já no nível exibido ${shownLevel(me.level)}` };
        }
        if (st.phase !== 'reset') {
          const slot = c.findItem(step.ticket);
          const talk = await talkQuest(c, log, step.npc);
          st.handin = {
            ...talk,
            level: me.level,
            shownLevel: shownLevel(me.level),
            ticketSlot: slot,
            ticketConsumed: talk.clearedSlots.includes(slot) && c.findItem(step.ticket) < 0,
            inArena: inArena(),
            ok: !!talk.teleport && isInArea(step.area, talk.teleport.to.x, talk.teleport.to.y) && inArena(),
          };
          if (!st.handin.ok) {
            fail(state, st, step, `entregar o item ${step.ticket} no nível exibido ${st.handin.shownLevel} não teleportou para a arena (teleporte: ${talk.teleport ? `${talk.teleport.to.x},${talk.teleport.to.y}` : 'nenhum'}; avisos: ${talk.notices.join(',') || 'nenhum'})`);
            st.phase = 'done';
            break;
          }
          if (!st.handin.ticketConsumed) fail(state, st, step, `${step.npc.name} teleportou mas o item ${step.ticket} continuou no slot ${slot}`);
          progress.save(state);
        }
        st.phase = 'reset';
        await awaitReset(c, state, st, step);
        break;
      }
    }
    progress.save(state);
  }
  return 'done';
}

/** Espera o reset dentro da arena e fecha o veredito do passo. */
async function awaitReset(c: GameClient, state: State, st: StepState, step: QuestStep): Promise<void> {
  const enteredAt = Date.now();
  st.reset = await waitForReset(c, log, {
    enteredAt,
    waitUntil: resetWaitMs !== undefined ? enteredAt + resetWaitMs : resetDeadline(enteredAt),
    safeSpot: safeSpot(step),
    inArea: (x, y) => isInArea(step.area, x, y),
  });
  if (!st.reset.ok) {
    fail(state, st, step, st.reset.kicked
      ? `teleportado da arena para (${st.reset.kicked.to.x},${st.reset.kicked.to.y}), que ainda é dentro da arena`
      : `a quest não resetou: o personagem continuou na arena de ${st.reset.enteredAt} até ${st.reset.waitUntil}${st.reset.died ? ' (morto desde ' + st.reset.died.t + ')' : ''}`);
  }
  if (st.verdict !== 'fail') st.verdict = st.verdict ?? 'pass';
  st.phase = 'done';
}

/** Passo 5 sem o Emblema: entra na arena pelo Mestre Grifo (QuestFlag do nível) e testa o reset. */
async function griffArena(c: GameClient, state: State, st: StepState, step: QuestStep): Promise<void> {
  const me = c.self!;
  st.verdict = 'blocked';
  log.warn('sem o Emblema do Guarda: entrega bloqueada; testando a arena pelo Mestre Grifo', { step: step.step });
  if (me.level < step.level.min && !(await levelTo(c, state, step, step.level.min))) { st.phase = 'done'; return; }
  await returnToArmia(c, log);
  const since = c.mark;
  const talk = await talkQuest(c, log, NPC.mestreGrifo, 8000);
  st.griffEntry = {
    t: talk.t, via: 'Mestre Grifo (_MSG_Quest)', from: talk.from, to: talk.teleport?.to ?? here(c), coinBefore: me.coin, coinAfter: me.coin,
    inArena: isInArea(step.area, me.x, me.y),
  };
  log.info('entrada pelo Mestre Grifo', { ...st.griffEntry, frames: c.framesSince(since).length });
  if (!st.griffEntry.inArena) {
    fail(state, st, step, `o Mestre Grifo não levou para a arena do passo ${step.step} (foi para ${st.griffEntry.to.x},${st.griffEntry.to.y})`);
    st.phase = 'done';
    return;
  }
  st.phase = 'reset';
  await awaitReset(c, state, st, step); // mantém 'blocked' se o reset passar
}

async function runSession(cfg: BotConfig, state: State, deadline: number): Promise<'done' | 'in-progress'> {
  const c = await login(cfg, log);
  try {
    if (adopt && !state.charName) {
      const ch = c.selChars.find((s) => s.name === adopt);
      if (!ch) throw new SessionError(`--adopt: o personagem "${adopt}" não existe na conta`);
      Object.assign(state, { charName: adopt, charClass: cfg.charClass, createdAt: new Date().toISOString(), adopted: true });
      progress.save(state);
    }
    await ensureCharacter(c, state, cfg, log, () => progress.save(state));
    await enterWorld(c, state.charName!, log);
    const me = c.self!;
    clock.start(state.playMs);
    if (me.hp <= 0) await reviveAfterDeath(c, log);

    if (onlyStep !== undefined && state.runsAtStep !== state.runs) {
      const step = stepByNumber(onlyStep);
      if (me.level >= step.level.max) throw new Error(`--step ${onlyStep} exige nível exibido < ${shownLevel(step.level.max)}; está em ${shownLevel(me.level)}`);
      state.current = onlyStep;
      state.steps[onlyStep] = { phase: 'level', attempts: 0, failures: [] };
      state.runsAtStep = state.runs;
    }

    while (state.current <= 5) {
      const step = stepByNumber(state.current);
      if ((await runStep(c, state, step, deadline)) === 'in-progress') return 'in-progress';
      const st = stepState(state, step.step);
      log.info('passo concluído', { step: step.step, quest: step.quest, verdict: st.verdict, failures: st.failures });
      if (onlyStep !== undefined) { state.current = 6; break; }
      state.current++;
      progress.save(state);
      if (!isInArmia(me.x, me.y)) await returnToArmia(c, log);
    }
    if (state.verdict !== 'fail') state.verdict = 'pass';
    return 'done';
  } finally {
    if (clock.running) state.playMs = clock.stop();
    progress.save(state);
    c.close();
  }
}

async function main(): Promise<number> {
  const cfg = loadConfig();
  let state = progress.load();

  if (flag('--cleanup') || flag('--fresh')) {
    // Personagem adotado não é apagado: só o estado do cenário.
    if (state.adopted) progress.clear();
    else await cleanupScenario(cfg, state, progress, log);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  if (onlyStep !== undefined && !state.charName && !adopt) throw new Error('--step exige um personagem já criado (rode o cenário antes ou use --adopt)');
  if (state.current > 5 && onlyStep === undefined) {
    log.info('cenário já concluído; use --step N para repetir um passo, ou --fresh para recomeçar', { verdict: state.verdict });
    writeReport(state, { reused: true });
    return state.verdict === 'fail' ? 1 : 0;
  }
  if (onlyStep !== undefined) {
    state.failures = [];
    state.verdict = undefined;
  }

  state.runs++;
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + budgetMs;
  const { outcome, error } = await runWithReconnect(log, deadline, () => runSession(cfg, state, deadline));
  writeReport(state, { startedAt, endedAt: new Date().toISOString(), budget: Number.isFinite(budgetMs) ? `${budgetMs / 60000} min` : 'until-done', outcome, error });

  if (outcome === 'error') return 3;
  if (state.verdict === 'fail') {
    log.error('FALHOU', { failures: state.failures });
    return 1;
  }
  if (outcome === 'in-progress') {
    log.info('em progresso; rode de novo para continuar', { step: state.current, phase: state.steps[state.current]?.phase });
    return 0;
  }
  log.info('PASSOU', { steps: Object.fromEntries(STEPS.map((s) => [s.step, state.steps[s.step]?.verdict])) });
  return 0;
}

runMain(main, log);
