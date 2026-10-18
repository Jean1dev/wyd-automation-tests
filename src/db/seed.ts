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

export interface ItemRow {
  slot: number;
  index: number;
  eff: [number, number][];
}

/** Uma conexão por uso; fecha sempre (a máquina de teste tem pouca memória). */
export async function withDb<T>(cfg: DbConfig, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: cfg.url });
  await client.connect();
  try {
    return await fn(new Db(client));
  } finally {
    await client.end();
  }
}

export class Db {
  constructor(private readonly c: pg.Client) {}

  async character(name: string): Promise<CharRow> {
    const r = await this.c.query(`SELECT id, account_id, slot, name, ${CHAR_COLUMNS.map((k) => `"${k}"`).join(', ')} FROM character WHERE name = $1`, [name]);
    if (!r.rows[0]) throw new Error(`personagem "${name}" não está no banco`);
    return r.rows[0] as CharRow;
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

  async items(name: string, kind: ItemKind): Promise<ItemRow[]> {
    const ch = await this.character(name);
    const r = await this.c.query(
      'SELECT slot, item_index, eff1, effv1, eff2, effv2, eff3, effv3 FROM item WHERE character_id = $1 AND owner_kind = $2 ORDER BY slot',
      [ch.id, OWNER[kind]],
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
