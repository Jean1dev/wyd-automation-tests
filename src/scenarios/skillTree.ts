// Cenários 6 a 9: as skills de uma árvore da Foema (Magia Negra 32–39, Magia Branca 24–31, Magia
// Especial 40–47) ou do BeastMaster (magias 48–55, evocações 56–63, transformações 64–71), numa
// conta só para a classe (WYD_ACCOUNT_FOEMA / WYD_ACCOUNT_BM), com um personagem por árvore.
// Como um jogador:
//   1. cria uma Foema e sobe de nível com a Poeira de Fada, distribuindo os atributos em Int e a
//      maestria em Special[árvore] só até o que a próxima skill pede;
//   2. a cada skill, assim que tem pontos, nível e maestria, aprende no mestre da classe
//      (MSG_ApplyBonus BonusType 2) e vai conjurar nos Gremlins a leste de Armia;
// e verifica que:
//   - um nível antes, o aprendizado é recusado (pontos ou requisito) sem mexer no Learn;
//   - o aprendizado liga o bit da skill, desconta exatamente o custo dela e não cobra gold;
//     aprender de novo é recusado;
//   - o cast volta com a mesma skill e o MP descontado pela fórmula do servidor, e faz o que a
//     skill faz: dano (em área, em vários alvos), Relâmpagos do Trovão, cura em si mesma pela
//     fórmula do legado, Flash e Desintoxicar sem dano, Julgamento Divino com o HP da Foema somado
//     ao dano de cada alvo e o HP dela em HP/6 + 1, buffs (Velocidade, Escudo Mágico, Arma
//     Mágica, Toque de Athena, Controle de Mana) com o affect e o efeito no score, e o Teleporte,
//     que não pode levar a Foema para uma coordenada escolhida pelo cliente;
//   - controles: skill não aprendida, sem MP, alvo fora do alcance, e comprar (MSG_Buy) a skill
//     do mestre como item;
//   - 8ª skill (Inferno / Renascimento): no nível exibido 220 com as 7 aprendidas e sem os 50M,
//     recusa sem mexer em nada;
//   - depois de relogar, o Learn e os pontos de skill continuam certos.
//
// É retomável: o estado fica em state/foema-{black,white,special}-magic.json.
//
// Uso:
//   npm run scenario:foema-black | scenario:foema-white | scenario:foema-special   # até 60 min
//   npm run scenario:foema-white -- --until-done
//   npm run scenario:foema-white -- --fresh | --cleanup
//   npm run scenario:foema-white -- --skill 27,30   # repete o cast de skills já aprendidas (e a 8ª e o relogin)
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient, Mob } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { BUILDS, CASTER_INT, HUNTRESS_STR, spendBuild, spendMastery, type MasteryResult } from '../bot/build.ts';
import { walkPath, walkTo } from '../bot/movement.ts';
import { buyItem, type Purchase } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { FAIRY_DUST, useDustUntil } from '../bot/quest.ts';
import { enterWorld, login } from '../bot/session.ts';
import { CAST_GAP_MS, castSkill, learnSkill, NOTICE, noticeName, openSkillShop, syntheticAttacks, tiles, type CastResult, type LearnAttempt } from '../bot/skills.ts';
import { reviveAfterDeath } from '../bot/survival.ts';
import { isInArmia } from '../bot/travel.ts';
import { shownLevel, sleep } from '../bot/util.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { FAIRY_DUST_PRICE, NPC } from '../world/coveiro.ts';
import {
  assaultScore, buffGain, CAST_SPOT, cumulativePoints, EIGHTH_SKILL_COIN, healAmount, HUNTRESS, possessedGain, TRANSKNIGHT, summonCount, SUMMON_MOB, summonMinSpecial, transformScore, judgmentHp, learnBit, learnLevel, manaCost,
  ROUTE_TO_CAST_SPOT, skillPointsAt, TREES, type SkillDef, type SkillTree, type TreeKey,
} from '../world/skillTrees.ts';
import { cleanupScenario, ensureCharacter, flag, opt, parseDuration, PlayClock, reportDirFor, runMain, runWithReconnect, writeReportFile, type CharacterState } from './common.ts';

const treeKey = (opt('--tree') ?? 'negra') as TreeKey;
if (!(treeKey in TREES)) throw new Error(`--tree inválida: ${treeKey} (use ${Object.keys(TREES).join(', ')})`);
const TREE: SkillTree = TREES[treeKey];
const SCENARIO = TREE.scenario;
/** O mestre de skills da classe. */
const SKILL_MASTER = TREE.master;
/** A Huntress bate com Str, o TK com o misto da comunidade; Foema e BM, com Int. */
const BUILD = TREE.cls === HUNTRESS ? HUNTRESS_STR : TREE.cls === TRANSKNIGHT ? BUILDS[0] : CASTER_INT;
const DUST_STACK = 255;
/** As 7 primeiras skills; a 8ª só tem o controle de recusa. */
const LEARNABLE = TREE.skills.filter((s) => s.kind !== 'eighth');
const EIGHTH = TREE.skills.find((s) => s.kind === 'eighth')!;
const LEARNABLE_MASK = LEARNABLE.reduce((m, s) => m | learnBit(s.id), 0);
/** Issue aberta para a compra da skill como item. */
const BUY_ISSUE = 'Jean1dev/w2pp-OpenWYD#391';

type Phase = 'skills' | 'eighth' | 'relogin' | 'done';

interface CastCheck {
  attempts: CastResult[];
  expectedMp: number;
  checks: Record<string, boolean>;
  ok: boolean;
  /** Trovão: Relâmpagos que o servidor disparou sozinho depois do cast. */
  thunder?: { ticks: { t: string; skillIndex: number; currentMp: number; hits: number; damage: number[] }[]; mpPerTick: number };
  /** Cura: o esperado pela fórmula e o HP antes/depois. */
  heal?: { expected: number; got?: number; hpBefore: number; hpAfter?: number; maxHp: number; damagedFirst: boolean };
  /** Flash: ataques dos mobs alvo na própria Foema nos 4 s antes e depois. */
  flash?: { attacksBefore: number; attacksAfter: number };
  /** Julgamento Divino: o HP antes, os danos por alvo e o HP depois. */
  judgment?: { hpBefore: number; hpAfter?: number; expectedHp: number[]; damage: { id: number; name: string; damage: number }[] };
  /** Buff: o affect que chegou e o score antes/depois. */
  buff?: { affect?: { type: number; value: number; level: number; time: number }; before: ScoreView; after: ScoreView; expectedGain: number; scores?: { t: string; maxHp?: number; ac: number; con?: number; level: number }[] };
  /** Evocação: a maestria, os bichos esperados e os que apareceram. */
  summon?: { special: number; expected: number; mob: string; appeared: { id: number; name: string; x: number; y: number }[] };
  /** Transformação: o affect, o score antes e depois e o esperado pela fórmula do legado. */
  transform?: { affect?: { type: number; value: number; level: number; time: number }; before: ScoreView; after: ScoreView; expected: { ac: number; maxHp: number; run: number }; waitedMs: number };
  /** Passiva: o cast dela (recusado) e a transformação que ela melhora, refeita. */
  passive?: { cast: CastResult; boosted?: CastCheck };
  /** Teleporte: em si mesma, na própria posição e numa coordenada escolhida pelo cliente. */
  teleport?: { self: { from: Pt; to: Pt; moved?: Pt }; remote: { from: Pt; target: Pt; moved?: Pt } };
  note?: string;
}

