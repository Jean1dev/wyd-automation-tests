// Cenário 2: Quest do Coveiro. Cria um personagem, leva ele ao nível exibido 40 (grind no
// Campo de Treino até juntar gold para a Poeira de Fada, que dá +1 nível por uso), compra a
// Vela do Coveiro na Aki e entrega ao Coveiro. Verifica que:
//   A) a entrega teleporta o personagem para dentro da arena da quest;
//   B) o reset da quest teleporta o personagem de volta para a cidade.
// Antes da entrega, dois controles: sem a vela o Coveiro não teleporta, e quem entra na arena
// a pé (sem QuestFlag) é mandado de volta para a cidade.
//
// O legado reseta a arena a cada 10 min contados do boot do servidor (ProcessSecMinTimer.cpp:560).
// O bot espera até o maior entre entrada + 12 min e a próxima hh:00 + 2 min (ou --reset-wait).
// A arena tem Aparição (nv 98) e Esqueleto (nv 84): o bot espera no canto mais longe dos
// spawns e, se morrer, fica morto lá dentro sem reviver. O reset legado também revive e manda
// de volta quem está morto na arena (ClearAreaQuest, Server.cpp:6263).
//
// É retomável: o estado fica em state/coveiro-quest.json. A espera do reset não é: se a conexão
// cair dentro da arena, a tentativa recomeça na compra da vela (o QuestFlag não sobrevive ao relogin).
//
// Uso:
//   npm run scenario:coveiro                       # até 60 min nesta execução (a espera do reset vai até o fim)
//   npm run scenario:coveiro -- --until-done
//   npm run scenario:coveiro -- --phase handin     # repete vela + entrega + reset (exige nível exibido ≥ 40)
//   npm run scenario:coveiro -- --reset-wait 20m   # espera fixa pelo reset depois da entrada
//   npm run scenario:coveiro -- --fresh | --cleanup
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { grindUntil, type LevelUpRecord } from '../bot/grind.ts';
import { walkPath, walkTo } from '../bot/movement.ts';
import { buyItem, talkQuest, type Purchase, type QuestTalk } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { probeIntruder, useDustUntil, waitForReset, type DustUse, type IntruderProbe, type ResetWait } from '../bot/quest.ts';
import { enterWorld, login } from '../bot/session.ts';
import { spendStatPoints } from '../bot/stats.ts';
import { reviveAfterDeath } from '../bot/survival.ts';
import { shownLevel } from '../bot/util.ts';
import {
  ARENA_SAFE_SPOT, FAIRY_DUST_PRICE, INTRUDER_PROBE, isInCoveiroArea, ITEM, NPC, QUEST_LEVEL, resetDeadline, ROUTE_TO_ARMIA, ROUTE_TO_COVEIRO,
} from '../world/coveiro.ts';
import { isInTrainingField, ROUTE } from '../world/trainingField.ts';
import {
  cleanupScenario, ensureCharacter, flag, opt, parseDuration, PlayClock, reportDirFor, runMain, runWithReconnect, writeReportFile,
  type CharacterState,
} from './common.ts';

const SCENARIO = 'coveiro-quest';
/** Nível ARMAZENADO equivalente ao exibido 40, o mínimo do Coveiro. */
const LEVEL_40 = QUEST_LEVEL.min;
/** Tentativas de entrega + espera do reset antes de desistir (queda de conexão na arena). */
const MAX_ATTEMPTS = 3;
/** Armia vai até x 2171; a leste disso o personagem está na rota do Coveiro. */
const ARMIA_MAX_X = 2171;

type Phase = 'level40' | 'controls' | 'candle' | 'handin' | 'reset' | 'done';

interface Handin extends QuestTalk {
  level: number;
  shownLevel: number;
  candleSlot: number;
  candleConsumed: boolean;
  inArena: boolean;
  ok: boolean;
}

