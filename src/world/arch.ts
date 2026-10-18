// Criação do Arch (mortal → Arch) como está no servidor (Jean1dev/w2pp-OpenWYD, main d896ae2f).
//
// - O Rei (Merchant 111; MOB.Merchant 14/15 no legado) cria o Arch quando o mortal tem nível
//   armazenado ≥ 299, a Pedra da Imortalidade (1742) no Equip[10] e uma Sephirot (1760–1763) no
//   Equip[11], e o MSG_Quest chega com confirmação ≠ 0 (handler/misc.go:262 kingQuest, :525
//   kingArch; _MSG_Quest.cpp:694-867). A classe do Arch é sephirot − 1760.
// - O DB cria o Arch no primeiro slot livre, com o mesmo nome, nível 0, sem itens, e o corpo do
//   mortal: Equip[0] = MortalFace + 5 + classe (dbserver grpcsrv/server.go:471; DBSrv
//   CFileDB.cpp:1449-1611). O mortal continua na conta, só sem a Pedra e a Sephirot.
// - Depois o servidor salva o mortal, volta para a seleção de personagem (CNFCharacterLogout),
//   manda a lista nova (CNFNewCharacter) e o MSG_SendArchEffect com o slot do Arch (misc.go:573).
// - O Rei só atende o próprio reino: quem não tem capa de reino (Clan 0) passa em qualquer um.
import type { NpcSpec } from '../bot/npc.ts';
import { NPC as COVEIRO_NPC } from './coveiro.ts';

export const ITEM = {
  /** Pedra_da_Imortalidade (ItemList.csv; nPos 1024 = Equip[10]), 5000 na Evolução. */
  pedraDaImortalidade: 1742,
  /** Sephirot(TransKnight..Huntress) = 1760 + classe (nPos 2048 = Equip[11]), 7000 na Evolução. */
  sephirotBase: 1760,
  poeiraDeFada: 4142,
} as const;

export const PRICE = { pedraDaImortalidade: 5000, sephirot: 7000 } as const;

export const EQUIP_SLOT = { face: 0, imortalidade: 10, sephirot: 11 } as const;

export const CLASS_NAME = ['TransKnight', 'Foema', 'BeastMaster', 'Huntress'] as const;

/** Nível armazenado mínimo do Rei e o máximo do mortal (level.MaxLevel = 399, exibido 400). */
export const KING_MIN_LEVEL = 299;
export const MORTAL_MAX_LEVEL = 399;

/** Corpo esperado do Arch: o rosto do mortal + 5 + a classe escolhida. */
export const archFace = (mortalFace: number, archClass: number) => mortalFace + 5 + archClass;

/** Rosto do mortal novo por classe (BaseMob Equip[0]): 1, 11, 21, 31. */
export const MORTAL_FACE = [1, 11, 21, 31] as const;

export const NPC = {
  /** Bloco [6071], Armia: vende a Pedra da Imortalidade (slot 0) e as Sephirot (slots 1–4) no seed do DB. */
  evolucao: COVEIRO_NPC.evolucao,
  /** Bloco [9], Rei_Glantuar (Clan 8, Akelonia): o rei mais perto de Armia. */
  rei: { name: 'Rei_Glantuar', merchant: 111, pos: { x: 1750, y: 1880 }, stand: { x: 1752, y: 1882 } },
} as const satisfies Record<string, NpcSpec>;

/** De Armia até o Rei: sai pelo oeste e segue reto (o servidor não valida o caminho). */
export const ROUTE_TO_KING = [{ x: 2052, y: 2060 }, { x: 1900, y: 1960 }, NPC.rei.stand];
export const ROUTE_TO_ARMIA = [{ x: 1900, y: 1960 }, { x: 2052, y: 2060 }, { x: 2090, y: 2098 }];
