import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decode, encode, Framer, HEADER_SIZE } from '../../src/protocol/cpsock.ts';

// Vetores de transporte copiados de w2pp-OpenWyd-WebClient/docs/evidence/03-protocolo/vectors/transport.
// Os mesmos vetores são validados contra o codec Go do servidor na CI do webclient.
const dir = join(import.meta.dirname, '..', 'fixtures', 'transport');
const vectors = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
    iKeyWord: number; plain_hex: string; wire_hex: string; checksum: number;
  } }));

describe('cpsock: vetores de transporte', () => {
  it('tem os vetores', () => expect(vectors.length).toBeGreaterThan(90));

  it.each(vectors)('$name: encode bate byte a byte', (v) => {
    const plain = Buffer.from(v.plain_hex, 'hex');
    const wire = encode(plain.readUInt16LE(4), plain.readUInt16LE(6), plain.readUInt32LE(8), plain.subarray(HEADER_SIZE), v.iKeyWord);
    expect(wire.toString('hex')).toBe(v.wire_hex);
    expect(wire[3]).toBe(v.checksum);
  });

  it.each(vectors)('$name: decode recupera o plano', (v) => {
    const f = decode(Buffer.from(v.wire_hex, 'hex'));
    const plain = Buffer.from(v.plain_hex, 'hex');
    expect(f.checksumMismatch).toBe(false);
    expect(f.header.type).toBe(plain.readUInt16LE(4));
    expect(f.header.id).toBe(plain.readUInt16LE(6));
    expect(f.header.clientTick).toBe(plain.readUInt32LE(8));
    expect(Buffer.from(f.body).toString('hex')).toBe(plain.subarray(HEADER_SIZE).toString('hex'));
  });
});

describe('Framer', () => {
  it('remonta frames partidos e colados', () => {
    const a = encode(0x0336, 1, 10, Buffer.alloc(140, 7), 3);
    const b = encode(0x0337, 1, 11, Buffer.alloc(36, 9), 200);
    const all = Buffer.concat([a, b]);
    const fr = new Framer();
    const out = [...fr.push(all.subarray(0, 5)), ...fr.push(all.subarray(5, 160)), ...fr.push(all.subarray(160))];
    expect(out.map((x) => decode(x).header.type)).toEqual([0x0336, 0x0337]);
    expect(decode(out[1]).body.equals(Buffer.alloc(36, 9))).toBe(true);
  });
});
