// Gera src/world/data/newbie-zone.json a partir dos dados do servidor
// (Jean1dev/w2pp-OpenWYD, Release/TMsrv/run):
//   - AttributeMap.dat: grade 1024×1024, um byte por bloco de 4×4 tiles,
//     lido como attr[y/4][x/4]. O bit 0x80 marca a "Newbie Zone" (Campo de Treino).
//   - NPCGener.txt: geradores de mobs; guardamos os que nascem dentro da zona.
//   - npc/<Nome>: template STRUCT_MOB (816 B). Exp i64 @32; CurrentScore @92:
//     Level i32 @+0, Ac i32 @+4, MaxHp i32 @+16.
//
// Uso: npm run zone:extract -- <caminho/para/Release/TMsrv/run>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEWBIE_BIT = 0x80;
const GRID = 1024;

const runDir = process.argv[2];
if (!runDir || !existsSync(join(runDir, 'AttributeMap.dat'))) {
  console.error('uso: npm run zone:extract -- <Release/TMsrv/run do repo w2pp-OpenWYD>');
  process.exit(2);
}

const attr = readFileSync(join(runDir, 'AttributeMap.dat'));
if (attr.length !== GRID * GRID) throw new Error(`AttributeMap.dat com ${attr.length} bytes, esperado ${GRID * GRID}`);

// Células (blocos de 4×4) com o bit da zona, agrupadas por linha em intervalos [x0,x1].
const rows: Record<number, [number, number][]> = {};
let cells = 0;
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (let cy = 0; cy < GRID; cy++) {
  let start = -1;
  for (let cx = 0; cx <= GRID; cx++) {
    const on = cx < GRID && (attr[cy * GRID + cx] & NEWBIE_BIT) !== 0;
    if (on) {
      cells++;
      if (start < 0) start = cx;
      minX = Math.min(minX, cx * 4); maxX = Math.max(maxX, cx * 4 + 3);
      minY = Math.min(minY, cy * 4); maxY = Math.max(maxY, cy * 4 + 3);
    } else if (start >= 0) {
      (rows[cy] ??= []).push([start, cx - 1]);
      start = -1;
    }
  }
}
const inZone = (x: number, y: number) => {
  const r = rows[Math.floor(y / 4)];
  const cx = Math.floor(x / 4);
  return !!r && r.some(([a, b]) => cx >= a && cx <= b);
};

// Geradores cujo ponto de nascimento cai dentro da zona.
type Spawn = { gen: number; leader: string; follower: string; x: number; y: number; range: number; maxNumMob: number; level?: number; exp?: number };
type MobStats = { level: number; exp: number; ac: number; maxHp: number };
// Atributos dos mobs (líder e seguidor) dos geradores da zona, para o bot estimar quanto
// tempo leva cada kill. undefined se o template não existir; null se for NPC (Merchant != 0).
const mobs: Record<string, MobStats> = {};
function readMob(name: string): MobStats | null | undefined {
  const tmpl = join(runDir, 'npc', name);
  if (!name || !existsSync(tmpl)) return undefined;
  const b = readFileSync(tmpl);
  if (b.length < 112) return undefined;
  if ((b[17] ?? 0) !== 0) return null;
  const cs = 92;
  return { level: b.readInt32LE(cs), exp: Number(b.readBigInt64LE(32)), ac: b.readInt32LE(cs + 4), maxHp: b.readInt32LE(cs + 16) };
}
const gener = readFileSync(join(runDir, 'NPCGener.txt'), 'utf8');
const spawns: Spawn[] = [];
for (const block of gener.split(/^#\s*\[/m).slice(1)) {
  const gen = parseInt(block, 10);
  const field = (k: string) => block.match(new RegExp(`^\\s*${k}:\\s*(\\S+)`, 'm'))?.[1];
  const x = Number(field('StartX')), y = Number(field('StartY'));
  const max = Number(field('MaxNumMob') ?? '0');
  const leader = field('Leader') ?? '';
  if (!Number.isFinite(x) || !Number.isFinite(y) || max <= 0 || !inZone(x, y)) continue;
  const s: Spawn = { gen, leader, follower: field('Follower') ?? '', x, y, range: Number(field('StartRange') ?? '0'), maxNumMob: max };
  const lead = readMob(leader);
  if (lead === null) continue; // NPC, não é mob
  if (lead) {
    s.exp = lead.exp;
    s.level = lead.level;
    mobs[leader] = lead;
  }
  const fol = readMob(s.follower);
  if (fol) mobs[s.follower] = fol;
  spawns.push(s);
}
spawns.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.gen - b.gen);

const out = {
  source: 'Jean1dev/w2pp-OpenWYD Release/TMsrv/run (AttributeMap.dat bit 0x80, NPCGener.txt, npc/*)',
  cellSize: 4,
  cells,
  bbox: { minX, minY, maxX, maxY },
  rows,
  spawns,
  mobs: Object.fromEntries(Object.entries(mobs).sort(([a], [b]) => a.localeCompare(b))),
};
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'world', 'data', 'newbie-zone.json');
writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(`zona: ${cells} células, bbox ${JSON.stringify(out.bbox)}; ${spawns.length} geradores de mob dentro, ${Object.keys(mobs).length} tipos de mob → ${dest}`);
