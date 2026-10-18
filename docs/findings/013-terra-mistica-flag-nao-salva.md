# 013 — Terra Mística: a flag `terra_mistica` não é salva e volta a 0 no relog

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401)
**Cenário:** `npm run quest -- 06 --case TM-04` (casos em [docs/quests/06-terra-mistica.md](../quests/06-terra-mistica.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T18-48-*-quest-06/TM-04`):

| Verificação | Resultado |
|---|---|
| Conta A lidera o grupo com a conta B (0x037D recebido), Cap.Mercenario confirm 1 | 18:50:18 UTC, sem resposta (o legado manda `_NN_Get_Watching_Town_Mission`) |
| Segundo pedido na mesma sessão, confirm 1 | 18:50:24 UTC, `NoticeReqNotMet` 15: a flag está em 1 na memória |
| `terra_mistica` no banco depois do relog | ❌ 0 |

## Comportamento esperado (legado)

- `Source/Code/Basedef.h:638`: a flag faz parte do `STRUCT_MOBEXTRA`.
- `Source/Code/TMSrv/Server.cpp:7875` (`SaveUser`): o save leva o extra inteiro.
- `Source/Code/TMSrv/_MSG_Quest.cpp:286-287`: o aceite grava 1 e manda a mensagem.

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:718`: grava 1 na memória.
- `tmserver/internal/dbclient/client.go:753-800` (`characterSaveToProto`): não preenche `MortalTerraMistica`.
- `dbserver/internal/grpcsrv/mapping.go:158` lê 0 e o `store_live.go:391` grava 0.

## Onde corrigir

`MortalTerraMistica: int32(s.TerraMistica)` no `characterSaveToProto`. Detalhes na issue.
