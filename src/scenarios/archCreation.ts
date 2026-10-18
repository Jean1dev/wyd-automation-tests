// Cenário 5: criação do Arch a partir de um mortal nível 400, numa conta só para isso
// (WYD_ACCOUNT_ARCH). Como um jogador:
//   1. cria um mortal (WYD_CHAR_CLASS) e o leva ao nível exibido 400 com a Poeira de Fada,
//      distribuindo os pontos pela build da classe;
//   2. compra na Evolução a Pedra da Imortalidade e a Sephirot da classe escolhida para o Arch;
//   3. controles no Rei: com os itens só no inventário não cria Arch; com tudo equipado mas a
//      conta cheia (4 personagens), recusa e os itens continuam equipados;
//   4. libera um slot, pergunta ao Rei (confirmação 0, só a pergunta) e confirma (1);
// e verifica que:
//   A) o servidor volta para a seleção de personagem com o Arch novo num slot livre, manda o
//      SendArchEffect com esse slot e tira a Pedra e a Sephirot do mortal;
//   B) o Arch tem o mesmo nome, a classe da Sephirot, nível exibido 1, nenhum item e o corpo do
//      mortal (Equip[0] = rosto do mortal + 5 + classe);
//   C) o mortal continua na conta, no nível exibido 400, sem a Pedra e a Sephirot.
//
// É retomável: o estado fica em state/arch-creation.json.
//
// Uso:
//   npm run scenario:arch                       # até 60 min nesta execução
//   npm run scenario:arch -- --until-done
//   npm run scenario:arch -- --arch-class 2     # classe do Arch: 0 TK, 1 FM, 2 BM (padrão), 3 HT
//   npm run scenario:arch -- --fresh | --cleanup
//
// Saída: 0 = passou ou ainda em progresso · 1 = falhou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { loadConfig, type BotConfig } from '../config.ts';
import { ALL_STR, BUILDS, spendBuild } from '../bot/build.ts';
import { equipFromCarry, type EquipResult } from '../bot/equip.ts';
import { walkPath } from '../bot/movement.ts';
import { approachNpc, buyItem, type Purchase } from '../bot/npc.ts';
import { Progress } from '../bot/progress.ts';
import { useDustUntil } from '../bot/quest.ts';
import { createCharacter, deleteCharacter, enterWorld, login, SessionError } from '../bot/session.ts';
import { reviveAfterDeath } from '../bot/survival.ts';
import { isInArmia } from '../bot/travel.ts';
import { dist, shownLevel, sleep } from '../bot/util.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { archFace, CLASS_NAME, EQUIP_SLOT, ITEM, KING_MIN_LEVEL, MORTAL_MAX_LEVEL, NPC, PRICE, ROUTE_TO_ARMIA, ROUTE_TO_KING } from '../world/arch.ts';
import { FAIRY_DUST_PRICE } from '../world/coveiro.ts';
import { flag, newCharName, opt, parseDuration, PlayClock, reportDirFor, runMain, runWithReconnect, writeReportFile, type CharacterState } from './common.ts';

const SCENARIO = 'arch-creation';
const DUST_STACK = 255;
const MAX_SLOTS = 4;

type Phase = 'mortal' | 'items' | 'controls' | 'arch' | 'verify' | 'done';

interface KingTalk {
  t: string;
  confirm: number;
  /** Itens no Equip[10]/[11] antes e depois. */
  before: { imortalidade: number; sephirot: number };
  after: { imortalidade: number; sephirot: number };
  notices: number[];
  texts: string[];
  /** Respostas que só a criação do Arch manda. */
  logout: boolean;
  newCharList: boolean;
  archEffectSlot?: number;
  freeSlots: number;
}

interface CharView {
  slot: number;
  name: string;
  shownLevel: number;
  face: number;
}

interface ArchLogin {
  slot: number;
  name: string;
  cls: number;
  shownLevel: number;
  face: number;
  equip: { i: number; index: number }[];
  carry: { i: number; index: number }[];
  coin: number;
  attrs: P.Attributes;
}

