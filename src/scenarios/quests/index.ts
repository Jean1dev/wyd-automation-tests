// Quests de docs/quests/, carregadas sob demanda (o runner só importa a que vai rodar).
import type { QuestSpec } from './runner.ts';

export const QUESTS: Record<string, () => Promise<QuestSpec>> = {
  '00': async () => (await import('./q00-smoke.ts')).default,
};
