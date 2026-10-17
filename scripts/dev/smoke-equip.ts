// Smoke manual dos pacotes do cenário 4: mostra equipamento e atributos do login, abre as lojas
// usadas (Aki, Set_TK, Arma_SemiDeus), tira e põe de volta a arma inicial (MSG_TradingItem) e,
// com --griff, viaja com o Mestre Grifo para o Jardim dos Deuses e volta a pé.
// Uso: npx tsx scripts/dev/smoke-equip.ts <nomeDoPersonagem> [--griff]
import { loadConfig } from '../../src/config.ts';
import { Logger } from '../../src/client/logger.ts';
import { equipFromCarry } from '../../src/bot/equip.ts';
import { approachNpc, type NpcSpec } from '../../src/bot/npc.ts';
import { enterWorld, login } from '../../src/bot/session.ts';
import { griffTravel, returnToArmia } from '../../src/bot/travel.ts';
import { sleep } from '../../src/bot/util.ts';
import { Op } from '../../src/protocol/opcodes.ts';
import * as P from '../../src/protocol/packets.ts';
import { EQUIP_SLOT, GRIFF_WARP, NPC } from '../../src/world/quest256.ts';

const cfg = loadConfig();
const log = new Logger('smoke', process.env.DEBUG ? 'debug' : 'info');
const c = await login(cfg, log);
const name = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : c.selChars[0]?.name;
if (!name) throw new Error('a conta não tem personagem');
await enterWorld(c, name, log);
const me = c.self!;
const items = (list: P.Item[]) => list.map((it, i) => ({ i, index: it.index, amount: P.itemAmount(it) })).filter((x) => x.index);
log.info('personagem', { level: me.level, coin: me.coin, ac: me.ac, damage: me.damage, attrs: me.attrs, equip: items(me.equip), carry: items(me.carry) });

async function shop(npc: NpcSpec): Promise<void> {
  const ent = await approachNpc(c, npc);
  const since = c.mark;
  c.send(Op.ReqShopList, P.reqShopList(ent.id));
  const list = P.parseShopList((await c.waitType(Op.ShopList, { timeoutMs: 5000, since })).body);
  log.info(`loja ${npc.name}`, { npc: { id: ent.id, name: ent.name, merchant: ent.merchant }, items: list.items.map((it) => ({ index: it.index, npcSlot: it.npcSlot })) });
}
for (const npc of [NPC.aki, NPC.setTk, NPC.armaSemiDeus]) await shop(npc);

// Tira a arma (Equip[6] → inventário) e põe de volta.
const weapon = me.equip[EQUIP_SLOT.weapon]?.index ?? 0;
const free = c.freeCarrySlot();
if (weapon && free >= 0) {
  const since = c.mark;
  c.send(Op.TradingItem, P.tradingItem({ place: P.PLACE_EQUIP, slot: EQUIP_SLOT.weapon }, { place: P.PLACE_CARRY, slot: free }));
  await sleep(1500);
  log.info('arma tirada', { echo: c.framesSince(since).map((f) => Op.TradingItem === f.header.type ? 'TradingItem' : f.header.type.toString(16)), carry: me.carry[free]?.index, equip: me.equip[EQUIP_SLOT.weapon]?.index, damage: me.damage });
  const r = await equipFromCarry(c, log, free, EQUIP_SLOT.weapon);
  log.info('arma de volta', { ok: r.ok, damageBefore: r.before.damage, damage: r.after.damage });
}

if (process.argv.includes('--griff')) {
  const hop = await griffTravel(c, log, GRIFF_WARP.jardimDosDeuses);
  log.info('chegou', { hop, mobsPerto: [...c.mobs.values()].filter((m) => m.merchant).map((m) => ({ name: m.name, merchant: m.merchant, x: m.x, y: m.y })) });
  await returnToArmia(c, log);
}
c.close();
