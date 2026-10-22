**Situação (2026-10-19): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 02`.**

# 008 — Troféu da Quest 256 sem os 10 % de líder para quem usa

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#396](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396)
**Cenário:** `npm run quest -- 02 --case QST-09` (casos em [docs/quests/02-quest256-tickets.md](../quests/02-quest256-tickets.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T14-43-*-quest-02`):

| Verificação | Resultado |
|---|---|
| Caixa_da_Sabedoria 4117 ×2 no exibido 115, sem grupo (QST-09): gold +10.000, sobra 1 | ✅ o banco grava coin 11000 depois do relog |
| Exp do mesmo uso: 30.000 da tabela + 3.000 de líder = 33.000 | ❌ 14:43 UTC, +30.000 (o banco grava exp 30000) |
| Membro usa a Caixa em grupo (QST-11): o líder ganha 3.000 | ✅ |
| Exibido 116 (QST-10): recusa, a Caixa fica | ✅ (`NoticeReqNotMet`) |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_UseItem.cpp:2403-2414`: `partyleader = Leader` e, sem líder, `partyleader = conn`. A parte de 10 % (`QuestExpParty`) vai para o líder sem condição, porque o filtro foi comentado em `:2411-2412`. Por isso, quem usa o troféu sozinho, ou sendo o líder, ganha 110 % do exp da tabela.

## Comportamento atual (Go)

- `tmserver/internal/handler/item.go:1029-1046` (`grantQuestPartyExp`): sem grupo, faz `return`. Com grupo, marca o consumidor como `seen`, e um líder que usa o troféu fica sem os 10 %.

## Onde corrigir

Em `grantQuestPartyExp`, dar a parte ao líder (o próprio consumidor, quando ele não tem líder) e pular o consumidor só entre os membros. Detalhes na issue.