type Pt = { x: number; y: number };
interface ScoreView { ac: number; damage: number; run: number; special: number[]; maxHp: number; mp: number; resist: number[]; con: number }

interface SkillRecord {
  id: number;
  name: string;
  expectedLevel: number;
  early?: LearnAttempt & { expected: number[]; ok: boolean };
  shop?: { npcId: number; shopType: number; listed: boolean };
  learn?: LearnAttempt & { checks: Record<string, boolean>; ok: boolean; acBefore?: number; acAfter?: number; specialAtLearn?: number };
  again?: LearnAttempt & { ok: boolean };
  cast?: CastCheck;
}

interface State extends CharacterState {
  scenario: string;
  tree: string;
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
    buyAsItem?: { npcSlot: number; index: number; slot: number; gotItem?: number; notices: number[]; texts?: string[]; coinBefore: number; coinAfter: number; ok: boolean };
  };
  /** Relogins pedidos porque o SkillBonus não acompanhou o nível (o login recalcula). */
  pointRelogins: number[];
  relearn?: LearnAttempt & { ok: boolean };
  eighth?: LearnAttempt & { ok: boolean; blocked: string };
  relogin?: { learn: number; skillBonus: number; expectedSkillBonus: number; level: number; checks: Record<string, boolean>; ok: boolean };
  verdict?: 'pass' | 'fail';
  failures: string[];
}

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  tree: TREE.label,
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
const special = (c: GameClient) => c.self!.special[TREE.tree] ?? 0;
const learned = (c: GameClient, id: number) => (c.self!.learn & learnBit(id)) !== 0;
const failedChecks = (checks: Record<string, boolean>) => Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
const isAttack = (type: number) => type === Op.Attack || type === Op.AttackOne || type === Op.AttackTwo;

/** Tem nível, pontos e maestria para aprender a skill agora? */
function eligible(c: GameClient, s: SkillDef): boolean {
  const me = c.self!;
  return me.level >= s.reqLevel && me.skillBonus >= s.points && special(c) >= s.reqSpecial;
}

/** Com mais um nível (+3/+4 pontos e +2 de maestria) a skill fica disponível? */
function eligibleNext(c: GameClient, s: SkillDef): boolean {
  const me = c.self!;
  const lv = me.level + 1;
  const mastery = Math.min(Math.min((3 * (lv + 1)) >> 1, 200), special(c) + me.specialBonus + 2);
  return lv >= s.reqLevel && me.skillBonus + (lv > 199 ? 4 : 3) >= s.points && mastery >= s.reqSpecial;
}

/** A recusa que o servidor deve dar agora (a ordem de learnSkill: pontos antes dos requisitos). */
function expectedRefusal(c: GameClient, s: SkillDef): number {
  return c.self!.skillBonus < s.points ? NOTICE.notEnoughSkillPoint : NOTICE.reqNotMet;
}

function recordLevel(c: GameClient, state: State): void {
  const me = c.self!;
  state.levelCurve.push({ t: new Date().toISOString(), level: me.level, skillBonus: me.skillBonus, special: special(c), specialBonus: me.specialBonus, int: me.attrs.int, maxMp: me.maxMp });
}

async function spendPoints(c: GameClient, state: State, masteryUntil: number): Promise<void> {
  await spendBuild(c, log, BUILD);
  if (c.self!.specialBonus > 0 && special(c) < masteryUntil) {
    const m = await spendMastery(c, log, TREE.tree, masteryUntil);
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
      const step = Math.min(2, within);
      await walkTo(c, m.x + Math.sign(me.x - m.x) * step, m.y + Math.sign(me.y - m.y) * step);
    } else {
      await walkTo(c, CAST_SPOT.x + ((i % 3) - 1) * 6, CAST_SPOT.y + ((i % 2) * 2 - 1) * 6);
    }
    await sleep(800);
  }
  throw new Error(`nenhum mob a até ${within} tiles perto de (${me.x},${me.y})`);
}

/** Ataques de mobs na própria Foema desde `since` (de quem está em `from`, se dado). */
function attacksOnMe(c: GameClient, since: number, from?: Set<number>): number {
  const me = c.self!;
  return c.framesSince(since).filter((f) => isAttack(f.header.type) && f.body.length >= 56).map((f) => P.parseAttack(f.body))
    .filter((a) => a.attackerId !== me.clientId && (!from || from.has(a.attackerId)) && a.dam.some((d) => d.targetId === me.clientId)).length;
}

/** Espera os mobs tirarem HP da Foema (para testar a cura), parada no meio dos Gremlins. */
async function getHurt(c: GameClient, below: number, maxWaitMs = 90_000): Promise<boolean> {
  const me = c.self!;
  await goToCastSpot(c);
  const t0 = Date.now();
  while (me.hp >= below && Date.now() - t0 < maxWaitMs) {
    const m = mobsByDistance(c)[0];
    if (m && tiles(me, m) > 3) await walkTo(c, m.x + Math.sign(me.x - m.x), m.y + Math.sign(me.y - m.y));
    await sleep(1500);
  }
  return me.hp < below;
}

// ---------------------------------------------------------------- aprender

