**Situação (2026-10-22): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 13`.**

# 022 — Sub-Celestial: adds do diadema (SetCircletSubGod) ausentes

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#409](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409)
**Cenário:** `npm run quest -- 13 --case CL-10` (caso em [docs/quests/13-celestial-destravas.md](../quests/13-celestial-destravas.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T21-*-quest-13/CL-10`). Sub-Celestial semeado pelo banco
(class_master 5, armazenado 119, exp no limiar do 120, Cythera 3500 no Equip[1]). Às 21:58:11 UTC o kill de um
Basilisco_Ifrit dá +6 de exp e o personagem sobe para o 120; depois do relog o diadema continua com os efeitos zerados.

## Comportamento esperado (legado)

`Source/Code/TMSrv/Server.cpp:9794-9851` `SetCircletSubGod`: no 120/150/180/199 o Equip[1] ganha `EF_AC`
30/35/45/50 e `EF_HP` 40/50/60/70, uma vez por nível (flags `Add120..Add200`).

## Comportamento atual (Go)

`applyLevelUps` (`handler/mobkilled.go:362`) não tem o hook; `combine_variants.go:291` diz que ele foi adiado. Não há
as flags no personagem nem no banco.

## Onde corrigir

Portar `SetCircletSubGod` no level up do `SCELESTIAL`, com as quatro flags persistidas. Detalhes na issue.
