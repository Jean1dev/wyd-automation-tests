**Situação (2026-10-22): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 12`.**

# 020 — Celestial: o Go usa a 1742 no lugar da Pedra Ideal 5338

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) (relacionada a #222, fechada)
**Cenário:** `npm run quest -- 12 --case CE-07 --case CE-08 --case CE-09` (casos em [docs/quests/12-celestial.md](../quests/12-celestial.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T21-*-quest-12`). Arch semeado pelo banco (Clan 0, MortalLevel 99,
Equip[1] vazio), com a 5338 e a 1742 no inventário, `MSG_UseItem` (botão direito):

| Caso | Horário (UTC) | Arch | 5338 (legado: Celestial) | 1742 (legado: nada) |
|---|---|---|---|---|
| CE-07 | 21:34:25 / 21:34:38 | exibido 356 | ❌ notice 39, nada muda | vira Celestial: Cythera 3500, capa 3199, SpecialBonus 855, ArchLevel 1 |
| CE-08 | 21:35:18 | exibido 356 | — | ❌ vira Celestial |
| CE-09 | 21:35:57 / 21:36:10 | exibido 400, Cristal 4 | ❌ notice 39, nada muda | vira Celestial: Cythera 3502, ArchLevel 5 |

A transformação em si (requisitos, atributos, Cythera, capa, volta para a seleção) está certa; só o gatilho está trocado.
Os controles CE-04/05/06 recusam nas duas pedras (no Go, a 1742 com as mensagens de requisito).

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_UseItem.cpp:3003-3159`: `Vol == 211`, que no `ItemList.csv` é só a `5338,Pedra_Ideal`.
- A `1742,Pedra_da_Imortalidade` não tem `EF_VOLATILE`; ela vai no Equip[10] para o Rei.

## Comportamento atual (Go)

- `tmserver/internal/handler/item.go:505-512`: `useIdealStone` para `idealStoneItem` (1742, `misc.go:414`) com ClassMaster Arch.
- A 5338 cai na recusa de consumível não implementado (notice 39).

## Onde corrigir

Disparar o `useIdealStone` pela 5338 (volátil 211) e tirar a 1742 desse caminho. Detalhes na issue.

## Informativo

A Cythera 3501/3502 do Go exige Cristal 4 (penalidade pedida no #327); o legado olha só o nível. O CE-09 semeia Cristal 4.