async function learnStep(c: GameClient, state: State, s: SkillDef): Promise<void> {
  const me = c.self!;
  const rec = state.skills[s.id];
  // Sobe até ter pontos, nível e maestria; um nível antes, o controle de recusa.
  await spendPoints(c, state, s.reqSpecial);
  let levels = 0;
  while (!eligible(c, s)) {
    if (me.level > rec.expectedLevel + 2) {
      const msg = `skill ${s.id} (${s.name}): no nível exibido ${shownLevel(me.level)} o SkillBonus é ${me.skillBonus} e a maestria ${special(c)}; esperado ≥ ${s.points} pontos e Special[${TREE.tree}] ≥ ${s.reqSpecial} desde o nível exibido ${shownLevel(rec.expectedLevel)} (${skillPointsAt(me.level)} pontos pelo nível − ${cumulativePoints(TREE, s.id) - s.points} gastos)`;
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
        fail(state, `skill ${s.id} (${s.name}) foi aprendida um nível antes (nível exibido ${shownLevel(a.level)}, SkillBonus ${a.skillBonusBefore}/${s.points}, Special[${TREE.tree}] ${a.special}/${s.reqSpecial}): Learn ${hex(a.learnBefore)}→${hex(a.learnAfter)}, SkillBonus ${a.skillBonusBefore}→${a.skillBonusAfter}`);
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
  const acBefore = me.ac;
  const a = await learnSkill(c, log, shop.npcId, s.id);
  const checks = {
    bitSet: a.learned,
    onlyThisBit: (a.learnAfter ^ a.learnBefore) === learnBit(s.id),
    pointsCharged: a.skillBonusBefore - a.skillBonusAfter === s.points,
    noGold: a.coinAfter === a.coin,
    noRefusal: a.notices.length === 0,
  };
  rec.learn = { ...a, checks, ok: Object.values(checks).every(Boolean), acBefore, acAfter: me.ac, specialAtLearn: special(c) };
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

const echoOk = (r: CastResult, s: SkillDef) => !!r.echo && r.echo.skillIndex === s.id;
const mpOk = (r: CastResult, s: SkillDef) => r.mpSpent === manaCost(s.mana, r.special);

/**
 * Trovão / Aura Bestial: buff em si mesma que dispara sozinho a skill do tick (Relâmpago 33 / Fúria
 * de Gaia 52) nos mobs a até 4 tiles a noroeste.
 */
async function castThunder(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
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
    mpPerTick: manaCost(s.tick!.mana, special(c)), // cada tick é um cast cobrado
  };
  cc.checks = {
    echo: echoOk(r, s),
    mpCharged: mpOk(r, s),
    thunderFires: ticks.some((t) => t.skillIndex === s.tick!.skill),
    thunderDamages: ticks.some((t) => t.dam.some((d) => d.damage > 0)),
  };
}

/**
 * Cura em si mesma: o eco traz −cura e o HP sobe. Os Gremlins não atacam sozinhos (o clã deles
 * não puxa briga), então, com o Julgamento Divino aprendido, a Foema o usa para ficar com HP/6 + 1;
 * sem ele, espera os mobs tirarem HP.
 */
async function castHeal(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const expected = healAmount(s, special(c));
  const judgment = TREE.skills.find((k) => k.kind === 'judgment');
  let damagedFirst = false;
  if (judgment && learned(c, judgment.id) && me.mp >= manaCost(judgment.mana, special(c)) + manaCost(s.mana, special(c))) {
    const [m] = await mobsInReach(c, judgment.range);
    const r = await castSkill(c, log, judgment.id, [m]);
    damagedFirst = !!r.echo && me.hp < me.maxHp;
    log.info('HP derrubado com o Julgamento Divino para testar a cura', { hp: me.hp, maxHp: me.maxHp });
  }
  if (!damagedFirst) damagedFirst = await getHurt(c, me.maxHp - Math.min(expected, me.maxHp / 3));
  if (me.hp <= 0) await reviveAfterDeath(c, log);
  const hpBefore = me.hp;
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  const got = r.echo?.dam.find((d) => d.targetId === me.clientId)?.damage;
  cc.heal = { expected: healAmount(s, r.special), got: got === undefined ? undefined : -got, hpBefore, hpAfter: r.echo?.currentHp, maxHp: me.maxHp, damagedFirst };
  cc.checks = {
    echo: echoOk(r, s),
    mpCharged: mpOk(r, s),
    healAmount: got === -healAmount(s, r.special),
    hpRose: damagedFirst ? (r.echo?.currentHp ?? 0) === Math.min(me.maxHp, hpBefore + healAmount(s, r.special)) : (r.echo?.currentHp ?? 0) === me.maxHp,
  };
  if (!damagedFirst) cc.note = 'os mobs não tiraram HP em 90 s e o Julgamento Divino ainda não estava aprendido; a cura foi conjurada com o HP cheio';
}

/** Desintoxicar em si mesma: sem dano. Tirar um debuff não é exercitado (os mobs não envenenam). */
async function castDetox(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), noDamage: !!r.echo && r.echo.dam.every((d) => d.damage === 0) };
  cc.note = 'sem debuff na Foema: os Gremlins não envenenam e a lentidão (Lança de Gelo) só vem de outro jogador; o que a skill tira não foi exercitado';
}

/** Flash nos mobs em volta: sem dano; os mobs saem de combate (informativo: eles voltam a atacar). */
async function castFlash(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  await goToCastSpot(c);
  await getHurt(c, c.self!.maxHp, 30_000); // espera os mobs entrarem em combate
  const targets = (await mobsInReach(c, 4)).slice(0, P.MAX_ATTACK_TARGETS);
  const ids = new Set(targets.map((m) => m.id));
  const before = c.mark;
  await sleep(4000);
  const attacksBefore = attacksOnMe(c, before, ids);
  const r = await castSkill(c, log, s.id, targets.slice(0, s.maxTarget + 1));
  cc.attempts.push(r);
  const after = c.mark;
  await sleep(4000);
  cc.flash = { attacksBefore, attacksAfter: attacksOnMe(c, after, ids) };
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), noDamage: !!r.echo && r.echo.dam.every((d) => d.damage <= 0) };
  cc.note = `ataques dos alvos na Foema: ${attacksBefore} nos 4 s antes, ${cc.flash.attacksAfter} nos 4 s depois (os mobs voltam a atacar quem está à vista)`;
}

/**
 * Julgamento Divino nos mobs colados: o legado soma o HP da Foema de ANTES do golpe ao dano de
 * cada alvo (_MSG_Attack.cpp:281 e 1028-1033) e deixa a Foema com HP/6 + 1 a cada alvo.
 */
async function castJudgment(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  await rest(c, manaCost(s.mana, special(c)));
  await goToCastSpot(c);
  // Os Gremlins não vêm atacar, então a Foema espera dois deles, andando, ficarem a até 2 tiles
  // um do outro e para no tile colado aos dois.
  const t0 = Date.now();
  let close: Mob[] = [];
  while (Date.now() - t0 < 180_000) {
    close = mobsByDistance(c).filter((m) => tiles(me, m) <= s.range);
    if (close.length >= 2) break;
    const mobs = mobsByDistance(c).filter((m) => tiles(me, m) <= 15);
    let pair: [Mob, Mob] | undefined;
    for (let i = 0; i < mobs.length && !pair; i++) for (let j = i + 1; j < mobs.length && !pair; j++) if (tiles(mobs[i], mobs[j]) <= 2) pair = [mobs[i], mobs[j]];
    if (pair) await walkTo(c, Math.round((pair[0].x + pair[1].x) / 2), Math.round((pair[0].y + pair[1].y) / 2));
    await sleep(pair ? 300 : 1000);
  }
  if (!close.length) close = await mobsInReach(c, s.range);
  // Mobs com a mesma AC do primeiro (Gremlin e Gremlin_ têm AC 4), para comparar os danos.
  const targets = close.filter((m) => m.ac === close[0].ac).slice(0, s.maxTarget + 1);
  const hpBefore = me.hp;
  const r = await castSkill(c, log, s.id, targets);
  cc.attempts.push(r);
  const damage = targets.map((m) => ({ id: m.id, name: m.name, damage: r.echo?.dam.find((d) => d.targetId === m.id)?.damage ?? 0 }));
  const hits = damage.filter((d) => d.damage > 0);
  const hpAfter = r.setHpMp.at(-1)?.hp ?? r.echo?.currentHp;
  const expectedHp = targets.map((_, k) => judgmentHp(hpBefore, k + 1));
  cc.judgment = { hpBefore, hpAfter, expectedHp, damage };
  cc.checks = {
    echo: echoOk(r, s),
    mpCharged: mpOk(r, s),
    damage: hits.length > 0,
    hpBonusFirst: hits.length > 0 && hits[0].damage > hpBefore,
    casterHp: hpAfter !== undefined && expectedHp.includes(hpAfter),
  };
  if (hits.length >= 2) {
    // Todo alvo leva o HP de antes. O dano base sorteia 90–110% (combat.SkillDamage) e os alvos têm
    // a mesma AC, então o de cada alvo é pelo menos 90/110 do dano base do primeiro.
    const base1 = hits[0].damage - hpBefore;
    cc.checks.hpBonusEveryTarget = hits.slice(1).every((h) => h.damage - hpBefore >= Math.floor((base1 * 90) / 110));
  } else {
    cc.note = 'só um mob colado; a soma do HP em cada alvo não foi exercitada';
  }
  await rest(c, 0); // volta a Armia com HP/6
}

const scoreView = (c: GameClient): ScoreView => {
  const me = c.self!;
  return { ac: me.ac, damage: me.damage, run: (me.attackRun ?? 0) & 0x0f, special: [...me.special], maxHp: me.maxHp, mp: me.mp, resist: [...(me.resist ?? [])], con: me.attrs.con };
};

