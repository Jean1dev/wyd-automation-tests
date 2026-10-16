// Cenário 1: criar um personagem, upá-lo no Campo de Treino até o nível exibido 35 jogando
// normalmente, e verificar que depois do 35 ele não consegue mais entrar no campo.
//
// Nível exibido = armazenado + 1. A regra legada (_MSG_Action.cpp:213) barra o campo com
// nível armazenado >= 35, isto é, exibido >= 36: manda a mensagem #46 e teleporta para Armia.
//
// É retomável: o estado fica em state/training-field-lv35.json e cada execução continua a fase.
//
// Uso:
//   npm run scenario:training-field                 # até 60 min nesta execução
//   npm run scenario:training-field -- --budget 2h
//   npm run scenario:training-field -- --until-done
//   npm run scenario:training-field -- --phase negative   # repete só a verificação final
//   npm run scenario:training-field -- --fresh            # apaga personagem/estado e recomeça
//   npm run scenario:training-field -- --cleanup          # apaga personagem/estado e sai
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou (regra violada) · 3 = erro de execução.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameClient, Received } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { grindUntil, StallError, type LevelUpRecord } from '../bot/grind.ts';
import { walkPath } from '../bot/movement.ts';
import { Progress, REPORTS_DIR } from '../bot/progress.ts';
import { createCharacter, deleteCharacter, enterWorld, login, SessionError } from '../bot/session.ts';
import { shownLevel, sleep } from '../bot/util.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { isInTrainingField, isLegacyKickSpot, isNewbieZoneMessage, ROUTE } from '../world/trainingField.ts';

const SCENARIO = 'training-field-lv35';
/** Nível ARMAZENADO equivalente ao exibido 35. */
const LEVEL_35 = 34;
/** Nível ARMAZENADO a partir do qual a regra legada barra o campo (exibido 36). */
const LEVEL_BLOCKED = 35;
/** Ponto bem dentro do campo usado nas tentativas de entrada. */
const PROBE_INSIDE = { x: 2100, y: 2032 };

type Phase = 'grind35' | 'positive' | 'grind36' | 'negative' | 'done';

interface ProbeResult {
  t: string;
  level: number;
  shownLevel: number;
  start: { x: number; y: number };
  final: { x: number; y: number };
  finalInTrainingField: boolean;
  newbieMessage?: string;
  forcedTeleport?: { from: { x: number; y: number }; to: { x: number; y: number }; toLegacyKickSpot: boolean };
  /** O personagem ficou dentro do campo, sem mensagem nem teleporte forçado. */
  entered: boolean;
}

interface LevelTime {
  /** Nível exibido alcançado. */
  shown: number;
  seconds: number;
  /** O nível começou antes desta sessão (reinício/reconexão): a medida cobre só parte dele. */
  partial: boolean;
  /** Tempo de jogo acumulado do personagem ao alcançar o nível. */
  playMinutes: number;
  /** Exp ganha por minuto durante o nível. */
  expPerMin: number;
}

interface BlockSignal {
  t: string;
  level: number;
  kind: 'message' | 'teleport';
  detail: string;
  x: number;
  y: number;
}

interface State {
  scenario: string;
  charName?: string;
  charClass?: number;
  createdAt?: string;
  phase: Phase;
  runs: number;
  levelUps: LevelUpRecord[];
  kills: { count: number; byMob: Record<string, { count: number; exp: number }> };
  /** Sinais de bloqueio (mensagem #46 / teleporte forçado) vistos fora das verificações. */
  blockSignals: BlockSignal[];
  /** Tempo de jogo gasto em cada nível (só conta o tempo conectado). */
  levelTimes: LevelTime[];
  /** Tempo de jogo acumulado (todas as sessões) desde a criação do personagem. */
  playMs: number;
  /** playMs inclui uma estimativa para sessões anteriores à medição. */
  playEstimated?: boolean;
  /** Tempo de jogo até o nível exibido 35, contra a meta (padrão 15 min). */
  timeToLevel35?: { minutes: number; targetMinutes: number; ok: boolean; estimated: boolean };
  positive?: ProbeResult & { skipped?: string };
  negative?: ProbeResult;
  verdict?: 'pass' | 'fail';
  failure?: string;
}

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  phase: 'grind35',
  runs: 0,
  levelUps: [],
  kills: { count: 0, byMob: {} },
  blockSignals: [],
  levelTimes: [],
  playMs: 0,
}));

// ---------------------------------------------------------------- CLI

