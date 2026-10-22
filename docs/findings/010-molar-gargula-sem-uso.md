**Situação (2026-10-22): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 04`.**

# 010 — Molar_de_Gárgula sem uso no Go: o Equip[1..5] não sobe para +6

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398)
**Cenário:** `npm run quest -- 04 --case MG-05` (casos em [docs/quests/04-molar-gargula.md](../quests/04-molar-gargula.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T16-09-*-quest-04/MG-05`):

| Verificação | Resultado |
|---|---|
| Mortal exibido 200, Equip[1..5] +0 +3 +5 +7 +1, `MSG_UseItem` no 4122 (MG-05) | ❌ 16:09:26 UTC, `MessageBoxOk` 39 (NoticeCantUseHere); refinação igual, também no banco depois do relog; o 4122 fica; AC 1992 → 1992 |
| Ida pela Patrulha__ (MG-01 a MG-03) e drop do 4122 na arena (MG-04) | ✅ |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_UseItem.cpp:2494-2546` (`Vol == 194`): Mortal, armazenado `[199,254)` e `QuestInfo.Mortal.MolarGargula == 0`; as peças do Equip[1..5] abaixo de +6 viram +6 (slot vazio é pulado), grava a flag, recalcula o score e consome uma unidade. Se recusar, devolve o item ao slot.

## Comportamento atual (Go)

- `tmserver/internal/handler/item.go:525-589`: o Vol 194 não tem caso no `useItem` e cai no `rejectUnimplementedConsumable` (`item.go:668`).
- Não existe a flag `MolarGargula` (nem no `world.Entity`, nem no banco).

## Onde corrigir

Persistir a flag como a Terra Mística (#139) e criar um `useMolarGargula` no `switch vol` do `useItem`. Detalhes na issue.
