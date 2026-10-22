# 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei

Esta é a evolução de Mortal para Arch. São quatro peças que terminam no Rei, e só a última já é testada (cenário 5, que compra a 1742 e a Sephirot na Evolucao).

1. **Pedra da Imortalidade (1742):** o Oráculo do reino junta a Alma_do_Unicórnio (1740) e a Alma_da_Fênix (1741) com 10 safiras.
2. **Pedras Arch (1744–1751):** cada pedra de boss (1752–1759) vira uma das oito pedras Arch quando se usa uma Poeira de Oriharucon ou de Lactolerium nela, por sorteio.
3. **Sephirot (1760–1763):** o mestre de skill da classe junta as oito pedras Arch diferentes e cobra 30.000.000 de gold.
4. **Rei:** com a 1742 no Equip[10] e a Sephirot no Equip[11], o Mortal de nível exibido ≥ 300 vira Arch (cenário 5).

## Resumo

| Peça | NPC / gatilho | Posição | Entrada | Saída |
|---|---|---|---|---|
| Pedra da Imortalidade | BlueOracle `[2851]` / RedOracle `[2792]` (Merchant 78) | (1760,1582) / (1760,1890) | 1740 seguida de 1741 no slot seguinte; 10 safiras (697 vale 1, 4131 vale 10) | 1742 |
| Pedra Arch | uso de 412 Poeira_de_Oriharucon ou 413 Poeira_de_Lactolerium sobre uma pedra de boss | — | 1752–1759 | 1744–1751, por sorteio; sucesso de 93 % (1752) a 60 % (1759). Na falha, só a poeira é gasta |
| Sephirot | Cap.Cavaleiros `[3416]` (TK), Foema_Ancian `[3407]` (FM), Mestre_Archi `[3427]` (BM), ForeLearner `[3417]` (HT); Merchant 19 | Armia: (2144,2120), (2094,2126), (2077,2123), (2130,2125) | uma de cada 1744–1751 e 30M de gold; confirm ≠ 0 | 1759 + classe do NPC (1760 TK … 1763 HT) |
| Arch | Rei (cenário 5) | (1750,1880) / (1750,1574) | 1742 no Equip[10], 1760–1763 no Equip[11], Mortal ≥ armazenado 299, confirm | personagem Arch novo |

Drops (templates em `npc/*`):
- **1740:** Cav._Lugefer, Balrog, Arvak, Valquiria (e as versões em inglês).
- **1741:** Sombra_Negra, Imp_Inferno, Lich_Batama, Bruxa_Negra, Amazona_Negra.
- **Pedras de boss:**
  - 1752 Orc_L_Trooper; 1753 Guer_Caveira / Cav.Caveira; 1754 Dragao_Lich;
  - 1755 Demon_Lord; 1756 Manticora; 1757 Flame_Gargula;
  - 1758 Cav._Lugefer; 1759 FrenzyDemonLord.
  - O Mestre_Shiner tem 1753–1759 no inventário, mas não nasce no `NPCGener.txt`.

## Fluxo

- **Legado:**
  - Oráculo em `_MSG_Quest.cpp:2257-2340`:
    - procura a **primeira** 1740 e exige a 1741 no slot seguinte;
    - consome as safiras (um 4131 é consumido inteiro);
    - apaga as almas e dá a 1742. Não confere classe nem nível.
  - Pedras Arch em `_MSG_UseItem.cpp:513-715`, dentro do caminho PO/PL (Vol 4/5).
  - Sephirot em `_MSG_Quest.cpp:2102-2165`: confirm 0 só dá a fala `_NN_Soul_n_8_Sephera`.
  - Rei em `_MSG_Quest.cpp:769-866`.
- **Go:**
  - Oráculo em `blackOracle`, `handler/misc.go:736` ✅. A diferença: aceita **qualquer par** 1740→1741 vizinho, não só o primeiro.
  - Pedras Arch ❌: não há caso 1752–1759 no caminho da poeira. Mas o efeito é o mesmo do legado: as 1752–1759 têm `EF_NOSANC 1` no `ItemList.csv`, e o caminho PO/PL do legado recusa todo destino com EF_NOSANC (`_MSG_UseItem.cpp:188` no inventário, `:365` no equipamento) antes de chegar ao ramo das Pedras Arch (`:515`). Com esses dados, o ramo é inalcançável nos dois servidores.
  - Sephirot em `compSephi`, `misc.go:802` ⚠️: dá `1760 + Class`, um a mais que o legado (issue [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390)).
  - Rei em `kingArch`, `misc.go:525` ✅ (cenário 5).

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| AR-01 | Oráculo sem almas | — | `MSG_Quest` no Oráculo | `_NN_Set_Soul`; nada muda | controle |
| AR-02 | Almas fora de ordem | 1741 no slot n, 1740 no slot n+1 | `MSG_Quest` | `_NN_Set_Soul`; nada some | controle |
| AR-03 | Sem safiras | almas em ordem, 9 safiras | `MSG_Quest` | "precisa de 10 safiras"; nada some | controle |
| AR-04 | Pedra da Imortalidade | almas em ordem, 10 × 697 | `MSG_Quest` | almas e safiras somem; recebe a 1742 | feliz |
| AR-05 | Pacote de safiras | almas em ordem, 1 × 4131 | `MSG_Quest` | o 4131 some; recebe a 1742 | borda |
| AR-06 | Refino da pedra de boss | 1752 e Poeira 412 | `MSG_UseItem` com a poeira sobre a pedra (no inventário e no Equip[11]) | pelo código do ramo: sucesso troca a 1752 por uma de 1744–1747. **Na prática, recusa**: `_NN_Cant_Refine_More`, a poeira volta e a pedra fica (ver nota abaixo) | feliz |
| AR-07 | Sephirot (ask) | 8 pedras, 30M | `MSG_Quest` no mestre, confirm 0 | só a fala; nada muda | controle |
| AR-08 | Sephirot sem gold | 8 pedras, gold < 30M | confirm 1 | `_NN_Need_8_Sephera`; nada some | controle |
| AR-09 | Sephirot faltando pedra | 7 pedras diferentes e uma repetida | confirm 1 | `_NN_Need_8_Sephera`; nada some | controle |
| AR-10 | Sephirot | uma de cada 1744–1751, 30M | confirm 1 no Cap.Cavaleiros | as 8 pedras e os 30M somem; recebe a **1760** (TK) | feliz |
| AR-11 | Sephirot de cada mestre | AR-10 nos outros três mestres | — | Foema_Ancian 1761, Mestre_Archi 1762, ForeLearner 1763 | feliz |
| AR-12 | Rei | ver cenário 5 | — | — | coberto |

