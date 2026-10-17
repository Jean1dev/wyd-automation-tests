// Skills como o cliente: abrir a janela do mestre (MSG_REQShopList, ShopType 3), aprender
// (MSG_ApplyBonus BonusType 2) e conjurar (MSG_AttackOne / MSG_Attack com SkillIndex e Dam = -1).
import type { GameClient, Mob, Received } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { approachNpc, type NpcSpec } from './npc.ts';
import { sleep } from './util.ts';

/** Códigos de MessageBoxOk das skills (handler/notice.go: iota local, não o número do legado). */
export const NOTICE = {
  reqNotMet: 15,
  otherClassSkill: 17,
  notEnoughSkillPoint: 18,
  onlyOneEighthSkill: 19,
  learnPrereq: 20,
  alreadyLearned: 21,
  notEnoughCoin: 22,
  maxPoint: 23,
} as const;

export const noticeName = (n: number) => Object.entries(NOTICE).find(([, v]) => v === n)?.[0] ?? `aviso ${n}`;

/** O servidor recusa ataques com menos de 800 ms entre si (crack 107). */
const CAST_GAP_MS = 850;

export interface SkillShop {
  npcId: number;
  shopType: number;
  /** Itens 5000 + skill da janela, com o slot do Carry do NPC. */
  items: { index: number; npcSlot: number }[];
}

/** Anda até o mestre e abre a janela de skills (o que o cliente faz ao clicar nele). */
export async function openSkillShop(c: GameClient, npc: NpcSpec): Promise<SkillShop> {
  const ent = await approachNpc(c, npc);
  const since = c.mark;
  c.send(Op.ReqShopList, P.reqShopList(ent.id));
  const list = P.parseShopList((await c.waitType(Op.ShopList, { timeoutMs: 5000, since })).body);
  return { npcId: ent.id, shopType: list.shopType, items: list.items.map((it) => ({ index: it.index, npcSlot: it.npcSlot })) };
}

export interface LearnAttempt {
  t: string;
  skill: number;
  level: number;
  special: number;
  coin: number;
  learnBefore: number;
  learnAfter: number;
  skillBonusBefore: number;
  skillBonusAfter: number;
  coinAfter: number;
  notices: number[];
  /** O bit da skill apareceu no Learn. */
  learned: boolean;
}

/** Pede para aprender a skill e observa a resposta: UpdateEtc (aprendeu) ou MessageBoxOk (recusa). */
export async function learnSkill(c: GameClient, log: Logger, npcId: number, skill: number): Promise<LearnAttempt> {
  const me = c.self!;
  const before = { learn: me.learn, skillBonus: me.skillBonus, coin: me.coin };
  const since = c.mark;
  c.send(Op.ApplyBonus, P.learnSkill(skill, npcId));
  try {
    await c.waitType([Op.UpdateEtc, Op.MessageBoxOk], { timeoutMs: 5000, since, what: `resposta ao aprender a skill ${skill}` });
  } catch {
    // sem resposta: registrado como tentativa sem efeito
  }
  await sleep(500);
  const r: LearnAttempt = {
    t: new Date().toISOString(),
    skill,
    level: me.level,
    special: me.special[Math.floor((skill % 24) / 8) + 1] ?? 0,
    coin: before.coin,
    learnBefore: before.learn,
    learnAfter: me.learn,
    skillBonusBefore: before.skillBonus,
    skillBonusAfter: me.skillBonus,
    coinAfter: me.coin,
    notices: c.framesSince(since).filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    learned: (me.learn & (1 << (skill % 24))) !== 0 && (before.learn & (1 << (skill % 24))) === 0,
  };
  log.info(`aprender skill ${skill}`, { ...r, noticeNames: r.notices.map(noticeName) });
  return r;
}

export interface CastResult {
  t: string;
  skill: number;
  op: string;
  from: { x: number; y: number };
  targets: { id: number; name: string; x: number; y: number; dist: number; hpBefore: number }[];
  mpBefore: number;
  special: number;
  /** Eco do servidor (o próprio pacote com o dano e o MP calculados por ele). */
  echo?: { skillIndex: number; currentMp: number; reqMp: number; motion: number; dam: { targetId: number; damage: number }[] };
  mpSpent?: number;
  /** Frames de MP (SetHpMp) e avisos recebidos em vez do eco. */
  setHpMp: { hp: number; mp: number }[];
  notices: number[];
  affects: { targetId: number; affects: { type: number; value: number; level: number; time: number }[] }[];
}