interface State extends CharacterState {
  scenario: string;
  phase: Phase;
  runs: number;
  playMs: number;
  levelUps: LevelUpRecord[];
  kills: { count: number; byMob: Record<string, { count: number; exp: number }> };
  /** Gold na hora de comprar a Poeira de Fada. */
  coinAtDust?: number;
  dust?: { purchase?: Purchase; uses: DustUse[] };
  controls?: { noCandle?: QuestTalk & { ok: boolean; skipped?: string }; intruder?: IntruderProbe };
  candle?: Purchase & { free: boolean };
  attempts: number;
  /** Execução em que o --phase já foi aplicado (as reconexões da mesma execução não reaplicam). */
  runsAtPhase?: number;
  handin?: Handin;
  reset?: ResetWait;
  verdict?: 'pass' | 'fail';
  failures: string[];
}

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  phase: 'level40',
  runs: 0,
  playMs: 0,
  levelUps: [],
  kills: { count: 0, byMob: {} },
  attempts: 0,
  failures: [],
}));

// ---------------------------------------------------------------- CLI

const budgetMs = flag('--until-done') ? Infinity : parseDuration(opt('--budget') ?? '60m');
const stallMs = parseDuration(opt('--stall') ?? '10m');
const resetWaitMs = opt('--reset-wait') ? parseDuration(opt('--reset-wait')!) : undefined;
const onlyPhase = opt('--phase') as Phase | undefined;
if (onlyPhase && !['controls', 'candle', 'handin'].includes(onlyPhase)) throw new Error(`--phase inválida: ${onlyPhase} (use controls, candle ou handin)`);

const reportDir = reportDirFor(SCENARIO);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));
const clock = new PlayClock();

// ---------------------------------------------------------------- helpers

function fail(state: State, msg: string): void {
  state.failures.push(msg);
  state.verdict = 'fail';
  log.error('verificação falhou', { failure: msg });
}

/** Leva o personagem para Armia, saindo do Campo de Treino ou voltando da rota do Coveiro. */
async function goToArmia(c: GameClient): Promise<void> {
  const me = c.self!;
  if (isInTrainingField(me.x, me.y)) await walkPath(c, [ROUTE.fieldEntry, ROUTE.armiaEdge, ROUTE.armia]);
  else if (me.x > ARMIA_MAX_X) await walkPath(c, ROUTE_TO_ARMIA);
}

/** Leva o personagem de onde estiver até o lado do Coveiro. */
async function goToCoveiro(c: GameClient): Promise<void> {
  const me = c.self!;
  if (isInTrainingField(me.x, me.y)) await walkPath(c, [ROUTE.fieldEntry, ROUTE.armiaEdge, ROUTE.armia]);
  const rest = me.x > ARMIA_MAX_X ? ROUTE_TO_COVEIRO.filter((p) => p.x >= me.x) : ROUTE_TO_COVEIRO;
  await walkPath(c, rest.length ? rest : [NPC.coveiro.stand]);
}

/** Compra a Poeira de Fada na Evolução e usa uma por vez até o nível exibido 40. */
async function levelWithDust(c: GameClient, state: State): Promise<void> {
  const me = c.self!;
  state.dust ??= { uses: [] };
  if (c.findItem(ITEM.poeiraDeFada) < 0) {
    await goToArmia(c);
    state.coinAtDust = me.coin;
    state.dust.purchase = await buyItem(c, log, NPC.evolucao, ITEM.poeiraDeFada);
    progress.save(state);
  }
  const bad = await useDustUntil(c, log, LEVEL_40, async (use) => {
    state.dust!.uses.push(use);
    if (use.ok) await spendStatPoints(c, log);
    progress.save(state);
  });
  if (bad) {
    fail(state, `Poeira de Fada no nível exibido ${shownLevel(bad.from)} levou ao ${shownLevel(bad.to)} (esperado +1)${bad.texts?.length ? `; servidor: ${bad.texts.join(' | ')}` : ''}`);
  }
}

function writeReport(state: State, run: Record<string, unknown>): void {
  writeReportFile(reportDir, {
    scenario: SCENARIO,
    description: 'Upar um personagem novo até o nível exibido 40 (Poeira de Fada), entregar a Vela do Coveiro e verificar o teleporte para a arena e a volta no reset da quest.',
    run,
    character: { name: state.charName, class: state.charClass, createdAt: state.createdAt },
    phase: state.phase,
    verdict: state.verdict ?? 'in-progress',
    failures: state.failures,
    checks: {
      dust: state.dust && { purchase: state.dust.purchase, coinAtPurchase: state.coinAtDust, uses: state.dust.uses },
      noCandle: state.controls?.noCandle,
      intruder: state.controls?.intruder,
      candle: state.candle,
      handin: state.handin,
      reset: state.reset,
    },
    attempts: state.attempts,
    playMinutes: +(state.playMs / 60000).toFixed(1),
    levelCurve: state.levelUps.map((l) => ({ t: l.t, shown: shownLevel(l.to), inTrainingField: l.inTrainingField })),
    kills: state.kills,
  }, log);
}