## Viabilidade do bot

- **Almas, safiras e pedras de boss** vêm de bosses de endgame (Lugefer nv 499, Demon Lord…), fora do alcance de um bot solo. Nenhuma loja mapeada vende as almas.
  - Antes de tudo, conferir se a loja do Go entrega algum desses itens: o Mestre_Shiner tem as pedras de boss, mas não nasce.
- **Plano realista:**
  - AR-01, AR-02 parcial, AR-03, AR-07, AR-08 e AR-09 rodam **sem** os itens raros: os controles só precisam de gold e de itens que dá para comprar.
  - Os casos felizes AR-04, AR-06 e AR-10 ficam `blocked` até haver fonte dos itens: drop de boss, ambiente de teste com itens ou outro caminho combinado com o usuário.
  - As 412/413 estão na Aki.
- O caso AR-10 é a reprodução direta do #390. Se um dia houver as 8 pedras, ele confirma o finding.

## Divergências suspeitas no Go

- Refino das pedras de boss ausente (AR-06): sem efeito visível, porque o EF_NOSANC das pedras de boss também barra o legado.
- Sephirot com classe deslocada (#390, já aberto).
- O Oráculo procura qualquer par de almas vizinho: com 1740 no slot 0 e o par certo em 5/6, o legado recusa e o Go aceita. Borda informativa.

## Reaproveitamento

- `src/scenarios/archCreation.ts` (`talkKing`, conta do Arch) e `src/world/arch.ts` (Rei, rota, Evolucao).
- O mestre de skill de cada classe já está em `src/world/skillTrees.ts` (cenários 6–11).

## Situação (2026-10-18)

`npm run quest -- 09` no Railway: 10 ✅ 2 ❌. O mortal 300 e todos os itens raros (almas, safiras, pedras de boss, Pedras Arch, Pedra da Imortalidade, Sephirot) e o gold vêm pelo banco, então nenhum caso ficou bloqueado.

| ID | Resultado | Issue |
|---|---|---|
| AR-01 | ✅ | |
| AR-02 | ✅ | |
| AR-03 | ✅ | |
| AR-04 | ✅ | |
| AR-05 | ✅ | |
| AR-06 | ✅ (o legado também recusa: EF_NOSANC) | |
| AR-07 | ✅ | |
| AR-08 | ✅ | |
| AR-09 | ✅ | |
| AR-10 | ❌ 1761 no lugar da 1760 | [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) |
| AR-11 | ❌ 1762/1763/1764 no lugar de 1761/1762/1763 | [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) |
| AR-12 | ✅ | |

Finding: [018](../findings/018-sephirot-classe-deslocada.md).

## Situação (2026-10-22)

Reteste no Railway depois do [w2pp-OpenWYD#411](https://github.com/Jean1dev/w2pp-OpenWYD/pull/411) (`main` `2866b8c`), com `npm run quest -- 09`: 12 ✅. Cada mestre de skill agora entrega a Sephirot `1759 + Class` do template (Cap.Cavaleiros 1760, Foema_Ancian 1761, Mestre_Archi 1762, ForeLearner 1763), com as 8 Pedras Arch 1744–1751 e os 30M semeados. O Go escolhe a vaga livre antes de apagar as pedras, por isso a Sephirot cai na 1ª vaga já vazia (Carry[12]) e não no Carry[0], como no legado; também não fala `_NN_Sepherot_created`. O efeito é o mesmo. O AR-06 passou a ler o banco com uma conexão só: o papel do banco aceita 5 conexões e o tmServer usa 2, então a consulta aninhada podia esperar para sempre.

| ID | Resultado | Issue |
|---|---|---|
| AR-01 | ✅ notice 15, nada muda | |
| AR-02 | ✅ notice 15, nada muda | |
| AR-03 | ✅ notice 15, nada muda | |
| AR-04 | ✅ almas e 10 safiras → 1742 | |
| AR-05 | ✅ almas e 4131 → 1742 | |
| AR-06 | ✅ "não pode ser mais refinado" (o legado também recusa) | |
| AR-07 | ✅ sem resposta, nada muda | |
| AR-08 | ✅ notice 15, nada muda | |
| AR-09 | ✅ notice 15, nada muda | |
| AR-10 | ✅ 1760 | [~~#390~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) corrigida |
| AR-11 | ✅ 1761 / 1762 / 1763 | [~~#390~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) corrigida |
| AR-12 | ✅ Arch no slot 1 (master 1, nível 0) | |
