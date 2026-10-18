# 016 — Pílula do Poder Mágico: a 470 não faz nada no Go (chão e uso), sem flag PilulaOrc

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404)
**Cenário:** `npm run quest -- 07` (casos em [docs/quests/07-pilula-orc.md](../quests/07-pilula-orc.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T19-2*-quest-07`), Mortal nível armazenado 49 (`SkillBonus` 147):

| Verificação | Resultado |
|---|---|
| PO-01: larga a 470 aos pés e pega (`MSG_GetItem`, 19:22:12 UTC) | ❌ `CNFGetItem`: a pílula volta ao inventário, `SkillBonus` 147→147 |
| PO-02: `MSG_UseItem` na 470 (19:22:45 UTC) | ❌ `MessageBoxOk` 39 (NoticeCantUseHere), a 470 fica, `SkillBonus` 147→147 |
| Esperado | `SkillBonus` +9, pílula consumida, `PilulaOrc` 1 (recusa a segunda) |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_GetItem.cpp:94-126`: 470 no chão aplica na hora (+9, flag 1, `MSG_DecayItem`), ou `_NN_Youve_Done_It_Already` se a flag já está.
- `Source/Code/TMSrv/_MSG_UseItem.cpp:981-998` (Vol 6): +9, flag 1, consome; com flag, `return` seco.
- `Source/Code/Basedef.cpp:865-868`: a derivação soma 9 se `PilulaOrc`.

## Comportamento atual (Go)

- `tmserver/internal/handler/item.go:81-127` (`getItem`): 470 é item comum.
- `tmserver/internal/handler/item.go:525-596`: sem `vol == 6` → `rejectUnimplementedConsumable`.
- `tmserver/internal/handler/skill.go:18-21`: PilulaOrc "not modeled yet"; não há coluna no banco.

## Observação do bot

O Go não manda `MSG_CreateItem` do item largado (`item.go:76`), então o bot sonda os ids do chão (`src/bot/ground.ts pickUpNear`).

## Onde corrigir

Coluna `pilula_orc`, `+9` em `deriveSkillBonus`, `case vol == 6` no `useItem` e a 470 no `getItem`. Detalhes na issue.
