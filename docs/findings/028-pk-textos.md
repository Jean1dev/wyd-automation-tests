# 028 — PK: textos do CantKill e da troca com K

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#422](https://github.com/Jean1dev/w2pp-OpenWYD/issues/422) (`enhancement`)
**Cenário:** `npm run quest -- 15 --case PV-08 --case PV-09` (casos em [docs/quests/15-pvp-duelo.md](../quests/15-pvp-duelo.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `4b661398`)

## O que acontece

O comportamento está certo; só os textos divergem. Confirmado no Railway em 2026-10-23:

| Caso | Horário (UTC) | Situação | Legado | Go |
|---|---|---|---|---|
| PV-08 | 11:45 | A com `pk_point` 10 golpeia B no campo; dano 0 (correto) | "Você não pode mais derrotar jogadores. (Atual : 10)" (209) | "Voce nao pode atacar este jogador (Pontos Caos: -65)" |
| PV-09 | 11:59 | A liga o K com troca aberta; a troca fecha e o PKInfo vem 1/0 (correto) | "A troca não fica disponível com o modo PK ativado." (331) para os dois | nenhum texto |

No PV-08, o HP de B cai de 945 para 944 no quarto golpe. Quem tirou esse 1 de HP foi um mob do campo (frame `Attack` de um mob), e não A.

## Comportamento esperado (legado)

- `_MSG_Attack.cpp:1373-1378`: `_DN_CantKillUser` com o PKPoint cru.
- `_MSG_PKMode.cpp:27-35`: `_NN_Cant_trade_pkmode` para os dois, depois `RemoveTrade`.

## Comportamento atual (Go)

- `combat.go:232`: texto próprio, com `PKPoint − 75`.
- `pkmode.go:153`: `removeTrade` sem texto.
