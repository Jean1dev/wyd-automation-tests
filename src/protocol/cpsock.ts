// Codec de transporte CPSock (mesmo algoritmo de tmserver/internal/protocol/{codec,transform,checksum}.go).
//
// Header de 12 bytes, little-endian:
//   0 Size u16 · 2 KeyWord u8 · 3 CheckSum u8 · 4 Type u16 · 6 ID u16 · 8 ClientTick u32
// Os bytes 0..3 viajam em claro; de 4 em diante o pacote é ofuscado pelo keyword transform.
// CheckSum = soma(cifrado) − soma(plano), mod 256.
import { KEY_TABLE } from './keytable.ts';

export const HEADER_SIZE = 12;
export const INIT_CODE = 0x1f11f311;
export const MAX_MESSAGE_SIZE = 8192;
const TRANSFORM_START = 4;

export interface Header {
  size: number;
  keyWord: number;
  checkSum: number;
  type: number;
  id: number;
  clientTick: number;
}

export interface Frame {
  header: Header;
  /** Corpo em claro (bytes [12, Size)). */
  body: Buffer;
  checksumMismatch: boolean;
}

/** Os 4 bytes do handshake que todo cliente envia ao abrir a conexão. */
export function initCodeBytes(): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(INIT_CODE, 0);
  return b;
}

/** Ofusca buf[4:] in place. Retorna [soma plano, soma cifrado] (uint8). */
function encodePayload(buf: Buffer, keyWord: number): [number, number] {
  let pos = KEY_TABLE[keyWord * 2];
  let sum1 = 0;
  let sum2 = 0;
  for (let i = TRANSFORM_START; i < buf.length; i++) {
    const plain = buf[i];
    sum1 = (sum1 + plain) & 0xff;
    const trans = KEY_TABLE[pos * 2 + 1];
    let c: number;
    switch (i & 3) {
      case 0: c = plain + ((trans << 1) & 0xff); break;
      case 1: c = plain - (trans >> 3); break;
      case 2: c = plain + ((trans << 2) & 0xff); break;
      default: c = plain - (trans >> 5); break;
    }
    buf[i] = c & 0xff;
    sum2 = (sum2 + buf[i]) & 0xff;
    pos = (pos + 1) & 0xff;
  }
  return [sum1, sum2];
}

/** Desofusca buf[4:] in place. Retorna [soma plano, soma cifrado] (uint8). */
function decodePayload(buf: Buffer, keyWord: number): [number, number] {
  let pos = KEY_TABLE[keyWord * 2];
  let sum1 = 0;
  let sum2 = 0;
  for (let i = TRANSFORM_START; i < buf.length; i++) {
    const cipher = buf[i];
    sum2 = (sum2 + cipher) & 0xff;
    const trans = KEY_TABLE[pos * 2 + 1];
    let p: number;
    switch (i & 3) {
      case 0: p = cipher - ((trans << 1) & 0xff); break;
      case 1: p = cipher + (trans >> 3); break;
      case 2: p = cipher - ((trans << 2) & 0xff); break;
      default: p = cipher + (trans >> 5); break;
    }
    buf[i] = p & 0xff;
    sum1 = (sum1 + buf[i]) & 0xff;
    pos = (pos + 1) & 0xff;
  }
  return [sum1, sum2];
}

/** Monta os bytes de fio de um pacote. Size, KeyWord e CheckSum são calculados aqui. */
export function encode(type: number, id: number, clientTick: number, body: Uint8Array, keyWord: number): Buffer {
  const size = HEADER_SIZE + body.length;
  if (size > MAX_MESSAGE_SIZE) throw new Error(`cpsock: pacote de ${size} bytes excede ${MAX_MESSAGE_SIZE}`);
  const buf = Buffer.alloc(size);
  buf.writeUInt16LE(size, 0);
  buf[2] = keyWord & 0xff;
  buf[3] = 0;
  buf.writeUInt16LE(type & 0xffff, 4);
  buf.writeUInt16LE(id & 0xffff, 6);
  buf.writeUInt32LE(clientTick >>> 0, 8);
  buf.set(body, HEADER_SIZE);
  const [sum1, sum2] = encodePayload(buf, keyWord & 0xff);
  buf[3] = (sum2 - sum1) & 0xff;
  return buf;
}

/** Decodifica um frame completo (exatamente Size bytes). Não altera `wire`. */
export function decode(wire: Uint8Array): Frame {
  if (wire.length < HEADER_SIZE) throw new Error(`cpsock: frame curto (${wire.length} bytes)`);
  const buf = Buffer.from(wire);
  const size = buf.readUInt16LE(0);
  if (size !== buf.length) throw new Error(`cpsock: frame de ${buf.length} bytes com Size ${size}`);
  const keyWord = buf[2];
  const wantSum = buf[3];
  const [sum1, sum2] = decodePayload(buf, keyWord);
  return {
    header: {
      size,
      keyWord,
      checkSum: wantSum,
      type: buf.readUInt16LE(4),
      id: buf.readUInt16LE(6),
      clientTick: buf.readUInt32LE(8),
    },
    body: buf.subarray(HEADER_SIZE),
    checksumMismatch: ((sum2 - sum1) & 0xff) !== wantSum,
  };
}

/**
 * Remonta frames a partir do stream TCP vindo do servidor. O servidor não manda INITCODE
 * de volta: o stream S→C começa direto no primeiro header.
 */
export class Framer {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out: Buffer[] = [];
    while (this.buf.length >= 2) {
      const size = this.buf.readUInt16LE(0);
      if (size < HEADER_SIZE || size > MAX_MESSAGE_SIZE) {
        throw new Error(`cpsock: Size fora do intervalo no stream: ${size}`);
      }
      if (this.buf.length < size) break;
      out.push(Buffer.from(this.buf.subarray(0, size)));
      this.buf = this.buf.subarray(size);
    }
    return out;
  }
}
