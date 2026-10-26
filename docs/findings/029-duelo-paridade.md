# 029 — Duelo 1x1: duração, textos, HP do perdedor e recusa na cidade

**Situação (2026-10-25): corrigido em w2pp-OpenWYD#425 (deploy 66102a6b), verificado com `npm run quest -- 15`. Resta só o texto 143 na morte do duelo (DU-04): [#427](https://github.com/Jean1dev/w2pp-OpenWYD/issues/427).**
**Issue:** [Jean1dev/w2pp-OpenWYD#424](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) (relacionada à #118)
**Cenário:** `npm run quest -- 15 --case DU-02 --case DU-04 --case DU-05 --case DU-06 --case DU-07 --case DU-08 --case DU-10 --case DU-11` (casos em [docs/quests/15-pvp-duelo.md](../quests/15-pvp-duelo.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `4b661398`)

## O que acontece

O essencial do duelo funciona:
- o pedido é repassado (DU-01);
- o aceite forjado é ignorado (DU-09);
- o aceite leva A para (147,4044) e B para (189,4044);
- um lado zerado encerra a partida;
- os dois saem em (2572,1752).

O que diverge, confirmado no Railway em 2026-10-23 e 2026-10-25:

| Caso | Horário (UTC) | Legado | Go |
|---|---|---|---|
| DU-02 | 10-23 12:44 | `StartTime` 240 e "Batalha entre … foi iniciada" | `StartTime` 121, sem texto |
| DU-04 | 10-23 14:44 | "A é o vencedor, B é o perdedor" aos dois, B com HP 1 | avisos 35/36, B com HP 0 |
| DU-05 | 10-23 14:45 | texto do vencedor | aviso 35 |
| DU-06 | 10-25 17:51 | texto do vencedor | aviso 35 |
| DU-07 | 10-23 14:52 | "Há uma partida em progresso." para C e D | aviso 34 |
| DU-08 | 10-25 17:51 | duelo na praça de Armia começa | pedido recusado (aviso 38) |
| DU-10 | 10-25 17:53–17:56 | empate com texto em cerca de 242 s | aviso 37 em 121 s |
| DU-11 | 10-25 17:52 | "Não é possível sussurrar para este jogador." | aviso 12 |

Pela leitura do código, há também um ponto não medido: no empate, o Go não teleporta ninguém (`concludeDuelDraw`).

## Comportamento esperado (legado)

- `_MSG_ReqRanking.cpp`: `_NN_Deny_Whisper` (:31-35), repasse (:42-49) e `_NN_Battle_In_Progress` (:62-67). Não há checagem de posição.
- `DoRanking` (`Server.cpp:8991-9019`): teleporte, `_NN_Battle_Started` e `StartTime` 240.
- `ProcessRanking` (`Server.cpp:8786`):
  - `RankingTime` 121 → 0, um passo a cada 5 chamadas de 2 s;
  - no fim, `_SS_S_WinBy_S`/`_SS_S_S_Draw` por `SendNoticeArea` e `ClearAreaTeleport` para (2572,1752), com HP 1 para quem morreu.

## Comportamento atual (Go, `handler/duel.go`)

- :39 e :167: `duelTicks` 121 a 1 s e `StartTime` 121.
- :108-113 e :139-142: `inSafeCity` recusa o pedido e o aceite. O próprio código marca essa regra como `UNVERIFIED (issue #118)`.
- :247/251/267/270: `NoticeDuelWin`/`Lose`/`Draw`, sem os nomes.
- :243-256: o HP do perdedor não é restaurado.
- :262-272: o empate não teleporta.

## Nota do bot

O DU-06 foi corrigido no bot: se o servidor encerra o duelo no meio do caminho, B para de andar quando sai do mapa do duelo ou depois de 40 s. Antes disso, o caso estourava o tempo.
