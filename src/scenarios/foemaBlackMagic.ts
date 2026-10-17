// Cenário 6: as skills de Magia Negra da Foema (skills 32–39), numa conta só para isso
// (WYD_ACCOUNT_FOEMA). Como um jogador:
//   1. cria uma Foema e sobe de nível com a Poeira de Fada, distribuindo os atributos em Int e a
//      maestria em Special[2] só até o que a próxima skill pede;
//   2. a cada skill, assim que tem pontos, nível e maestria, aprende no Foema_Ancian
//      (MSG_ApplyBonus BonusType 2) e vai conjurar nos Gremlins a leste de Armia;
// e verifica que:
//   - um nível antes, o aprendizado é recusado (pontos ou requisito) sem mexer no Learn;
//   - o aprendizado liga o bit da skill, desconta exatamente o custo dela e não cobra gold;
//     aprender de novo é recusado (já aprendida);
//   - o cast volta com a mesma skill, dano no alvo e o MP descontado pela fórmula do servidor;
//     a Tempestade de Meteoros acerta vários alvos; o Trovão dispara Relâmpagos sozinho;
//   - controles: skill não aprendida, sem MP, alvo fora do alcance, e comprar (MSG_Buy) a skill
//     do mestre como item;
//   - Inferno (8ª): no nível exibido 220 com as 7 aprendidas e sem os 50M, recusa sem mexer em nada;
//   - depois de relogar, o Learn e os pontos de skill continuam certos.
//
// É retomável: o estado fica em state/foema-black-magic.json.
//
// Uso:
//   npm run scenario:foema-black                       # até 60 min nesta execução
//   npm run scenario:foema-black -- --until-done
//   npm run scenario:foema-black -- --fresh | --cleanup
//   npm run scenario:foema-black -- --skill 37        # repete o cast de uma skill já aprendida (e a recusa do Inferno e o relogin)
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient, Mob } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { FOEMA_NEGRA, spendBuild, spendMastery, type MasteryResult } from '../bot/build.ts';
import { walkPath, walkTo } from '../bot/movement.ts';
import { approachNpc, buyItem, type Purchase } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { FAIRY_DUST, useDustUntil } from '../bot/quest.ts';
import { enterWorld, login } from '../bot/session.ts';
import { castSkill, learnSkill, NOTICE, noticeName, openSkillShop, syntheticAttacks, tiles, type CastResult, type LearnAttempt } from '../bot/skills.ts';
import { reviveAfterDeath } from '../bot/survival.ts';
import { isInArmia } from '../bot/travel.ts';
import { shownLevel, sleep } from '../bot/util.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { FAIRY_DUST_PRICE, NPC } from '../world/coveiro.ts';
import {
  BLACK_SKILLS, BLACK_TREE, CAST_SPOT, cumulativePoints, EIGHTH_SKILL_COIN, FOEMA, INFERNO, learnBit, learnLevel, manaCost,
  ROUTE_TO_CAST_SPOT, SKILL_MASTER, skillPointsAt, type BlackSkill,
} from '../world/foemaBlackMagic.ts';
import { cleanupScenario, ensureCharacter, flag, opt, parseDuration, PlayClock, reportDirFor, runMain, runWithReconnect, writeReportFile, type CharacterState } from './common.ts';

const SCENARIO = 'foema-black-magic';
const DUST_STACK = 255;
/** As 7 primeiras skills; o Inferno (8ª) só tem o controle de recusa. */
const LEARNABLE = BLACK_SKILLS.filter((s) => s.id !== INFERNO.id);
const LEARNABLE_MASK = LEARNABLE.reduce((m, s) => m | learnBit(s.id), 0);

type Phase = 'skills' | 'inferno' | 'relogin' | 'done';

interface CastCheck {
  attempts: CastResult[];
  expectedMp: number;
  checks: Record<string, boolean>;
  ok: boolean;
  /** Trovão: Relâmpagos que o servidor disparou sozinho depois do cast. */
  thunder?: { ticks: { t: string; skillIndex: number; currentMp: number; hits: number; damage: number[] }[]; mpPerTick: number };
  note?: string;
}

interface SkillRecord {
  id: number;
  name: string;
  expectedLevel: number;
  early?: LearnAttempt & { expected: number[]; ok: boolean };
  shop?: { npcId: number; shopType: number; listed: boolean };
  learn?: LearnAttempt & { checks: Record<string, boolean>; ok: boolean };
  again?: LearnAttempt & { ok: boolean };
  cast?: CastCheck;
}

