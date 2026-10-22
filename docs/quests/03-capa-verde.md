# 03 — Capa Verde (Formatura Aprendiz)

Esta é a primeira capa do personagem, o Manto_do_Aprendiz (4006). Os guias a chamam de "Formatura dos Cavaleiros Aprendizes".

- O Mortal faz a quest em três passos:
  1. o Diretor_Treina. o leva a uma arena ao sul de Azran;
  2. lá ele mata Taurus até cair o Emblema_da_Aprendizagem (4080);
  3. com o emblema equipado, o Chefe_Treina. troca o emblema pela capa.
- O Arch na faixa de nível recebe a capa direto do Lider_Aprendiz.

## Resumo

| Papel | NPC (gerador) | Posição | Merchant (byte 17 / Go) |
|---|---|---|---|
| Teleporte | Diretor_Treina. `[3691]` | (2244,1595) | 100 grade 14 / 100 |
| Entrega (Mortal) | Chefe_Treina. `[3749]` | (2234,1566), dentro da arena | 8 / 8 |
| Entrega (Arch) | Lider_Aprendiz `[3141]` | (1705,1724), centro dos reinos | 100 grade 5 / 100 |

- **Arena:** (2232,1564)–(2263,1592), com reset a cada 10 min (`ClearAreaQuest`). Não há guarda de `QuestFlag`: dá para entrar a pé.
- **Teleporte:** (2245,1576) ± variação.
- **Mobs que soltam o 4080:** Taurus_Maligno `[3655-3666]`, ao redor de (2233–2258,1570–1588), e Chefe_Taurus `[3836]`, em (2245,1576). Os templates HiperTaurus, Taurus_Dourado e TaursKing@ também o carregam.

## Pré-requisitos

- **Mortal (teleporte e entrega):**
  - `ClassMaster == MORTAL`;
  - armazenado `[99,150)`, que é exibido 100–150.
  - Só a entrega exige o 4080 no **Equip[13]** e o Equip[15] (capa) vazio.
- **Arch (Lider_Aprendiz):**
  - `ClassMaster == ARCH`;
  - `BaseScore.Level` 99–149 (é o BaseScore, não o CurrentScore);
  - Equip[15] vazio.

## Fluxo

- **Legado:**
  - `CAPAVERDE_TELEPORT` em `_MSG_Quest.cpp:2167-2186`;
  - `CAPAVERDE_TRADE` em `:2188-2234`, que apaga o Equip[13], põe o 4006 no Equip[15], faz `SendEmotion(14,3)` e manda a mensagem "Formatura Aprendiz";
  - `LIDER_APRENDIZ` em `:2625-2662`.
- **Go:**
  - `capaverdeTeleport` em `handler/misc.go:635` ✅;
  - `capaverdeTrade` em `misc.go:662` ✅;
  - Lider_Aprendiz ❌, sem rota para Merchant 100 grade 5.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| CV-01 | Teleporte abaixo do nível | Mortal, exibido 99 | `MSG_Quest` no Diretor | recusa (`_NN_Level_limit`); não teleporta | controle |
| CV-02 | Teleporte | Mortal, exibido 100 | `MSG_Quest` no Diretor | teleporta para (2245±3,1576±3) | feliz |
| CV-03 | Entrega sem emblema | dentro da arena, sem 4080 | `MSG_Quest` no Chefe_Treina. | "quero o Emblema_da_Aprendizagem"; nada muda | controle |
| CV-04 | Emblema no inventário, não equipado | 4080 no inventário | `MSG_Quest` no Chefe_Treina. | recusa: o emblema tem que estar no Equip[13] | controle |
| CV-05 | Drop do emblema | dentro da arena | matar Taurus até o drop (tempo máximo) | o 4080 cai | feliz |
| CV-06 | Entrega | 4080 no Equip[13], sem capa | `MSG_Quest` no Chefe_Treina. | o Equip[13] fica vazio; o Equip[15] recebe o 4006; o score sobe pela AC da capa | feliz |
| CV-07 | Entrega com capa | já com o 4006 (ou outra capa) e outro 4080 | `MSG_Quest` no Chefe_Treina. | "já fez" (`_NN_Youve_Done_It_Already`); o emblema fica | controle |
| CV-08 | Acima do nível | Mortal exibido 151 com 4080 equipado | `MSG_Quest` no Chefe_Treina. | recusa (nível) | controle |
| CV-09 | Reset da arena | dentro da arena | esperar ≤ 12 min | mandado para a cidade | feliz |
| CV-10 | Arch pelo Lider_Aprendiz | Arch, BaseScore 99–149, sem capa | `MSG_Quest` no Lider_Aprendiz | recebe o 4006 no Equip[15] | feliz |
| CV-11 | Arch fora da faixa | Arch, BaseScore 98 | `MSG_Quest` no Lider_Aprendiz | recusa | controle |
| CV-12 | Mortal no Lider_Aprendiz | Mortal na faixa | `MSG_Quest` no Lider_Aprendiz | recusa (`_SN_NEEDCLASS` "Arch") | controle |
| CV-13 | Arch no Diretor | Arch exibido 100 | `MSG_Quest` no Diretor | recusa (`_NN_Level_Limit2`): o teleporte é só para Mortal | controle |