interface State extends CharacterState {
  scenario: string;
  runs: number;
  playMs: number;
  phase: Phase;
  archClass: number;
  mortalSlot?: number;
  mortalFace?: number;
  dust: { purchases: Purchase[]; uses: number };
  items?: { pedra: Purchase; sephirot: Purchase };
  fillers: string[];
  controls: { unequipped?: KingTalk & { ok: boolean }; fullSlots?: KingTalk & { equip: EquipResult[]; ok: boolean } };
  ask?: KingTalk;
  arch?: KingTalk & { selChars: CharView[]; archSlot?: number; ok: boolean };
  archLogin?: ArchLogin & { ok: boolean; checks: Record<string, boolean> };
  mortalAfter?: { selChar?: CharView; level: number; imortalidade: number; sephirot: number; coin: number; ok: boolean };
  verdict?: 'pass' | 'fail';
  failures: string[];
}

const archClassOpt = Number(opt('--arch-class') ?? 2);
if (!(archClassOpt >= 0 && archClassOpt <= 3)) throw new Error(`--arch-class inválida: ${opt('--arch-class')} (use 0 a 3)`);

const progress = new Progress<State>(SCENARIO, () => ({
  scenario: SCENARIO,
  runs: 0,
  playMs: 0,
  phase: 'mortal',
  archClass: archClassOpt,
  dust: { purchases: [], uses: 0 },
  fillers: [],
  controls: {},
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

const sephirotOf = (state: State) => ITEM.sephirotBase + state.archClass;

const charViews = (c: GameClient): CharView[] => c.selChars.map((s) => ({ slot: s.slot, name: s.name, shownLevel: shownLevel(s.level), face: s.face }));

const equipped = (c: GameClient) => ({ imortalidade: c.self!.equip[EQUIP_SLOT.imortalidade]?.index ?? 0, sephirot: c.self!.equip[EQUIP_SLOT.sephirot]?.index ?? 0 });

async function goToKing(c: GameClient): Promise<void> {
  const me = c.self!;
  if (dist(me.x, me.y, NPC.rei.pos.x, NPC.rei.pos.y) <= 15) return;
  await walkPath(c, ROUTE_TO_KING, { abort: () => me.hp <= 0 });
  if (me.hp <= 0) throw new Error(`morreu no caminho do ${NPC.rei.name}`);
}

async function goToArmia(c: GameClient): Promise<void> {
  const me = c.self!;
  if (!isInArmia(me.x, me.y)) await walkPath(c, ROUTE_TO_ARMIA);
}

/**
 * Fala com o Rei (MSG_Quest com a confirmação dada) e observa por `waitMs` as respostas: aviso,
 * texto, e as que só a criação do Arch manda (CNFCharacterLogout, CNFNewCharacter, SendArchEffect).
 */
async function talkKing(c: GameClient, confirm: number, waitMs = 8000): Promise<KingTalk> {
  const before = equipped(c);
  const ent = await approachNpc(c, NPC.rei);
  await sleep(500);
  const since = c.mark;
  c.send(Op.Quest, P.quest(ent.id, confirm));
  try {
    await c.waitType(Op.SendArchEffect, { timeoutMs: waitMs, since, what: 'SendArchEffect' });
    await sleep(500);
  } catch {
    // sem Arch: as respostas (se houver) já estão nos frames
  }
  const frames = c.framesSince(since);
  const effect = frames.find((f) => f.header.type === Op.SendArchEffect);
  const r: KingTalk = {
    t: new Date().toISOString(),
    confirm,
    before,
    after: equipped(c),
    notices: frames.filter((f) => f.header.type === Op.MessageBoxOk).map((f) => P.parseNotice(f.body)),
    texts: frames.filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body)),
    logout: frames.some((f) => f.header.type === Op.CNFCharacterLogout),
    newCharList: frames.some((f) => f.header.type === Op.CNFNewCharacter),
    archEffectSlot: effect && effect.body.length >= 4 ? effect.body.readInt32LE(0) : undefined,
    freeSlots: MAX_SLOTS - c.selChars.length,
  };
  log.info(`falou com ${NPC.rei.name}`, r as unknown as Record<string, unknown>);
  return r;
}

const noArch = (k: KingTalk) => !k.logout && !k.newCharList && k.archEffectSlot === undefined;

/** Leva o mortal ao nível exibido 400 com a Poeira de Fada, distribuindo os pontos a cada nível. */
async function levelMortal(c: GameClient, state: State): Promise<void> {
  const me = c.self!;
  const build = BUILDS[state.charClass ?? 0] ?? ALL_STR;
  const have = me.carry.reduce((n, it) => n + (it.index === ITEM.poeiraDeFada ? P.itemAmount(it) : 0), 0);
  const need = MORTAL_MAX_LEVEL - me.level;
  if (have < need) {
    await goToArmia(c);
    for (let stacks = Math.ceil((need - have) / DUST_STACK); stacks > 0; stacks--) {
      if (me.coin < FAIRY_DUST_PRICE) throw new Error(`sem gold para a Poeira de Fada (${me.coin})`);
      state.dust.purchases.push(await buyItem(c, log, NPC.evolucao, ITEM.poeiraDeFada));
      progress.save(state);
    }
  }
  await spendBuild(c, log, build);
  const bad = await useDustUntil(c, log, MORTAL_MAX_LEVEL, async (use) => {
    if (use.ok) {
      state.dust.uses++;
      await spendBuild(c, log, build);
    }
    progress.save(state);
  });
  if (bad) throw new Error(`a Poeira de Fada no nível exibido ${shownLevel(bad.from)} não subiu de nível${bad.texts?.length ? `: ${bad.texts.join(' | ')}` : ''}`);
  log.info('mortal no nível exibido 400', { shown: shownLevel(me.level), attrs: me.attrs, damage: me.damage, maxHp: me.maxHp, coin: me.coin });
}

async function equipArchItems(c: GameClient, state: State): Promise<EquipResult[]> {
  const out: EquipResult[] = [];
  for (const [item, slot] of [[ITEM.pedraDaImortalidade, EQUIP_SLOT.imortalidade], [sephirotOf(state), EQUIP_SLOT.sephirot]] as const) {
    if (c.self!.equip[slot]?.index === item) continue;
    const from = c.findItem(item);
    if (from < 0) throw new Error(`o item ${item} não está no inventário para equipar`);
    const r = await equipFromCarry(c, log, from, slot);
    out.push(r);
    if (!r.ok) fail(state, `o servidor recusou equipar o item ${item} no Equip[${slot}] (avisos: ${r.notices.join(',') || 'nenhum'})`);
  }
  return out;
}

function writeReport(state: State, run: Record<string, unknown>): void {
  writeReportFile(reportDir, {
    scenario: SCENARIO,
    description: 'Criar um Arch a partir de um mortal nível 400: Pedra da Imortalidade + Sephirot da classe escolhida equipadas e o Rei; o Arch nasce com o mesmo nome, a classe da Sephirot e o corpo do mortal.',
    run,
    mortal: { name: state.charName, class: state.charClass, slot: state.mortalSlot, face: state.mortalFace, createdAt: state.createdAt },
    archClass: { value: state.archClass, name: CLASS_NAME[state.archClass], sephirot: sephirotOf(state), expectedFace: state.mortalFace !== undefined ? archFace(state.mortalFace, state.archClass) : undefined },
    phase: state.phase,
    verdict: state.verdict ?? 'in-progress',
    failures: state.failures,
    checks: { dust: state.dust, items: state.items, controls: state.controls, ask: state.ask, arch: state.arch, archLogin: state.archLogin, mortalAfter: state.mortalAfter },
    playMinutes: +(state.playMs / 60000).toFixed(1),
  }, log);
}

// ---------------------------------------------------------------- execução

/** Entra com o mortal (pelo slot, porque o Arch tem o mesmo nome). */
async function enterMortal(c: GameClient, state: State): Promise<void> {
  await enterWorld(c, state.charName!, log, state.mortalSlot);
  clock.start(state.playMs);
  const me = c.self!;
  if (me.hp <= 0) await reviveAfterDeath(c, log);
}

async function runSession(cfg: BotConfig, state: State, deadline: number): Promise<'done' | 'in-progress'> {
  const c = await login(cfg, log);
  try {
    if (!state.charName) {
      const name = newCharName(cfg.charPrefix);
      state.mortalSlot = await createCharacter(c, name, cfg.charClass, log);
      Object.assign(state, { charName: name, charClass: cfg.charClass, createdAt: new Date().toISOString() });
      progress.save(state);
      const created = c.selChars.find((s) => s.slot === state.mortalSlot)!;
      if (created.level !== 0) throw new Error(`personagem novo com nível armazenado ${created.level} (esperado 0 = exibido 1)`);
    }
    const mortal = c.selChars.find((s) => s.name === state.charName && s.slot === state.mortalSlot);
    if (!mortal) throw new SessionError(`o mortal "${state.charName}" não está mais no slot ${state.mortalSlot}; rode com --fresh`);
    log.info('fase', { phase: state.phase, chars: charViews(c) });

    switch (state.phase) {
      case 'mortal': {
        await enterMortal(c, state);
        const me = c.self!;
        state.mortalFace = me.equip[EQUIP_SLOT.face]?.index;
        if (me.level < MORTAL_MAX_LEVEL) {
          if (Date.now() >= deadline) return 'in-progress';
          await levelMortal(c, state);
        }
        state.phase = 'items';
        progress.save(state);
        // segue na mesma sessão
      }
      // falls through
      case 'items': {
        if (!c.self) await enterMortal(c, state);
        const me = c.self!;
        state.mortalFace ??= me.equip[EQUIP_SLOT.face]?.index;
        await goToArmia(c);
        const pedra = c.findItem(ITEM.pedraDaImortalidade) >= 0 || me.equip[EQUIP_SLOT.imortalidade]?.index === ITEM.pedraDaImortalidade
          ? state.items?.pedra : await buyItem(c, log, NPC.evolucao, ITEM.pedraDaImortalidade);
        const seph = c.findItem(sephirotOf(state)) >= 0 || me.equip[EQUIP_SLOT.sephirot]?.index === sephirotOf(state)
          ? state.items?.sephirot : await buyItem(c, log, NPC.evolucao, sephirotOf(state));
        if (pedra && seph) state.items = { pedra, sephirot: seph };
        for (const [p, price, name] of [[pedra, PRICE.pedraDaImortalidade, 'Pedra da Imortalidade'], [seph, PRICE.sephirot, 'Sephirot']] as const) {
          if (p && p.coinBefore - p.coinAfter !== price) log.warn(`${name} com preço diferente do ItemList`, { esperado: price, pago: p.coinBefore - p.coinAfter });
        }
        state.phase = 'controls';
        progress.save(state);
        return 'in-progress'; // os controles começam numa sessão nova, na seleção de personagem
      }
      case 'controls': {
        // Enche a conta para o controle de slots cheios.
        while (c.selChars.length < MAX_SLOTS) {
          const name = newCharName(`${cfg.charPrefix}f`);
          await createCharacter(c, name, 0, log);
          state.fillers.push(name);
          progress.save(state);
        }
        await enterMortal(c, state);
        const me = c.self!;
        if (me.level < KING_MIN_LEVEL) throw new Error(`o mortal está no nível exibido ${shownLevel(me.level)}; esperado 400`);
        // Controle 1: Pedra e Sephirot só no inventário.
        if (!state.controls.unequipped) {
          await goToKing(c);
          const k = await talkKing(c, 1);
          state.controls.unequipped = { ...k, ok: noArch(k) && c.findItem(ITEM.pedraDaImortalidade) >= 0 && c.findItem(sephirotOf(state)) >= 0 };
          if (!state.controls.unequipped.ok) fail(state, `o Rei reagiu como criação de Arch com a Pedra e a Sephirot só no inventário (logout ${k.logout}, lista ${k.newCharList}, efeito ${k.archEffectSlot})`);
          progress.save(state);
        }
        // Controle 2: tudo equipado, mas a conta cheia.
        if (!state.controls.fullSlots) {
          const eq = await equipArchItems(c, state);
          await goToKing(c);
          const k = await talkKing(c, 1);
          const kept = k.after.imortalidade === ITEM.pedraDaImortalidade && k.after.sephirot === sephirotOf(state);
          state.controls.fullSlots = { ...k, equip: eq, ok: noArch(k) && kept };
          if (!noArch(k)) fail(state, `com os ${MAX_SLOTS} slots ocupados o Rei criou o Arch (slot ${k.archEffectSlot})`);
          else if (!kept) fail(state, `com a conta cheia o Rei recusou mas tirou ${k.after.imortalidade ? 'a Sephirot' : 'a Pedra da Imortalidade'} do mortal`);
          if (!k.notices.length) log.warn('o Rei recusou com a conta cheia sem nenhum aviso (o legado manda _NN_NoEmptySlot)');
          progress.save(state);
        }
        state.phase = 'arch';
        progress.save(state);
        return 'in-progress'; // apaga os personagens extras numa sessão nova
      }
      case 'arch': {
        for (const name of [...state.fillers]) {
          await deleteCharacter(c, name, cfg.password, log);
          state.fillers = state.fillers.filter((n) => n !== name);
          progress.save(state);
        }
        // Retomada: o Arch já pode ter sido criado numa sessão que caiu.
        const twins = c.selChars.filter((s) => s.name === state.charName && s.slot !== state.mortalSlot);
        if (twins.length) {
          log.warn('o Arch já existe na conta; pulando para a verificação', { twins });
          state.arch ??= { t: new Date().toISOString(), confirm: 1, before: { imortalidade: 0, sephirot: 0 }, after: { imortalidade: 0, sephirot: 0 }, notices: [], texts: [], logout: true, newCharList: true, freeSlots: 0, selChars: charViews(c), archSlot: twins[0].slot, ok: true };
          state.phase = 'verify';
          break;
        }
        await enterMortal(c, state);
        await equipArchItems(c, state);
        await goToKing(c);
        // O cliente pergunta primeiro (confirmação 0) e cria só no "sim" (1).
        state.ask = await talkKing(c, 0);
        if (!noArch(state.ask)) fail(state, 'o Rei criou o Arch na pergunta (confirmação 0), antes do "sim"');
        const k = await talkKing(c, 1, 20_000); // o DB cria o Arch e salva o mortal antes de responder
        const archChar = c.selChars.find((s) => s.name === state.charName && s.slot !== state.mortalSlot);
        state.arch = { ...k, selChars: charViews(c), archSlot: archChar?.slot, ok: false };
        const checks = {
          logout: k.logout,
          newCharList: k.newCharList,
          archInList: !!archChar,
          effectSlot: archChar !== undefined && k.archEffectSlot === archChar.slot,
          itemsRemoved: k.after.imortalidade === 0 && k.after.sephirot === 0,
        };
        state.arch.ok = Object.values(checks).every(Boolean);
        for (const [name, ok] of Object.entries(checks)) if (!ok) fail(state, `criação do Arch: falhou a verificação "${name}" (${JSON.stringify({ logout: k.logout, list: k.newCharList, effect: k.archEffectSlot, archSlot: archChar?.slot, after: k.after, notices: k.notices })})`);
        progress.save(state);
        if (!archChar) { state.phase = 'done'; break; }
        // Ainda na seleção de personagem: entra no Arch.
        await enterWorld(c, state.charName!, log, archChar.slot);
        const me = c.self!;
        const view: ArchLogin = {
          slot: archChar.slot, name: me.name, cls: me.cls, shownLevel: shownLevel(me.level), face: me.equip[EQUIP_SLOT.face]?.index ?? 0,
          equip: me.equip.map((it, i) => ({ i, index: it.index })).filter((x) => x.index),
          carry: me.carry.map((it, i) => ({ i, index: it.index })).filter((x) => x.index),
          coin: me.coin, attrs: me.attrs,
        };
        const expectedFace = archFace(state.mortalFace ?? 0, state.archClass);
        const archChecks = {
          sameName: view.name === state.charName,
          chosenClass: view.cls === state.archClass,
          level1: view.shownLevel === 1,
          mortalBody: view.face === expectedFace,
          selCharFace: archChar.face === expectedFace,
          onlyBody: view.equip.length === 1,
          emptyCarry: view.carry.length === 0,
        };
        state.archLogin = { ...view, ok: Object.values(archChecks).every(Boolean), checks: archChecks };
        log.info('Arch no mundo', state.archLogin as unknown as Record<string, unknown>);
        for (const [name, ok] of Object.entries(archChecks)) {
          if (!ok) fail(state, `Arch: falhou "${name}" (nome ${view.name}, classe ${view.cls}/${state.archClass}, nível exibido ${view.shownLevel}, rosto ${view.face}/${expectedFace} na seleção ${archChar.face}, equip ${JSON.stringify(view.equip)}, inventário ${view.carry.length} itens)`);
        }
        state.phase = 'verify';
        progress.save(state);
        return 'in-progress'; // o mortal é conferido numa sessão nova
      }
      case 'verify': {
        const sel = charViews(c).find((s) => s.slot === state.mortalSlot);
        await enterMortal(c, state);
        const me = c.self!;
        const eq = equipped(c);
        state.mortalAfter = {
          selChar: sel, level: me.level, imortalidade: eq.imortalidade, sephirot: eq.sephirot, coin: me.coin,
          ok: me.level === MORTAL_MAX_LEVEL && eq.imortalidade === 0 && eq.sephirot === 0 && me.equip[EQUIP_SLOT.face]?.index === state.mortalFace,
        };
        log.info('mortal depois do Arch', state.mortalAfter as unknown as Record<string, unknown>);
        if (!state.mortalAfter.ok) fail(state, `o mortal depois do Arch: nível exibido ${shownLevel(me.level)}, Equip[10] ${eq.imortalidade}, Equip[11] ${eq.sephirot}, rosto ${me.equip[0]?.index}/${state.mortalFace}`);
        if (state.verdict !== 'fail') state.verdict = 'pass';
        state.phase = 'done';
        break;
      }
    }
    return state.phase === 'done' ? 'done' : 'in-progress';
  } finally {
    if (clock.running) state.playMs = clock.stop();
    progress.save(state);
    c.close();
  }
}

async function cleanup(cfg: BotConfig, state: State): Promise<void> {
  const c = await login(cfg, log);
  try {
    // Apaga o mortal, o Arch (mesmo nome) e os extras do controle de slots cheios.
    for (const s of [...c.selChars].filter((x) => x.name === state.charName || state.fillers.includes(x.name)).sort((a, b) => b.slot - a.slot)) {
      await deleteCharacter(c, s.name, cfg.password, log, s.slot);
    }
  } finally {
    c.close();
  }
  progress.clear();
  log.info('personagens e estado removidos', { char: state.charName, fillers: state.fillers });
}

async function main(): Promise<number> {
  const cfg = loadConfig('arch');
  let state = progress.load();
  if (flag('--cleanup') || flag('--fresh')) {
    if (state.charName || state.fillers.length) await cleanup(cfg, state);
    else progress.clear();
    if (flag('--cleanup')) return 0;
    state = progress.load();
  }
  if (state.phase === 'done') {
    log.info('cenário já concluído; use --fresh para recomeçar', { verdict: state.verdict });
    writeReport(state, { reused: true });
    return state.verdict === 'fail' ? 1 : 0;
  }
  state.runs++;
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + budgetMs;
  // Cada fase que precisa da seleção de personagem termina a sessão; o laço abre a próxima.
  const phase = (): Phase => state.phase; // muda dentro das sessões
  let outcome: 'done' | 'in-progress' | 'error' = 'in-progress';
  let error: string | undefined;
  while (outcome === 'in-progress' && Date.now() < deadline && phase() !== 'done') {
    const before: Phase = phase();
    ({ outcome, error } = await runWithReconnect(log, deadline, () => runSession(cfg, state, deadline)));
    if (outcome === 'in-progress' && phase() === before) break; // sem avanço: orçamento
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
  log.info('PASSOU', { arch: state.archLogin?.checks, mortal: state.mortalAfter?.ok });
  return 0;
}

runMain(main, log);
