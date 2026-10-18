# 014 — Terra Mística: o kill dos dragões nunca conclui a missão (passo 2 ausente)

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#402](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402)
**Cenário:** `npm run quest -- 06 --case TM-07` (casos em [docs/quests/06-terra-mistica.md](../quests/06-terra-mistica.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T18-57-00-810Z-quest-06/TM-07`):

| Verificação | Resultado |
|---|---|
| Mortal exibido 151 com `terra_mistica` 1, caça ao norte de Azran por 10 min (18:57–19:07 UTC) | 77 kills: 25 Draco_Lich, 23 Dracorich, 18 Basilisco, 11 Basilisco_Ifrit; 0 mortes |
| Mensagem `_NN_Watching_Town_Success` | ❌ nenhuma |
| `terra_mistica` no banco a cada 10 kills / depois do relog | ❌ 1 / 0 (o 0 é o [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401)) |

No legado a chance de não concluir em 77 kills é 0,95^77 ≈ 1,9 %.

## Comportamento esperado (legado)

- `Source/Code/TMSrv/MobKilled.cpp:2909-2921`: rosto 239/241, `rand() % 20 == 0` e flag 1 → flag 2 e `_NN_Watching_Town_Success`.

## Comportamento atual (Go)

- `tmserver/internal/handler/mobkilled.go:40` (`mobKilled`): nenhum hook da Terra Mística; a flag só é escrita no aceite (`misc.go:718`).

## Onde corrigir

Um hook no `mobKilled` para o killer jogador. Detalhes na issue.
