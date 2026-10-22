# 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial

Depois de virar Celestial, o personagem passa por travas de nível e por bônus permanentes:

- **Lv40:** o Alquimista Odin combina 2 Pergaminhos Selados, o Selo Mágico e quatro runas.
- **Lv90:** com a Pedra da Fúria (3020) e 500 de Fama, o personagem usa a pedra no nível exibido 90.
- **Arcana:** o Celestial exibido ≥ 200 usa a Pedra da Fúria com as quatro Pedras Secretas e ganha a Cythera Arcana.
- **Reset:** depois da Arcana, a mesma pedra tira 20M de exp, até 3 vezes.
- **Adds do Sub-Celestial:** automáticos nos níveis 120, 150, 180 e 199 do Sub-Celestial. Eles aumentam a AC e o HP do diadema.

## Resumo

| Destrava | Gatilho | Requisitos (legado) | Recompensa | Legado | Go |
|---|---|---|---|---|---|
| Lv40 | `MSG_CombineItemOdin`, receita 4: 4127, 4127, 5135 Selo_Mágico, 5113 Fehu, 5129 Mannaz, 5112 Thurisaz, 5110 Ansuz | Celestial; armazenado 39; `Lv40 == 0` | `Celestial.Lv40 = 1`, com chance `g_pOdinRate[4]` | `_MSG_CombineItemOdin.cpp:80, :530-555` | ✅ `combine_odin.go:223` |
| Lv90 | uso da 3020 | Celestial; armazenado ≥ 89; `Lv90 == 0`; `Fame ≥ 500` | Fama −500 sempre; ~87 % de chance: `Lv90 = 1` e um 3502 Cythera_Mística | `_MSG_UseItem.cpp:3470-3690` | ❌ (a 3020 não é volátil no Go) |
| Arcana | uso da 3020 | Celestial/CS/Sub; armazenado ≥ 199; `Fame ≥ 500`; `QuestInfo.Circle == 0`; 5334–5337 no inventário | as 4 pedras e 500 de Fama somem; ~87 %: Equip[1] = 3507 Cythera_Arcana (se vazio) e `Circle = 1` | mesmo trecho | ❌ (só pelo `/arcana`) |
| Reset | uso da 3020 | `Circle == 1`; `Celestial.Reset < 3`; `Fame ≥ 500` | Fama −500; Exp −20M; nível recalculado; `Reset++` | mesmo trecho | ❌ |
| Adds do Sub | automático ao subir | Sub-Celestial com BaseScore 120/150/180/199 e o Equip[1] | AC +30/35/45/50 e HP +40/50/60/70 no diadema; flags `Add120..Add200` | `Server.cpp:9794-9850` | não verificado |

As runas vêm da **Pista de Runas** (Uxmal), uma quest secundária que fica fora do mapa e entra aqui só como fonte de itens.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| CL-01 | Lv40 fora do nível | Celestial exibido 39 | combinação no Odin | recusa; nada some | controle |
| CL-02 | Lv40 | Celestial exibido 40, receita | combinação | itens somem; sucesso: `Lv40` = 1 e o personagem volta a ganhar exp | feliz |
| CL-03 | Lv40 de novo | `Lv40` 1 | combinação | recusa | controle |
| CL-04 | Lv90 sem Fama | Celestial 90, `Fame` < 500 | `MSG_UseItem` na 3020 | recusa; a pedra fica | controle |
| CL-05 | Lv90 | Celestial 90, `Fame` ≥ 500 | `MSG_UseItem` na 3020 | Fama −500; sucesso: `Lv90` = 1 e um 3502 no inventário; falha: `_NN_FAILURE`; a pedra some nos dois casos | feliz |
| CL-06 | Arcana | Celestial 200, `Fame` ≥ 500, 5334–5337, Equip[1] vazio | `MSG_UseItem` na 3020 | pedras e Fama somem; sucesso: 3507 no Equip[1] e `Circle` = 1 | feliz |
| CL-07 | Arcana herdando o `Circle` | Celestial cujo personagem usou o Círculo Divino comum como Arch (`Circle` = 1, arquivo 08) | `MSG_UseItem` na 3020 | cai no ramo Reset, não na Arcana: o `QuestInfo.Circle` é o mesmo campo | borda |
| CL-08 | Reset | `Circle` 1, `Reset` < 3 | `MSG_UseItem` na 3020 | Exp −20M; nível recalculado; `Reset` +1 | feliz |
| CL-09 | Comandos que pulam quest | Celestial exibido 40 sem a receita | `/destravar40` | o legado grava sem checar. O Go grava para o Celestial (`chat.go:452`). Registrar e **não** usar nos cenários | borda |
| CL-10 | Adds do Sub | Sub-Celestial em BaseScore 119 com diadema | subir para 120 | AC +30, HP +40; `Add120` = 1 | feliz |

## Viabilidade do bot

