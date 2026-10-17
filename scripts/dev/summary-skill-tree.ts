// Resumo do estado de um cenário de árvore de skills (state/<cenário>.json) para conferir à mão.
// Uso: npx tsx scripts/dev/summary-skill-tree.ts ht-tree1
import { readFileSync } from 'node:fs';

const s = JSON.parse(readFileSync(`state/${process.argv[2]}.json`, 'utf8'));
console.log('char', s.charName, 'fase', s.phase, 'min', (s.playMs / 60000).toFixed(1), 'poeiras', s.dust.uses, 'runs', s.runs);
for (const r of Object.values<any>(s.skills)) {
  const cc = r.cast;
  const a = cc && (cc.attempts.find((x: any) => x.echo?.dam.some((d: any) => d.damage > 0)) ?? cc.attempts.find((x: any) => x.echo) ?? cc.attempts.at(-1));
  console.log(r.id, r.name, 'antes', r.early && [r.early.level + 1, r.early.notices], 'nv', r.learn && r.learn.level + 1, JSON.stringify(cc?.checks), 'mp', a?.mpSpent, 'dano', a?.echo?.dam.map((d: any) => d.damage).join('/'), cc?.buff ? JSON.stringify({ affect: cc.buff.affect, ac: [cc.buff.before.ac, cc.buff.after.ac], gain: cc.buff.expectedGain }) : '', cc?.note ?? '');
}
const c = s.controls;
console.log(JSON.stringify({ unlearned: c.unlearned && [c.unlearned.ok, c.unlearned.skill], outOfRange: c.outOfRange && [c.outOfRange.ok, c.outOfRange.note], noMana: c.noMana && [c.noMana.ok, c.noMana.drained, c.noMana.note], buy: c.buyAsItem?.gotItem }));
console.log(JSON.stringify({ relearn: s.relearn?.notices, eighth: s.eighth && [s.eighth.notices, s.eighth.level], relogin: s.relogin }));
console.log(s.failures);
