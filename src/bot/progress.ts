// Estado persistido de um cenário longo (state/<cenário>.json, fora do Git), para que
// cada execução retome de onde a anterior parou.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

export class Progress<T extends object> {
  readonly file: string;
  constructor(scenario: string, private readonly initial: () => T) {
    this.file = join(ROOT, 'state', `${scenario}.json`);
  }

  exists(): boolean {
    return existsSync(this.file);
  }

  load(): T {
    if (!this.exists()) return this.initial();
    return { ...this.initial(), ...(JSON.parse(readFileSync(this.file, 'utf8')) as T) };
  }

  save(state: T): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
    renameSync(tmp, this.file);
  }

  clear(): void {
    rmSync(this.file, { force: true });
  }
}

export const REPORTS_DIR = join(ROOT, 'reports');
