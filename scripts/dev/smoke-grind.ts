// Smoke manual do grind: entra com o personagem e caça por N minutos.
// Uso: npx tsx scripts/dev/smoke-grind.ts <personagem> [minutos]
import { loadConfig } from '../../src/config.ts';
import { Logger } from '../../src/client/logger.ts';
import { login, enterWorld } from '../../src/bot/session.ts';
import { grindUntil } from '../../src/bot/grind.ts';

const cfg = loadConfig();
const log = new Logger('smoke', process.env.DEBUG ? 'debug' : 'info');
const name = process.argv[2];
const minutes = Number(process.argv[3] ?? 3);
const c = await login(cfg, log);
await enterWorld(c, name ?? c.selChars[0].name, log);
const status = await grindUntil(c, log, { targetLevel: 99, deadline: Date.now() + minutes * 60_000, stallMs: 5 * 60_000 });
log.info('fim', { status, self: c.self });
c.close();