function parseDuration(s: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(h|m|s)?$/.exec(s.trim());
  if (!m) throw new Error(`duração inválida: ${s}`);
  const n = Number(m[1]);
  return n * (m[2] === 'h' ? 3_600_000 : m[2] === 's' ? 1000 : 60_000);
}

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const budgetMs = flag('--until-done') ? Infinity : parseDuration(opt('--budget') ?? '60m');
const stallMs = parseDuration(opt('--stall') ?? '10m');
/** Meta de tempo de jogo para ir do nível exibido 1 ao 35 no campo. */
const targetTimeMs = parseDuration(opt('--target-time') ?? '15m');
const onlyPhase = opt('--phase') as Phase | undefined;

const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = join(REPORTS_DIR, `${runStamp}-${SCENARIO}`);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));

// ---------------------------------------------------------------- helpers

function newCharName(prefix: string): string {
  const base = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'bot';
  const rnd = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 12 - base.length);
  return (base + rnd).slice(0, 12).padEnd(4, '0');
}

function newbieMessageIn(frames: Received[]): string | undefined {
  for (const f of frames) {
    if (f.header.type !== Op.MessagePanel && f.header.type !== Op.MessageChat) continue;
    const text = P.parseText(f.body);
    if (isNewbieZoneMessage(text)) return text;
  }
  return undefined;
}

function forcedTeleportIn(c: GameClient, frames: Received[]): ProbeResult['forcedTeleport'] {
  const me = c.self!;
  for (const f of frames) {
    if (f.header.type !== Op.Action || f.header.id !== me.clientId || f.body.length < 40) continue;
    const a = P.parseAction(f.body);
    if (a.effect !== 1) continue;
    return { from: { x: a.posX, y: a.posY }, to: { x: a.targetX, y: a.targetY }, toLegacyKickSpot: isLegacyKickSpot(a.targetX, a.targetY) };
  }
  return undefined;
}

/** Sai do campo para Armia (se estiver dentro) e tenta entrar de novo, observando a reação do servidor. */
async function probeEntry(c: GameClient, label: string): Promise<ProbeResult> {
  const me = c.self!;
  if (isInTrainingField(me.x, me.y)) {
    log.info(`${label}: saindo do campo para Armia`, { x: me.x, y: me.y });
    await walkPath(c, [ROUTE.fieldEntry, ROUTE.armiaEdge, ROUTE.armia]);
  } else {
    await walkPath(c, [ROUTE.armia]);
  }
  await sleep(3000);
  const start = { x: me.x, y: me.y };
  const mark = c.mark;
  let teleported = false;
  const onTp = () => { teleported = true; };
  c.on('teleport', onTp);
  log.info(`${label}: tentando entrar no campo`, { level: me.level, shown: shownLevel(me.level), from: start, to: PROBE_INSIDE });
  try {
    await walkPath(c, [ROUTE.armiaEdge, ROUTE.fieldEntry, PROBE_INSIDE], { abort: () => teleported });
    await sleep(5000); // tempo para a mensagem/teleporte chegarem
  } finally {
    c.off('teleport', onTp);
  }
  const frames = c.framesSince(mark);
  const msg = newbieMessageIn(frames);
  const tp = forcedTeleportIn(c, frames);
  const final = { x: me.x, y: me.y };
  const finalIn = isInTrainingField(final.x, final.y);
  const r: ProbeResult = {
    t: new Date().toISOString(),
    level: me.level,
    shownLevel: shownLevel(me.level),
    start,
    final,
    finalInTrainingField: finalIn,
    newbieMessage: msg,
    forcedTeleport: tp,
    entered: finalIn && !msg && !tp,
  };
  log.info(`${label}: resultado`, r as unknown as Record<string, unknown>);
  return r;
}

