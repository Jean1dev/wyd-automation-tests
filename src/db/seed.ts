// Acesso direto ao banco do servidor de teste (Postgres do db-server) para montar pré-condições
// de caso e conferir o que foi salvo. Só se escreve com o personagem deslogado: o tm-server lê o
// personagem do banco no CharacterLogin e o grava de volta no logout, por cima de qualquer escrita
// feita durante a sessão.
//
// Esquema: w2pp-OpenWYD internal/migrations (character, item). Nomes de coluna em snake_case.
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv({ quiet: true });

export interface DbConfig {
  url: string;
}

export function loadDbConfig(): DbConfig {
  const url = process.env.WYD_DATABASE_URL?.trim();
  if (!url) throw new Error('variável WYD_DATABASE_URL ausente no .env (veja .env.example)');
  return { url };
}

/** Colunas de `character` que os cenários podem semear. */
export const CHAR_COLUMNS = [
  'class', 'level', 'exp', 'coin', 'str', 'int', 'dex', 'con', 'score_bonus', 'special_bonus', 'skill_bonus',
  'max_hp', 'max_mp', 'hp', 'mp', 'learned_skill', 'sec_learned_skill', 'save_x', 'save_y', 'citizen',
  'class_master', 'clan', 'soul', 'fame', 'celestial_lv40', 'celestial_lv90', 'celestial_circle', 'terra_mistica',
  'arch_lv355', 'arch_lv370', 'mortal_level', 'celestial_arch_level', 'arch_crystal_stage',
  // Migrações 0028–0033 (w2pp-OpenWYD#411).
  'newbie_quest', 'molar_gargula', 'pilula_orc', 'celestial_reset',
  'celestial_add120', 'celestial_add150', 'celestial_add180', 'celestial_add200', 'celestial_level', 'sub_celestial_level',
  // Guilda (0001_init; o save de logout grava por cima, store_live.go).
  'guild_id', 'guild_level',
] as const;
export type CharColumn = (typeof CHAR_COLUMNS)[number];
export type CharRow = Record<CharColumn, number> & { id: number; account_id: number; slot: number; name: string };

/** Valores de `class_master` (tmserver/internal/handler/score_derive.go). */
export const CLASS_MASTER = { ARCH: 1, MORTAL: 2, CELESTIAL: 3, CELESTIAL_CS: 4, SCELESTIAL: 5 } as const;

export type ItemKind = 'equip' | 'carry';
const OWNER: Record<ItemKind, string> = { equip: 'char_equip', carry: 'char_carry' };

export interface SeedItem {
  index: number;
  eff?: [number, number][];
}

export interface GuildRow {
  id: number;
  name: string;
  clan: number;
  citizen: number;
  members: { name: string; level: number }[];
}

export interface ItemRow {
  slot: number;
  index: number;
  eff: [number, number][];
}

/** Uma conexão por uso; fecha sempre (a máquina de teste tem pouca memória). */
export async function withDb<T>(cfg: DbConfig, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await connectWithRetry(cfg);
  try {
    return await fn(new Db(client));
  } finally {
    await client.end();
  }
}

/**
 * O Postgres do db-server tem poucas conexões e às vezes recusa com "too many connections"
 * (53300) por alguns minutos; espera e tenta de novo até ~25 min antes de desistir.
 */