interface State extends CharacterState {
  scenario: string;
  runs: number;
  playMs: number;
  phase: Phase;
  dust: { purchases: Purchase[]; uses: number };
  mastery: MasteryResult[];
  levelCurve: { t: string; level: number; skillBonus: number; special: number; specialBonus: number; int: number; maxMp: number }[];
  skills: Record<number, SkillRecord>;
  controls: {
    unlearned?: CastResult & { ok: boolean };
    outOfRange?: CastResult & { ok: boolean; note?: string };
    noMana?: { drained: number; final?: CastResult; ok: boolean; note?: string };
    buyAsItem?: { npcSlot: number; index: number; slot: number; gotItem?: number; notices: number[]; coinBefore: number; coinAfter: number; ok: boolean };
  };
  /** Relogins pedidos porque o SkillBonus não acompanhou o nível (o login recalcula). */
  pointRelogins: number[];
  relearn?: LearnAttempt & { ok: boolean };
  inferno?: LearnAttempt & { ok: boolean; blocked: string };
  relogin?: { learn: number; skillBonus: number; expectedSkillBonus: number; level: number; checks: Record<string, boolean>; ok: boolean };
  verdict?: 'pass' | 'fail';
  failures: string[];
}

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  runs: 0,
  playMs: 0,
  phase: 'skills',
  dust: { purchases: [], uses: 0 },
  mastery: [],
  levelCurve: [],
  skills: {},
  controls: {},
  pointRelogins: [],
  failures: [],
}));

const budgetMs = flag('--until-done') ? Infinity : parseDuration(opt('--budget') ?? '60m');
const reportDir = reportDirFor(SCENARIO);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));
const clock = new PlayClock();

// ---------------------------------------------------------------- helpers

function fail(state: State, msg: string): void {
  state.failures.push(msg);
  state.verdict = 'fail';
  log.error('verificação falhou', { failure: msg });
}

class Relogin extends Error {}

const hex = (n: number) => `0x${(n >>> 0).toString(16)}`;
const special = (c: GameClient) => c.self!.special[BLACK_TREE] ?? 0;
const learned = (c: GameClient, id: number) => (c.self!.learn & learnBit(id)) !== 0;
const failedChecks = (checks: Record<string, boolean>) => Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

/** Tem nível, pontos e maestria para aprender a skill agora? */
function eligible(c: GameClient, s: BlackSkill): boolean {
  const me = c.self!;
  return me.level >= s.reqLevel && me.skillBonus >= s.points && special(c) >= s.reqSpecial;
}

/** Com mais um nível (+3/+4 pontos e +2 de maestria) a skill fica disponível? */
function eligibleNext(c: GameClient, s: BlackSkill): boolean {
  const me = c.self!;
  const lv = me.level + 1;
  const mastery = Math.min(Math.min((3 * (lv + 1)) >> 1, 200), special(c) + me.specialBonus + 2);
  return lv >= s.reqLevel && me.skillBonus + (lv > 199 ? 4 : 3) >= s.points && mastery >= s.reqSpecial;
}

/** A recusa que o servidor deve dar agora (a ordem de learnSkill: pontos antes dos requisitos). */
function expectedRefusal(c: GameClient, s: BlackSkill): number {
  return c.self!.skillBonus < s.points ? NOTICE.notEnoughSkillPoint : NOTICE.reqNotMet;
}

function recordLevel(c: GameClient, state: State): void {
  const me = c.self!;
  state.levelCurve.push({ t: new Date().toISOString(), level: me.level, skillBonus: me.skillBonus, special: special(c), specialBonus: me.specialBonus, int: me.attrs.int, maxMp: me.maxMp });
}

async function spendPoints(c: GameClient, state: State, masteryUntil: number): Promise<void> {
  await spendBuild(c, log, FOEMA_NEGRA);
  if (c.self!.specialBonus > 0 && special(c) < masteryUntil) {
    const m = await spendMastery(c, log, BLACK_TREE, masteryUntil);
    if (m.spent || m.notices.length) state.mastery.push(m);
  }
}

/** Garante Poeira de Fada para chegar ao nível armazenado `target`. */
async function ensureDust(c: GameClient, state: State, target: number): Promise<void> {
  const me = c.self!;
  const have = me.carry.reduce((n, it) => n + (it.index === FAIRY_DUST ? P.itemAmount(it) : 0), 0);
  const need = target - me.level;
  if (have >= need) return;
  await goToArmia(c);
  for (let stacks = Math.ceil((need - have) / DUST_STACK); stacks > 0; stacks--) {
    if (me.coin < FAIRY_DUST_PRICE) throw new Error(`sem gold para a Poeira de Fada (${me.coin})`);
    state.dust.purchases.push(await buyItem(c, log, NPC.evolucao, FAIRY_DUST));
    progress.save(state);
  }
}

/** Um nível com a Poeira de Fada, distribuindo os pontos depois. */
async function levelOnce(c: GameClient, state: State, masteryUntil: number): Promise<void> {
  const me = c.self!;
  const bad = await useDustUntil(c, log, me.level + 1, async (use) => {
    if (use.ok) state.dust.uses++;
  });
  if (bad) throw new Error(`a Poeira de Fada no nível exibido ${shownLevel(bad.from)} não subiu de nível${bad.texts?.length ? `: ${bad.texts.join(' | ')}` : ''}`);
  await sleep(300); // UpdateEtc com os pontos novos
  await spendPoints(c, state, masteryUntil);
  recordLevel(c, state);
  progress.save(state);
}