/** Buff em si mesma: chega o SendAffect com o tipo e o nível (= a maestria) e o score muda pela fórmula. */
async function castBuff(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const fx = s.affect!;
  // Com o mesmo buff ainda ativo (de uma execução anterior), o score não muda: espera ele acabar.
  if (me.affects.some((a) => a.type === fx.type)) {
    log.info('esperando o buff anterior acabar', { type: fx.type, affects: me.affects });
    const t0 = Date.now();
    while (me.affects.some((a) => a.type === fx.type) && Date.now() - t0 < 15 * 60_000) await sleep(5000);
  }
  await sleep(1000);
  const markBefore = c.mark;
  const before = scoreView(c);
  const coinBefore = me.coin;
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  await sleep(1000); // UpdateScore com o buff
  const after = scoreView(c);
  // Os UpdateScore do próprio personagem desde a medição de antes, para conferir à mão.
  const scores = c.framesSince(markBefore).filter((f) => f.header.type === Op.UpdateScore && f.header.id === me.clientId)
    .map((f) => { const u = P.parseUpdateScore(f.body); return { t: new Date(f.at).toISOString(), maxHp: u.maxHp, ac: u.ac, con: u.attrs?.con, level: u.level }; });
  const affect = r.affects.filter((a) => a.targetId === me.clientId).flatMap((a) => a.affects).find((a) => a.type === fx.type);
  const level = affect?.level ?? r.special;
  const expectedGain = buffGain(fx.type, fx.value, level, me.learn);
  cc.buff = { affect, before, after, expectedGain, scores };
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), affect: !!affect, affectLevel: affect?.level === r.special };
  // A 85 cobra 100 × Special[2] de gold antes do MP (_MSG_Attack.cpp:223-232, combat.go validateCast).
  if (s.id === 85) {
    cc.checks.goldCharged = coinBefore - me.coin === 100 * r.special;
    cc.note = `gold ${coinBefore} → ${me.coin} (esperado −${100 * r.special})`;
  }
  if ([19, 26, 27, 36, 37].includes(fx.type)) cc.note = `affect ${fx.type}: o efeito (bloqueio, parry, congelar/drenar com a arma certa, dano extra) só aparece em combate ou com arma; vale o affect`;
  switch (fx.type) {
    case 2: cc.checks.runUp = after.run === before.run + expectedGain; break;
    case 11: case 21: case 31: cc.checks.acChange = after.ac - before.ac === expectedGain; break;
    case 9: cc.checks.damageUp = after.damage - before.damage === expectedGain; break;
    case 15: cc.checks.specialUp = after.special.every((v, k) => v - before.special[k] === expectedGain); break;
    case 13: {
      const exp = assaultScore({ damage: before.damage, maxHp: before.maxHp });
      // O HP máximo mostrado leva o EF_HPADD do equipamento: base M = mostrado/(1 + pct); o legado dá ⌊M×9/10⌋.
      const m = Math.round(before.maxHp / 1.05);
      const legacyHp = Math.trunc((Math.trunc((m * 9) / 10) * 105) / 100);
      cc.checks.maxHpExact = after.maxHp === legacyHp;
      // O dano não é comparável direto: o Go separa o dano da arma (weaponDamage) e aplica os +15% e o
      // DAMAGEMULTI só na parte base (handler/item.go effectiveDamage); fica informativo.
      cc.note = `dano ${before.damage} → ${after.damage} (legado, com a arma dentro do Damage: ${exp.damage} antes do DAMAGEMULTI); HP máx. ${before.maxHp} → ${after.maxHp} (legado ⌊M×9/10⌋ com o HPADD: ${legacyHp})`;
      break;
    }
    case 14: {
      const v = possessedGain(level, fx.value);
      cc.checks.conUp = after.con - before.con === v;
      // O HP máximo mostrado é (MaxHP + buffs) × (100 + EF_HPADD%)/100 (handler/item.go effectiveMaxHP):
      // os +2v do buff saem multiplicados pelo HPADD do equipamento (o TK novo tem +5%).
      const pct = Math.round(((after.maxHp - before.maxHp) / (2 * v) - 1) * 100);
      cc.checks.maxHpUp = after.maxHp - before.maxHp >= 2 * v && pct >= 0 && pct <= 30;
      cc.note = `Con ${before.con} → ${after.con}, HP máx. ${before.maxHp} → ${after.maxHp} = +2v × ${100 + pct}% (EF_HPADD do equipamento; v = ${level}×3/4 + ${fx.value} = ${v}; a conta do Go/"Buff Loop.txt", não a do Basedef.cpp:4053)`;
      break;
    }
    case 17: cc.note = 'Aura da Vida: o tick 17 (cura por tempo) chegou como affect; a cura não foi exercitada (os Gremlins não tiram HP)'; break;
    case 24: cc.note = 'Samaritano: o efeito diverge do legado de propósito no Go (issue #267); vale o affect'; break;
    case 18: cc.note = 'Controle de Mana: o affect 18 chegou; o dano virar gasto de MP não foi exercitado (os Gremlins não atacam)'; break;
    case 25: {
      // Três das quatro resistências sobem; quais três é uma escolha deliberada do Go (issue #233).
      const deltas = after.resist.map((v, k) => v - (before.resist[k] ?? 0));
      cc.checks.resistUp = deltas.filter((d) => d === expectedGain).length === 3 && deltas.filter((d) => d === 0).length === 1;
      cc.note = `resistências ${before.resist.join('/')} → ${after.resist.join('/')}`;
      break;
    }
  }
}

/**
 * Teleporte (InstanceType 9) em si mesma. O legado puxa o alvo para a posição da Foema no
 * servidor (DoSummon(idx, pMob[conn].TargetX, pMob[conn].TargetY), _MSG_Attack.cpp:781), então
 * nela mesma não sai do lugar, nem quando o pacote traz outra coordenada.
 */
async function castTeleport(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const movedTo = async (since: number): Promise<Pt | undefined> => {
    await sleep(1500);
    const tp = c.framesSince(since).find((f) => f.header.type === Op.Action && f.header.id === me.clientId && f.body.length >= 40 && f.body.readInt32LE(4) === 1);
    return tp ? { x: P.parseAction(tp.body).targetX, y: P.parseAction(tp.body).targetY } : undefined;
  };
  const from1 = { x: me.x, y: me.y };
  let since = c.mark;
  const r1 = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r1);
  const moved1 = await movedTo(since);
  // Agora com o destino do pacote 15 tiles a sudeste, ainda no campo dos Gremlins.
  const from2 = { x: me.x, y: me.y };
  const target = { x: from2.x + 15, y: from2.y + 10 };
  since = c.mark;
  const r2 = await castSkill(c, log, s.id, 'self', 3000, target);
  cc.attempts.push(r2);
  const moved2 = await movedTo(since);
  cc.teleport = { self: { from: from1, to: from1, moved: moved1 }, remote: { from: from2, target, moved: moved2 } };
  const far = (a: Pt, b?: Pt) => !!b && tiles(a, b) > 2;
  cc.checks = {
    echo: echoOk(r1, s),
    mpCharged: mpOk(r1, s),
    staysInPlace: !far(from1, moved1),
    noRemoteTeleport: !far(from2, moved2),
  };
  if (moved2 && far(from2, moved2)) await walkTo(c, from2.x, from2.y);
}

/** Debuff hostil sem dano (Enfraquecer) nos mobs ao alcance. Em mob o SetAffect não pega (só jogador). */
async function castDebuff(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const targets = (await mobsInReach(c, s.range > 0 ? Math.max(1, s.range - 2) : 4)).slice(0, s.maxTarget + 1);
  const r = await castSkill(c, log, s.id, targets);
  cc.attempts.push(r);
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), noDamage: !!r.echo && r.echo.dam.every((d) => d.damage <= 0) };
  cc.note = `${targets.length} alvo(s); o debuff (affect ${s.affect?.type}) só pega em jogador, como no legado (Server.cpp SetAffect): ${r.affects.length ? 'veio SendAffect' : 'nenhum SendAffect'}`;
}

