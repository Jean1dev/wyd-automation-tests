# 011 — Rei não aceita o Emblema_do_Reino (4081): sem safiras, a capa do reino não sai

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#399](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399)
**Cenário:** `npm run quest -- 05 --case CR-06` (casos em [docs/quests/05-capa-real.md](../quests/05-capa-real.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T16-5*-quest-05/CR-06`):

| Verificação | Resultado |
|---|---|
| Mortal exibido 220, 4081 no Equip[13], sem safiras, `MSG_Quest` no Rei_Harabard com confirm 1 (CR-06) | ❌ 16:55:31 UTC, "Sao necessarias 4 safiras em pagamento exato."; Equip[13] continua 4081, Equip[15] vazio (banco igual) |
| Mortal exibido 256 com a 545 e o 4081, sem safiras (CR-11) | ❌ 17:13:09 UTC, mesmo texto; a 545 não vira 543 e o 4081 fica (banco igual) |
| Guarda_Real (CR-01, CR-02), drop do 4081 (CR-03), nível e preço do Rei (CR-04, CR-05) | ✅ |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:997`: as safiras só são cobradas quando não há o 4081 no Equip[13].
- `:1016`: o laço de consumo das safiras para quando o 4081 está equipado.
- `:1038-1042`: o 4081 é apagado do Equip[13].
- `:1044-1080`: sem capa → 545/546; capa sem borda e armazenado ≥ 255 → 543/544.

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:272` (`kingCapeService`): não olha o Equip[13].
- `misc.go:305-308`: `sapphirePaymentPlan` exige o pagamento exato em 697/4131; sem safiras, recusa com texto.

## Onde corrigir

No `kingCapeService`, antes do `sapphirePaymentPlan`: com o 4081 no Equip[13], pular as safiras e limpar o Equip[13] no `staged`. Detalhes na issue.
