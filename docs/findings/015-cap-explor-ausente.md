**Situação (2026-10-22): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 06`.**

# 015 — Terra Mística: o Cap.Explor. não tem rota no Go e o amuleto nunca sai (passo 3 ausente)

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403)
**Cenário:** `npm run quest -- 06 --case TM-08` e `--case TM-09` (casos em [docs/quests/06-terra-mistica.md](../quests/06-terra-mistica.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T19-0*-quest-06/TM-08`):

| Verificação | Resultado |
|---|---|
| Mortal exibido 101 com `terra_mistica` 2, `MSG_Quest` no Cap.Explor. (19:09:46 UTC) | ❌ sem resposta, nenhum item (inventário e banco iguais) |
| Esperado | um Amuleto_Místico 559–562 com efeito 43 e `terra_mistica` 3 |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:1626-1743` (`EXPLOIT_LEADER`): falas para flag 0 e ≠ 2; com 2, amuleto pela faixa de `CurrentScore.Level` (< 50 Prata 551–554, 50–79 Ouro 555–558, ≥ 80 Místico 559–562), efeito 0 = 43 e dois adicionais, flag 3.

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:228`: só o Merchant 10 (Cap.Mercenario) tem rota; o 11 cai no `"quest NPC not implemented"` (`:259`).

## Onde corrigir

Rotear o Merchant 11 para um `exploitLeader` que porte o bloco do legado. Detalhes na issue.