/** Chamas Etéreas num mob: só age em jogador (queima MP ou tira buffs); em mob vale o cast. */
async function castEthereal(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const [m] = await mobsInReach(c, s.range - 2);
  const r = await castSkill(c, log, s.id, [m]);
  cc.attempts.push(r);
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s) };
  cc.note = `dano no mob: ${r.echo?.dam.map((d) => d.damage).join('/') ?? '—'} (o efeito em jogador não foi exercitado)`;
}

/**
 * Evocação: com Special[2] suficiente, evoca Special[2]/30, /40 ou /80 bichos do modelo da skill
 * perto do BM. Antes, sobe a maestria até evocar ao menos um. Depois reloga, porque o logout
 * recolhe os bichos (handler/character.go:643) e uma evocação de outro tipo falha com bicho vivo.
 */
async function castSummon(c: GameClient, state: State, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const need = summonMinSpecial(s.summon!);
  let leveled = 0;
  await spendPoints(c, state, need);
  while (special(c) < need && leveled < 60) {
    await ensureDust(c, state, me.level + 1);
    await levelOnce(c, state, need);
    leveled++;
  }
  if (leveled) log.info('maestria para evocar', { skill: s.id, special: special(c), need, levels: leveled });
  await rest(c, manaCost(s.mana, special(c)));
  await goToCastSpot(c);
  const before = new Set(c.mobs.keys());
  const expected = summonCount(s.summon!, special(c));
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  await sleep(2500); // CreateMob dos bichos
  const mobName = SUMMON_MOB[s.summon!];
  const fresh = [...c.mobs.values()].filter((m) => !before.has(m.id) && !m.isPlayer && tiles(me, m) <= 6);
  // O nome no jogo troca o _ do arquivo por espaço e leva um ^ no fim ("Dragao Negro^").
  const norm = (n: string) => n.replace(/[_^]/g, ' ').trim();
  const appeared = fresh.filter((m) => norm(m.name).startsWith(norm(mobName)));
  cc.summon = { special: r.special, expected, mob: mobName, appeared: appeared.map((m) => ({ id: m.id, name: m.name, x: m.x, y: m.y })) };
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), summoned: appeared.length === expected };
  if (fresh.length !== appeared.length) cc.note = `outros mobs novos perto: ${fresh.filter((m) => !appeared.includes(m)).map((m) => m.name).join(', ')}`;
  cc.ok = Object.values(cc.checks).every(Boolean);
  rec(state, s).cast = cc;
  if (!cc.ok) fail(state, `evocar com ${s.name} (${s.id}) no nível exibido ${shownLevel(me.level)}: falhou ${failedChecks(cc.checks).join(', ')} (Special[2] ${r.special}, esperados ${expected} ${mobName}, apareceram ${appeared.length}; eco ${r.echo ? `MP ${r.mpBefore}→${r.echo.currentMp} (esperado −${manaCost(s.mana, r.special)})` : 'nenhum'})`);
  progress.save(state);
  throw new Relogin('relogar para recolher os bichos antes da próxima evocação');
}

const rec = (state: State, s: SkillDef) => state.skills[s.id];

/**
 * Transformação: espera a anterior acabar (os affects voltam no login, então não basta relogar),
 * mede o score sem transformação e confere AC, HP máximo e corrida pela fórmula do legado.
 */
async function castTransform(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const t0 = Date.now();
  if (me.affects.some((a) => a.type === 16)) {
    log.info('esperando a transformação anterior acabar', { affects: me.affects });
    await goToArmia(c);
    while (me.affects.some((a) => a.type === 16) && Date.now() - t0 < 15 * 60_000) await sleep(5000);
  }
  await rest(c, manaCost(s.mana, special(c)));
  await sleep(1500);
  const before = scoreView(c);
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  await sleep(1500);
  const after = scoreView(c);
  const affect = me.affects.find((a) => a.type === 16) ?? r.affects.flatMap((a) => a.affects).find((a) => a.type === 16);
  const expected = transformScore(s.affect!.value, affect?.level ?? r.special, me.learn, { ac: before.ac, maxHp: before.maxHp, run: before.run });
  cc.transform = { affect, before, after, expected, waitedMs: Date.now() - t0 };
  cc.checks = {
    echo: echoOk(r, s),
    mpCharged: mpOk(r, s),
    affect: affect?.value === s.affect!.value,
    acExact: after.ac === expected.ac,
    maxHpExact: after.maxHp === expected.maxHp,
    run: after.run === expected.run,
  };
}

/**
 * Passiva: o cast é recusado (Passive, combat.go validateCast). Se ela melhora uma transformação,
 * refaz a transformação; se soma AC (Proteção das Sombras), confere o ganho de quando foi aprendida.
 */
async function castPassive(c: GameClient, state: State, s: SkillDef, cc: CastCheck): Promise<void> {
  const r = await castSkill(c, log, s.id, 'self');
  cc.attempts.push(r);
  if (!s.boosts) {
    cc.checks = { castRefused: !r.echo };
    const l = rec(state, s).learn;
    if (s.passiveAc && l?.acBefore !== undefined && l.acAfter !== undefined) {
      // O legado (e o Go) só soma com o bit 23 (Invisibilidade, a 8ª), não com o bit da própria 94.
      const bit23 = (l.learnAfter & (1 << 23)) !== 0;
      const expected = bit23 ? Math.trunc((l.specialAtLearn ?? 0) / 3) + 10 : 0;
      cc.checks.acOnLearn = l.acAfter - l.acBefore === expected;
      cc.note = `AC ao aprender: ${l.acBefore} → ${l.acAfter} (esperado +${expected}: o legado soma Special[3]/3 + 10 = ${Math.trunc((l.specialAtLearn ?? 0) / 3) + 10} só com o bit 23, da Invisibilidade, Basedef.cpp:3867)`;
    } else {
      cc.note = 'passiva: o efeito só aparece em combate ou com arma (Basedef.cpp / handler/item.go); vale a recusa do cast';
    }
    return;
  }
  const boosted: CastCheck = { attempts: [], expectedMp: 0, checks: {}, ok: false };
  const target = TREE.skills.find((k) => k.id === s.boosts)!;
  await castTransform(c, target, boosted);
  boosted.ok = Object.values(boosted.checks).every(Boolean);
  cc.passive = { cast: r, boosted };
  cc.checks = { castRefused: !r.echo, noMp: r.echo === undefined, boostedTransform: boosted.ok };
  cc.note = `${target.name} refeito com ${s.name}: AC ${boosted.transform?.before.ac}→${boosted.transform?.after.ac} (esperado ${boosted.transform?.expected.ac}), HP máx. ${boosted.transform?.before.maxHp}→${boosted.transform?.after.maxHp} (esperado ${boosted.transform?.expected.maxHp})`;
}

/**
 * Ilusão: o MSG_Action3 move a Huntress e cobra 45 de MP (o ManaSpent, sem escala:
 * _MSG_Action.cpp:81-90, handler/movement.go consumeIllusion). O servidor não ecoa o próprio
 * movimento, então o MP é conferido pelo eco do cast seguinte.
 */
