// Lista os personagens da conta principal (slot, nome, nível exibido) e sai.
// Uso: npx tsx scripts/dev/list-chars.ts
import { loadConfig } from '../../src/config.ts';
import { Logger } from '../../src/client/logger.ts';
import { login } from '../../src/bot/session.ts';

const c = await login(loadConfig(), new Logger('chars', 'warn'));
console.log(JSON.stringify(c.selChars.map((s) => ({ slot: s.slot, name: s.name, shownLevel: s.level + 1 }))));
c.close();
process.exit(0);