async function connectWithRetry(cfg: DbConfig): Promise<pg.Client> {
  for (let attempt = 1; ; attempt++) {
    const client = new pg.Client({ connectionString: cfg.url });
    try {
      await client.connect();
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      const full = (e as { code?: string }).code === '53300' || /too many connections/i.test(String(e));
      if (!full || attempt >= 50) throw e;
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
}

export class Db {
  constructor(private readonly c: pg.Client) {}

  async character(name: string): Promise<CharRow> {
    const r = await this.c.query(`SELECT id, account_id, slot, name, ${CHAR_COLUMNS.map((k) => `"${k}"`).join(', ')} FROM character WHERE name = $1`, [name]);
    if (!r.rows[0]) throw new Error(`personagem "${name}" não está no banco`);
    return r.rows[0] as CharRow;
  }

  /** Todos os personagens com esse nome (o Arch nasce com o nome do mortal, na mesma conta), por slot. */
  async charactersNamed(name: string): Promise<CharRow[]> {
    const r = await this.c.query(`SELECT id, account_id, slot, name, ${CHAR_COLUMNS.map((k) => `"${k}"`).join(', ')} FROM character WHERE name = $1 ORDER BY slot`, [name]);
    return r.rows as CharRow[];
  }

  /** Grava colunas do personagem (só as da lista CHAR_COLUMNS). */
  async setCharacter(name: string, fields: Partial<Record<CharColumn, number>>): Promise<void> {
    const keys = Object.keys(fields) as CharColumn[];
    for (const k of keys) if (!CHAR_COLUMNS.includes(k)) throw new Error(`coluna inválida: ${k}`);
    if (!keys.length) return;
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const r = await this.c.query(`UPDATE character SET ${sets} WHERE name = $1`, [name, ...keys.map((k) => fields[k])]);
    if (r.rowCount !== 1) throw new Error(`personagem "${name}" não está no banco`);
  }

  /** Special[0..3] do personagem (coluna `special`, smallint[]; store_live.go LoadCharacter). */
  async setSpecial(name: string, special: [number, number, number, number]): Promise<void> {
    const r = await this.c.query('UPDATE character SET special = $2::smallint[] WHERE name = $1', [name, special]);
    if (r.rowCount !== 1) throw new Error(`personagem "${name}" não está no banco`);
  }

  async special(name: string): Promise<number[]> {
    const r = await this.c.query('SELECT special FROM character WHERE name = $1', [name]);
    if (!r.rows[0]) throw new Error(`personagem "${name}" não está no banco`);
    return (r.rows[0].special ?? []).map(Number);
  }

  /** Blob `save_celestial` (SaveCelestial[2] do tmServer, world/celestial_sheet.go); vazio = sem ficha. Só leitura. */
  async saveCelestial(name: string): Promise<Buffer> {
    const r = await this.c.query('SELECT save_celestial FROM character WHERE name = $1', [name]);
    if (!r.rows[0]) throw new Error(`personagem "${name}" não está no banco`);
    return (r.rows[0].save_celestial as Buffer | null) ?? Buffer.alloc(0);
  }

  /** Ciclo do Kefra (tabela kefra_state, store/kefra_state.go). O tmServer só o lê no boot: não semeie. Só leitura. */
  async kefraState(): Promise<{ defeated: boolean; nextSpawnUnix: number; revision: number } | undefined> {
    const r = await this.c.query('SELECT defeated, next_spawn_unix, revision FROM kefra_state WHERE id = 1');
    const x = r.rows[0];
    return x ? { defeated: !!x.defeated, nextSpawnUnix: Number(x.next_spawn_unix), revision: Number(x.revision) } : undefined;
  }

  /** Guilda pelo nome (tabelas guild e guild_member, migração 0012); undefined se não existe. Só leitura. */
  async guild(name: string): Promise<GuildRow | undefined> {
    const g = await this.c.query('SELECT id, name, clan, citizen FROM guild WHERE name = $1', [name]);
    if (!g.rows[0]) return undefined;
    const m = await this.c.query('SELECT name, guild_level FROM guild_member WHERE guild_id = $1 ORDER BY name', [g.rows[0].id]);
    return { ...g.rows[0], members: m.rows.map((r) => ({ name: r.name as string, level: Number(r.guild_level) })) } as GuildRow;
  }

  async items(name: string, kind: ItemKind): Promise<ItemRow[]> {
    return this.itemsById((await this.character(name)).id, kind);
  }

  /** Itens pelo id do personagem (para quando há dois com o mesmo nome, como o mortal e o Arch). */
  async itemsById(id: number, kind: ItemKind): Promise<ItemRow[]> {
    const r = await this.c.query(
      'SELECT slot, item_index, eff1, effv1, eff2, effv2, eff3, effv3 FROM item WHERE character_id = $1 AND owner_kind = $2 ORDER BY slot',
      [id, OWNER[kind]],
    );
    return r.rows.map((x) => ({ slot: x.slot, index: x.item_index, eff: [[x.eff1, x.effv1], [x.eff2, x.effv2], [x.eff3, x.effv3]] }));
  }

  /** Põe um item no slot (substitui o que houver). */
  async putItem(name: string, kind: ItemKind, slot: number, item: SeedItem): Promise<void> {
    const ch = await this.character(name);
    const e = [...(item.eff ?? []), [0, 0], [0, 0], [0, 0]].slice(0, 3);
    await this.c.query('DELETE FROM item WHERE character_id = $1 AND owner_kind = $2 AND slot = $3', [ch.id, OWNER[kind], slot]);
    await this.c.query(
      `INSERT INTO item (owner_kind, character_id, slot, item_index, eff1, effv1, eff2, effv2, eff3, effv3)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [OWNER[kind], ch.id, slot, item.index, e[0][0], e[0][1], e[1][0], e[1][1], e[2][0], e[2][1]],
    );
  }

  /** Preço da capa do reino em safiras (tabela `sapphire_balance`, store/kingdom_cape.go). */
  async kingdomCapeQuote(): Promise<{ revision: number; hekalotia: number; akelonia: number }> {
    const r = await this.c.query('SELECT version, hekalotia_cost, akelonia_cost FROM sapphire_balance WHERE singleton');
    const x = r.rows[0];
    if (!x) throw new Error('sapphire_balance vazia');
    return { revision: Number(x.version), hekalotia: x.hekalotia_cost, akelonia: x.akelonia_cost };
  }

  async clearItem(name: string, kind: ItemKind, slot: number): Promise<void> {
    const ch = await this.character(name);
    await this.c.query('DELETE FROM item WHERE character_id = $1 AND owner_kind = $2 AND slot = $3', [ch.id, OWNER[kind], slot]);
  }
}