const isAttack = (f: Received) => f.header.type === Op.Attack || f.header.type === Op.AttackOne || f.header.type === Op.AttackTwo;

/** Distância de Chebyshev, a que o bot usa para ficar dentro do alcance. */
export const tiles = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

let lastCastTick = 0;

/**
 * Conjura a skill nos alvos (o primeiro é o alvo principal; para skill em si mesma, passe o
 * próprio id) e espera o eco. Um alvo usa MSG_AttackOne; mais de um, MSG_Attack.
 */
export async function castSkill(c: GameClient, log: Logger, skill: number, targets: Mob[] | 'self', waitMs = 3000): Promise<CastResult> {
  const me = c.self!;
  const list = targets === 'self'
    ? [{ id: me.clientId, name: me.name, x: me.x, y: me.y, hp: me.hp }]
    : targets.map((m) => ({ id: m.id, name: m.name, x: m.x, y: m.y, hp: m.hp }));
  const main = list[0];
  const op = list.length > 1 ? Op.Attack : Op.AttackOne;
  const tree = Math.floor((skill % 24) / 8) + 1;
  const r: CastResult = {
    t: '',
    skill,
    op: op === Op.Attack ? 'Attack' : 'AttackOne',
    from: { x: me.x, y: me.y },
    targets: list.map((m) => ({ id: m.id, name: m.name, x: m.x, y: m.y, dist: tiles(me, m), hpBefore: m.hp })),
    mpBefore: me.mp,
    special: me.special[tree] ?? 0,
    setHpMp: [],
    notices: [],
    affects: [],
  };
  let tick = c.tick();
  if (tick < lastCastTick + CAST_GAP_MS) {
    await sleep(lastCastTick + CAST_GAP_MS - tick);
    tick = c.tick();
  }
  lastCastTick = tick;
  const since = c.mark;
  r.t = new Date().toISOString();
  c.send(op, P.attack({
    attackerId: me.clientId, posX: me.x, posY: me.y, targetId: main.id, targetX: main.x, targetY: main.y,
    skillIndex: skill, currentMp: me.mp, reqMp: 0, moreTargets: list.slice(1).map((m) => m.id),
  }), { tick });
  try {
    const f = await c.waitFor((x) => isAttack(x) && x.body.length >= 56 && P.parseAttack(x.body).attackerId === me.clientId && P.parseAttack(x.body).skillIndex === skill && P.parseAttack(x.body).motion !== 254,
      { timeoutMs: waitMs, since, what: `eco da skill ${skill}` });
    const e = P.parseAttack(f.body);
    r.echo = { skillIndex: e.skillIndex, currentMp: e.currentMp, reqMp: e.reqMp, motion: e.motion, dam: e.dam };
    r.mpSpent = r.mpBefore - e.currentMp;
    await sleep(300); // SendAffect / UpdateScore dos alvos
  } catch {
    // sem eco: o servidor descartou o cast (sem a skill, sem MP, crack); a razão vai nos frames
  }
  const frames = c.framesSince(since);
  r.setHpMp = frames.filter((f) => f.header.type === Op.SetHpMp && f.body.length >= 8).map((f) => P.parseHpMp(f.body));
  r.notices = frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body));
  r.affects = frames.filter((f) => f.header.type === Op.SendAffect).map((f) => ({ targetId: f.header.id, affects: P.parseSendAffect(f.body) }));
  log.info(`skill ${skill} conjurada`, r as unknown as Record<string, unknown>);
  return r;
}

/** Ataques do próprio personagem que o servidor gera sozinho (o Trovão dispara Relâmpagos com Motion 254). */
export function syntheticAttacks(c: GameClient, since: number): { t: number; skillIndex: number; currentMp: number; dam: { targetId: number; damage: number }[] }[] {
  const me = c.self!;
  return c.framesSince(since).filter((f) => isAttack(f) && f.body.length >= 48).map((f) => ({ f, a: P.parseAttack(f.body) }))
    .filter(({ a }) => a.attackerId === me.clientId && a.motion === 254)
    .map(({ f, a }) => ({ t: f.at, skillIndex: a.skillIndex, currentMp: a.currentMp, dam: a.dam }));
}
