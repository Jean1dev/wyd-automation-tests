# 017 — Círculo Divino: o Jeffi e a Shaman não têm rota no Go

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) (a [#249](https://github.com/Jean1dev/w2pp-OpenWYD/issues/249), do Jeffi, está fechada sem código no `main`)
**Cenário:** `npm run quest -- 08` (casos em [docs/quests/08-circulo-divino.md](../quests/08-circulo-divino.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T19-*-quest-08`), Mortal nível armazenado 99:

| Verificação | Resultado |
|---|---|
| CD-02: 447 no Equip[13], gold 1.005.000, `MSG_Quest` no Jeffi (19:32:36 UTC) | ❌ sem resposta; Equip[13] 447, gold igual (cliente e banco) |
| CD-04: 448, Special [60,60,60,60], LearnedSkill 0xffffff, `MSG_Quest` na Shaman (19:34:46 UTC) | ❌ sem resposta; nada muda |
| Esperado | Jeffi: −1M e 448–450; Shama: SpecialBonus +200, Special [10,10,10,10], LearnedSkill 0xffff00, Equip[13] vazio, Circle 1 |

Os controles (CD-01, CD-03, CD-05) "passam" só porque nada responde (vácuo).

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:514-610` (JEFFI) e `:612-691` (SHAMA).

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:150-259`: sem caso para os Merchants 12 e 13 → `"quest NPC not implemented"`.

## Onde corrigir

Rotear os Merchants 12 e 13 para handlers que portem os dois blocos; `QuestInfo.Circle` = `Entity.CelCircle`. Detalhes na issue.
