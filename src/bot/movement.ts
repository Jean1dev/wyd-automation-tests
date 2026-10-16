// Movimento em passos curtos via MSG_Action (0x036C), como o cliente faz ao clicar no chão.
// O servidor Go aceita o destino sem validar o caminho, mas andamos em passos de poucos
// tiles e no ritmo de um jogador, para continuar válidos se a validação vier.
import type { GameClient } from '../client/GameClient.ts';
import { Op } from '../protocol/opcodes.ts';
import * as P from '../protocol/packets.ts';
import { sleep } from './util.ts';

const STEP_TILES = 4;
/** Velocidade de movimento (AttackRun & 0x0F) de um personagem novo. */
const SPEED = 2;
const MS_PER_TILE = 260;

/** Direções no formato do Route[] legado (BASE_GetRoute): teclado numérico, y cresce para o sul. */
function dirChar(dx: number, dy: number): number {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const table: Record<string, string> = {
    '0,-1': '2', '1,-1': '3', '1,0': '6', '1,1': '9',
    '0,1': '8', '-1,1': '7', '-1,0': '4', '-1,-1': '1',
  };
  return (table[`${sx},${sy}`] ?? '0').charCodeAt(0);
}

function route(fromX: number, fromY: number, toX: number, toY: number): Uint8Array {
  const r = new Uint8Array(24);
  let x = fromX, y = fromY;
  for (let i = 0; i < 24 && (x !== toX || y !== toY); i++) {
    const dx = toX - x, dy = toY - y;
    r[i] = dirChar(dx, dy);
    x += Math.sign(dx); y += Math.sign(dy);
  }
  return r;
}

/** Envia um único passo de (x,y) atual até (tx,ty) e atualiza a posição local. */
export function stepTo(c: GameClient, tx: number, ty: number): void {
  const me = c.self!;
  c.send(Op.Action, P.action({ posX: me.x, posY: me.y, effect: 0, speed: SPEED, route: route(me.x, me.y, tx, ty), targetX: tx, targetY: ty }));
  me.x = tx;
  me.y = ty;
}

export interface WalkOptions {
  /** Interrompe a caminhada (ex.: teleporte forçado pelo servidor). Retorna true para parar. */
  abort?: () => boolean;
}

/** Anda até (tx, ty) em passos. Retorna false se foi interrompido. */
export async function walkTo(c: GameClient, tx: number, ty: number, opts: WalkOptions = {}): Promise<boolean> {
  for (let guard = 0; guard < 400; guard++) {
    const me = c.self!;
    const dx = tx - me.x, dy = ty - me.y;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d === 0) return true;
    if (opts.abort?.()) return false;
    const n = Math.min(STEP_TILES, d);
    const nx = me.x + Math.round((dx * n) / d);
    const ny = me.y + Math.round((dy * n) / d);
    stepTo(c, nx, ny);
    await sleep(n * MS_PER_TILE);
    if (opts.abort?.()) return false;
  }
  throw new Error(`walkTo(${tx},${ty}) não convergiu`);
}

/** Anda por uma sequência de pontos. */
export async function walkPath(c: GameClient, pts: { x: number; y: number }[], opts: WalkOptions = {}): Promise<boolean> {
  for (const p of pts) if (!(await walkTo(c, p.x, p.y, opts))) return false;
  return true;
}
