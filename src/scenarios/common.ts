// Peças comuns dos cenários: linha de comando, personagem do cenário, relógio de jogo,
// sessões com reconexão, limpeza e gravação do relatório.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import type { BotConfig } from '../config.ts';
import { StallError } from '../bot/grind.ts';
import { REPORTS_DIR, type Progress } from '../bot/progress.ts';
import { createCharacter, deleteCharacter, login, SessionError } from '../bot/session.ts';
import { sleep } from '../bot/util.ts';

// ---------------------------------------------------------------- CLI

export function parseDuration(s: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(h|m|s)?$/.exec(s.trim());
  if (!m) throw new Error(`duração inválida: ${s}`);
  const n = Number(m[1]);
  return n * (m[2] === 'h' ? 3_600_000 : m[2] === 's' ? 1000 : 60_000);
}

const argv = process.argv.slice(2);
export const flag = (f: string) => argv.includes(f);
export const opt = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

/** Pasta do relatório desta execução: reports/<data>-<cenário>/. */
export function reportDirFor(scenario: string): string {
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(REPORTS_DIR, `${runStamp}-${scenario}`);
}

export function writeReportFile(dir: string, report: object, log: Logger): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
  log.info('relatório gravado', { dir });
}

// ---------------------------------------------------------------- personagem

export interface CharacterState {
  charName?: string;
  charClass?: number;
  createdAt?: string;
}

export function newCharName(prefix: string): string {
  const base = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'bot';
  const rnd = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 12 - base.length);
  return (base + rnd).slice(0, 12).padEnd(4, '0');
}

/**
 * Cria o personagem do cenário na primeira sessão (chamando `onCreated` para salvar o estado
 * antes de qualquer outra coisa) e confere que ele ainda existe nas seguintes.
 */
export async function ensureCharacter(c: GameClient, state: CharacterState, cfg: BotConfig, log: Logger, onCreated: () => void): Promise<void> {
  if (!state.charName) {
    const name = newCharName(cfg.charPrefix);
    await createCharacter(c, name, cfg.charClass, log);
    Object.assign(state, { charName: name, charClass: cfg.charClass, createdAt: new Date().toISOString() });
    onCreated();
    const created = c.selChars.find((s) => s.name === name)!;
    if (created.level !== 0) throw new Error(`personagem novo com nível armazenado ${created.level} (esperado 0 = exibido 1)`);
  }
  if (!c.selChars.some((s) => s.name === state.charName)) {
    throw new SessionError(`personagem "${state.charName}" não existe mais na conta; rode com --fresh`);
  }
}

/** Apaga o personagem do cenário e o estado salvo. */
export async function cleanupScenario(cfg: BotConfig, state: CharacterState, progress: Progress<object>, log: Logger): Promise<void> {
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

// ---------------------------------------------------------------- execução

/** Relógio de jogo: tempo acumulado das sessões anteriores + o da sessão atual. */
export class PlayClock {
  private base = 0;
  private startedAt = 0;

  start(base: number): void {
    this.base = base;
    this.startedAt = Date.now();
  }

  get running(): boolean {
    return this.startedAt !== 0;
  }

  ms(): number {
    return this.base + (this.startedAt ? Date.now() - this.startedAt : 0);
  }

  /** Para o relógio e devolve o total acumulado. */
  stop(): number {
    const total = this.ms();
    this.base = total;
    this.startedAt = 0;
    return total;
  }
}

export type Outcome = 'done' | 'in-progress' | 'error';

/**
 * Roda sessões até a fase final, reconectando (até 6 tentativas, com espera crescente) quando a
 * conexão cai. Stall, recusa de sessão e erros de uso (`exige`, `não existe`, `inválid`) param na hora.
 */
export async function runWithReconnect(log: Logger, deadline: number, session: () => Promise<'done' | 'in-progress'>): Promise<{ outcome: Outcome; error?: string }> {
  let error: string | undefined;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return { outcome: await session(), error };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      const fatal = e instanceof StallError || e instanceof SessionError || /exige|não existe|inválid/.test(error);
      log.error('sessão interrompida', { err: error, attempt, fatal });
      if (fatal || attempt === 6 || Date.now() >= deadline) break;
      await sleep(10_000 * attempt);
      log.info('reconectando');
    }
  }
  return { outcome: 'error', error };
}

/** Ponto de entrada: converte o código de saída e trata erro inesperado como execução quebrada (3). */
export function runMain(main: () => Promise<number>, log: Logger): void {
  main().then(
    (code) => process.exit(code),
    (e) => {
      log.error('erro', { err: e instanceof Error ? e.stack : String(e) });
      process.exit(3);
    },
  );
}
