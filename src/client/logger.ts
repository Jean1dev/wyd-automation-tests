// Log JSON por linha (stdout + arquivo opcional), sanitizado: senha e PIN nunca são gravados.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEYS = /pass|pin|token|secret/i;

function sanitize(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = SECRET_KEYS.test(k) ? '***' : sanitize(x);
    return out;
  }
  return v;
}

export class Logger {
  private file?: string;
  constructor(private readonly scope: string, private readonly minLevel: Level = 'info', file?: string) {
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      this.file = file;
    }
  }

  child(scope: string): Logger {
    const l = new Logger(`${this.scope}:${scope}`, this.minLevel);
    l.file = this.file;
    return l;
  }

  setFile(file: string): void {
    mkdirSync(dirname(file), { recursive: true });
    this.file = file;
  }

  log(level: Level, msg: string, data?: Record<string, unknown>): void {
    const order: Level[] = ['debug', 'info', 'warn', 'error'];
    const line = JSON.stringify({ t: new Date().toISOString(), lvl: level, scope: this.scope, msg, ...(sanitize(data ?? {}) as object) });
    if (this.file) appendFileSync(this.file, line + '\n');
    if (order.indexOf(level) >= order.indexOf(this.minLevel)) {
      (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
    }
  }

  debug(msg: string, data?: Record<string, unknown>) { this.log('debug', msg, data); }
  info(msg: string, data?: Record<string, unknown>) { this.log('info', msg, data); }
  warn(msg: string, data?: Record<string, unknown>) { this.log('warn', msg, data); }
  error(msg: string, data?: Record<string, unknown>) { this.log('error', msg, data); }
}