async function castIllusion(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  const probe = TREE.skills.find((k) => k.kind === 'damage' && learned(c, k.id))!;
  await rest(c, s.mana + manaCost(probe.mana, special(c)) + 10);
  await goToCastSpot(c);
  const mpBefore = me.mp;
  const from = { x: me.x, y: me.y };
  const to = { x: me.x - 5, y: me.y };
  c.send(Op.Action3, P.action({ posX: from.x, posY: from.y, effect: 0, speed: (me.attackRun ?? 2) & 0x0f, targetX: to.x, targetY: to.y }));
  me.x = to.x; me.y = to.y;
  await sleep(1200); // > 900 ms: o próximo movimento antes disso é crack (103)
  const [m] = await mobsInReach(c, Math.max(1, probe.range - 1));
  const r = await castSkill(c, log, probe.id, [m]);
  cc.attempts.push(r);
  const spent = r.echo ? mpBefore - r.echo.currentMp : undefined;
  const expected = s.mana + manaCost(probe.mana, r.special);
  cc.checks = { probeEcho: !!r.echo, illusionMp: spent === expected };
  cc.note = `MP ${mpBefore} → ${r.echo?.currentMp} depois da Ilusão de (${from.x},${from.y}) para (${to.x},${to.y}) e de ${probe.name}: −${spent} (esperado −${s.mana} − ${manaCost(probe.mana, r.special)})`;
}

/**
 * Fúria Divina: com chance (Special/5 + 40 + diferença de nível/4, até 50%), puxa o mob para o tile
 * vizinho do TK, sem dano. Tenta até 6 vezes num mob a 3–5 tiles.
 */
async function castPull(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  let pulled: { from: Pt; to: Pt } | undefined;
  for (let i = 0; i < 6 && !pulled; i++) {
    if (me.mp < manaCost(s.mana, special(c))) await rest(c, manaCost(s.mana, special(c)) * 2), await goToCastSpot(c);
    // Um mob a 3–5 tiles: colado no TK, puxar não muda nada. Sem nenhum, a 4 tiles do mais perto.
    const farEnough = () => mobsByDistance(c).find((x) => tiles(me, x) >= 3 && tiles(me, x) <= s.range - 1);
    let m = farEnough();
    for (let k = 0; k < 4 && !m; k++) {
      const n = mobsByDistance(c)[0];
      if (n) await walkTo(c, n.x + (me.x >= n.x ? 4 : -4), n.y);
      await sleep(1000);
      m = farEnough();
    }
    if (!m) continue;
    const from = { x: m.x, y: m.y };
    const r = await castSkill(c, log, s.id, [m]);
    cc.attempts.push(r);
    await sleep(1200);
    const now = c.mobs.get(m.id);
    if (now && tiles(me, now) <= 1 && tiles(from, now) >= 2) pulled = { from, to: { x: now.x, y: now.y } };
  }
  const r = cc.attempts.at(-1);
  if (!r) {
    cc.checks = { targetFound: false };
    cc.note = 'nenhum mob a 3–5 tiles para puxar';
    return;
  }
  cc.checks = { echo: echoOk(r, s), mpCharged: mpOk(r, s), noDamage: cc.attempts.every((a) => !a.echo || a.echo.dam.every((d) => d.damage <= 0)), pulled: !!pulled };
  cc.note = pulled ? `mob puxado de (${pulled.from.x},${pulled.from.y}) para (${pulled.to.x},${pulled.to.y}) em ${cc.attempts.length} cast(s)` : `nenhum mob puxado em ${cc.attempts.length} casts (chance de até 50% por cast)`;
}

/** Exterminar: gasta todo o MP e soma MP + Int/2 ao dano (handler/combat.go:717-724). */
async function castExterminate(c: GameClient, s: SkillDef, cc: CastCheck): Promise<void> {
  const me = c.self!;
  await rest(c, me.maxMp);
  await goToCastSpot(c);
  const [m] = await mobsInReach(c, Math.max(1, s.range - 2));
  const r = await castSkill(c, log, s.id, [m]);
  cc.attempts.push(r);
  const dmg = r.echo?.dam.find((d) => d.targetId === m.id)?.damage ?? 0;
  cc.checks = { echo: echoOk(r, s), allMpSpent: r.echo?.currentMp === 0, damageWithMp: dmg >= r.mpBefore };
  cc.note = `MP ${r.mpBefore} → ${r.echo?.currentMp}; dano ${dmg} (≥ MP + Int/2 = ${r.mpBefore} + ${Math.trunc(me.attrs.int / 2)})`;
}

async function castStep(c: GameClient, state: State, s: SkillDef): Promise<void> {
  const me = c.self!;
  const rec = state.skills[s.id];
  const expectedMp = () => manaCost(s.mana, special(c));
  await rest(c, expectedMp());
  await goToCastSpot(c);
  const cc: CastCheck = { attempts: [], expectedMp: expectedMp(), checks: {}, ok: false };

  switch (s.kind) {
    case 'thunder': await castThunder(c, s, cc); break;
    case 'heal': await castHeal(c, s, cc); break;
    case 'detox': await castDetox(c, s, cc); break;
    case 'flash': await castFlash(c, s, cc); break;
    case 'judgment': await castJudgment(c, s, cc); break;
    case 'buff': await castBuff(c, s, cc); break;
    case 'teleport': await castTeleport(c, s, cc); break;
    case 'debuff': await castDebuff(c, s, cc); break;
    case 'ethereal': await castEthereal(c, s, cc); break;
    case 'summon': await castSummon(c, state, s, cc); break;
    case 'transform': await castTransform(c, s, cc); break;
    case 'passive': await castPassive(c, state, s, cc); break;
    case 'illusion': await castIllusion(c, s, cc); break;
    case 'pull': await castPull(c, s, cc); break;
    case 'exterminate': await castExterminate(c, s, cc); break;
    case 'utility':
      cc.checks = { learned: learned(c, s.id) };
      cc.note = 'usada na combinação de itens (_MSG_CombineItemAlquimia / Extracao), não por cast; só o aprendizado foi testado';
      break;
    default: {
      const within = Math.max(1, s.range - 2); // a distância do servidor é a da tabela; folga de 2 tiles (1 no alcance 2)
      for (let i = 0; i < 4; i++) {
        if (me.hp <= 0 || me.hp < me.maxHp * 0.35 || me.mp < expectedMp()) {
          await rest(c, expectedMp());
          await goToCastSpot(c);
        }
        const near = await mobsInReach(c, within);
        if (s.kind === 'area' && near.length < 2 && i < 3) {
          // procura um ponto com dois mobs ao alcance
          const two = mobsByDistance(c).slice(0, 2);
          if (two.length === 2) await walkTo(c, Math.round((two[0].x + two[1].x) / 2), Math.round((two[0].y + two[1].y) / 2));
          await sleep(800);
        }
        const targets = s.kind === 'area' ? (await mobsInReach(c, within)).slice(0, s.maxTarget) : near.slice(0, 1);
        const r = await castSkill(c, log, s.id, targets);
        cc.attempts.push(r);
        const hits = r.echo?.dam.filter((d) => d.damage > 0).length ?? 0;
        if (r.echo && hits > 0 && (s.kind !== 'area' || hits >= 2 || i === 3)) break;
      }
      const best = cc.attempts.find((r) => r.echo?.dam.some((d) => d.damage > 0)) ?? cc.attempts.at(-1)!;
      const hits = best.echo?.dam.filter((d) => d.damage > 0).length ?? 0;
      cc.checks = { echo: echoOk(best, s), damage: hits > 0, mpCharged: mpOk(best, s) };
      if (s.kind === 'area') {
        cc.checks.multiTarget = cc.attempts.some((r) => (r.echo?.dam.filter((d) => d.damage > 0).length ?? 0) >= 2);
        if (!cc.checks.multiTarget && !cc.attempts.some((r) => r.targets.length >= 2)) {
          delete cc.checks.multiTarget;
          cc.note = 'nunca houve 2 mobs ao alcance ao mesmo tempo; o acerto em área não foi exercitado';
        }
      }
      if (s.id === 34 || s.id === 36) cc.note = `lentidão em mob (SetAffect só pega em jogador, como no legado): ${cc.attempts.some((r) => r.affects.length) ? 'veio SendAffect' : 'nenhum SendAffect'}`;
    }
  }
  cc.ok = Object.values(cc.checks).every(Boolean);
  rec.cast = cc;
  if (!cc.ok) {
    const last = cc.attempts.at(-1);
    const extra = cc.summon ? `, evocação ${JSON.stringify(cc.summon)}` : cc.transform ? `, transformação ${JSON.stringify(cc.transform)}` : cc.passive ? `, ${cc.note}` : cc.buff ? `, affect ${JSON.stringify(cc.buff.affect)}, score ${JSON.stringify(cc.buff.before)}→${JSON.stringify(cc.buff.after)} (ganho esperado ${cc.buff.expectedGain})` : cc.teleport ? `, teleporte ${JSON.stringify(cc.teleport)}` : cc.heal ? `, cura ${cc.heal.got}/${cc.heal.expected}, HP ${cc.heal.hpBefore}→${cc.heal.hpAfter}` : cc.judgment ? `, HP ${cc.judgment.hpBefore}→${cc.judgment.hpAfter} (esperado ${cc.judgment.expectedHp.join(' ou ')}), danos ${cc.judgment.damage.map((d) => d.damage).join('/')}` : '';
    fail(state, `conjurar ${s.name} (${s.id}) no nível exibido ${shownLevel(me.level)}: falhou ${failedChecks(cc.checks).join(', ')} (eco ${last?.echo ? `skill ${last.echo.skillIndex}, dano ${last.echo.dam.map((d) => d.damage).join('/')}, MP ${last.mpBefore}→${last.echo.currentMp} (esperado −${manaCost(s.mana, last.special)})` : 'nenhum'}${extra}, SetHpMp ${last?.setHpMp.length ?? 0}, avisos ${last?.notices.join(',') || 'nenhum'})`);
  }
  progress.save(state);
}

