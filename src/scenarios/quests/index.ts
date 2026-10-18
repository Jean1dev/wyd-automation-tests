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
  '07': async () => (await import('./q07-pilula-orc.ts')).default,
  '08': async () => (await import('./q08-circulo-divino.ts')).default,
  '09': async () => (await import('./q09-arch-cadeia.ts')).default,
  '10': async () => (await import('./q10-arch-destravas.ts')).default,
  '11': async () => (await import('./q11-alma-mortal-kibita.ts')).default,
  '12': async () => (await import('./q12-celestial.ts')).default,
};
