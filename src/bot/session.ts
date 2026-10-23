// Fluxo de sessão de um jogador: conectar → login → PIN → seleção de personagem →
// criar/apagar → entrar no mundo. Mensagens de recusa viram erros explícitos.
import { GameClient } from '../client/GameClient.ts';
import { Logger } from '../client/logger.ts';
import { Op, opName } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

export interface Credentials {
  target: string;
  clientVersion: number;
  account: string;
  password: string;
  pin: string;
}

export class SessionError extends Error {}

/** NoticeDBError do tmServer Go (handler/notice.go, iota 8): a chamada ao banco falhou. */
const NOTICE_DB_ERROR = 8;

/** Conecta e loga na conta até a tela de seleção (com PIN verificado). */
export async function login(creds: Credentials, log: Logger): Promise<GameClient> {
  const c = new GameClient(log.child('net'));
  await c.connect(creds.target);
  for (let attempt = 1; ; attempt++) {
    const since = c.mark;
    c.send(Op.AccountLogin, P.accountLogin(creds.account, creds.password, creds.clientVersion), { id: 0 });
    const r = await c.waitType([Op.CNFAccountLogin, Op.MessageBoxOk, Op.AlreadyPlaying, Op.StillPlaying], { timeoutMs: 15_000, since });
    if (r.header.type === Op.CNFAccountLogin) break;
    if ((r.header.type === Op.AlreadyPlaying || r.header.type === Op.StillPlaying) && attempt < 6) {
      // Sessão anterior da conta ainda sendo salva/fechada: o servidor aceita nova tentativa.
      log.warn('conta ainda em uso; tentando de novo', { reply: opName(r.header.type), attempt });
      await sleep(3000);
      continue;
    }
    const notice = r.header.type === Op.MessageBoxOk && r.body.length >= 4 ? r.body.readInt32LE(0) : undefined;
    if (notice === NOTICE_DB_ERROR && attempt < 10) {
      // O Postgres do db-server recusa conexões ("too many connections") por alguns minutos.
      log.warn('login: erro de banco no servidor; tentando de novo', { attempt });
      await sleep(30_000);
      continue;
    }
    c.close();
    throw new SessionError(`login recusado: ${opName(r.header.type)}${notice !== undefined ? ` (notice ${notice})` : ''}`);
  }
  log.info('login ok', { account: creds.account, chars: c.selChars.map((s) => `${s.slot}:${s.name}`) });

  const since = c.mark;
  c.send(Op.AccountSecure, P.accountSecure(creds.pin), { id: 0 });
  const pin = await c.waitType([Op.AccountSecure, Op.AccountSecureFail], { timeoutMs: 15_000, since });
  if (pin.header.type !== Op.AccountSecure) {
    c.close();
    throw new SessionError('PIN recusado (AccountSecureFail)');
  }
  log.info('PIN ok');
  return c;
}

/** Cria um personagem no primeiro slot livre e devolve o slot. */
export async function createCharacter(c: GameClient, name: string, cls: number, log: Logger): Promise<number> {
  const used = new Set(c.selChars.map((s) => s.slot));
  const slot = [0, 1, 2, 3].find((s) => !used.has(s));
  if (slot === undefined) throw new SessionError('conta sem slot livre (4 personagens)');
  const since = c.mark;
  c.send(Op.CreateCharacter, P.createCharacter(slot, name, cls), { id: 0 });
  const r = await c.waitType([Op.CNFNewCharacter, Op.NewCharacterFail], { timeoutMs: 15_000, since });
  if (r.header.type !== Op.CNFNewCharacter) throw new SessionError(`criação de "${name}" recusada (NewCharacterFail)`);
  const created = c.selChars.find((s) => s.name === name);
  if (!created) throw new SessionError(`CNFNewCharacter não lista "${name}"`);
  log.info('personagem criado', { name, slot: created.slot, class: cls, level: created.level });
  return created.slot;
}

export async function deleteCharacter(c: GameClient, name: string, password: string, log: Logger, slot?: number): Promise<void> {
  const ch = c.selChars.find((s) => s.name === name && (slot === undefined || s.slot === slot));
  if (!ch) return;
  const since = c.mark;
  c.send(Op.DeleteCharacter, P.deleteCharacter(ch.slot, name, password), { id: 0 });
  const r = await c.waitType([Op.CNFDeleteCharacter, Op.DeleteCharacterFail, Op.MessageBoxOk], { timeoutMs: 15_000, since });
  if (r.header.type !== Op.CNFDeleteCharacter) throw new SessionError(`exclusão de "${name}" recusada (${opName(r.header.type)})`);
  log.info('personagem apagado', { name, slot: ch.slot });
}

/**
 * Entra no mundo com o personagem e espera o snapshot (CNFCharacterLogin). `slot` escolhe entre
 * personagens de mesmo nome (o Arch tem o nome do mortal).
 */
export async function enterWorld(c: GameClient, name: string, log: Logger, slot?: number): Promise<void> {
  const ch = c.selChars.find((s) => s.name === name && (slot === undefined || s.slot === slot));
  if (!ch) throw new SessionError(`personagem "${name}" não está na conta`);
  const since = c.mark;
  c.send(Op.CharacterLogin, P.characterLogin(ch.slot), { id: 0 });
  const r = await c.waitType([Op.CNFCharacterLogin, Op.CharacterLoginFail, Op.MessageBoxOk], { timeoutMs: 20_000, since });
  if (r.header.type !== Op.CNFCharacterLogin) throw new SessionError(`entrada no mundo recusada (${opName(r.header.type)})`);
  // O servidor manda UpdateScore/UpdateEtc logo depois. Esperar > 3 s também evita o filtro
  // de "boot auto-walk" (movement.go: o 1º passo nos 3 s após o login é descartado).
  await sleep(3500);
  c.startKeepalive();
  const me = c.self!;
  log.info('no mundo', { name: me.name, clientId: me.clientId, x: me.x, y: me.y, level: me.level, shownLevel: me.level + 1, exp: me.exp, hp: me.hp });
}
