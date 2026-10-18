# 021 — Pedra da Fúria (3020) sem uso: Lv90, Arcana e Reset do Celestial

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408)
**Cenário:** `npm run quest -- 13 --case CL-04 --case CL-05 --case CL-06 --case CL-07 --case CL-08` (casos em [docs/quests/13-celestial-destravas.md](../quests/13-celestial-destravas.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T21-*-quest-13`). Celestial semeado pelo banco (class_master 3,
exp da curva do Go, flags e Fama pelas colunas), com a 3020 no slot 27, `MSG_UseItem` (botão direito); banco depois do relog:

| Caso | Horário (UTC) | Pré-condição | Go |
|---|---|---|---|
| CL-04 | 21:52:32 | armazenado 89, Fama 100 | nada muda (o legado também recusa: vácuo) |
| CL-05 | 21:53:06 | armazenado 89, Fama 600 | ❌ sem resposta; Fama, Lv90 e a pedra iguais |
| CL-06 | 21:53:44 | armazenado 199, Fama 600, 5334–5337, Equip[1] vazio | ❌ nada muda |
| CL-07 | 21:54:22 | igual, com Circle 1 | ❌ nada muda (legado: ramo Reset) |
| CL-08 | 21:54:47 | Circle 1, 3507 no Equip[1] | ❌ nada muda |

## Comportamento esperado (legado)

`Source/Code/TMSrv/_MSG_UseItem.cpp:3470-3690`, pelo sIndex 3020: Arcana (`:3472-3568`), Reset (`:3570-3615`) e Lv90
(`:3617-3690`), todos cobrando 500 de Fama e consumindo a pedra.

## Comportamento atual (Go)

- A 3020 não tem `EF_VOLATILE` (`ItemList.csv:4675`) e cai no `equipItem` (`handler/item.go:525`), que sai calado.
- As flags só são gravadas por `/destravar90` e `/arcana` (`handler/chat.go:361-370`). O contador `Celestial.Reset` não existe.

## Onde corrigir

Caso pelo sIndex 3020 em `useItem` com os três ramos do legado. Detalhes na issue.