async function goToArmia(c: GameClient): Promise<void> {
  const me = c.self!;
  if (!isInArmia(me.x, me.y)) await walkPath(c, [{ x: 2176, y: 2106 }, { x: 2150, y: 2100 }]);
}

async function goToCastSpot(c: GameClient): Promise<void> {
  const me = c.self!;
  if (tiles(me, CAST_SPOT) > 8) await walkPath(c, ROUTE_TO_CAST_SPOT);
  await sleep(1500); // CreateMob dos Gremlins
}

/** Volta para Armia e espera HP e MP (o MP mínimo para o próximo cast). */
async function rest(c: GameClient, mpNeeded: number, maxWaitMs = 240_000): Promise<void> {
  const me = c.self!;
  if (me.hp <= 0) await reviveAfterDeath(c, log);
  if (me.hp >= me.maxHp * 0.5 && me.mp >= mpNeeded) return;
  log.info('descansando em Armia', { hp: me.hp, maxHp: me.maxHp, mp: me.mp, maxMp: me.maxMp, mpNeeded });
  await goToArmia(c);
  const t0 = Date.now();
  while ((me.hp < me.maxHp * 0.9 || me.mp < Math.min(me.maxMp, Math.max(mpNeeded, me.maxMp * 0.9))) && Date.now() - t0 < maxWaitMs) await sleep(2000);
  log.info('descansou', { hp: me.hp, mp: me.mp, waitedMs: Date.now() - t0 });
}

const preferred = (m: Mob) => /Gremlin|Krill/.test(m.name);

/** Mobs vivos ordenados pela distância (Gremlins e Krills primeiro). */
function mobsByDistance(c: GameClient): Mob[] {
  const me = c.self!;
  const all = c.liveMobs();
  const pool = all.some(preferred) ? all.filter(preferred) : all;
  return pool.sort((a, b) => tiles(me, a) - tiles(me, b));
}

/** Chega a até `within` tiles de um mob e devolve os mobs ao alcance (o mais perto primeiro). */
async function mobsInReach(c: GameClient, within: number): Promise<Mob[]> {
  const me = c.self!;
  for (let i = 0; i < 12; i++) {
    const near = mobsByDistance(c);
    if (near.length && tiles(me, near[0]) <= within) return near.filter((m) => tiles(me, m) <= within);
    if (near.length) {
      const m = near[0];
      await walkTo(c, m.x + Math.sign(me.x - m.x) * 2, m.y + Math.sign(me.y - m.y) * 2);
    } else {
      await walkTo(c, CAST_SPOT.x + ((i % 3) - 1) * 6, CAST_SPOT.y + ((i % 2) * 2 - 1) * 6);
    }
    await sleep(800);
  }
  throw new Error(`nenhum mob a até ${within} tiles perto de (${me.x},${me.y})`);
}

// ---------------------------------------------------------------- aprender

