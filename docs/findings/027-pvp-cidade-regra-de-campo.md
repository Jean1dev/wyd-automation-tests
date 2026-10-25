# 027 — PvP em cidade/arena: Guilty, perda de EXP e CP seguem a regra do campo

**Situação (2026-10-25): corrigido em w2pp-OpenWYD#425 (deploy 66102a6b), verificado com `npm run quest -- 15`.**
**Issue:** [Jean1dev/w2pp-OpenWYD#421](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421)
**Cenário:** `npm run quest -- 15 --case PV-04 --case PV-05 --case PV-06 --case PV-07` (casos em [docs/quests/15-pvp-duelo.md](../quests/15-pvp-duelo.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `4b661398`)

## O que acontece

Confirmado no Railway em 2026-10-23:

| Caso | Horário (UTC) | Onde | Visto |
|---|---|---|---|
| PV-04 | 11:18 | arena de Armia, os dois com K | A e B com nick vermelho (`MobName[12] = 0` no `CreateMob`) |
| PV-05 | 11:19 | arena de Armia, A mata B | B recebe "Voce perdeu 1322 pontos de experiencia" e nenhum "Na arena não há perda de EXP."; `pk_point` de A fica 75 (esperado 66) |
| PV-06 | 11:20 | praça de Armia, tile `0x01` | A e B com nick vermelho |

Controle que passa: PV-07 (14:41, campo a leste de Armia): os dois ficam Guilty, como no legado.

O CP de A não cai no PV-05 por tabela: B já estava Guilty pelo golpe (PV-04), e o `pvpLostPk` zera contra vítima Guilty.

## Comportamento esperado (legado)

- `_MSG_Attack.cpp:1351-1405` ("PK - War - Miss"): CantKill e Guilty só fora de arena/cidade (`BASE_GetArena`/`BASE_GetVillage` = 5), fora do mapa (1,31) e fora de guerra.
- `MobKilled.cpp:3131-3228`: em arena/cidade, `_NN_In_Arena_No_Exp_Loss` para a vítima, sem perda de EXP. O matador perde `3 * PK / -20` (entre −9 e 0) se a vítima não estava Guilty.

## Comportamento atual (Go)

- `combat.go:231` (CantKill) e `:313` (Guilty dos dois) não olham a geografia.
- `pvpkilled.go:55` tira EXP em qualquer lugar, e `:65` usa a fórmula do campo (`/ -25`).
- O próprio `pvpkilled.go:33` marca essa geografia como "Deferred/UNVERIFIED".

## Onde corrigir

Uma checagem equivalente a `BASE_GetArena`/`BASE_GetVillage` (limites de `world/city.go`): na posição do atacante para o bloco CantKill/Guilty e na da vítima para a morte.