function writeReport(state: State, run: Record<string, unknown>): void {
  mkdirSync(reportDir, { recursive: true });
  const levels = state.levelUps;
  const report = {
    scenario: SCENARIO,
    description: 'Criar personagem, upar no Campo de Treino até o nível exibido 35 e verificar que depois do 35 ele não entra mais no campo.',
    run,
    character: { name: state.charName, class: state.charClass, createdAt: state.createdAt },
    phase: state.phase,
    verdict: state.verdict ?? 'in-progress',
    failure: state.failure,
    checks: { positive: state.positive, negative: state.negative },
    blockSignals: state.blockSignals,
    levelCurve: levels.map((l) => ({ t: l.t, shown: shownLevel(l.to), inTrainingField: l.inTrainingField, x: l.x, y: l.y })),
    kills: state.kills,
    timeToLevel35: state.timeToLevel35 ?? {
      reached: false,
      playMinutesSoFar: +(state.playMs / 60000).toFixed(1),
      targetMinutes: targetTimeMs / 60000,
      ok: state.playMs <= targetTimeMs ? 'pending' : false,
      estimated: !!state.playEstimated,
    },
    levelTimes: state.levelTimes,
  };
  writeFileSync(join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  log.info('relatório gravado', { dir: reportDir });
}

// ---------------------------------------------------------------- execução

async function cleanup(cfg: BotConfig, state: State): Promise<void> {
  if (state.charName) {
    const c = await login(cfg, log);
    try {
      await deleteCharacter(c, state.charName, cfg.password, log);
    } finally {
      c.close();
    }
  }
  progress.clear();
  log.info('personagem e estado removidos', { char: state.charName });
}

/** Uma sessão de jogo: entra e avança as fases até concluir ou estourar o orçamento. */
async function runSession(cfg: BotConfig, state: State, deadline: number): Promise<'done' | 'in-progress'> {
  const c = await login(cfg, log);
  try {
    if (!state.charName) {
      const name = newCharName(cfg.charPrefix);
      await createCharacter(c, name, cfg.charClass, log);
      Object.assign(state, { charName: name, charClass: cfg.charClass, createdAt: new Date().toISOString(), phase: 'grind35' as Phase });
      progress.save(state);
      const created = c.selChars.find((s) => s.name === name)!;
      if (created.level !== 0) throw new Error(`personagem novo com nível armazenado ${created.level} (esperado 0 = exibido 1)`);
    }
    if (!c.selChars.some((s) => s.name === state.charName)) {
      throw new SessionError(`personagem "${state.charName}" não existe mais na conta; rode com --fresh`);
    }
    await enterWorld(c, state.charName!, log);
    const me = c.self!;
    // Sessões anteriores à medição de tempo: estima pelo intervalo criação → último level up.
    if (!state.playMs && state.levelUps.length && state.createdAt) {
      state.playMs = Date.parse(state.levelUps.at(-1)!.t) - Date.parse(state.createdAt);
      state.playEstimated = true;
    }
    sessionStartedAt = Date.now();
    playBase = state.playMs;

    if (onlyPhase) {
      if (onlyPhase === 'negative' && me.level < LEVEL_BLOCKED) throw new Error(`--phase negative exige nível exibido >= ${LEVEL_BLOCKED + 1}; está em ${shownLevel(me.level)}`);
      state.phase = onlyPhase;
    }

    // Sinais de bloqueio fora das verificações: antes do 36 são falha (trava cedo demais);
    // depois do 36 dentro do campo são a trava funcionando.
    const onText = (e: { text: string }) => {
      if (!isNewbieZoneMessage(e.text)) return;
      state.blockSignals.push({ t: new Date().toISOString(), level: me.level, kind: 'message', detail: e.text, x: me.x, y: me.y });
      log.warn('mensagem do Campo de Treino recebida', { text: e.text, shown: shownLevel(me.level) });
    };
    const onTp = (e: { from: { x: number; y: number }; to: { x: number; y: number } }) => {
      state.blockSignals.push({ t: new Date().toISOString(), level: me.level, kind: 'teleport', detail: `${e.from.x},${e.from.y} → ${e.to.x},${e.to.y}`, x: e.to.x, y: e.to.y });
      log.warn('teleporte forçado pelo servidor', { ...e, shown: shownLevel(me.level) });
    };
    c.on('text', onText);
    c.on('teleport', onTp);

    const grindOpts = {
      deadline,
      stallMs,
      onKill: (k: { mob: string; expGain: string }) => {
        const b = (state.kills.byMob[k.mob] ??= { count: 0, exp: 0 });
        b.count++; b.exp += Number(k.expGain);
        state.kills.count++;
      },
      onLevelUp: (l: LevelUpRecord) => {
        state.levelUps.push(l);
        const now = Date.now();
        const seconds = Math.round((now - levelStartedAt) / 1000);
        const lt: LevelTime = {
          shown: shownLevel(l.to),
          seconds,
          partial: levelPartial,
          playMinutes: +(playMs() / 60000).toFixed(1),
          expPerMin: Math.round(Number(BigInt(l.exp) - levelStartExp) / Math.max(1, seconds / 60)),
        };
        state.levelTimes.push(lt);
        log.info('tempo do nível', { ...lt, minutes: +(seconds / 60).toFixed(1) });
        if (l.to >= LEVEL_35 && !state.timeToLevel35) {
          const minutes = +(playMs() / 60000).toFixed(1);
          state.timeToLevel35 = { minutes, targetMinutes: targetTimeMs / 60000, ok: playMs() <= targetTimeMs, estimated: !!state.playEstimated };
          log[state.timeToLevel35.ok ? 'info' : 'warn']('nível exibido 35 alcançado', state.timeToLevel35 as unknown as Record<string, unknown>);
        }
        levelStartedAt = now;
        levelStartExp = BigInt(l.exp);
        levelPartial = false;
        progress.save(state);
      },
    };
    // Mede o tempo de cada nível a partir da entrada no mundo (nível parcial) ou do level up anterior.
    let levelStartedAt = Date.now();
    let levelStartExp = me.exp;
    let levelPartial = true;
    let warnedTarget = playMs() > targetTimeMs;
    const targetTimer = setInterval(() => {
      if (!warnedTarget && !state.timeToLevel35 && playMs() > targetTimeMs) {
        warnedTarget = true;
        log.warn('meta de tempo até o nível exibido 35 estourada', { targetMinutes: targetTimeMs / 60000, shown: shownLevel(me.level), exp: me.exp });
      }
    }, 30_000);
    targetTimer.unref();
    c.once('close', () => clearInterval(targetTimer));

    while (state.phase !== 'done') {
      log.info('fase', { phase: state.phase, shown: shownLevel(me.level), exp: me.exp });
      switch (state.phase) {
        case 'grind35': {
          if ((await grindUntil(c, log, { ...grindOpts, targetLevel: LEVEL_35 })) === 'budget') return 'in-progress';
          const early = state.blockSignals.filter((s) => s.level < LEVEL_BLOCKED && s.kind === 'message');
          if (early.length) {
            state.verdict = 'fail';
            state.failure = `o campo barrou o personagem antes do nível exibido 36 (exibido ${shownLevel(early[0].level)})`;
          }
          state.phase = 'positive';
          break;
        }
        case 'positive': {
          if (me.level > LEVEL_35) {
            state.positive = { ...(await probeEntry(c, 'controle positivo')), skipped: `nível já passou do exibido 35 (${shownLevel(me.level)})` };
          } else {
            state.positive = await probeEntry(c, 'controle positivo');
            if (!state.positive.entered) {
              state.verdict = 'fail';
              state.failure = `com nível exibido ${state.positive.shownLevel} o personagem não conseguiu entrar no campo`;
            }
          }
          state.phase = 'grind36';
          break;
        }
        case 'grind36': {
          if ((await grindUntil(c, log, { ...grindOpts, targetLevel: LEVEL_BLOCKED })) === 'budget') return 'in-progress';
          await sleep(3000);
          state.phase = 'negative';
          break;
        }
        case 'negative': {
          state.negative = await probeEntry(c, 'controle negativo');
          if (state.negative.entered) {
            state.verdict = 'fail';
            state.failure = `trava do Campo de Treino ausente: personagem com nível exibido ${state.negative.shownLevel} entrou em (${state.negative.final.x},${state.negative.final.y}) sem mensagem nem teleporte`;
          } else if (state.verdict !== 'fail') {
            state.verdict = 'pass';
          }
          state.phase = 'done';
          break;
        }
      }
      progress.save(state);
    }
    return 'done';
  } finally {
    if (sessionStartedAt) state.playMs = playMs();
    sessionStartedAt = 0;
    progress.save(state);
    c.close();
  }
}

// Relógio de jogo: tempo acumulado das sessões anteriores + o da sessão atual.
let sessionStartedAt = 0;
let playBase = 0;
const playMs = () => playBase + (sessionStartedAt ? Date.now() - sessionStartedAt : 0);

async function main(): Promise<number> {
  const cfg = loadConfig();
  let state = progress.load();

  if (flag('--cleanup') || flag('--fresh')) {
    await cleanup(cfg, state);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  if (onlyPhase && !state.charName) throw new Error('--phase exige um personagem já criado (rode o cenário antes)');
  if (state.phase === 'done' && !onlyPhase) {
    log.info('cenário já concluído; use --phase negative para repetir a verificação ou --fresh para recomeçar', { verdict: state.verdict });
    writeReport(state, { reused: true });
    return state.verdict === 'fail' ? 1 : 0;
  }

  state.runs++;
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + budgetMs;
  let outcome: 'done' | 'in-progress' | 'error' = 'error';
  let error: string | undefined;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      outcome = await runSession(cfg, state, deadline);
      break;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      const fatal = e instanceof StallError || e instanceof SessionError || /exige|não existe|inválid/.test(error);
      log.error('sessão interrompida', { err: error, attempt, fatal });
      if (fatal || attempt === 6 || Date.now() >= deadline) break;
      await sleep(10_000 * attempt);
      log.info('reconectando');
    }
  }
  writeReport(state, { startedAt, endedAt: new Date().toISOString(), budget: Number.isFinite(budgetMs) ? `${budgetMs / 60000} min` : 'until-done', outcome, error });

  if (outcome === 'error') return 3;
  if (state.verdict === 'fail') {
    log.error('FALHOU', { failure: state.failure });
    return 1;
  }
  if (outcome === 'in-progress') {
    log.info('em progresso; rode de novo para continuar', { phase: state.phase, shown: state.levelUps.at(-1) ? shownLevel(state.levelUps.at(-1)!.to) : 1 });
    return 0;
  }
  log.info('PASSOU', { positive: state.positive?.entered, negativeBlocked: !state.negative?.entered });
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    log.error('erro', { err: e instanceof Error ? e.stack : String(e) });
    process.exit(3);
  },
);