async function learnStep(c: GameClient, state: State, s: BlackSkill): Promise<void> {
  const me = c.self!;
  const rec = state.skills[s.id];
  // Sobe até ter pontos, nível e maestria; um nível antes, o controle de recusa.
  await spendPoints(c, state, s.reqSpecial);
  let levels = 0;
  while (!eligible(c, s)) {
    if (me.level > rec.expectedLevel + 2) {
      const msg = `skill ${s.id} (${s.name}): no nível exibido ${shownLevel(me.level)} o SkillBonus é ${me.skillBonus} e a maestria ${special(c)}; esperado ≥ ${s.points} pontos e Special[2] ≥ ${s.reqSpecial} desde o nível exibido ${shownLevel(rec.expectedLevel)} (${skillPointsAt(me.level)} pontos pelo nível − ${cumulativePoints(s.id) - s.points} gastos)`;
      if (!state.pointRelogins.includes(s.id)) {
        fail(state, msg);
        state.pointRelogins.push(s.id);
        progress.save(state);
        throw new Relogin('relogar para o servidor recalcular os pontos de skill');
      }
      throw new Error(`${msg}; nem relogando`);
    }
    if (!rec.early && eligibleNext(c, s)) {
      // Controle: um nível antes, o mestre tem que recusar.
      const expected = expectedRefusal(c, s);
      const shop = await openSkillShop(c, SKILL_MASTER);
      const a = await learnSkill(c, log, shop.npcId, s.id);
      const ok = !a.learned && a.learnAfter === a.learnBefore && a.skillBonusAfter === a.skillBonusBefore && a.notices.includes(expected);
      rec.early = { ...a, expected: [expected], ok };
      if (a.learned || a.learnAfter !== a.learnBefore || a.skillBonusAfter !== a.skillBonusBefore) {
        fail(state, `skill ${s.id} (${s.name}) foi aprendida um nível antes (nível exibido ${shownLevel(a.level)}, SkillBonus ${a.skillBonusBefore}/${s.points}, Special[2] ${a.special}/${s.reqSpecial}): Learn ${hex(a.learnBefore)}→${hex(a.learnAfter)}, SkillBonus ${a.skillBonusBefore}→${a.skillBonusAfter}`);
      } else if (!ok) {
        log.warn('recusa com aviso diferente do esperado', { skill: s.id, expected: noticeName(expected), got: a.notices.map(noticeName) });
      }
      progress.save(state);
    }
    await ensureDust(c, state, me.level + 1);
    await levelOnce(c, state, s.reqSpecial);
    levels++;
  }
  if (levels) log.info('pronta para aprender', { skill: s.id, name: s.name, shownLevel: shownLevel(me.level), skillBonus: me.skillBonus, special: special(c), expectedShownLevel: shownLevel(rec.expectedLevel) });

  // Aprende.
  const shop = await openSkillShop(c, SKILL_MASTER);
  rec.shop = { npcId: shop.npcId, shopType: shop.shopType, listed: shop.items.some((it) => it.index === 5000 + s.id) };
  const a = await learnSkill(c, log, shop.npcId, s.id);
  const checks = {
    bitSet: a.learned,
    onlyThisBit: (a.learnAfter ^ a.learnBefore) === learnBit(s.id),
    pointsCharged: a.skillBonusBefore - a.skillBonusAfter === s.points,
    noGold: a.coinAfter === a.coin,
    noRefusal: a.notices.length === 0,
  };
  rec.learn = { ...a, checks, ok: Object.values(checks).every(Boolean) };
  if (!rec.learn.ok) fail(state, `aprender ${s.name} (${s.id}) no nível exibido ${shownLevel(a.level)}: falhou ${failedChecks(checks).join(', ')} (Learn ${hex(a.learnBefore)}→${hex(a.learnAfter)}, SkillBonus ${a.skillBonusBefore}→${a.skillBonusAfter} de ${s.points}, gold ${a.coin}→${a.coinAfter}, avisos ${a.notices.map(noticeName).join(',') || 'nenhum'})`);
  progress.save(state);
  if (!a.learned) return;

  // De novo: recusa sem mexer em nada. Como no legado (_MSG_ApplyBonus.cpp:146), os pontos são
  // conferidos antes de "já aprendida"; com o saldo zerado o aviso é o de pontos.
  const again = await learnSkill(c, log, shop.npcId, s.id);
  const expected = again.skillBonusBefore >= s.points ? NOTICE.alreadyLearned : NOTICE.notEnoughSkillPoint;
  const okAgain = again.notices.includes(expected) && again.skillBonusAfter === again.skillBonusBefore && again.learnAfter === again.learnBefore;
  rec.again = { ...again, ok: okAgain };
  if (!okAgain) fail(state, `aprender ${s.name} de novo: esperado "${noticeName(expected)}" sem mudar nada; veio ${again.notices.map(noticeName).join(',') || 'nenhum aviso'}, SkillBonus ${again.skillBonusBefore}→${again.skillBonusAfter}, Learn ${hex(again.learnBefore)}→${hex(again.learnAfter)}`);
  progress.save(state);
}

// ---------------------------------------------------------------- conjurar

