// Quests de docs/quests/, carregadas sob demanda (o runner só importa a que vai rodar).
import type { QuestSpec } from './runner.ts';

export const QUESTS: Record<string, () => Promise<QuestSpec>> = {
  '00': async () => (await import('./q00-smoke.ts')).default,
  '01': async () => (await import('./q01-novato.ts')).default,
  '02': async () => (await import('./q02-quest256.ts')).default,
  '03': async () => (await import('./q03-capa-verde.ts')).default,
  '04': async () => (await import('./q04-molar-gargula.ts')).default,
  '05': async () => (await import('./q05-capa-real.ts')).default,
  '06': async () => (await import('./q06-terra-mistica.ts')).default,
};