// ---------------------------------------------------------------- controles

/** Controles feitos uma vez, com só a primeira skill da árvore aprendida. */
async function controls(c: GameClient, state: State): Promise<void> {
  const me = c.self!;
  const first = TREE.skills[0];
  // A skill ainda não aprendida do controle: a próxima que se conjura (as passivas não se conjuram).
  const second = TREE.skills.slice(1).find((k) => k.kind !== 'passive' && k.kind !== 'eighth')!;
  // Alcance e falta de MP: com a 1ª skill, se ela for de dano; sem MP também com buff/transformação em si mesma.
  const ranged = first.kind === 'damage' || first.kind === 'area';
  const selfCast = first.kind === 'transform' || first.kind === 'buff';

  // Comprar a skill do mestre como item (MSG_Buy): o legado só vende com Merchant 1.
  if (!state.controls.buyAsItem) {
    const shop = await openSkillShop(c, SKILL_MASTER);
    const offer = shop.items.find((it) => it.index === 5000 + second.id) ?? shop.items[0];
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
        // A recusa do legado ("Pode comprar itens apenas do mercador.") vem como texto (MessagePanel), não como MessageBoxOk.
        texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
        coinBefore, coinAfter: me.coin, ok: !got?.item.index && me.carry[slot]?.index !== offer.index,
      };
      state.controls.buyAsItem = r;
      log.info('controle: comprar skill como item', r as unknown as Record<string, unknown>);
      if (!r.ok) fail(state, `o ${SKILL_MASTER.name} (Merchant ${SKILL_MASTER.merchant}) vendeu a skill ${offer.index} como item pelo MSG_Buy (slot ${slot}, gold ${coinBefore}→${me.coin}); o legado só vende com Merchant 1 (_MSG_Buy.cpp) — ${BUY_ISSUE}`);
    }
    progress.save(state);
  }

  await rest(c, manaCost(first.mana, special(c)) * 3);
  await goToCastSpot(c);

  // Skill ainda não aprendida: sem eco, sem dano, sem MP.
  if (!state.controls.unlearned && !learned(c, second.id)) {
    const [m] = await mobsInReach(c, 3);
    const r = await castSkill(c, log, second.id, [m]);
    const ok = !r.echo?.dam.some((d) => d.damage > 0) && (r.echo === undefined || r.mpSpent === 0) && me.mp === r.mpBefore;
    state.controls.unlearned = { ...r, ok };
    if (!ok) fail(state, `conjurar ${second.name} sem aprender: o servidor aceitou (dano ${r.echo?.dam.map((d) => d.damage).join('/')}, MP ${r.mpBefore}→${r.echo?.currentMp})`);
    progress.save(state);
  }

  // Alvo fora do alcance: dano 0 nesse alvo.
  const farMob = () => mobsByDistance(c).find((m) => tiles(me, m) >= first.range + 3 && tiles(me, m) <= first.range + 8);
  if (!state.controls.outOfRange && ranged) {
    const far = farMob();
    if (far) {
      const r = await castSkill(c, log, first.id, [far]);
      const d = r.echo?.dam.find((x) => x.targetId === far.id);
      const ok = !d || d.damage <= 0;
      state.controls.outOfRange = { ...r, ok, note: `alvo a ${tiles(me, far)} tiles, alcance ${first.range}` };
      if (!ok) fail(state, `${first.name} num alvo a ${tiles(me, far)} tiles (alcance ${first.range}) causou ${d!.damage} de dano`);
    } else {
      log.warn(`controle de alcance sem mob entre ${first.range + 3} e ${first.range + 8} tiles; fica para a próxima sessão`);
    }
    progress.save(state);
  }

  // Sem MP: gasta o MP e tenta mais um. Os casts vão num mob fora do alcance (o Go cobra o MP e
  // dá dano 0), porque matar Gremlins sobe de nível e o nível novo enche o MP.
  if (!state.controls.noMana && (ranged || selfCast)) {
    let drained = 0;
    const cost = () => manaCost(first.mana, special(c));
    const target = async (): Promise<Mob[] | 'self'> => (selfCast ? 'self' : [farMob() ?? (await mobsInReach(c, Math.max(1, first.range - 2)))[0]]);
    // A regeneração (SetHpMp a cada ~10 s) pode chegar entre o último dreno e o cast final: depois
    // do intervalo entre casts, confere o MP de novo e drena mais, se ele voltou a cobrir o custo.
    for (let round = 0; round < 5 && me.mp >= cost(); round++) {
      for (let i = 0; i < 120 && me.mp >= cost(); i++) {
        if (me.hp < me.maxHp * 0.35) await walkTo(c, CAST_SPOT.x - 10, CAST_SPOT.y); // sai de perto sem descansar o MP
        const r = await castSkill(c, log, first.id, await target());
        if (r.echo) drained++;
        else break;
      }
      await sleep(CAST_GAP_MS);
    }
    if (me.mp < cost()) {
      const r = await castSkill(c, log, first.id, selfCast ? 'self' : [(await mobsInReach(c, Math.max(1, first.range - 2)))[0]]); // só a falta de MP impede
      const ok = !r.echo && r.setHpMp.length > 0;
      state.controls.noMana = { drained, final: r, ok };
      if (r.echo) fail(state, `${first.name} com ${r.mpBefore} de MP (custo ${cost()}): o servidor aceitou (dano ${r.echo.dam.map((d) => d.damage).join('/')}, MP → ${r.echo.currentMp})`);
      else if (!ok) log.warn('cast sem MP descartado, mas sem o SetHpMp do legado', { mp: me.mp, cost: cost() });
    } else {
      state.controls.noMana = { drained, ok: false, note: `o MP não baixou do custo (${me.mp} ≥ ${cost()}) em ${drained} casts` };
      log.warn('controle de MP inconclusivo', state.controls.noMana as unknown as Record<string, unknown>);
    }
    progress.save(state);
  }
}