async function castStep(c: GameClient, state: State, s: BlackSkill): Promise<void> {
  const me = c.self!;
  const rec = state.skills[s.id];
  const expectedMp = () => manaCost(s.mana, special(c));
  await rest(c, expectedMp());
  await goToCastSpot(c);
  const cc: CastCheck = { attempts: [], expectedMp: expectedMp(), checks: {}, ok: false };

  if (s.target === 'self') {
    // Trovão: buff em si mesma que dispara Relâmpagos (skill 33) nos mobs a até 4 tiles a noroeste.
    const r = await castSkill(c, log, s.id, 'self');
    cc.attempts.push(r);
    const since = c.mark;
    const until = Date.now() + 40_000;
    while (Date.now() < until && !syntheticAttacks(c, since).some((t) => t.dam.some((d) => d.damage > 0))) {
      if (me.hp < me.maxHp * 0.35) break;
      const m = mobsByDistance(c)[0];
      // thunderTargets varre (x-1..x, y-1..y) e (x-4..x, y-4..y): o mob precisa estar a noroeste.
      if (m && !(m.x <= me.x && m.y <= me.y && me.x - m.x <= 4 && me.y - m.y <= 4)) await walkTo(c, m.x + 2, m.y + 2);
      await sleep(2000);
    }
    const ticks = syntheticAttacks(c, since);
    cc.thunder = {
      ticks: ticks.map((t) => ({ t: new Date(t.t).toISOString(), skillIndex: t.skillIndex, currentMp: t.currentMp, hits: t.dam.filter((d) => d.damage > 0).length, damage: t.dam.map((d) => d.damage) })),
      mpPerTick: manaCost(BLACK_SKILLS[1].mana, special(c)), // cada tick é um Relâmpago cobrado
    };
    cc.checks = {
      echo: !!r.echo && r.echo.skillIndex === s.id,
      mpCharged: r.mpSpent === cc.expectedMp,
      thunderFires: ticks.some((t) => t.skillIndex === 33),
      thunderDamages: ticks.some((t) => t.dam.some((d) => d.damage > 0)),
    };
  } else {
    const within = s.range - 2; // a distância do servidor é a da tabela; 2 tiles de folga
    for (let i = 0; i < 4; i++) {
      if (me.hp <= 0 || me.hp < me.maxHp * 0.35 || me.mp < expectedMp()) {
        await rest(c, expectedMp());
        await goToCastSpot(c);
      }
      const near = await mobsInReach(c, within);
      if (s.target === 'area' && near.length < 2 && i < 3) {
        // procura um ponto com dois mobs ao alcance
        const two = mobsByDistance(c).slice(0, 2);
        if (two.length === 2) await walkTo(c, Math.round((two[0].x + two[1].x) / 2), Math.round((two[0].y + two[1].y) / 2));
        await sleep(800);
      }
      const targets = s.target === 'area' ? (await mobsInReach(c, within)).slice(0, s.maxTarget) : near.slice(0, 1);
      const r = await castSkill(c, log, s.id, targets);
      cc.attempts.push(r);
      const hits = r.echo?.dam.filter((d) => d.damage > 0).length ?? 0;
      if (r.echo && hits > 0 && (s.target !== 'area' || hits >= 2 || i === 3)) break;
    }
    const best = cc.attempts.find((r) => r.echo?.dam.some((d) => d.damage > 0)) ?? cc.attempts.at(-1)!;
    const hits = best.echo?.dam.filter((d) => d.damage > 0).length ?? 0;
    cc.checks = {
      echo: !!best.echo && best.echo.skillIndex === s.id,
      damage: hits > 0,
      mpCharged: best.mpSpent === manaCost(s.mana, best.special),
    };
    if (s.target === 'area') {
      cc.checks.multiTarget = cc.attempts.some((r) => (r.echo?.dam.filter((d) => d.damage > 0).length ?? 0) >= 2);
      if (!cc.checks.multiTarget && !cc.attempts.some((r) => r.targets.length >= 2)) {
        delete cc.checks.multiTarget;
        cc.note = 'nunca houve 2 mobs ao alcance ao mesmo tempo; o acerto em área não foi exercitado';
      }
    }
    if (s.id === 34 || s.id === 36) cc.note = `lentidão em mob (SetAffect só pega em jogador, como no legado): ${cc.attempts.some((r) => r.affects.length) ? 'veio SendAffect' : 'nenhum SendAffect'}`;
  }
  cc.ok = Object.values(cc.checks).every(Boolean);
  rec.cast = cc;
  if (!cc.ok) {
    const last = cc.attempts.at(-1);
    fail(state, `conjurar ${s.name} (${s.id}) no nível exibido ${shownLevel(me.level)}: falhou ${failedChecks(cc.checks).join(', ')} (eco ${last?.echo ? `skill ${last.echo.skillIndex}, dano ${last.echo.dam.map((d) => d.damage).join('/')}, MP ${last.mpBefore}→${last.echo.currentMp} (esperado −${cc.expectedMp})` : 'nenhum'}, SetHpMp ${last?.setHpMp.length ?? 0}, avisos ${last?.notices.join(',') || 'nenhum'})`);
  }
  progress.save(state);
}

// ---------------------------------------------------------------- controles

