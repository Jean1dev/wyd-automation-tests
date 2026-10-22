# 024 — Pedra Ideal 5338: as recusas do Arch falam onde o legado fica calado

**Situação (2026-10-22): corrigido em w2pp-OpenWYD#414 (deploy 55cbf4a3), verificado com `npm run quest -- 12`.**

**Status:** corrigido.
**Issue:** [Jean1dev/w2pp-OpenWYD#413](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) (aberta no reteste do w2pp-OpenWYD#411)
**Cenário:** `npm run quest -- 12 --case CE-04 --case CE-05 --case CE-06` (casos em [docs/quests/12-celestial.md](../quests/12-celestial.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `2866b8c`)

## O que acontece

Confirmado no Railway em 2026-10-22 (`reports/2026-10-22T09-3*-quest-12`). Arch semeado pelo banco com a 5338 no inventário,
`MSG_UseItem` (botão direito). Em todos o estado fica igual (pedra no slot, Arch, banco igual depois do relog); só a resposta diverge:

| Caso | Horário (UTC) | Arch | Legado | Go |
|---|---|---|---|---|
| CE-04 | 09:32 | armazenado 355, elmo 100 no Equip[1] | só _NN_Cant_with_armor ("No momento você não pode equipar arma e armadura.") | "Remova a armadura antes de usar a Pedra Ideal." + notice 24 |
| CE-05 | 09:33 | armazenado 354 | calado | "Seu Arch precisa atingir o nivel 356…" + notice 15 |
| CE-06 | 09:34 | armazenado 355, MortalLevel 98 | calado | "O Mortal de origem precisa ter atingido o nivel 100…" + notice 15 |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_UseItem.cpp:3003-3024` (Vol 211): nível < 355 → só `SendItem`; Equip[1] ocupado ou MortalLevel < 99 →
  `_NN_Cant_with_armor` só se houver armadura, depois `SendItem`. Nenhum notice.

## Comportamento atual (Go)

- `tmserver/internal/handler/item.go:1546-1565` (`useIdealStone`): notice 15 + texto próprio para nível e MortalLevel; notice 24 +
  texto próprio para a armadura; e testa o MortalLevel antes da armadura.

## Onde corrigir

No ramo do Arch do `useIdealStone`: recusas caladas (só o `sendSlot`) e, com armadura, só o texto 205 da tabela de mensagens.
