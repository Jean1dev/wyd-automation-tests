**Situação (2026-10-22): parcialmente corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 05`: o pagamento com sobra funciona; o Clan pela guilda do líder não foi portado.**

# 012 — Rei exige pagamento exato em safiras: com sobra, a capa do reino não sai

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#400](https://github.com/Jean1dev/w2pp-OpenWYD/issues/400)
**Cenário:** `npm run quest -- 05 --case CR-12` (casos em [docs/quests/05-capa-real.md](../quests/05-capa-real.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T17-1*-quest-05/CR-12`):

| Verificação | Resultado |
|---|---|
| Mortal exibido 220, sem capa e sem 4081, 1 × 4131 (valor 10) para o preço 4, Rei_Harabard confirm 1 | ❌ 17:16:44 UTC, "Sao necessarias 4 safiras em pagamento exato."; o 4131 fica, Equip[15] vazio (banco igual) |
| O mesmo personagem com 4 × 697 (pagamento exato) | ✅ 17:19:49 UTC, recebe a 545, as safiras somem; o Go grava `clan` = 7 |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:986-997`: soma 697 = 1 e 4131 = 10; recusa só se a soma for menor que o preço.
- `:1016-1035`: consome na ordem do inventário até cobrir o preço; o 4131 é apagado inteiro.
- O legado não muda o clan do jogador (só o da guilda, se ele for líder).

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:391` (`sapphirePaymentPlan`): só fecha com o valor exato.
- `misc.go:305-308`: sem pagamento exato, recusa com texto.
- `misc.go:311`: grava `Clan` = reino no personagem.

## Onde corrigir

No `sapphirePaymentPlan`, aceitar valor ≥ preço e consumir como o legado. Detalhes na issue.