/** Controles feitos uma vez, com só o Ataque de Fogo aprendido. */
async function controls(c: GameClient, state: State): Promise<void> {
  const me = c.self!;
  const fire = BLACK_SKILLS[0];
  const bolt = BLACK_SKILLS[1];

  // Comprar a skill do mestre como item (MSG_Buy): o legado só vende com Merchant 1.
  if (!state.controls.buyAsItem) {
    const shop = await openSkillShop(c, SKILL_MASTER);
    const offer = shop.items.find((it) => it.index === 5000 + bolt.id) ?? shop.items[0];
    const slot = c.freeCarrySlot();
    if (offer && slot >= 0) {
      const coinBefore = me.coin;
      const since = c.mark;
      c.send(Op.Buy, P.buy(shop.npcId, offer.npcSlot, slot));
      await sleep(2500);
      const frames = c.framesSince(since);
      const got = frames.filter((f) => f.header.type === Op.SendItem).map((f) => P.parseSendItem(f.body)).find((x) => x.place === P.PLACE_CARRY && x.slot === slot);
      const r = {
        npcSlot: offer.npcSlot, index: offer.index, slot, gotItem: got?.item.index,
        notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
        coinBefore, coinAfter: me.coin, ok: !got?.item.index && me.carry[slot]?.index !== offer.index,
      };
      state.controls.buyAsItem = r;
      log.info('controle: comprar skill como item', r as unknown as Record<string, unknown>);
      if (!r.ok) fail(state, `o ${SKILL_MASTER.name} (Merchant ${SKILL_MASTER.merchant}) vendeu a skill ${offer.index} como item pelo MSG_Buy (slot ${slot}, gold ${coinBefore}→${me.coin}); o legado só vende com Merchant 1 (_MSG_Buy.cpp)`);
    }
    progress.save(state);
  }

  await rest(c, manaCost(fire.mana, special(c)) * 3);
  await goToCastSpot(c);

  // Skill ainda não aprendida (Relâmpago): sem eco, sem dano, sem MP.
  if (!state.controls.unlearned && !learned(c, bolt.id)) {
    const [m] = await mobsInReach(c, 3);
    const r = await castSkill(c, log, bolt.id, [m]);
    const ok = !r.echo?.dam.some((d) => d.damage > 0) && (r.echo === undefined || r.mpSpent === 0) && me.mp === r.mpBefore;
    state.controls.unlearned = { ...r, ok };
    if (!ok) fail(state, `conjurar o Relâmpago sem aprender: o servidor aceitou (dano ${r.echo?.dam.map((d) => d.damage).join('/')}, MP ${r.mpBefore}→${r.echo?.currentMp})`);
    progress.save(state);
  }

  // Alvo fora do alcance: dano 0 nesse alvo.
  if (!state.controls.outOfRange) {
    const far = mobsByDistance(c).find((m) => tiles(me, m) >= fire.range + 3 && tiles(me, m) <= fire.range + 8);
    if (far) {
      const r = await castSkill(c, log, fire.id, [far]);
      const d = r.echo?.dam.find((x) => x.targetId === far.id);
      const ok = !d || d.damage <= 0;
      state.controls.outOfRange = { ...r, ok, note: `alvo a ${tiles(me, far)} tiles, alcance ${fire.range}` };
      if (!ok) fail(state, `Ataque de Fogo num alvo a ${tiles(me, far)} tiles (alcance ${fire.range}) causou ${d!.damage} de dano`);
    } else {
      log.warn('controle de alcance sem mob entre 8 e 13 tiles; fica para a próxima sessão');
    }
    progress.save(state);
  }

  // Sem MP: gasta o MP com Ataques de Fogo e tenta mais um. Os casts vão num mob fora do
  // alcance (o Go cobra o MP e dá dano 0), porque matar Gremlins sobe de nível e o nível novo
  // enche o MP.
  if (!state.controls.noMana) {
    let drained = 0;
    const farTarget = async (): Promise<Mob> => {
      const far = mobsByDistance(c).find((m) => tiles(me, m) >= fire.range + 3 && tiles(me, m) <= fire.range + 8);
      return far ?? (await mobsInReach(c, fire.range - 2))[0];
    };
    for (let i = 0; i < 80 && me.mp >= manaCost(fire.mana, special(c)); i++) {
      if (me.hp < me.maxHp * 0.35) await walkTo(c, CAST_SPOT.x - 10, CAST_SPOT.y); // sai de perto sem descansar o MP
      const r = await castSkill(c, log, fire.id, [await farTarget()]);
      if (r.echo) drained++;
      else break;
    }
    const cost = manaCost(fire.mana, special(c));
    if (me.mp < cost) {
      const [m] = await mobsInReach(c, fire.range - 2);
      const r = await castSkill(c, log, fire.id, [m]); // agora ao alcance: só a falta de MP impede
      const ok = !r.echo && r.setHpMp.length > 0;
      state.controls.noMana = { drained, final: r, ok };
      if (r.echo) fail(state, `Ataque de Fogo com ${r.mpBefore} de MP (custo ${cost}): o servidor aceitou (dano ${r.echo.dam.map((d) => d.damage).join('/')}, MP → ${r.echo.currentMp})`);
      else if (!ok) log.warn('cast sem MP descartado, mas sem o SetHpMp do legado', { mp: me.mp, cost });
    } else {
      state.controls.noMana = { drained, ok: false, note: `o MP não baixou do custo (${me.mp} ≥ ${cost}) em ${drained} casts` };
      log.warn('controle de MP inconclusivo', state.controls.noMana as unknown as Record<string, unknown>);
    }
    progress.save(state);
  }
}

// ---------------------------------------------------------------- relatório