// ---------------------------------------------------------------- execução

async function runSession(cfg: BotConfig, state: State, deadline: number): Promise<'done' | 'in-progress'> {
  const c = await login(cfg, log);
  try {
    await ensureCharacter(c, state, cfg, log, () => { state.phase = 'level40'; progress.save(state); });
    await enterWorld(c, state.charName!, log);
    const me = c.self!;
    clock.start(state.playMs);
    if (me.hp <= 0) await reviveAfterDeath(c, log);

    if (onlyPhase && state.runsAtPhase !== state.runs) {
      if (me.level < LEVEL_40) throw new Error(`--phase exige nível exibido >= ${LEVEL_40 + 1}; está em ${shownLevel(me.level)}`);
      state.phase = onlyPhase === 'handin' ? 'candle' : onlyPhase;
      state.runsAtPhase = state.runs;
    }
    // A entrega e a espera do reset não sobrevivem ao relogin (o QuestFlag é volátil).
    if (state.phase === 'handin' || state.phase === 'reset') {
      log.warn('tentativa anterior interrompida; recomeçando na compra da vela', { phase: state.phase });
      state.phase = 'candle';
    }

    const onLevelUp = (l: LevelUpRecord) => { state.levelUps.push(l); progress.save(state); };
    const grindOpts = {
      deadline,
      stallMs,
      onKill: (k: { mob: string; expGain: string }) => {
        const b = (state.kills.byMob[k.mob] ??= { count: 0, exp: 0 });
        b.count++; b.exp += Number(k.expGain);
        state.kills.count++;
      },
      onLevelUp,
    };

    while (state.phase !== 'done') {
      log.info('fase', { phase: state.phase, shown: shownLevel(me.level), coin: me.coin, x: me.x, y: me.y });
      switch (state.phase) {
        case 'level40': {
          if (me.level < LEVEL_40 && c.findItem(ITEM.poeiraDeFada) < 0 && me.coin < FAIRY_DUST_PRICE) {
            // Grind até ter gold para a pilha de Poeira de Fada (ou chegar ao 40 jogando).
            const st = await grindUntil(c, log, { ...grindOpts, targetLevel: LEVEL_40, until: () => me.coin >= FAIRY_DUST_PRICE });
            if (st === 'budget') return 'in-progress';
          }
          if (me.level < LEVEL_40) await levelWithDust(c, state);
          if (me.level < LEVEL_40) {
            // A Poeira de Fada falhou (já registrado): chega ao 40 no grind para testar a quest mesmo assim.
            if ((await grindUntil(c, log, { ...grindOpts, targetLevel: LEVEL_40 })) === 'budget') return 'in-progress';
          }
          log.info('nível exibido 40 alcançado', { shown: shownLevel(me.level), coin: me.coin, playMinutes: +(clock.ms() / 60000).toFixed(1) });
          state.phase = 'controls';
          break;
        }
        case 'controls': {
          state.controls ??= {};
          await goToCoveiro(c);
          if (c.findItem(ITEM.velaDoCoveiro) >= 0) {
            state.controls.noCandle = { ...(await talkQuest(c, log, NPC.coveiro)), ok: true, skipped: 'o personagem já tem uma vela' };
            state.phase = 'handin';
            break;
          }
          const noCandle = await talkQuest(c, log, NPC.coveiro);
          state.controls.noCandle = { ...noCandle, ok: !noCandle.teleport };
          if (noCandle.teleport) fail(state, `o Coveiro teleportou sem a Vela do Coveiro para (${noCandle.teleport.to.x},${noCandle.teleport.to.y})`);
          if (!isInCoveiroArea(me.x, me.y)) {
            state.controls.intruder = await probeIntruder(c, log, INTRUDER_PROBE, isInCoveiroArea);
            if (!state.controls.intruder.ok) fail(state, `entrou na arena a pé sem QuestFlag e ficou em (${me.x},${me.y}) sem ser mandado para a cidade`);
          }
          state.phase = 'candle';
          break;
        }
        case 'candle': {
          if (state.attempts >= MAX_ATTEMPTS) throw new Error(`${MAX_ATTEMPTS} tentativas de entrega + reset interrompidas; veja events.jsonl`);
          if (isInCoveiroArea(me.x, me.y)) await walkTo(c, NPC.coveiro.stand.x, NPC.coveiro.stand.y);
          if (c.findItem(ITEM.velaDoCoveiro) < 0) {
            await goToArmia(c);
            const p = await buyItem(c, log, NPC.aki, ITEM.velaDoCoveiro);
            state.candle = { ...p, free: p.coinAfter === p.coinBefore };
            if (!state.candle.free) log.warn('a Vela do Coveiro não saiu de graça', { coinBefore: p.coinBefore, coinAfter: p.coinAfter });
          }
          state.phase = 'handin';
          break;
        }
        case 'handin': {
          await goToCoveiro(c);
          state.attempts++;
          const candleSlot = c.findItem(ITEM.velaDoCoveiro);
          if (candleSlot < 0) { state.phase = 'candle'; break; }
          const talk = await talkQuest(c, log, NPC.coveiro);
          const inArena = isInCoveiroArea(me.x, me.y);
          state.handin = {
            ...talk,
            level: me.level,
            shownLevel: shownLevel(me.level),
            candleSlot,
            candleConsumed: talk.clearedSlots.includes(candleSlot) && c.findItem(ITEM.velaDoCoveiro) < 0,
            inArena,
            ok: !!talk.teleport && isInCoveiroArea(talk.teleport.to.x, talk.teleport.to.y) && inArena,
          };
          if (!state.handin.ok) {
            fail(state, `entregar a Vela do Coveiro no nível exibido ${state.handin.shownLevel} não teleportou para a arena (teleporte: ${talk.teleport ? `${talk.teleport.to.x},${talk.teleport.to.y}` : 'nenhum'}; avisos: ${talk.notices.join(',') || 'nenhum'})`);
            state.phase = 'done';
            break;
          }
          if (!state.handin.candleConsumed) fail(state, `o Coveiro teleportou mas a Vela do Coveiro continuou no slot ${candleSlot}`);
          progress.save(state);
          state.phase = 'reset';
          const enteredAt = Date.now();
          state.reset = await waitForReset(c, log, {
            enteredAt,
            waitUntil: resetWaitMs !== undefined ? enteredAt + resetWaitMs : resetDeadline(enteredAt),
            safeSpot: ARENA_SAFE_SPOT,
            inArea: isInCoveiroArea,
          });
          if (!state.reset.ok) {
            fail(state, state.reset.kicked
              ? `teleportado da arena para (${state.reset.kicked.to.x},${state.reset.kicked.to.y}), que ainda é dentro da arena`
              : `a quest não resetou: o personagem continuou na arena de ${state.reset.enteredAt} até ${state.reset.waitUntil}${state.reset.died ? ' (morto desde ' + state.reset.died.t + ')' : ''}`);
          }
          if (state.verdict !== 'fail') state.verdict = 'pass';
          state.phase = 'done';
          break;
        }
      }
      progress.save(state);
    }
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
    await cleanupScenario(cfg, state, progress, log);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  if (onlyPhase && !state.charName) throw new Error('--phase exige um personagem já criado (rode o cenário antes)');
  if (state.phase === 'done' && !onlyPhase) {
    log.info('cenário já concluído; use --phase handin para repetir a entrega e o reset, ou --fresh para recomeçar', { verdict: state.verdict });
    writeReport(state, { reused: true });
    return state.verdict === 'fail' ? 1 : 0;
  }
  if (onlyPhase) {
    // Repetição de uma fase: o veredito passa a ser só o desta execução.
    state.failures = [];
    state.verdict = undefined;
    state.attempts = 0;
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
    log.info('em progresso; rode de novo para continuar', { phase: state.phase });
    return 0;
  }
  log.info('PASSOU', { handin: state.handin?.ok, reset: state.reset?.kicked });
  return 0;
}

runMain(main, log);