## Viabilidade do bot

- **Mortal:**
  - nível exibido 100 por Poeira de Fada, que custa uns 99 usos;
  - ida pelo Mestre Grifo "Jardim dos Deuses" (2220,1714) e depois a pé para o sul até o Diretor;
  - farm de Taurus_Maligno (nv 107) com o equipamento da loja do cenário 4;
  - medir a taxa de drop do 4080 com tempo máximo.
- **Arch:** reaproveitar o Arch do cenário 5, que nasce no nível 1. Subir até BaseScore 99 com Poeira de Fada e ir até (1705,1724), ao lado da Lindy.
- **Emblema no slot 13:** equipar com `equipFromCarry` (`src/bot/equip.ts`), passando o slot 13.

## Divergências suspeitas no Go

- Lider_Aprendiz ausente (CV-10).
- Diferença de mensagens: o Go responde com `NoticeReqNotMet`/`NoticeAlreadyDone` e o legado com `SendSay`. O cenário deve conferir o efeito (slots e posição), não o texto.

## Reaproveitamento

- `src/bot/travel.ts` `griffTravel(GRIFF_WARP.jardimDosDeuses)`, `src/bot/npc.ts` `talkQuest`, `src/bot/equip.ts` `equipFromCarry`, `src/bot/quest.ts` `waitForReset`.
- Pode reaproveitar o personagem do cenário 4, se ele passar pela faixa 100–150 e tiver o slot de capa vazio.

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 03`, com o nível, a classe, o emblema, a capa, os atributos e o equipamento semeados pelo banco. O Mortal vai pelo Mestre Grifo até o Jardim dos Deuses e anda até o Diretor; o Arch anda de Armia até o Lider_Aprendiz. Resultado: 12 ✅ e 1 ❌.

- O caminho do Mortal (Diretor_Treina. e Chefe_Treina.) está como no legado, inclusive o reset da arena.
- O único ❌ é o Lider_Aprendiz: o Merchant 100 grade 5 não tem rota no Go, e o Arch fica sem resposta e sem capa. CV-11 e CV-12 passam só porque o NPC não responde a ninguém.
- O 4080 pede ReqLvl 100 contra o nível **armazenado** (`Basedef.cpp:5050`, igual no Go): o exibido 100 não equipa o emblema. A entrega (CV-06) roda com o exibido 101.
- Drop (CV-05): o Chefe_Taurus solta o 4080 com 1/4 por kill (Carry[10]) e nasce a cada ~3 min; o Taurus_Maligno, com ≈ 1/225. Uma rodada de 15 min (5 Chefe + 63 Taurus) saiu sem drop; a seguinte teve o drop no primeiro Chefe.

| ID | Resultado | Issue |
|---|---|---|
| CV-01 | ✅ |  |
| CV-02 | ✅ |  |
| CV-03 | ✅ |  |
| CV-04 | ✅ |  |
| CV-05 | ✅ |  |
| CV-06 | ✅ |  |
| CV-07 | ✅ |  |
| CV-08 | ✅ |  |
| CV-09 | ✅ |  |
| CV-10 | ❌ | [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) |
| CV-11 | ✅ (o NPC não responde; ver [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397)) |  |
| CV-12 | ✅ (o NPC não responde; ver [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397)) |  |
| CV-13 | ✅ |  |

Finding: [009](../findings/009-lider-aprendiz-ausente.md).

## Situação (2026-10-22)

Reteste no Railway depois do [w2pp-OpenWYD#411](https://github.com/Jean1dev/w2pp-OpenWYD/pull/411) (`main` `2866b8c`), com `npm run quest -- 03`: 13 ✅. O Go agora roteia o Lider_Aprendiz (Merchant 100, grade 5, Equip[0] 60 no template, `handler/liderapprentice.go`) e dá o 4006 direto no Equip[15] do Arch, salvo no banco. CV-11 e CV-12 deixaram de passar no vácuo: os casos exigem a fala de recusa do próprio Lider (`_NN_Level_Limit2` para o Arch fora da faixa, `_SN_NEEDCLASS` "Arch" para o Mortal), como o `SendSay` do legado (`_MSG_Quest.cpp:2629-2643`).

| ID | Resultado | Issue |
|---|---|---|
| CV-01 | ✅ |  |
| CV-02 | ✅ |  |
| CV-03 | ✅ |  |
| CV-04 | ✅ |  |
| CV-05 | ✅ drop no Chefe_Taurus em 12 min |  |
| CV-06 | ✅ |  |
| CV-07 | ✅ |  |
| CV-08 | ✅ |  |
| CV-09 | ✅ |  |
| CV-10 | ✅ Equip[15] = 4006, também no banco | [~~#397~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) corrigida |
| CV-11 | ✅ recusa "Seu nível não permite o uso disto." | [~~#397~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) corrigida |
| CV-12 | ✅ recusa "Somente personagem Arch." | [~~#397~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) corrigida |
| CV-13 | ✅ |  |
