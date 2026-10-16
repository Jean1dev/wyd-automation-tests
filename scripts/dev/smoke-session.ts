// Smoke manual: login → PIN → (cria se preciso) → entra no mundo e mostra o que vê.
// Uso: npx tsx scripts/dev/smoke-session.ts [nomeDoPersonagem]
import { loadConfig } from '../../src/config.ts';
import { Logger } from '../../src/client/logger.ts';
import { login, createCharacter, enterWorld } from '../../src/bot/session.ts';
import { sleep } from '../../src/bot/util.ts';
import { opName } from '../../src/protocol/opcodes.ts';

const cfg = loadConfig();
const log = new Logger('smoke', process.env.DEBUG ? 'debug' : 'info');
const c = await login(cfg, log);
let name = process.argv[2] ?? c.selChars[0]?.name;
if (!name) {
  name = `${cfg.charPrefix}${Math.random().toString(36).slice(2, 8)}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  await createCharacter(c, name, cfg.charClass, log);
}
await enterWorld(c, name, log);
await sleep(4000);
const counts: Record<string, number> = {};
for (const f of c.framesSince(0)) counts[opName(f.header.type)] = (counts[opName(f.header.type)] ?? 0) + 1;
log.info('frames recebidos', counts);
log.info('estado', { self: c.self, mobs: c.liveMobs().slice(0, 10).map((m) => ({ id: m.id, name: m.name, lv: m.level, x: m.x, y: m.y, hp: m.hp })) , total: c.mobs.size });
c.close();
