# 009 — Lider_Aprendiz sem rota no Go: o Arch não recebe a capa verde

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397)
**Cenário:** `npm run quest -- 03 --case CV-10` (casos em [docs/quests/03-capa-verde.md](../quests/03-capa-verde.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T15-3*-quest-03/CV-10`):

| Verificação | Resultado |
|---|---|
| Arch (`class_master` 1), nível armazenado 99, Equip[15] vazio, `MSG_Quest` no Lider_Aprendiz (CV-10) | ❌ 15:40:09 UTC, nenhum frame de resposta; Equip[15] vazio, também no banco depois do relog |
| Arch com BaseScore 98 (CV-11) e Mortal na faixa (CV-12) | ✅ nada muda, mas só porque o NPC não responde a ninguém |
| Caminho do Mortal (Diretor_Treina. e Chefe_Treina., CV-01 a CV-09) | ✅ |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:67-68`: Merchant 100 com `EF_GRADE0` 5 → `LIDER_APRENDIZ`. O template `npc/Lider_Aprendiz` tem Merchant 100 e grade 5.
- `_MSG_Quest.cpp:2625-2662`: exige `ClassMaster == ARCH`, `BaseScore.Level` 99–149 e Equip[15] vazio; põe o 4006 no Equip[15], recalcula o score e manda "Formatura Aprendiz".

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:165-258` não tem caso para o Merchant 100 grade 5; o pedido cai no `misc.go:259` ("quest NPC not implemented").

## Onde corrigir

Rotear o grade 5 para um `liderAprendiz` no molde do `capaverdeTrade` (`misc.go:662`), com as três checagens do legado. Detalhes na issue.
