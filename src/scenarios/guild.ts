// Cenário 12: guilda. Quatro contas novas do portal, um personagem em cada, todos no mesmo Clan,
// cidadãos e lado a lado em Armia (gold semeado pelo banco):
//   L líder (300M) · S membro que vira sub-líder (10M) · R recruta do sub-líder (0) · X controles (50M).
// Casos, em série (um caso feliz que reprova bloqueia os que dependem dele):
//   GD-01 X sem 100M tenta criar → BoxOk 22, nada muda;
//   GD-02 L cria a guilda (/create) → cargo 9, −100M, linhas em guild/guild_member;
//   GD-03 L recruta S (_MSG_InviteGuild) → S cargo 0, L −4M;
//   GD-04 S, ainda membro, tenta recrutar X → recusa calada, nada muda;
//   GD-05 L promove S (/subcreate) → S cargo 6..8, L −100M;
//   GD-06 S, sub-líder, recruta R → R cargo 0, S −4M;
//   GD-07 todos relogam → guilda e cargo iguais no banco e no CreateMob visto pelos outros;
//   GD-08 /nick do líder mostra o nome da guilda.
//
// Uso:
//   npm run scenario:guild
//
// Saída: 0 = passou · 1 = algum caso reprovou · 3 = erro de execução.
import { join } from 'node:path';
import type { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import type { BotConfig } from '../config.ts';
import { randomFrom, signupAccount } from '../bot/account.ts';
import { createGuild, GUILD_LEADER, GUILD_MEMBER, type GuildAttempt, inviteToGuild, isSubLeader, nickInfo, NOTICE_NOT_ENOUGH_COIN, promoteSub } from '../bot/guild.ts';
import { createCharacter, enterWorld, login } from '../bot/session.ts';
import { sleep } from '../bot/util.ts';
import { type Db, loadDbConfig, withDb } from '../db/seed.ts';
import { newCharName, reportDirFor, runMain, writeReportFile } from './common.ts';

const SCENARIO = 'guild';
const M = 1_000_000;
const CLAN = 7;
const INVITE_COST = 4 * M;
const CREATE_COST = 100 * M;
const SUB_COST = 100 * M;
/** O logout grava o personagem por cima do banco; espera antes de ler (runner.ts SAVE_GRACE_MS). */
const SAVE_GRACE_MS = 6000;
/** As escritas assíncronas do servidor (SaveCharacterAsync, persistGuildMember) levam um instante. */
const DB_LAG_MS = 2000;

type Role = 'L' | 'S' | 'R' | 'X';
const COIN: Record<Role, number> = { L: 300 * M, S: 10 * M, R: 0, X: 50 * M };

interface Player {
  role: Role;
  cfg: BotConfig;
  name: string;
  c: GameClient;
}

type Status = 'passa' | 'reprova' | 'bloqueado' | 'erro';
interface CaseReport {
  id: string;
  title: string;
  type: 'feliz' | 'controle' | 'borda';
  status: Status;
  note?: string;
  evidence?: Record<string, unknown>;
}

const reportDir = reportDirFor(SCENARIO);
const log = new Logger(SCENARIO, process.env.DEBUG ? 'debug' : 'info', join(reportDir, 'events.jsonl'));
const db = loadDbConfig();
const q = <T>(fn: (d: Db) => Promise<T>) => withDb(db, fn);

// ---------------------------------------------------------------- sessão

async function setup(role: Role): Promise<Omit<Player, 'c'>> {
  const acc = await signupAccount();
  const cfg: BotConfig = {
    target: process.env.WYD_TARGET?.trim() || 'reseau.proxy.rlwy.net:56950',
    clientVersion: Number(process.env.WYD_CLIENT_VERSION ?? 12000),
    ...acc,
    charPrefix: process.env.WYD_CHAR_PREFIX?.trim() || 'bot',
    charClass: 0,
  };
  const name = newCharName(cfg.charPrefix);
  // Criação na seleção: sem save de logout pendente, a semente do banco não é sobrescrita.
  const sel = await login(cfg, log.child(role));
  await createCharacter(sel, name, cfg.charClass, log.child(role));
  sel.close();
  await q((d) => d.setCharacter(name, { clan: CLAN, citizen: 1, coin: COIN[role], guild_id: 0, guild_level: 0 }));
  log.info('jogador pronto', { role, account: acc.account, name, coin: COIN[role] });
  return { role, cfg, name };
}

async function enter(p: Omit<Player, 'c'>): Promise<Player> {
  const c = await login(p.cfg, log.child(p.role));
  await enterWorld(c, p.name, log.child(p.role));
  return { ...p, c };
}

/** O que `viewer` sabe da guilda de `p` (CreateMob mais recente; o próprio, se for o mesmo). */
function seenTag(viewer: Player, p: Player): { guild?: number; guildLevel?: number } {
  if (viewer === p) return { guild: p.c.self!.guild, guildLevel: p.c.self!.guildLevel };
  const m = viewer.c.mobs.get(p.c.self!.clientId);
  return m ? { guild: m.guild, guildLevel: m.guildLevel } : {};
}

const delta = (a: GuildAttempt) => a.coin.after - a.coin.before;

// ---------------------------------------------------------------- execução

async function main(): Promise<number> {
  const startedAt = new Date().toISOString();
  const guildName = `gd${randomFrom('abcdefghijklmnopqrstuvwxyz0123456789', 8)}`;
  const cases: CaseReport[] = [];
  const report: Record<string, unknown> = {
    scenario: SCENARIO,
    description: 'Cria a guilda, recruta um membro, promove-o a sub-líder e o sub-líder recruta outro; confere cargos, gold e banco, ao vivo e depois de relogar.',
    guildName,
  };
  let players: Record<Role, Player> | undefined;
  let outcome: 'done' | 'error' = 'done';
  let error: string | undefined;
  let guildId = 0;
  const blockedBy: string[] = [];

  /** Roda o caso; se `needs` reprovou, vira bloqueado sem rodar. */
  const run = async (k: Omit<CaseReport, 'status'>, needs: string[], fn: () => Promise<{ pass: boolean; note?: string; evidence: Record<string, unknown> }>) => {
    const dep = needs.find((n) => blockedBy.includes(n));
    if (dep) {
      cases.push({ ...k, status: 'bloqueado', note: `depende de ${dep}, que não passou` });
      blockedBy.push(k.id);
      return;
    }
    try {
      const r = await fn();
      cases.push({ ...k, status: r.pass ? 'passa' : 'reprova', note: r.note, evidence: r.evidence });
      if (!r.pass) blockedBy.push(k.id);
      log[r.pass ? 'info' : 'error']('resultado', { id: k.id, status: r.pass ? 'passa' : 'reprova', note: r.note });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cases.push({ ...k, status: 'erro', note: msg });
      blockedBy.push(k.id);
      log.error('caso interrompido', { id: k.id, err: e instanceof Error ? e.stack : msg });
    }
  };

  try {
    // Em série: quatro POST /api/signup simultâneos levam 503 do portal.
    const base: Omit<Player, 'c'>[] = [];
    for (const role of ['L', 'S', 'R', 'X'] as const) base.push(await setup(role));
    const entered = await Promise.all(base.map(enter));
    players = Object.fromEntries(entered.map((p) => [p.role, p])) as Record<Role, Player>;
    const { L, S, R, X } = players;
    report.characters = Object.fromEntries(entered.map((p) => [p.role, { name: p.name, clientId: p.c.self!.clientId, coin: p.c.self!.coin, x: p.c.self!.x, y: p.c.self!.y }]));
    report.visibility = Object.fromEntries(entered.map((p) => [p.role, entered.filter((o) => o !== p && p.c.mobs.has(o.c.self!.clientId)).map((o) => o.role)]));
    log.info('jogadores no mundo', report.visibility as Record<string, unknown>);

    await run({ id: 'GD-01', title: 'Criar guilda sem 100M', type: 'controle' }, [], async () => {
      const a = await createGuild(X.c, `${guildName}x`, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(`${guildName}x`));
      const pass = !a.applied && a.notice === NOTICE_NOT_ENOUGH_COIN && delta(a) === 0 && !row && !X.c.self!.guild;
      return { pass, note: pass ? undefined : `esperado BoxOk ${NOTICE_NOT_ENOUGH_COIN} sem guilda; veio ${a.applied ? 'guilda criada' : `notice ${a.notice ?? 'nenhum'}`}`, evidence: { attempt: a, dbGuild: row ?? null } };
    });

    await run({ id: 'GD-02', title: 'Líder cria a guilda', type: 'feliz' }, [], async () => {
      const a = await createGuild(L.c, guildName, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(guildName));
      guildId = a.tag?.guild ?? row?.id ?? 0;
      const problems: string[] = [];
      if (!a.applied) problems.push(`sem CreateMob de líder (notice ${a.notice ?? 'nenhum'})`);
      if (delta(a) !== -CREATE_COST) problems.push(`gold ${delta(a)}, esperado −${CREATE_COST}`);
      if (!row) problems.push('guilda ausente na tabela guild');
      else {
        if (row.id !== a.tag?.guild) problems.push(`id no banco ${row.id} ≠ CreateMob ${a.tag?.guild}`);
        if (!row.members.some((m) => m.name === L.name && m.level === GUILD_LEADER)) problems.push(`guild_member sem ${L.name} nível 9: ${JSON.stringify(row.members)}`);
      }
      return { pass: !problems.length, note: problems.join('; ') || undefined, evidence: { attempt: a, dbGuild: row ?? null } };
    });

    await run({ id: 'GD-03', title: 'Líder recruta um membro', type: 'feliz' }, ['GD-02'], async () => {
      const a = await inviteToGuild(L.c, S.c, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(guildName));
      const problems: string[] = [];
      if (!a.applied) problems.push(`S não recebeu o CreateMob com a guilda (notice ${a.notice ?? 'nenhum'})`);
      else if (a.tag!.guildLevel !== GUILD_MEMBER) problems.push(`S entrou com cargo ${a.tag!.guildLevel}, esperado 0`);
      if (delta(a) !== -INVITE_COST) problems.push(`gold do líder ${delta(a)}, esperado −${INVITE_COST}`);
      if (!row?.members.some((m) => m.name === S.name && m.level === GUILD_MEMBER)) problems.push(`guild_member sem ${S.name} nível 0: ${JSON.stringify(row?.members)}`);
      const leaderSees = seenTag(L, S);
      return { pass: !problems.length, note: problems.join('; ') || undefined, evidence: { attempt: a, leaderSees, dbGuild: row ?? null } };
    });

    await run({ id: 'GD-04', title: 'Membro (cargo 0) não recruta', type: 'controle' }, ['GD-03'], async () => {
      const a = await inviteToGuild(S.c, X.c, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(guildName));
      const pass = !a.applied && delta(a) === 0 && !X.c.self!.guild && !row?.members.some((m) => m.name === X.name);
      return { pass, note: pass ? undefined : `o membro recrutou ou foi cobrado: applied=${a.applied}, gold ${delta(a)}`, evidence: { attempt: a, dbGuild: row ?? null } };
    });

    await run({ id: 'GD-05', title: 'Líder promove o membro a sub-líder', type: 'feliz' }, ['GD-03'], async () => {
      const a = await promoteSub(L.c, S.c, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(guildName));
      const problems: string[] = [];
      if (!a.applied) problems.push(`S não recebeu o CreateMob de sub-líder (notice ${a.notice ?? 'nenhum'})`);
      if (delta(a) !== -SUB_COST) problems.push(`gold do líder ${delta(a)}, esperado −${SUB_COST}`);
      const m = row?.members.find((x) => x.name === S.name);
      if (!m || !isSubLeader(m.level)) problems.push(`guild_member de ${S.name}: ${JSON.stringify(m ?? null)}, esperado nível 6..8`);
      return { pass: !problems.length, note: problems.join('; ') || undefined, evidence: { attempt: a, leaderSees: seenTag(L, S), dbGuild: row ?? null } };
    });

    await run({ id: 'GD-06', title: 'Sub-líder recruta outro membro', type: 'feliz' }, ['GD-05'], async () => {
      const a = await inviteToGuild(S.c, R.c, log);
      await sleep(DB_LAG_MS);
      const row = await q((d) => d.guild(guildName));
      const problems: string[] = [];
      if (!a.applied) problems.push(`R não recebeu o CreateMob com a guilda (notice ${a.notice ?? 'nenhum'})`);
      else if (a.tag!.guild !== guildId || a.tag!.guildLevel !== GUILD_MEMBER) problems.push(`R entrou com ${JSON.stringify(a.tag)}, esperado guilda ${guildId} cargo 0`);
      if (delta(a) !== -INVITE_COST) problems.push(`gold do sub-líder ${delta(a)}, esperado −${INVITE_COST}`);
      if (!row?.members.some((m) => m.name === R.name && m.level === GUILD_MEMBER)) problems.push(`guild_member sem ${R.name} nível 0: ${JSON.stringify(row?.members)}`);
      return { pass: !problems.length, note: problems.join('; ') || undefined, evidence: { attempt: a, leaderSees: seenTag(L, R), dbGuild: row ?? null } };
    });

    await run({ id: 'GD-07', title: 'Guilda e cargos persistem no relogin', type: 'feliz' }, ['GD-06'], async () => {
      const coinBefore = Object.fromEntries(entered.map((p) => [p.role, p.c.self!.coin]));
      for (const p of Object.values(players!)) p.c.close();
      await sleep(SAVE_GRACE_MS);
      const chars = await q(async (d) => Object.fromEntries(await Promise.all(entered.map(async (p) => {
        const r = await d.character(p.name);
        return [p.role, { guild: r.guild_id, guildLevel: r.guild_level, coin: r.coin }] as const;
      }))));
      const again = await Promise.all(base.map(enter));
      players = Object.fromEntries(again.map((p) => [p.role, p])) as Record<Role, Player>;
      const { L: L2, S: S2, R: R2 } = players;
      const sub = chars.S.guildLevel;
      const want: Record<Role, { guild: number; level: (n: number) => boolean; desc: string }> = {
        L: { guild: guildId, level: (n) => n === GUILD_LEADER, desc: '9' },
        S: { guild: guildId, level: isSubLeader, desc: '6..8' },
        R: { guild: guildId, level: (n) => n === GUILD_MEMBER, desc: '0' },
        X: { guild: 0, level: (n) => n === 0, desc: '0' },
      };
      const problems: string[] = [];
      for (const role of ['L', 'S', 'R', 'X'] as const) {
        const got = chars[role];
        if (got.guild !== want[role].guild || !want[role].level(got.guildLevel)) problems.push(`banco de ${role}: guilda ${got.guild} cargo ${got.guildLevel}, esperado ${want[role].guild} cargo ${want[role].desc}`);
        if (got.coin !== coinBefore[role]) problems.push(`gold de ${role} no banco ${got.coin}, ao vivo era ${coinBefore[role]}`);
      }
      // Como os outros veem: o líder vê S e R; S vê o líder.
      const seen = { 'L→S': seenTag(L2, S2), 'L→R': seenTag(L2, R2), 'S→L': seenTag(S2, L2) };
      const expectSeen: Record<string, number> = { 'L→S': sub, 'L→R': GUILD_MEMBER, 'S→L': GUILD_LEADER };
      for (const [k, v] of Object.entries(seen)) {
        if (v.guild === undefined) continue; // fora da visão: o banco já cobre
        if (v.guild !== guildId || v.guildLevel !== expectSeen[k]) problems.push(`${k} no CreateMob: ${JSON.stringify(v)}, esperado guilda ${guildId} cargo ${expectSeen[k]}`);
      }
      return { pass: !problems.length, note: problems.join('; ') || undefined, evidence: { db: chars, coinBefore, seen } };
    });

    await run({ id: 'GD-08', title: '/nick mostra o nome da guilda', type: 'borda' }, ['GD-02'], async () => {
      const text = await nickInfo(players!.L.c, players!.L.name);
      const pass = !!text && text.includes(guildName);
      return { pass, note: pass ? undefined : `resposta do /nick: ${JSON.stringify(text ?? null)}, esperado o nome "${guildName}"`, evidence: { text: text ?? null } };
    });
  } catch (e) {
    outcome = 'error';
    error = e instanceof Error ? e.message : String(e);
    log.error('execução interrompida', { err: e instanceof Error ? e.stack : error });
  } finally {
    for (const p of Object.values(players ?? {})) p.c.close();
  }

  const failed = cases.filter((k) => k.status !== 'passa');
  const verdict = outcome === 'error' ? undefined : failed.length ? 'fail' : 'pass';
  const summary = { passa: 0, reprova: 0, bloqueado: 0, erro: 0 };
  for (const k of cases) summary[k.status]++;
  writeReportFile(reportDir, { ...report, guildId, run: { startedAt, endedAt: new Date().toISOString(), outcome, error }, summary, verdict, cases }, log);
  log.info('resumo', { ...summary, cases: cases.map((k) => `${k.id} ${k.status}`) });
  if (outcome === 'error') return 3;
  if (cases.some((k) => k.status === 'erro')) return 3;
  return verdict === 'fail' ? 1 : 0;
}

runMain(main, log);