function writeReport(state: State, run: Record<string, unknown>): void {
  writeReportFile(reportDir, {
    scenario: SCENARIO,
    description: 'Foema aprende as skills de Magia Negra (32–38) no Foema_Ancian assim que tem pontos, nível e maestria, e conjura cada uma nos Gremlins a leste de Armia; o Inferno (39) só tem a recusa sem os 50M de gold.',
    run,
    character: { name: state.charName, class: state.charClass, createdAt: state.createdAt },
    phase: state.phase,
    verdict: state.verdict ?? 'in-progress',
    failures: state.failures,
    skills: BLACK_SKILLS.map((s) => ({ ...s, record: state.skills[s.id] })),
    controls: state.controls,
    relearn: state.relearn,
    inferno: state.inferno,
    relogin: state.relogin,
    pointRelogins: state.pointRelogins,
    dust: state.dust,
    mastery: state.mastery,
    levelCurve: state.levelCurve,
    playMinutes: +(state.playMs / 60000).toFixed(1),
  }, log);
}

// ---------------------------------------------------------------- execução

async function runSession(cfg: BotConfig, state: State, deadline: number): Promise<'done' | 'in-progress'> {
  const c = await login(cfg, log);
  try {
    await ensureCharacter(c, state, cfg, log, () => progress.save(state));
    await enterWorld(c, state.charName!, log);
    clock.start(state.playMs);
    const me = c.self!;
    if (me.cls !== FOEMA) throw new Error(`o personagem ${me.name} é da classe ${me.cls}; o cenário exige Foema (WYD_CHAR_CLASS=1)`);
    if (me.hp <= 0) await reviveAfterDeath(c, log);
    log.info('fase', { phase: state.phase, shownLevel: shownLevel(me.level), learn: hex(me.learn), skillBonus: me.skillBonus, special: me.special, specialBonus: me.specialBonus, mp: me.mp, maxMp: me.maxMp });

    switch (state.phase) {
      case 'skills': {
        for (const s of LEARNABLE) {
          if (state.skills[s.id]?.cast) continue;
          if (Date.now() >= deadline) return 'in-progress';
          state.skills[s.id] ??= { id: s.id, name: s.name, expectedLevel: learnLevel(s.id) };
          // Os controles de cast precisam do Ataque de Fogo e do Relâmpago ainda não aprendido.
          if (s.id === BLACK_SKILLS[1].id && !learned(c, s.id) && learned(c, BLACK_SKILLS[0].id)) await controls(c, state);
          if (!learned(c, s.id)) await learnStep(c, state, s);
          if (!learned(c, s.id)) {
            state.skills[s.id].cast = { attempts: [], expectedMp: 0, checks: { learned: false }, ok: false, note: 'não aprendida; cast não testado' };
            progress.save(state);
            continue;
          }
          await castStep(c, state, s);
        }
        state.phase = 'inferno';
        progress.save(state);
      }
      // falls through
      case 'inferno': {
        // No nível exibido 220, com as 7 aprendidas e sem os 50M: recusa sem mexer em nada.
        await spendPoints(c, state, INFERNO.reqSpecial);
        while (me.level < INFERNO.reqLevel) {
          if (Date.now() >= deadline) return 'in-progress';
          await ensureDust(c, state, INFERNO.reqLevel);
          await levelOnce(c, state, INFERNO.reqSpecial);
        }
        const shop = await openSkillShop(c, SKILL_MASTER);
        // Com pontos sobrando, reaprender uma skill dá "já aprendida".
        const fire = BLACK_SKILLS[0];
        const re = await learnSkill(c, log, shop.npcId, fire.id);
        const reOk = re.skillBonusBefore >= fire.points && re.notices.includes(NOTICE.alreadyLearned) && re.learnAfter === re.learnBefore && re.skillBonusAfter === re.skillBonusBefore;
        state.relearn = { ...re, ok: reOk };
        if (!reOk) fail(state, `reaprender o Ataque de Fogo com ${re.skillBonusBefore} pontos livres: esperado "alreadyLearned" sem mudar nada; veio ${re.notices.map(noticeName).join(',') || 'nenhum aviso'}, SkillBonus ${re.skillBonusBefore}→${re.skillBonusAfter}, Learn ${hex(re.learnBefore)}→${hex(re.learnAfter)}`);
        progress.save(state);
        const a = await learnSkill(c, log, shop.npcId, INFERNO.id);
        const ok = !a.learned && a.learnAfter === a.learnBefore && a.skillBonusAfter === a.skillBonusBefore && a.coinAfter === a.coin && a.notices.includes(NOTICE.notEnoughCoin);
        state.inferno = { ...a, ok, blocked: `aprender e conjurar o Inferno exige ${EIGHTH_SKILL_COIN.toLocaleString('pt-BR')} de gold; o personagem tem ${a.coin.toLocaleString('pt-BR')}` };
        if (a.learned || a.learnAfter !== a.learnBefore || a.skillBonusAfter !== a.skillBonusBefore || a.coinAfter !== a.coin) {
          fail(state, `Inferno sem os 50M de gold (gold ${a.coin}): Learn ${hex(a.learnBefore)}→${hex(a.learnAfter)}, SkillBonus ${a.skillBonusBefore}→${a.skillBonusAfter}, gold ${a.coin}→${a.coinAfter}`);
        } else if (!ok) {
          fail(state, `Inferno sem os 50M de gold: recusado, mas com ${a.notices.map(noticeName).join(',') || 'nenhum aviso'} em vez de notEnoughCoin (SkillBonus ${a.skillBonusBefore}, Special[2] ${a.special})`);
        }
        state.phase = 'relogin';
        progress.save(state);
        return 'in-progress'; // confere numa sessão nova
      }
      case 'relogin': {
        const spent = LEARNABLE.filter((s) => (me.learn & learnBit(s.id)) !== 0).reduce((n, s) => n + s.points, 0);
        const expectedSkillBonus = skillPointsAt(me.level) - spent;
        const checks = {
          allSeven: (me.learn & LEARNABLE_MASK) === LEARNABLE_MASK,
          noInferno: (me.learn & learnBit(INFERNO.id)) === 0,
          skillBonus: me.skillBonus === expectedSkillBonus,
        };
        state.relogin = { learn: me.learn, skillBonus: me.skillBonus, expectedSkillBonus, level: me.level, checks, ok: Object.values(checks).every(Boolean) };
        log.info('depois do relogin', state.relogin as unknown as Record<string, unknown>);
        if (!state.relogin.ok) fail(state, `depois do relogin: falhou ${failedChecks(checks).join(', ')} (Learn ${hex(me.learn)}, SkillBonus ${me.skillBonus}, esperado ${expectedSkillBonus})`);
        if (state.verdict !== 'fail') state.verdict = 'pass';
        state.phase = 'done';
        break;
      }
    }
    return state.phase === 'done' ? 'done' : 'in-progress';
  } catch (e) {
    if (e instanceof Relogin) {
      log.warn(e.message);
      return 'in-progress';
    }
    throw e;
  } finally {
    if (clock.running) state.playMs = clock.stop();
    progress.save(state);
    c.close();
  }
}

