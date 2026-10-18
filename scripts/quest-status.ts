// Recalcula a tabela "Resumo" de docs/quests/STATUS.md a partir das linhas de caso de cada quest.
// Cada commit de caso edita só a linha do caso e roda: npm run quest:status
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(import.meta.dirname, '..', 'docs', 'quests', 'STATUS.md');
const MARKS = ['✅', '❌', '⏸️', '⏳'] as const;

const text = readFileSync(FILE, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);

// Conta os resultados por quest (seções "## NN — ...").
const counts = new Map<string, Record<(typeof MARKS)[number], number>>();
let quest: string | undefined;
for (const l of lines) {
  const h = /^## (\d\d) — /.exec(l);
  if (h) {
    quest = h[1];
    counts.set(quest, { '✅': 0, '❌': 0, '⏸️': 0, '⏳': 0 });
    continue;
  }
  if (!quest || !/^\| [A-Z0-9]+-\d+[a-z]? \|/.test(l)) continue;
  const result = l.split('|')[4]?.trim() ?? '';
  const mark = MARKS.find((m) => result.startsWith(m));
  if (!mark) throw new Error(`resultado inválido na quest ${quest}: ${l}`);
  counts.get(quest)![mark]++;
}

const total = { '✅': 0, '❌': 0, '⏸️': 0, '⏳': 0 };
const out = lines.map((l) => {
  const row = /^\| \[(\d\d)\]\(#\d\d\) \| ([^|]+) \|/.exec(l);
  if (row) {
    const c = counts.get(row[1]);
    if (!c) return l;
    for (const m of MARKS) total[m] += c[m];
    const n = MARKS.reduce((s, m) => s + c[m], 0);
    return `| [${row[1]}](#${row[1]}) | ${row[2].trim()} | ${n} | ${MARKS.map((m) => c[m]).join(' | ')} |`;
  }
  if (l.startsWith('| | **Total** |')) {
    const n = MARKS.reduce((s, m) => s + total[m], 0);
    return `| | **Total** | **${n}** | ${MARKS.map((m) => `**${total[m]}**`).join(' | ')} |`;
  }
  return l;
});
writeFileSync(FILE, out.join(eol));
console.log(MARKS.map((m) => `${m} ${total[m]}`).join(' · '));
