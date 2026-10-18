// Quest 07 — Pílula do Poder Mágico (docs/quests/07-pilula-orc.md).
//
// A pílula (470, EF_VOLATILE 6) cai do Orc Lord no fim do Castelo Orc. Os casos não dependem do drop:
// a pílula vem pelo banco e o "chão" é o próprio personagem largando a pílula aos pés (MSG_DropItem) —
// o legado aplica a pílula no MSG_GetItem pelo sIndex, venha ela de onde vier (_MSG_GetItem.cpp:94-126).

export const ITEM = {
  /** Pilula_do_Poder_Mágico (ItemList.csv), Vol 6 (_MSG_UseItem.cpp:981-998). */
  pilula: 470,
} as const;

/** Pontos de skill da pílula (SkillBonus += 9; Basedef.cpp:865 soma 9 se PilulaOrc). */
export const PILULA_BONUS = 9;

/** Nível ARMAZENADO dos personagens dos casos (o SkillBonus derivado é nível*3 no Go). */
export const LEVEL = 49;

/** Mensagens do legado (Language.h). */
export const MSG = { getSkillPoint: 1, youveDoneItAlready: 71 } as const;

/** Gerador do Orc Lord (NPCGener.txt:13816) — referência; o castelo não é usado nos casos. */
export const ORC_LORD_GENER = 'Orc_Lord';