async function main(): Promise<number> {
  const cfg = { ...loadConfig('foema'), charClass: FOEMA };
  let state = progress.load();
  if (flag('--cleanup') || flag('--fresh')) {
    await cleanupScenario(cfg, state, progress as unknown as Progress<object>, log);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  const redo = opt('--skill');
  if (redo !== undefined) {
    // Repete o cast de uma skill: apaga o resultado dela e as falhas que a citam, e volta para a fase das skills.
    const s = LEARNABLE.find((x) => x.id === Number(redo));
    if (!s) throw new Error(`--skill inválida: ${redo} (use ${LEARNABLE.map((x) => x.id).join(', ')})`);
    if (state.skills[s.id]) delete state.skills[s.id].cast;
    state.failures = state.failures.filter((f) => !f.includes(`(${s.id})`));
    state.verdict = state.failures.length ? 'fail' : undefined;
    state.phase = 'skills';
    progress.save(state);
    log.info('repetindo o cast', { skill: s.id, name: s.name, failuresLeft: state.failures.length });
  }
  if (state.phase === 'done') {
    log.info('cenário já concluído; use --fresh para recomeçar', { verdict: state.verdict });
    writeReport(state, { reused: true });
    return state.verdict === 'fail' ? 1 : 0;
  }
  state.runs++;
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + budgetMs;
  const phase = (): Phase => state.phase; // muda dentro das sessões
  const snapshot = () => JSON.stringify([phase(), Object.keys(state.skills).length, state.pointRelogins.length, state.dust.uses]);
  let outcome: 'done' | 'in-progress' | 'error' = 'in-progress';
  let error: string | undefined;
  while (outcome === 'in-progress' && Date.now() < deadline && phase() !== 'done') {
    const before = snapshot();
    ({ outcome, error } = await runWithReconnect(log, deadline, () => runSession(cfg, state, deadline)));
    if (outcome === 'in-progress' && snapshot() === before) break; // sem avanço: orçamento
  }
  writeReport(state, { startedAt, endedAt: new Date().toISOString(), budget: Number.isFinite(budgetMs) ? `${budgetMs / 60000} min` : 'until-done', outcome, error });
  if (outcome === 'error') return 3;
  if (state.verdict === 'fail') {
    log.error('FALHOU', { failures: state.failures });
    return 1;
  }
  if (phase() !== 'done') {
    log.info('em progresso; rode de novo para continuar', { phase: state.phase });
    return 0;
  }
  log.info('PASSOU', { skills: LEARNABLE.map((s) => ({ id: s.id, learn: state.skills[s.id]?.learn?.ok, cast: state.skills[s.id]?.cast?.ok })) });
  return 0;
}

runMain(main, log);
