// Peças das quests de arena (Quest 256): subir de nível com a Poeira de Fada, o controle de
// intruso (entrar a pé sem QuestFlag) e a espera do reset da arena.
import type { GameClient } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import type { Point } from '../world/coveiro.ts';
import { selfTeleportIn, walkTo } from './movement.ts';
import { useItem } from './npc.ts';
import { reviveAfterDeath } from './survival.ts';
import { shownLevel, sleep } from './util.ts';

/** Poeira_de_Fada (ItemList.csv:5831), EF_VOLATILE 7: +1 nível garantido por uso. */
export const FAIRY_DUST = 4142;

export interface DustUse {
  t: string;
  from: number;
  to: number;
  /** Subiu exatamente um nível. */
  ok: boolean;
  /** Avisos de texto do servidor quando não subiu. */
  texts?: string[];
}

/**
 * Usa a Poeira de Fada uma por vez até o nível ARMAZENADO `target`, chamando `afterUse` depois de
 * cada uso (para distribuir os pontos e salvar o estado). Para no primeiro uso que não der +1 e
 * devolve esse uso; sem falha, devolve undefined. Lança se a poeira acabar antes.
 */
export async function useDustUntil(c: GameClient, log: Logger, target: number, afterUse: (u: DustUse) => Promise<void> | void): Promise<DustUse | undefined> {
  const me = c.self!;
  while (me.level < target) {
    const slot = c.findItem(FAIRY_DUST);
    if (slot < 0) throw new Error(`a Poeira de Fada acabou antes do nível exibido ${shownLevel(target)}`);
    const from = me.level;
    const since = useItem(c, slot);
    try {
      await c.waitFor((f) => f.header.type === Op.UpdateScore && f.header.id === me.clientId && me.level !== from, { timeoutMs: 5000, since, what: 'level up da Poeira de Fada' });
    } catch {
      // sem level up: registrado abaixo
    }
    const use: DustUse = { t: new Date().toISOString(), from, to: me.level, ok: me.level === from + 1 };
    if (!use.ok) use.texts = c.framesSince(since).filter((f) => f.header.type === Op.MessagePanel || f.header.type === Op.MessageChat).map((f) => P.parseText(f.body));
    log.info('Poeira de Fada usada', { ...use, shownFrom: shownLevel(from), shownTo: shownLevel(me.level), left: P.itemAmount(me.carry[slot]) });
    await afterUse(use);
    if (!use.ok) return use;
  }
  return undefined;
}

export interface IntruderProbe {
  t: string;
  from: Point;
  target: Point;
  teleport?: { from: Point; to: Point };
  final: Point;
  ok: boolean;
}

/** Controle de intruso: entra a pé na arena sem QuestFlag e espera ser mandado para fora dela. */
export async function probeIntruder(c: GameClient, log: Logger, probe: { from: Point; to: Point }, inArea: (x: number, y: number) => boolean): Promise<IntruderProbe> {
  const me = c.self!;
  await walkTo(c, probe.from.x, probe.from.y);
  await sleep(1500);
  const from = { x: me.x, y: me.y };
  const since = c.mark;
  let teleported = false;
  const onTp = () => { teleported = true; };
  c.on('teleport', onTp);
  try {
    await walkTo(c, probe.to.x, probe.to.y, { abort: () => teleported });
    for (let i = 0; i < 10 && !teleported; i++) await sleep(500); // o guarda roda a cada tick de 1 s
  } finally {
    c.off('teleport', onTp);
  }
  const tp = selfTeleportIn(c, c.framesSince(since));
  const final = { x: me.x, y: me.y };
  const r: IntruderProbe = { t: new Date().toISOString(), from, target: probe.to, teleport: tp, final, ok: !!tp && !inArea(final.x, final.y) };
  log.info('controle: intruso na arena', r as unknown as Record<string, unknown>);
  return r;
}

