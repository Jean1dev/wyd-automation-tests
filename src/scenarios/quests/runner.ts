// Runner dos casos de uso das quests (docs/quests/NN-*.md). Cada caso roda isolado:
//   1. cria uma conta nova no portal e um personagem novo nela;
//   2. sai para a seleção e semeia a pré-condição direto no banco (personagem deslogado);
//   3. entra no mundo, executa a ação do bot e confere o efeito (slots, posição, flags);
//   4. grava reports/<data>-quest-NN/<ID>.json.
//
// Uso:
//   npm run quest -- 03                 # todos os casos da quest 03, em série
//   npm run quest -- 03 --case CV-06    # um caso (pode repetir --case)
//   npm run quest -- 03 --list          # só lista os casos
//
// Saída: 0 = todos passaram (ou bloqueados) · 1 = algum reprovou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../../client/GameClient.ts';
import { Logger } from '../../client/logger.ts';
import type { BotConfig } from '../../config.ts';
import { signupAccount } from '../../bot/account.ts';
import { createCharacter, enterWorld, login } from '../../bot/session.ts';
import { sleep } from '../../bot/util.ts';
import { type Db, type DbConfig, loadDbConfig, withDb } from '../../db/seed.ts';
import { newCharName, reportDirFor, runMain, writeReportFile } from '../common.ts';
import { QUESTS } from './index.ts';

export type CaseType = 'feliz' | 'controle' | 'borda';
export type CaseStatus = 'passa' | 'reprova' | 'bloqueado' | 'erro';

export interface CaseResult {
  pass: boolean;
  /** O que o caso viu (respostas, slots antes/depois, posições), para o relatório e a issue. */
  evidence: Record<string, unknown>;
  note?: string;
}

export interface CaseCtx {
  log: Logger;
  cfg: BotConfig;
  db: DbConfig;
  char: string;
  /** Cliente no mundo (o runner entra antes de chamar `run`). */
  c: GameClient;
  /** Sai do mundo, semeia de novo pelo banco e volta; devolve o cliente novo. */
  reseed(seed: (db: Db, char: string) => Promise<void>): Promise<GameClient>;
  /** Lê o banco (para conferir o que o servidor salvou, depois de um relogin). */
  query<T>(fn: (db: Db, char: string) => Promise<T>): Promise<T>;
  /** Reconecta sem mexer no banco (ex.: conferir o que persiste no relogin). */
  relog(): Promise<GameClient>;
}

export interface QuestCase {
  id: string;
  title: string;
  type: CaseType;
  /** Classe do personagem novo: 0 TK, 1 FM, 2 BM, 3 HT. Padrão 0. */
  charClass?: number;
  /** Motivo, quando o caso não dá para rodar (vira status "bloqueado" sem conectar). */
  blocked?: string;
  /** Pré-condição gravada no banco antes de entrar no mundo. */
  seed?: (db: Db, char: string) => Promise<void>;
  run?: (ctx: CaseCtx) => Promise<CaseResult>;
  /** Tempo máximo do caso (padrão 10 min). */
  timeoutMs?: number;
}

export interface QuestSpec {
  id: string;
  name: string;
  cases: QuestCase[];
}

export interface CaseReport {
  quest: string;
  id: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  startedAt: string;
  finishedAt: string;
  account?: string;
  char?: string;
  note?: string;
  error?: string;
  evidence?: Record<string, unknown>;
}

/** Espera o servidor salvar o personagem depois de sair (o logout grava por cima do banco). */
const SAVE_GRACE_MS = 6000;

async function enter(cfg: BotConfig, char: string, log: Logger): Promise<GameClient> {
  const c = await login(cfg, log);
  await enterWorld(c, char, log);
  return c;
}

