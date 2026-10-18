// Smoke do runner: o seed pelo banco chega ao jogo, e o que muda no jogo chega ao banco.
import type { QuestSpec } from './runner.ts';

const quest: QuestSpec = {
  id: '00',
  name: 'Smoke do runner',
  cases: [
    {
      id: 'SM-01',
      title: 'Nível, gold e item semeados pelo banco aparecem no login; o relogin preserva',
      type: 'feliz',
      seed: async (db, char) => {
        await db.setCharacter(char, { level: 99, coin: 123456 });
        await db.putItem(char, 'carry', 5, { index: 4142, eff: [[61, 3]] }); // 3 Poeiras de Fada
      },
      run: async (ctx) => {
        const me = () => ctx.c.self!;
        const first = { level: me().level, coin: me().coin, carry5: me().carry[5]?.index };
        await ctx.relog();
        const second = { level: me().level, coin: me().coin, carry5: me().carry[5]?.index };
        const saved = await ctx.query(async (db, char) => ({ level: (await db.character(char)).level, carry: await db.items(char, 'carry') }));
        const ok = (s: typeof first) => s.level === 99 && s.coin === 123456 && s.carry5 === 4142;
        return { pass: ok(first) && ok(second) && saved.level === 99, evidence: { first, second, saved } };
      },
    },
  ],
};

export default quest;
