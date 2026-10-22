**Situação (2026-10-22): parcialmente corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 14`: criação do Sub, Urnammu e ficha 2 persistida; a Pedra Misteriosa 4148 e o caminho Deserto → Kefra seguem pendentes (#410).**

# 023 — Sub-Celestial ausente: criação pela 5338 e Urnammu

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) (relacionada a #407)
**Cenário:** `npm run quest -- 14` (casos em [docs/quests/14-sub-celestial.md](../quests/14-sub-celestial.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T22-*-quest-14`). Celestial semeado pelo banco (class_master 3
ou 4, armazenado 120, Sephirot no Equip[11]):

| Caso | Horário (UTC) | Go |
|---|---|---|
| SC-03 | 22:03:58 | ❌ 5338 → notice 39; continua Celestial (3), Sephirot 1762 e 5338 ficam |
| SC-06 | 22:05:25 | ❌ Urnammu (id 12901) sem resposta; Fama 2500 e Sephirot 1763 ficam |

Os controles SC-01/02/04/05/07 passam no vácuo (nada acontece).

Para chegar ao Urnammu (3232,1685) o bot semeia o ponto da Gema Estelar (`save_x/save_y`) em (3235,1688) e usa o
Pergaminho_do_Teleporte (699): o Go não tem o teleporte Deserto → Kefra do legado e o `/kefra` vai para outro lugar.

## Comportamento esperado (legado)

- Criar o Sub: `_MSG_UseItem.cpp:3029-3085` (ramo `CELESTIAL` do Vol 211).
- Urnammu: `_MSG_Quest.cpp:1247-1311`.

## Comportamento atual (Go)

- A 5338 não tem caso (notice 39); o `useIdealStone` (1742) só aceita Arch (`handler/item.go:509`).
- O Merchant 76 não tem rota no `quest` (`handler/misc.go:142-260`).
- Não existe a ficha `SaveCelestial[1]` no personagem nem no banco.

## Onde corrigir

Ficha do Sub persistida, ramo `CELESTIAL` da 5338, rota do Urnammu e o teleporte para o Continente desconhecido.
Detalhes na issue.
