# 05 — Capa do Reino (azul / vermelha) e a borda

Esta é a segunda capa do Mortal, a que escolhe o reino. Os guias a chamam de "Cavaleiro do Reino".

1. O Guarda_Real do castelo leva o Mortal a uma área de Cavaleiros Mortais.
2. Lá ele pega o Emblema_do_Reino (4081) e o equipa no Equip[13].
3. O Rei troca o emblema pela capa do reino **sem cobrar safiras**. Sem o emblema, o Rei cobra safiras.

A partir do nível 255, o mesmo Rei troca a capa sem borda pela capa com borda.

## Resumo

| Papel | NPC (gerador) | Posição | Merchant (byte 17 / Go) |
|---|---|---|---|
| Teleporte (Hekalotia, clan 7) | Guarda_Real `[2843]` | (1754,1583) | 100 grade 13 / 100 |
| Teleporte (Akelonia, clan 8) | Guarda_Real_ `[2782]` | (1750,1890) | 100 grade 13 / 100 |
| Capa | Rei_Harabard `[8]` (clan 7) / Rei_Glantuar `[9]` (clan 8) | (1750,1574) / (1750,1880) | 15 / 111 |

- **Área:** em volta de (1740,1725) ± variação. Não tem guarda nem reset.
- **Mobs que soltam o 4081:** Cav._Mortal___ `[3817-3820]` (nv 221), em (1725–1740,1718–1734); o template Cav._Mortal____; e DarkKnightKing@.

### Capas

| Capa | Item | Reino | CapeMode |
|---|---|---|---|
| Manto_Hekalotia / Manto_Akelonia (sem borda) | 545 / 546 | 7 / 8 | 1 |
| Manto_do_Aventureiro (neutra) | 549 | — | 1 |
| Manto_do_Guerreiro / Manto_de_Shiner (com borda) | 543 / 544 | 7 / 8 | 2 |
| Elite (355), Herói (Alma), Mestre (Celestial) | 3191–3199 | — | 1 ou 2 |

## Pré-requisitos

- **Guarda_Real:** `ClassMaster == MORTAL`, armazenado `[199,254)`, que é exibido 200–254.
- **Rei (`KING`, `_MSG_Quest.cpp:693-1125`):**
  - O clan do jogador é o do Rei ou 0. A capa sobrepõe o clan: 545/543/3191/… valem 7, 546/544/3192/… valem 8.
  - `confirm == 0`: só informa o preço em safiras.
  - O valor configurado vem do banco. Para o clan 8, o legado inverte a tabela: 1↔60, 2↔32, 4↔16.
  - Capa com borda (CapeMode 2): só a mensagem de bênção, nada muda.
  - `CurrentScore.Level ≥ 219` (exibido 220).
  - **Sem capa ou com capa sem reino (CapeMode 0):**
    - exige safiras (697 vale 1, 4131 vale 10) ou o 4081 no Equip[13];
    - dá 545/546.
  - **Capa sem borda (CapeMode 1):**
    - só a partir do armazenado 255 (exibido 256);
    - mesmo pagamento;
    - dá 543/544. A partir de 3193/3196, dá 3191/3192 e 3194/3195.
  - O 4081, se equipado, é consumido no lugar das safiras.

## Fluxo

- **Legado:** teleporte em `_MSG_Quest.cpp:2342-2361`; Rei em `:693-1125`. Os trechos que importam aqui são o pagamento e o 4081 (`:986-1035`) e a escolha da capa (`:1036-1080`).
- **Go:**
  - Teleporte em `royalCapeQuest`, `handler/misc.go:649` ✅.
  - Rei em `kingCapeService`, `misc.go:272` ⚠️:
    - o preço vem de `QuoteKingdomCape` (persistência) e exige **pagamento exato**;
    - **não há o caminho do 4081**;
    - o confirm 0 manda o texto "Sao necessarias N safiras.".

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| CR-01 | Teleporte abaixo do nível | Mortal exibido 199 | `MSG_Quest` no Guarda_Real | recusa | controle |
| CR-02 | Teleporte | Mortal exibido 200 | `MSG_Quest` no Guarda_Real | teleporta para (1740±3,1725±3) | feliz |
| CR-03 | Drop do emblema | na área | matar Cav._Mortal até o drop (tempo máximo) | o 4081 cai | feliz |
| CR-04 | Rei abaixo do nível | exibido 219, com 4081 equipado | `MSG_Quest` no Rei, confirm 1 | `_NN_Need_Level`; nada muda | controle |
| CR-05 | Preço (ask) | exibido 220 | `MSG_Quest` no Rei, confirm 0 | mensagem com o número de safiras; nada muda | feliz |
| CR-06 | Capa pelo emblema | exibido 220, 4081 no Equip[13], **sem safiras** | `MSG_Quest` no Rei, confirm 1 | o Equip[13] fica vazio; o Equip[15] recebe 545 (Harabard) ou 546 (Glantuar) | feliz |
| CR-07 | Sem emblema e sem safira | exibido 220, nada | confirm 1 | "precisa de N safiras"; nada muda | controle |
| CR-08 | Rei do outro reino | com 545 | `MSG_Quest` no Rei_Glantuar | nada acontece (`break` silencioso) | controle |
| CR-09 | Capa já com borda | com 543 | `MSG_Quest` no Rei_Harabard | só a bênção; nada muda | controle |
| CR-10 | Borda antes do nível | com 545, exibido 255 | confirm 1 | `_NN_Need_Level` | controle |
| CR-11 | Borda pelo emblema | com 545, exibido 256, 4081 no Equip[13] | confirm 1 | 545 → 543; o emblema some | feliz |
| CR-12 | Pagamento em safiras | sem emblema, com safiras ≥ preço | confirm 1 | as safiras somem (o 4131 conta 10 e é consumido inteiro); recebe a capa | feliz |
| CR-13 | Mortal acima de 254 no Guarda | exibido 255 | `MSG_Quest` no Guarda_Real | recusa | controle |

## Viabilidade do bot

- Nível exibido 220 com Poeira de Fada. Equipamento da loja.
- **Ida:** o Rei_Glantuar e a rota até ele já estão no cenário 5 (`src/world/arch.ts`, `ROUTE_TO_KING`). A rota até o Rei_Harabard (1750,1574) e o Guarda_Real (1754,1583), no castelo de Hekalotia, ainda precisa ser levantada.
- **Farm:** os Cav._Mortal (nv 221) aparecem em grupos de 4. É o ponto mais caro. Medir o tempo até o drop. Se não der, marcar CR-06/11 como `blocked` e testar só o pagamento em safiras (CR-12).
- Safiras não estão nas lojas mapeadas, então CR-12 depende de drop ou troca. Se não houver safira, registrar como `blocked`.
- O pedido de preço (confirm 0) e a entrega (confirm 1) usam o padrão `talkKing` de `src/scenarios/archCreation.ts`.

## Divergências suspeitas no Go

- O caminho do 4081 não existe: com o emblema e sem safira, o Go deve recusar (CR-06/11). É a principal suspeita.
- O preço vem da persistência (`QuoteKingdomCape`), sem a inversão do legado para o clan 8, e só aceita pagamento exato. O legado aceita sobra e consome um 4131 inteiro mesmo quando faltava menos.
- O Go grava `Clan` = reino ao comprar. O legado não muda o clan do jogador aqui, só o da guilda quando ele é líder.

## Reaproveitamento

- `src/world/arch.ts` (`NPC.rei`, rotas), `talkKing` de `src/scenarios/archCreation.ts`, `src/bot/equip.ts` (emblema no slot 13).
