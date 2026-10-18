# 018 — Sephirot: cada mestre de skill entrega a Sephirot da classe seguinte

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) (já existia; este finding é a confirmação no Railway)
**Cenário:** `npm run quest -- 09 --case AR-10 --case AR-11` (casos em [docs/quests/09-arch-cadeia.md](../quests/09-arch-cadeia.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T20-*-quest-09`), Mortal nível armazenado 299 com uma de cada
Pedra Arch (1744–1751) e 30.001.000 de gold, `MSG_Quest` com confirm 1:

| Mestre (Class do template) | Horário (UTC) | Legado (1759 + Class) | Go |
|---|---|---|---|
| Cap.Cavaleiros (1) — AR-10 | 20:06:55 | 1760 Sephirot(TransKnight) | ❌ 1761 Sephirot(Foema) |
| Foema_Ancian (2) — AR-11 | 20:07:29 | 1761 | ❌ 1762 |
| Mestre_Archi (3) — AR-11 | 20:08:09 | 1762 | ❌ 1763 |
| ForeLearner (4) — AR-11 | 20:08:51 | 1763 | ❌ 1764 (Poção_Combatente) |

O resto do COMP_SEPHI está certo: as 8 pedras e os 30M somem, no cliente e no banco depois do relog.

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:2157`: `Item.sIndex = 1759 + pMob[npcIndex].MOB.Class;`

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:839`: `archSephirotMin + int16(npc.Class)`, com `archSephirotMin = 1760`.

## Onde corrigir

Usar `1759 + npc.Class` (ou `archSephirotMin - 1 + npc.Class`). Detalhes na issue.
