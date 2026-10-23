// Guilda como o cliente faz (tmserver/internal/handler/guild.go):
//   - criar: cochicho "/create <nome>" (MobName "create"); o servidor cobra 100M e manda o CreateMob
//     do próprio personagem com Guild = id e GuildMemberType 9;
//   - recrutar: _MSG_InviteGuild (0x03D5) com o id do alvo; entra direto, sem aceite, com cargo 0,
//     e quem convida paga 4M;
//   - promover: cochicho "/subcreate <nome>" do líder (100M); o alvo vira 6, 7 ou 8.
// A confirmação é sempre o CreateMob novo do alvo (refreshGuildTag). Recusa é BoxOk (22 = sem gold)
// ou silêncio até o timeout.
import type { GameClient, Received } from '../client/GameClient.ts';
import type { Logger } from '../client/logger.ts';
import { Op, opName } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

/** Cargos (MOB.GuildLevel). */
export const GUILD_MEMBER = 0;
export const GUILD_LEADER = 9;
export const isSubLeader = (level: number) => level >= 6 && level <= 8;

/** Aviso do servidor sem gold (notice.go NoticeNotEnoughCoin). */
export const NOTICE_NOT_ENOUGH_COIN = 22;

const STEP_TIMEOUT = 8000;
/** Depois da confirmação, tempo para o UpdateEtc e o resto das respostas chegarem. */
const SETTLE_MS = 1500;

export interface FrameNote {
  op: string;
  id: number;
  at: string;
  /** CreateMob: de quem e com que guilda/cargo. */
  mob?: { id: number; name: string; guild: number; guildLevel: number };
  coin?: number;
  notice?: number;
  text?: string;
}

export interface GuildAttempt {
  /** Horário UTC do envio (para a issue). */
  sentAt: string;
  /** O alvo recebeu o próprio CreateMob com a guilda/cargo esperados. */
  applied: boolean;
  /** Guild/GuildMemberType do alvo no CreateMob que confirmou. */
  tag?: { guild: number; guildLevel: number };
  notice?: number;
  coin: { before: number; after: number };
  /** O que cada lado recebeu na janela, sem movimento nem HP. */
  frames: { actor: FrameNote[]; target?: FrameNote[] };
}

const NOTED = new Set<number>([Op.CreateMob, Op.UpdateEtc, Op.MessagePanel, Op.MessageChat, Op.MessageBoxOk]);

function notes(c: GameClient, since: number, ids: number[]): FrameNote[] {
  const out: FrameNote[] = [];
  for (const f of c.framesSince(since)) {
    if (!NOTED.has(f.header.type)) continue;
    const n: FrameNote = { op: opName(f.header.type), id: f.header.id, at: new Date(f.at).toISOString() };
    if (f.header.type === Op.CreateMob) {
      if (f.body.length < 124) continue;
      const m = P.parseCreateMob(f.body);
      if (!ids.includes(m.id)) continue;
      n.mob = { id: m.id, name: m.name, guild: m.guild, guildLevel: m.guildLevel };
    } else if (f.header.type === Op.UpdateEtc && f.body.length >= 32) {
      n.coin = P.parseUpdateEtc(f.body).coin;
    } else if (f.header.type === Op.MessageBoxOk) {
      n.notice = P.parseNotice(f.body);
    } else {
      n.text = P.parseText(f.body);
    }
    out.push(n);
  }
  return out;
}

/**
 * Manda o pedido de `actor` e espera o CreateMob do próprio `target` que satisfaça `done`, um BoxOk
 * para `actor` ou o timeout (recusa calada). `actor` e `target` podem ser o mesmo cliente.
 */
async function attempt(actor: GameClient, target: GameClient, send: () => void, done: (m: P.MobView) => boolean, log: Logger, what: string): Promise<GuildAttempt> {
  const sinceA = actor.mark;
  const sinceT = target.mark;
  const before = actor.self!.coin;
  const tid = target.self!.clientId;
  const sentAt = new Date().toISOString();
  send();
  const isTag = (f: Received) => f.header.type === Op.CreateMob && f.body.length >= 124 && P.parseCreateMob(f.body).id === tid && done(P.parseCreateMob(f.body));
  const hit = target.waitFor(isTag, { timeoutMs: STEP_TIMEOUT, since: sinceT, what }).then((f) => ({ mob: P.parseCreateMob(f.body) }));
  const box = actor.waitType(Op.MessageBoxOk, { timeoutMs: STEP_TIMEOUT, since: sinceA }).then((f) => ({ notice: P.parseNotice(f.body) }));
  const r = await Promise.any([hit, box]).catch(() => undefined);
  await sleep(SETTLE_MS);
  const ids = [actor.self!.clientId, tid];
  const res: GuildAttempt = {
    sentAt,
    applied: !!r && 'mob' in r,
    tag: r && 'mob' in r ? { guild: r.mob.guild, guildLevel: r.mob.guildLevel } : undefined,
    notice: r && 'notice' in r ? r.notice : undefined,
    coin: { before, after: actor.self!.coin },
    frames: { actor: notes(actor, sinceA, ids), target: target === actor ? undefined : notes(target, sinceT, ids) },
  };
  log.info(`guilda: ${what}`, { by: actor.self!.name, target: target.self!.name, applied: res.applied, tag: res.tag, notice: res.notice, coin: res.coin });
  return res;
}

/** "/create <nome>": confirma com o CreateMob do próprio líder com guilda e cargo 9. */
export function createGuild(c: GameClient, name: string, log: Logger): Promise<GuildAttempt> {
  return attempt(c, c, () => c.send(Op.MessageWhisper, P.whisper('create', name)), (m) => m.guild !== 0 && m.guildLevel === GUILD_LEADER, log, `criar "${name}"`);
}

/** _MSG_InviteGuild: confirma com o CreateMob do alvo já na guilda de quem convidou. */
export function inviteToGuild(actor: GameClient, target: GameClient, log: Logger): Promise<GuildAttempt> {
  const guild = actor.self!.guild ?? 0;
  return attempt(actor, target, () => actor.send(Op.InviteGuild, P.inviteGuild(target.self!.clientId)), (m) => m.guild !== 0 && m.guild === guild, log, 'recrutar');
}

/** "/subcreate <nome>": confirma com o CreateMob do alvo com cargo de sub-líder (6..8). */
export function promoteSub(leader: GameClient, target: GameClient, log: Logger): Promise<GuildAttempt> {
  return attempt(leader, target, () => leader.send(Op.MessageWhisper, P.whisper('subcreate', target.self!.name)), (m) => isSubLeader(m.guildLevel), log, 'promover a sub-líder');
}

/** "/nick <nome>": a linha de informação que o servidor devolve no chat (chat.go showNick). */
export async function nickInfo(c: GameClient, name: string): Promise<string | undefined> {
  const since = c.mark;
  c.send(Op.MessageWhisper, P.whisper('nick', name));
  const f = await c.waitFor((x) => x.header.type === Op.MessageChat && P.parseText(x.body).includes(name), { timeoutMs: STEP_TIMEOUT, since, what: '/nick' }).catch(() => undefined);
  return f ? P.parseText(f.body) : undefined;
}