- É a mais cara do mapa. Exige um Celestial, que vem do arquivo 12, além de Fama (500 por uso) e runas da Pista de Runas.
- A Pedra da Fúria (3020) e as Pedras Secretas estão na Evolucao. A Fama e as runas não têm fonte simples.
- **Recomendação:** começar pelos controles (CL-01, CL-03, CL-04) e pelo CL-09, que só precisam de um Celestial, e deixar os casos felizes `blocked` até haver Fama e runas.

## Divergências suspeitas no Go

- Lv90, Arcana e Reset pela Pedra da Fúria não existem. Hoje só saem pelos comandos `/destravar90` e `/arcana`.
- Os adds do Sub-Celestial ainda não foram verificados no Go.

## Reaproveitamento

- O Celestial do cenário do arquivo 12.
- O protocolo do `MSG_CombineItemOdin` ainda não está no `src/protocol`. Copiar o layout do `combine_odin.go`.

## Situação (2026-10-18)

`npm run quest -- 13` no Railway: 6 ✅ 4 ❌. O Celestial (class_master 3, ou 5 no CL-10) nasce no banco com a exp da curva do Celestial do Go (placeholder de `level/nextlevel.go`: `c[L] = 1M·L + 50k·L·(L+1)`), as flags `celestial_lv40/lv90/circle`, a Fama e os itens em slots altos. A receita do Odin vai por `MSG_CombineItemOdin` (0x02D2), sem andar até o NPC (nem o legado nem o Go conferem a distância). "Voltar a ganhar exp" e o level up do Sub são medidos matando um dragão ao norte de Azran.

- **Lv40:** funciona como o legado. A 1ª combinação deu certo (40 %), a receita some, `celestial_lv40` = 1 e o 1º kill sobe o Celestial para o 40. Os controles CL-01/CL-03 recusam com CombineComplete 0.
- **Pedra da Fúria (#408):** a 3020 não tem uso no Go (sem volátil, cai no caminho de equipar e sai calada). Lv90, Arcana e Reset não acontecem; só saem por `/destravar90` e `/arcana`. O contador `Celestial.Reset` não existe.
- **Adds do Sub (#409):** o Sub-Celestial sobe para o 120, mas o diadema não ganha EF_AC/EF_HP (`SetCircletSubGod` adiado no Go).
- **Comandos:** `/destravar40` grava o Lv40 sem a receita, como o legado. Os cenários não usam os comandos.
- Informativo (do código, não medido): a Poeira de Fada do Go põe a exp da curva **mortal** também no Celestial (`handler/item.go:877`, `level.NextLevelExp`); o legado usa `g_pNextLevel_2` para os tiers celestiais (`_MSG_UseItem.cpp:1017`). Por isso o bot sobe o Celestial pelo kill, não pela Poeira.

| ID | Resultado | Issue |
|---|---|---|
| CL-01 | ✅ | |
| CL-02 | ✅ | |
| CL-03 | ✅ | |
| CL-04 | ✅ (vácuo: a 3020 não faz nada) | |
| CL-05 | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) |
| CL-06 | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) |
| CL-07 | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) |
| CL-08 | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) |
| CL-09 | ✅ (registro: o comando pula a quest) | |
| CL-10 | ❌ | [#409](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409) |

## Situação (2026-10-22)

`npm run quest -- 13` no Railway depois do w2pp-OpenWYD#411 (2866b8c): 10 ✅, sem regressão. Os casos agora semeiam e conferem as colunas novas `celestial_reset` e `celestial_add120`.

- **Pedra da Fúria (~~#408~~ corrigida):** a 3020 faz o Lv90 (3502, Fama −500), a Arcana (3507 no Equip[1], `Circle` 1, as quatro Pedras Secretas somem) e o Reset (exp −20M, `celestial_reset` +1). Com `Circle` 1 herdado ela cai no Reset, como o legado. Sem Fama a recusa é a do legado: só o SendItem do slot, calado (o CL-04 deixou de ser vácuo). A chance é 114/115.
- **Adds do Sub (~~#409~~ corrigida):** o Sub-Celestial que sobe para o 120 por kill ganha EF_AC 30 / EF_HP 40 no diadema (cliente e banco) e `celestial_add120` 1.
- O Lv40 do Odin e o `/destravar40` seguem como antes.

| ID | Resultado | Issue |
|---|---|---|
| CL-01 | ✅ | |
| CL-02 | ✅ | |
| CL-03 | ✅ | |
| CL-04 | ✅ (recusa calada do legado) | ~~#408~~ corrigida no #411 |
| CL-05 | ✅ | ~~#408~~ corrigida no #411 |
| CL-06 | ✅ | ~~#408~~ corrigida no #411 |
| CL-07 | ✅ | ~~#408~~ corrigida no #411 |
| CL-08 | ✅ | ~~#408~~ corrigida no #411 |
| CL-09 | ✅ (registro: o comando pula a quest) | |
| CL-10 | ✅ | ~~#409~~ corrigida no #411 |