export interface ResetWait {
  enteredAt: string;
  waitUntil: string;
  /** Hipóteses cobertas pela janela de espera. */
  covers: { legacyTenMinutes: boolean; topOfHour: boolean };
  safeSpot?: Point;
  kicked?: { t: string; utcMinute: number; utcSecond: number; secondsAfterEntry: number; from: Point; to: Point };
  died?: { t: string; secondsAfterEntry: number; x: number; y: number };
  /** Frames MSG_StartTime (contador de arena do legado) recebidos na espera. */
  startTimeFrames: number;
  final: { x: number; y: number; hp: number; inArena: boolean };
  ok?: boolean;
  interrupted?: string;
}

/**
 * Fica na arena até o reset (teleporte para fora) ou até `waitUntil`. Anda até `safeSpot` (o
 * canto mais longe dos spawns) e, se morrer, continua lá sem reviver: o reset legado também
 * revive e manda de volta quem está morto na arena (ClearAreaQuest, Server.cpp:6263).
 */
export async function waitForReset(c: GameClient, log: Logger, o: { enteredAt: number; waitUntil: number; safeSpot: Point; inArea: (x: number, y: number) => boolean }): Promise<ResetWait> {
  const me = c.self!;
  const { enteredAt, waitUntil, inArea } = o;
  const nextHour = new Date(enteredAt);
  nextHour.setUTCMinutes(60, 0, 0);
  const r: ResetWait = {
    enteredAt: new Date(enteredAt).toISOString(),
    waitUntil: new Date(waitUntil).toISOString(),
    covers: { legacyTenMinutes: waitUntil >= enteredAt + 10 * 60_000, topOfHour: waitUntil >= nextHour.getTime() },
    startTimeFrames: 0,
    final: { x: me.x, y: me.y, hp: me.hp, inArena: inArea(me.x, me.y) },
  };
  log.info('esperando o reset da quest', { waitUntil: r.waitUntil, minutes: +((waitUntil - enteredAt) / 60000).toFixed(1), covers: r.covers });

  const onTp = (e: { from: Point; to: Point }) => {
    if (r.kicked || inArea(e.to.x, e.to.y)) return;
    const now = new Date();
    r.kicked = { t: now.toISOString(), utcMinute: now.getUTCMinutes(), utcSecond: now.getUTCSeconds(), secondsAfterEntry: Math.round((now.getTime() - enteredAt) / 1000), from: e.from, to: e.to };
    log.info('teleportado para fora da arena', r.kicked as unknown as Record<string, unknown>);
  };
  const onFrame = (f: { header: { type: number } }) => { if (f.header.type === Op.StartTime) r.startTimeFrames++; };
  c.on('teleport', onTp);
  c.on('frame', onFrame);
  try {
    // Sai do lado dos spawns da entrada para o canto mais seguro da arena.
    await walkTo(c, o.safeSpot.x, o.safeSpot.y, { abort: () => !!r.kicked || me.hp <= 0 });
    if (!r.kicked && me.hp > 0) r.safeSpot = { x: me.x, y: me.y };
    let lastLog = Date.now();
    while (!r.kicked && Date.now() < waitUntil) {
      if (c.isClosed) throw new Error('conexão caiu esperando o reset da quest');
      if (me.hp <= 0 && !r.died) {
        r.died = { t: new Date().toISOString(), secondsAfterEntry: Math.round((Date.now() - enteredAt) / 1000), x: me.x, y: me.y };
        log.warn('morreu na arena; continua esperando o reset sem reviver', r.died as unknown as Record<string, unknown>);
      }
      if (Date.now() - lastLog >= 60_000) {
        lastLog = Date.now();
        log.info('na arena', { x: me.x, y: me.y, hp: me.hp, maxHp: me.maxHp, minutesLeft: +((waitUntil - Date.now()) / 60000).toFixed(1) });
      }
      await sleep(1000);
    }
  } finally {
    c.off('teleport', onTp);
    c.off('frame', onFrame);
  }
  r.final = { x: me.x, y: me.y, hp: me.hp, inArena: inArea(me.x, me.y) };
  r.ok = !!r.kicked && !r.final.inArena;
  if (me.hp <= 0) await reviveAfterDeath(c, log);
  return r;
}
