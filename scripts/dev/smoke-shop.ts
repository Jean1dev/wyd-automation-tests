// Smoke manual dos pacotes de loja: mostra o inventário e o gold do login, abre a loja da
// Evolução (Poeira de Fada) e compra a Vela do Coveiro (grátis) na Aki.
// Uso: npx tsx scripts/dev/smoke-shop.ts <nomeDoPersonagem>
import { loadConfig } from '../../src/config.ts';
import { Logger } from '../../src/client/logger.ts';
import { approachNpc, buyItem } from '../../src/bot/npc.ts';
import { enterWorld, login } from '../../src/bot/session.ts';
import { Op } from '../../src/protocol/opcodes.ts';
import * as P from '../../src/protocol/packets.ts';
import { ITEM, NPC } from '../../src/world/coveiro.ts';

const cfg = loadConfig();
const log = new Logger('smoke', process.env.DEBUG ? 'debug' : 'info');
const c = await login(cfg, log);
const name = process.argv[2] ?? c.selChars[0]?.name;
if (!name) throw new Error('a conta não tem personagem');
await enterWorld(c, name, log);
const me = c.self!;
log.info('inventário', { coin: me.coin, carry: me.carry.map((it, i) => ({ i, index: it.index, amount: P.itemAmount(it) })).filter((x) => x.index) });

const evo = await approachNpc(c, NPC.evolucao);
const since = c.mark;
c.send(Op.ReqShopList, P.reqShopList(evo.id));
const list = P.parseShopList((await c.waitType(Op.ShopList, { timeoutMs: 5000, since })).body);
log.info('loja da Evolução', { npc: evo, items: list.items.map((it) => ({ index: it.index, npcSlot: it.npcSlot, amount: P.itemAmount(it) })) });

if (c.findItem(ITEM.velaDoCoveiro) < 0) await buyItem(c, log, NPC.aki, ITEM.velaDoCoveiro);
log.info('depois', { coin: me.coin, vela: c.findItem(ITEM.velaDoCoveiro) });
c.close();
