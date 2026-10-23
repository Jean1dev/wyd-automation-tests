// Cliente TCP headless do tm-server: transporte CPSock, relógio de ClientTick,
// estado do mundo visto pelo personagem e espera por eventos.
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { decode, encode, Framer, initCodeBytes, type Frame } from '../protocol/cpsock.ts';
import { MAX_USER, Op, opName, SKIP_CHECK_TICK } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { Logger } from './logger.ts';

export interface Received extends Frame {
  seq: number;
  at: number;
}

export interface WaitOptions {
  timeoutMs: number;
  /** Considera também frames já recebidos com seq > since. */
  since?: number;
  what?: string;
}

export class TimeoutError extends Error {}

export interface Mob extends P.MobView {
  seenAt: number;
}

export interface SelfState {
  name: string;
  /** Classe (STRUCT_MOB.Class): 0 TK, 1 FM, 2 BM, 3 HT. */
  cls: number;
  clientId: number;
  x: number;
  y: number;
  /** Nível armazenado no servidor (o cliente exibe level + 1). */
  level: number;
  exp: bigint;
  hp: number;
  maxHp: number;
  /** Dano do CurrentScore (base + atributos + arma), como o servidor calcula. */
  damage: number;
  ac: number;
  /** Str/Int/Dex/Con do CurrentScore (com o equipamento). */
  attrs: P.Attributes;
  mp: number;
  maxMp: number;
  /** AttackRun do último UpdateScore: (ataque << 4) | corrida. */
  attackRun?: number;
  /** Resist[4] do último UpdateScore. */
  resist?: number[];
  /** Affects ativos do último SendAffect do próprio personagem. */
  affects: { type: number; value: number; level: number; time: number }[];
  /** CurrentScore.Special[4]: maestria de cada árvore (com equipamento e buffs). */
  special: number[];
  /** LearnedSkill: bit (skill % 24) de cada skill aprendida. */
  learn: number;
  /** Pontos de skill e de maestria livres (CNFCharacterLogin e cada UpdateEtc). */
  skillBonus: number;
  specialBonus: number;
  /** Pontos de atributo livres; undefined até o servidor mandar um UpdateEtc. */
  scoreBonus?: number;
  coin: number;
  /** Guilda e cargo do último CreateMob do próprio personagem (undefined até o servidor mandar um). */
  guild?: number;
  guildLevel?: number;
  /** Inventário (Carry[64]) do CNFCharacterLogin, atualizado a cada SendItem e UpdateCarry. */
  carry: P.Item[];
  /** Equipamento (Equip[16]) do CNFCharacterLogin, atualizado a cada SendItem. */
  equip: P.Item[];
}

const HISTORY = 4000;

export class GameClient extends EventEmitter {
  readonly log: Logger;
  private sock?: net.Socket;
  private framer = new Framer();
  private seq = 0;
  private history: Received[] = [];
  private closed = false;

  // Relógio: o servidor carimba w.Now() no ClientTick de cada frame S→C; o cliente
  // legado ressincroniza o seu movetime por ele. Estimamos tick = último + tempo decorrido.
  private serverTick = 0;
  private serverTickAt = 0;
  private lastSentTick = 0;

  /** HEADER.ID das mensagens C→S: 0 até entrar no mundo; depois o ClientID do CNFCharacterLogin. */
  connId = 0;
  selChars: P.SelCharSlot[] = [];
  self?: SelfState;
  readonly mobs = new Map<number, Mob>();
  private keepalive?: NodeJS.Timeout;

  constructor(log?: Logger) {
    super();
    this.log = log ?? new Logger('client');
  }

