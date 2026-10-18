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