export async function runCase(quest: QuestSpec, k: QuestCase, dir: string, log: Logger): Promise<CaseReport> {
  const rep: CaseReport = { quest: quest.id, id: k.id, title: k.title, type: k.type, status: 'erro', startedAt: new Date().toISOString(), finishedAt: '' };
  const clog = log.child(k.id);
  clog.setFile(join(dir, `${k.id}.events.jsonl`));
  if (k.blocked || !k.run) {
    rep.status = 'bloqueado';
    rep.note = k.blocked ?? 'caso sem implementação';
    rep.finishedAt = new Date().toISOString();
    writeReportFile(join(dir, k.id), rep, clog);
    return rep;
  }

  const db = loadDbConfig();
  let c: GameClient | undefined;
  let timer: NodeJS.Timeout | undefined;
  try {
    const acc = await signupAccount();
    const cfg: BotConfig = {
      target: process.env.WYD_TARGET?.trim() || 'reseau.proxy.rlwy.net:56950',
      clientVersion: Number(process.env.WYD_CLIENT_VERSION ?? 12000),
      ...acc,
      charPrefix: process.env.WYD_CHAR_PREFIX?.trim() || 'bot',
      charClass: k.charClass ?? 0,
    };
    const char = newCharName(cfg.charPrefix);
    rep.account = acc.account;
    rep.char = char;
    clog.info('conta nova', { account: acc.account, char });

    // Criação na seleção: o personagem nunca entrou no mundo, então não há save de logout pendente.
    const sel = await login(cfg, clog);
    await createCharacter(sel, char, cfg.charClass, clog);
    sel.close();
    if (k.seed) await withDb(db, (d) => k.seed!(d, char));
    c = await enter(cfg, char, clog);

    const ctx: CaseCtx = {
      log: clog,
      cfg,
      db,
      char,
      c,
      reseed: async (seed) => {
        c!.close();
        await sleep(SAVE_GRACE_MS);
        await withDb(db, (d) => seed(d, char));
        c = await enter(cfg, char, clog);
        ctx.c = c;
        return c;
      },
      query: (fn) => withDb(db, (d) => fn(d, char)),
      relog: async () => {
        c!.close();
        await sleep(SAVE_GRACE_MS);
        c = await enter(cfg, char, clog);
        ctx.c = c;
        return c;
      },
    };
    const limit = k.timeoutMs ?? 10 * 60_000;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`caso passou do tempo máximo (${limit / 60000} min)`)), limit); });
    const r = await Promise.race([k.run(ctx), timeout]);
    rep.status = r.pass ? 'passa' : 'reprova';
    rep.evidence = r.evidence;
    rep.note = r.note;
  } catch (e) {
    rep.error = e instanceof Error ? e.message : String(e);
    clog.error('caso interrompido', { err: e instanceof Error ? e.stack : rep.error });
  } finally {
    if (timer) clearTimeout(timer);
    c?.close();
  }
  rep.finishedAt = new Date().toISOString();
  clog.info('resultado', { id: k.id, status: rep.status, note: rep.note, error: rep.error });
  writeReportFile(join(dir, k.id), rep, clog);
  return rep;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const qid = argv.find((a) => /^\d{2}$/.test(a));
  const log = new Logger('quest');
  if (!qid || !QUESTS[qid]) {
    log.error('uso: npm run quest -- NN [--case ID]... [--list]', { quests: Object.keys(QUESTS) });
    return 3;
  }
  const quest = await QUESTS[qid]();
  const wanted = argv.flatMap((a, i) => (a === '--case' ? [argv[i + 1]] : []));
  const cases = wanted.length ? quest.cases.filter((k) => wanted.includes(k.id)) : quest.cases;
  if (argv.includes('--list')) {
    for (const k of quest.cases) console.log(`${k.id}\t${k.type}\t${k.blocked ? 'bloqueado' : k.run ? 'ok' : 'sem implementação'}\t${k.title}`);
    return 0;
  }
  const missing = wanted.filter((w) => !quest.cases.some((k) => k.id === w));
  if (missing.length) {
    log.error('casos inexistentes', { missing });
    return 3;
  }

  const dir = reportDirFor(`quest-${qid}`);
  const reports: CaseReport[] = [];
  for (const k of cases) reports.push(await runCase(quest, k, dir, log));
  const summary = { quest: qid, name: quest.name, cases: reports.map(({ id, status, note, error }) => ({ id, status, note, error })) };
  writeReportFile(join(dir, 'summary'), summary, log);
  for (const r of reports) console.log(`${r.id}\t${r.status}${r.note ? `\t${r.note}` : ''}${r.error ? `\terro: ${r.error}` : ''}`);
  if (reports.some((r) => r.status === 'erro')) return 3;
  return reports.some((r) => r.status === 'reprova') ? 1 : 0;
}

if (process.argv[1]?.endsWith('runner.ts')) runMain(main, new Logger('quest'));