  async connect(target: string, timeoutMs = 10_000): Promise<void> {
    const [host, portStr] = target.split(':');
    const port = Number(portStr);
    if (!host || !port) throw new Error(`alvo inválido "${target}" (esperado host:porta)`);
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection({ host, port });
      const timer = setTimeout(() => { sock.destroy(); reject(new Error(`timeout conectando em ${target}`)); }, timeoutMs);
      sock.once('connect', () => { clearTimeout(timer); resolve(); });
      sock.once('error', (e) => { clearTimeout(timer); reject(e); });
      sock.setNoDelay(true);
      this.sock = sock;
    });
    const sock = this.sock!;
    sock.on('data', (chunk: Buffer) => this.onData(chunk));
    sock.on('close', () => {
      this.closed = true;
      if (this.keepalive) clearInterval(this.keepalive);
      this.log.warn('conexão fechada');
      this.emit('close');
    });
    sock.on('error', (e) => this.log.warn('erro de socket', { err: String(e) }));
    sock.write(initCodeBytes());
    this.closed = false;
    this.log.info('conectado', { target });
  }

  get isClosed(): boolean {
    return this.closed || !this.sock || this.sock.destroyed;
  }

  close(): void {
    if (this.keepalive) clearInterval(this.keepalive);
    this.sock?.destroy();
    this.closed = true;
  }

  /** Para de ler o socket por `ms` (simula um cliente lento: o servidor acumula na fila de saída). */
  pauseReading(ms: number): void {
    const sock = this.sock;
    if (!sock || this.isClosed) return;
    sock.pause();
    setTimeout(() => { if (!sock.destroyed) sock.resume(); }, ms).unref();
  }

  /** Último seq recebido; use como `since` para não perder respostas que chegam rápido. */
  get mark(): number {
    return this.seq;
  }

  /** Tick estimado do servidor, estritamente crescente entre envios. */
  tick(): number {
    let t = this.serverTickAt ? this.serverTick + (Date.now() - this.serverTickAt) : 0;
    if (t === SKIP_CHECK_TICK) t++;
    if (t <= this.lastSentTick && this.lastSentTick) t = this.lastSentTick + 1;
    return t >>> 0;
  }

  send(type: number, body: Uint8Array, opts: { tick?: number; id?: number } = {}): number {
    if (this.isClosed) throw new Error(`envio de ${opName(type)} com a conexão fechada`);
    const tick = opts.tick ?? this.tick();
    this.lastSentTick = Math.max(this.lastSentTick, tick);
    const wire = encode(type, opts.id ?? this.connId, tick, body, Math.floor(Math.random() * 256));
    this.sock!.write(wire);
    this.log.debug('→', { op: opName(type), len: body.length, tick });
    return tick;
  }

  startKeepalive(everyMs = 15_000): void {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = setInterval(() => {
      if (!this.isClosed) this.send(Op.Ping, Buffer.alloc(0));
    }, everyMs);
    this.keepalive.unref();
  }

  /** Espera o primeiro frame (novo, ou no histórico depois de `since`) que satisfaça `pred`. */
  waitFor(pred: (f: Received) => boolean, opts: WaitOptions): Promise<Received> {
    if (opts.since !== undefined) {
      const hit = this.history.find((f) => f.seq > opts.since! && pred(f));
      if (hit) return Promise.resolve(hit);
    }
    return new Promise((resolve, reject) => {
      const onFrame = (f: Received) => {
        if (!pred(f)) return;
        cleanup();
        resolve(f);
      };
      const onClose = () => { cleanup(); reject(new Error(`conexão fechada esperando ${opts.what ?? 'frame'}`)); };
      const timer = setTimeout(() => {
        cleanup();
        reject(new TimeoutError(`timeout de ${opts.timeoutMs} ms esperando ${opts.what ?? 'frame'}`));
      }, opts.timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.off('frame', onFrame);
        this.off('close', onClose);
      };
      this.on('frame', onFrame);
      this.once('close', onClose);
    });
  }

  waitType(types: number | number[], opts: WaitOptions): Promise<Received> {
    const set = new Set(Array.isArray(types) ? types : [types]);
    return this.waitFor((f) => set.has(f.header.type), { what: [...set].map(opName).join('|'), ...opts });
  }

  /** Frames recebidos depois de `since` (do histórico em memória). */
  framesSince(since: number): Received[] {
    return this.history.filter((f) => f.seq > since);
  }

  /** Primeiro slot acessível do inventário com o item `index`, ou -1. */
  findItem(index: number): number {
    const carry = this.self?.carry ?? [];
    for (let i = 0; i < P.BASE_CARRY_SLOTS; i++) if (carry[i]?.index === index) return i;
    return -1;
  }

  /** Quantos slots acessíveis do inventário têm o item `index`. */
  countItem(index: number): number {
    const carry = this.self?.carry ?? [];
    let n = 0;
    for (let i = 0; i < P.BASE_CARRY_SLOTS; i++) if (carry[i]?.index === index) n++;
    return n;
  }

  /** Primeiro slot acessível vazio do inventário, ou -1. */
  freeCarrySlot(): number {
    const carry = this.self?.carry ?? [];
    for (let i = 0; i < P.BASE_CARRY_SLOTS; i++) if (!carry[i]?.index) return i;
    return -1;
  }

  /** Mobs vivos à vista (exclui jogadores e NPCs com Merchant). */
  liveMobs(): Mob[] {
    return [...this.mobs.values()].filter((m) => !m.isPlayer && m.merchant === 0 && m.hp > 0);
  }

  // ------------------------------------------------------------ recepção

  private onData(chunk: Buffer): void {
    let frames: Buffer[];
    try {
      frames = this.framer.push(chunk);
    } catch (e) {
      this.log.error('stream inválido; fechando', { err: String(e) });
      this.close();
      return;
    }
    for (const wire of frames) {
      let f: Frame;
      try {
        f = decode(wire);
      } catch (e) {
        this.log.warn('frame inválido', { err: String(e) });
        continue;
      }
      const r: Received = { ...f, seq: ++this.seq, at: Date.now() };
      if (r.header.clientTick && r.header.clientTick !== SKIP_CHECK_TICK) {
        this.serverTick = r.header.clientTick;
        this.serverTickAt = r.at;
      }
      this.history.push(r);
      if (this.history.length > HISTORY) this.history.splice(0, this.history.length - HISTORY);
      try {
        this.apply(r);
      } catch (e) {
        this.log.warn('falha aplicando frame', { op: opName(r.header.type), len: r.body.length, err: String(e) });
      }
      this.log.debug('←', { op: opName(r.header.type), id: r.header.id, len: r.body.length });
      this.emit('frame', r);
    }
  }

  /** Atualiza o estado a partir de um frame recebido. */
  private apply(f: Received): void {
    const b = f.body;
    const me = this.self;
    switch (f.header.type) {
      case Op.CNFAccountLogin:
        // HEADER.ID aqui é a constante IDSelChar (30002), não o slot da conexão.
        this.selChars = P.parseCNFAccountLogin(b);
        break;
      case Op.CNFNewCharacter:
      case Op.CNFDeleteCharacter:
        this.selChars = P.parseCNFNewCharacter(b);
        break;
      case Op.CNFCharacterLogin: {
        const s = P.parseCNFCharacterLogin(b);
        this.mobs.clear();
        this.connId = s.clientId;
        this.self = {
          name: s.name, cls: s.cls, clientId: s.clientId, x: s.x, y: s.y, level: s.level, exp: s.exp, hp: s.hp, maxHp: s.maxHp,
          damage: s.damage, ac: s.ac, attrs: s.attrs, coin: s.coin, carry: s.carry, equip: s.equip,
          mp: s.mp, maxMp: s.maxMp, special: s.special, learn: s.learn, skillBonus: s.skillBonus, specialBonus: s.specialBonus, affects: [],
        };
        break;
      }
      case Op.CreateMob:
        if (b.length >= 152) {
          const m = P.parseCreateMob(b);
          if (me && m.id === me.clientId) {
            me.x = m.x; me.y = m.y;
            me.guild = m.guild; me.guildLevel = m.guildLevel;
          } else {
            this.mobs.set(m.id, { ...m, seenAt: f.at });
          }
        }
        break;
      case Op.RemoveMob:
        this.mobs.delete(f.header.id);
        break;
      case Op.Action:
      case Op.Action2:
      case Op.Action3: {
        if (b.length < 40) break;
        const a = P.parseAction(b);
        if (me && f.header.id === me.clientId) {
          me.x = a.targetX; me.y = a.targetY;
          if (a.effect === 1) this.emit('teleport', { from: { x: a.posX, y: a.posY }, to: { x: a.targetX, y: a.targetY }, seq: f.seq });
        } else {
          const m = this.mobs.get(f.header.id);
          if (m) { m.x = a.targetX; m.y = a.targetY; }
        }
        break;
      }
      case Op.Attack:
      case Op.AttackOne:
      case Op.AttackTwo: {
        if (b.length < 48) break;
        const a = P.parseAttack(b);
        if (me && a.attackerId === me.clientId) {
          me.hp = a.currentHp;
          me.mp = a.currentMp;
          if (a.currentExp > 0n) me.exp = a.currentExp;
        } else {
          const atk = this.mobs.get(a.attackerId);
          if (atk) atk.hp = a.currentHp;
        }
        for (const d of a.dam) {
          if (d.damage <= 0) continue;
          if (me && d.targetId === me.clientId) {
            me.hp = Math.max(0, me.hp - d.damage);
          } else {
            const m = this.mobs.get(d.targetId);
            if (m) m.hp = Math.max(0, m.hp - d.damage);
          }
        }
        break;
      }
      case Op.UpdateScore:
        if (me && f.header.id === me.clientId && b.length >= 28) {
          const s = P.parseUpdateScore(b);
          if (s.level !== me.level) this.emit('level', { from: me.level, to: s.level, seq: f.seq });
          me.level = s.level; me.maxHp = s.maxHp; me.hp = s.hp; me.damage = s.damage; me.ac = s.ac;
          if (s.attrs) me.attrs = s.attrs;
          if (s.mp !== undefined) me.mp = s.mp;
          if (s.maxMp !== undefined) me.maxMp = s.maxMp;
          if (s.special) me.special = s.special;
          if (s.attackRun !== undefined) me.attackRun = s.attackRun;
          if (s.resist) me.resist = s.resist;
        }
        break;
      case Op.UpdateEtc:
        if (me && b.length >= 32) {
          const e = P.parseUpdateEtc(b);
          me.exp = e.exp; me.coin = e.coin; me.scoreBonus = e.scoreBonus;
          me.learn = e.learn; me.skillBonus = e.skillBonus; me.specialBonus = e.specialBonus;
        }
        break;
      case Op.SetHpMp:
        if (me && (f.header.id === me.clientId || f.header.id === this.connId) && b.length >= 8) {
          const hm = P.parseHpMp(b);
          me.hp = hm.hp; me.mp = hm.mp;
        }
        break;
      case Op.SetHpDam:
        if (me && (f.header.id === me.clientId || f.header.id === this.connId) && b.length >= 4) me.hp = P.parseHp(b);
        break;
      case Op.SendAffect:
        if (me && f.header.id === me.clientId) me.affects = P.parseSendAffect(b);
        break;
      case Op.SendItem:
        if (me && b.length >= 12) {
          const it = P.parseSendItem(b);
          if (it.place === P.PLACE_CARRY && it.slot < P.MAX_CARRY) me.carry[it.slot] = it.item;
          else if (it.place === P.PLACE_EQUIP && it.slot < P.MAX_EQUIP) me.equip[it.slot] = it.item;
        }
        break;
      case Op.Buy:
        if (me && b.length >= 12) me.coin = P.parseBuy(b).coin;
        break;
      case Op.UpdateCarry:
        if (me && b.length >= P.MAX_CARRY * 8 + 4) {
          const u = P.parseUpdateCarry(b);
          me.carry = u.carry;
          me.coin = u.coin;
        }
        break;
      case Op.MessagePanel:
      case Op.MessageChat:
        this.emit('text', { op: f.header.type, from: f.header.id, text: P.parseText(b), seq: f.seq });
        break;
    }
  }
}

export { MAX_USER };