// ---------------------------------------------------------------- relatório

function writeReport(state: State, run: Record<string, unknown>): void {
  const ids = TREE.skills.map((s) => s.id);
  writeReportFile(reportDir, {
    scenario: SCENARIO,
    description: `O personagem aprende as skills de ${TREE.label} (${ids[0]}–${ids[6]}) no ${SKILL_MASTER.name} assim que tem pontos, nível e maestria, e conjura cada uma (nos Gremlins a leste de Armia ou em si mesma); a 8ª (${EIGHTH.name}, ${EIGHTH.id}) só tem a recusa sem os 50M de gold.`,
    run,
    character: { name: state.charName, class: state.charClass, createdAt: state.createdAt },
    phase: state.phase,
    verdict: state.verdict ?? 'in-progress',
    failures: state.failures,
    skills: TREE.skills.map((s) => ({ ...s, record: state.skills[s.id] })),
    controls: state.controls,
    relearn: state.relearn,
    eighth: state.eighth,
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
    if (me.cls !== TREE.cls) throw new Error(`o personagem ${me.name} é da classe ${me.cls}; a árvore ${TREE.label} exige a classe ${TREE.cls}`);
    if (me.hp <= 0) await reviveAfterDeath(c, log);
    log.info('fase', { tree: TREE.label, phase: state.phase, shownLevel: shownLevel(me.level), learn: hex(me.learn), skillBonus: me.skillBonus, special: me.special, specialBonus: me.specialBonus, mp: me.mp, maxMp: me.maxMp });

    switch (state.phase) {
      case 'skills': {
        for (const s of LEARNABLE) {
          if (state.skills[s.id]?.cast) continue;
          if (Date.now() >= deadline) return 'in-progress';
          state.skills[s.id] ??= { id: s.id, name: s.name, expectedLevel: learnLevel(TREE, s.id) };
          // Os controles de cast precisam da 1ª skill aprendida e da 2ª ainda não.
          if (s.id === TREE.skills[1].id && !learned(c, s.id) && learned(c, TREE.skills[0].id)) await controls(c, state);
          if (!learned(c, s.id)) await learnStep(c, state, s);
          if (!learned(c, s.id)) {
            state.skills[s.id].cast = { attempts: [], expectedMp: 0, checks: { learned: false }, ok: false, note: 'não aprendida; cast não testado' };
            progress.save(state);
            continue;
          }
          await castStep(c, state, s);
        }
        state.phase = 'eighth';
        progress.save(state);
      }
      // falls through
      case 'eighth': {
        // No nível exibido 220, com as 7 aprendidas e sem os 50M: recusa sem mexer em nada.
        await goToArmia(c);
        await spendPoints(c, state, EIGHTH.reqSpecial);
        // O nível em que os pontos pagam a 8ª (as evocações somam 727 pontos: além do nível 219).
        const eighthLevel = learnLevel(TREE, EIGHTH.id);
        while (me.level < eighthLevel) {
          if (Date.now() >= deadline) return 'in-progress';
          await ensureDust(c, state, eighthLevel);
          await levelOnce(c, state, EIGHTH.reqSpecial);
        }
        const shop = await openSkillShop(c, SKILL_MASTER);
        // Com pontos sobrando, reaprender uma skill dá "já aprendida".
        const first = TREE.skills[0];
        const re = await learnSkill(c, log, shop.npcId, first.id);
        const reOk = re.skillBonusBefore >= first.points && re.notices.includes(NOTICE.alreadyLearned) && re.learnAfter === re.learnBefore && re.skillBonusAfter === re.skillBonusBefore;
        state.relearn = { ...re, ok: reOk };
        if (!reOk) fail(state, `reaprender ${first.name} com ${re.skillBonusBefore} pontos livres: esperado "alreadyLearned" sem mudar nada; veio ${re.notices.map(noticeName).join(',') || 'nenhum aviso'}, SkillBonus ${re.skillBonusBefore}→${re.skillBonusAfter}, Learn ${hex(re.learnBefore)}→${hex(re.learnAfter)}`);
        progress.save(state);
        const a = await learnSkill(c, log, shop.npcId, EIGHTH.id);
        const ok = !a.learned && a.learnAfter === a.learnBefore && a.skillBonusAfter === a.skillBonusBefore && a.coinAfter === a.coin && a.notices.includes(NOTICE.notEnoughCoin);
        state.eighth = { ...a, ok, blocked: `aprender e conjurar ${EIGHTH.name} exige ${EIGHTH_SKILL_COIN.toLocaleString('pt-BR')} de gold; o personagem tem ${a.coin.toLocaleString('pt-BR')}` };
        if (a.learned || a.learnAfter !== a.learnBefore || a.skillBonusAfter !== a.skillBonusBefore || a.coinAfter !== a.coin) {
          fail(state, `${EIGHTH.name} sem os 50M de gold (gold ${a.coin}): Learn ${hex(a.learnBefore)}→${hex(a.learnAfter)}, SkillBonus ${a.skillBonusBefore}→${a.skillBonusAfter}, gold ${a.coin}→${a.coinAfter}`);
        } else if (!ok) {
          fail(state, `${EIGHTH.name} sem os 50M de gold: recusado, mas com ${a.notices.map(noticeName).join(',') || 'nenhum aviso'} em vez de notEnoughCoin (SkillBonus ${a.skillBonusBefore}, Special[${TREE.tree}] ${a.special})`);
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
          noEighth: (me.learn & learnBit(EIGHTH.id)) === 0,
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
  const cfg = { ...loadConfig(TREE.account), charClass: TREE.cls };
  let state = progress.load();
  if (flag('--cleanup') || flag('--fresh')) {
    await cleanupScenario(cfg, state, progress as unknown as Progress<object>, log);
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  const redo = opt('--skill');
  if (redo !== undefined) {
    // Repete o cast de skills (lista separada por vírgula): apaga o resultado delas e as falhas que
    // as citam, e volta para a fase das skills.
    for (const id of redo.split(',').map(Number)) {
      const s = LEARNABLE.find((x) => x.id === id);
      if (!s) throw new Error(`--skill inválida: ${id} (use ${LEARNABLE.map((x) => x.id).join(', ')})`);
      if (state.skills[s.id]) delete state.skills[s.id].cast;
      state.failures = state.failures.filter((f) => !f.includes(`(${s.id})`));
      log.info('repetindo o cast', { skill: s.id, name: s.name });
    }
    state.verdict = state.failures.length ? 'fail' : undefined;
    state.phase = 'skills';
    progress.save(state);
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
  const snapshot = () => JSON.stringify([phase(), Object.values(state.skills).filter((r) => r.cast).length, Object.keys(state.skills).length, state.pointRelogins.length, state.dust.uses]);
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
  log.info('PASSOU', { tree: TREE.label, skills: LEARNABLE.map((s) => ({ id: s.id, learn: state.skills[s.id]?.learn?.ok, cast: state.skills[s.id]?.cast?.ok })) });
  return 0;
}

runMain(main, log);
