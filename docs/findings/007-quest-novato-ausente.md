**Situação (2026-10-19): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 01`.**

# 007 — Quest do novato (Treinadores do Campo de Treino) ausente no servidor Go

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395)
**Cenário:** `npm run quest -- 01` (casos em [docs/quests/01-novato-treinadores.md](../quests/01-novato-treinadores.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T13-5*-quest-01`):

| Verificação | Resultado |
|---|---|
| Treinador1 sem a chave (NOV-01): nada muda | ✅ (mas a resposta é a `NoticeReqNotMet` do Coveiro, não a fala `Cheerup1`) |
| Treinador1 com a 451 (NOV-02): Kit 682 ×20 e `Newbie` = 1 | ❌ 13:55:45 UTC, `MessageBoxOk 15`, inventário igual |
| Treinador2 / Treinador3 / Chefe_de_Treino com a 452 / 453 / 524 (NOV-05, NOV-04, NOV-09) | ❌ sem resposta, nada muda (14:06:28, 14:05:29, 14:10:19 UTC) |
| Treinador1 com nível exibido 40 e a Vela 4038 (NOV-12): `Already1`, nada muda | ❌ 14:03:15 UTC, teleporte para (2395,2102), arena do Coveiro, e a Vela consumida |
| Treinador1 com nível exibido 36 e a 451 (NOV-10): nada muda | ✅ (resposta `NoticeReqNotMet`) |

Os casos seguintes dependem do passo 1 e reprovam pela mesma causa (veja `docs/quests/STATUS.md`).

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:33` roteia pelo byte 17 do template: Merchant 36/40/41 → `TREINADORNEWBIE1..3` (`:94-101`), Merchant 100 grade 16 → `TREINADORNEWBIE4` (`:82-83`).
- `_MSG_Quest.cpp:1895-2100`: os quatro passos, cada um com `ClassMaster == MORTAL`, nível armazenado < 35 (`FREEEXP`, `Server.cpp:50`) e `QuestInfo.Mortal.Newbie == passo − 1` (`Basedef.h:637`). Recompensas: 682 ×20; adicionais da arma (ReqLvl ≤ 39); Equip[1..7] com adicional e +3; troca da 524 por 682 ×20, 481 ou 652.

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:142-260`: sem caso para os treinadores. O Treinador1 (`CurrentScore.Merchant` 100, grade 0) cai no `quest256NPC` do Coveiro (`:165`); os outros três caem no `quest NPC not implemented` (`:259`).
- A flag `Newbie` não existe na entidade nem na tabela `character`.

## Onde corrigir

Rotear por `npc.Template[17]` (como o `isUxmalNPC`, `runequest.go:50`) antes do ramo do Coveiro, portar os quatro passos e persistir a flag `newbie` no banco. Detalhes na issue.
