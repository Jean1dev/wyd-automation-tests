# 15 — PvP em Armia e duelo 1x1

Esta suíte cobre duas frentes:
- o PvP em Armia, na arena PK do norte da cidade, na praça e no campo logo fora;
- a declaração de duelo 1x1 (`_MSG_ReqRanking`), com a arena de duelo e o resultado.

O critério é o legado. O usuário pediu para exigir o legado mesmo onde o Go diverge de propósito.

## Resumo

- **Arena de Armia:** são as células com o bit `0x40` no `AttributeMap.dat`, dentro dos limites de Armia: x 2124–2147, y 2140–2155.
  - O resto da cidade é `0x01` (cidade) ou `0x03`.
  - O campo fora da cidade é `0x00`.
  - Não há NPC nem teleporte: entra-se andando.
- **Duelo 1x1:** `_MSG_ReqRanking` (0x039F, `MSG_STANDARDPARM2`).
  - Pedido: Parm1 = alvo, Parm2 = 0. O servidor repassa ao alvo com Parm1 = quem desafiou.
  - Aceite: Parm1 = quem desafiou, Parm2 = 4.
  - O aceite leva os dois para a arena de duelo (x 142–195, y 4007–4082, tile `0x44`).
  - No fim, os dois vão para (2572,1752), em Azran.
- **K (PK mode):** `_MSG_PKMode` (0x0399). O servidor responde com `_MSG_PKInfo` (0x0166): Parm 1 quando o jogador está atacável.
- **Nick vermelho (Guilty):** vem no `MobName[12]` do `MSG_CreateMob`, onde 75 é neutro e 0 é Guilty.

## Fluxo

### Golpe entre jogadores (legado `_MSG_Attack.cpp`)

1. **:405-419.** Se o tile do **atacante** tem `0x40` e o alvo está sem K e sem Guilty, o golpe é zerado.
   - O servidor não olha o K do atacante; isso fica com o cliente.
   - Fora dos tiles `0x40` (praça e campo), o servidor não bloqueia.
2. **:1344-1405, "PK - War - Miss".** Só roda fora de arena de guerra e de cidade (`BASE_GetArena`/`BASE_GetVillage` = 5), fora do mapa (1,31) e fora de guerra.
   - Atacante com PKPoint ≤ 10 contra alvo com PKPoint > 10: `_DN_CantKillUser` e dano 0.
   - Senão, um golpe que acerta alvo com PKPoint > 10 deixa os dois Guilty 8.
   - A arena de Armia está nos limites da cidade, então ninguém fica Guilty lá.
3. **Morte (`MobKilled.cpp:3131-3228`).** Em arena ou cidade:
   - a vítima recebe `_NN_In_Arena_No_Exp_Loss` e não perde EXP;
   - o matador perde `3*PKPoint/-20` de CP (no máximo 9) se a vítima não estava Guilty, e recebe `_DD_PKPointMinus`.

   O `if (killed_x == 1 && killed_y == 31)` sem corpo é o `ZoneUnk = 1` perdido na descompilação. A intenção é que o mapa do duelo também não tire EXP.

### Golpe entre jogadores no Go

- `handler/combat.go:223`: exige o K do atacante em todo lugar e não lê o AttributeMap (#67). No duelo, `dueling()` libera o golpe.
- `:231`: o CantKill vale sem geografia.
- `:313`: o Guilty vale sem geografia.
- `handler/pvpkilled.go:50`: tira EXP e CP em qualquer lugar.

### Duelo no legado

1. **`_MSG_ReqRanking.cpp`:**
   - alvo com sussurro bloqueado: `_NN_Deny_Whisper`;
   - pedido: grava `RankingTarget` e repassa o 0x039F com `ID = alvo` e `Parm1 = conn`;
   - aceite: exige `RankingTarget == conn`. Com a arena ocupada (`RankingProgress`), manda `_NN_Battle_In_Progress` aos dois.
   - **Não olha a posição:** pode-se pedir e aceitar dentro da cidade.
2. **`DoRanking` (`Server.cpp:8991`):**
   - o aceitante vai para (189,4044) e o desafiante para (147,4044);
   - os dois recebem `_NN_Battle_Started` ("Batalha entre %s e %s foi iniciada.") e `_MSG_StartTime` com Parm 240 (2·121−2).
3. **`ProcessRanking` (`Server.cpp:8786`), a cada 2 s:**
   - `RankingTime` começa em 121 e vai a 0, ou seja, cerca de 242 s;
   - a cada 5 chamadas (cerca de 10 s) conta quem está vivo, em jogo e dentro da caixa. Um lado zerado encerra o duelo;
   - muro: `SendDamage` (`MSG_SetHpDam` 0x018A) com −2000 de HP, sem baixar de 1, e `SendEnvEffect` 32;
   - fim: `_SS_S_WinBy_S` ("%s é o vencedor, %s é o perdedor desta partida.") ou `_SS_S_S_Draw` por `SendNoticeArea`, depois `ClearAreaTeleport` para (2572,1752) com HP 1 para quem morreu.

### Duelo no Go (`handler/duel.go`)

- O convite expira em 30 s.
- Pedido e aceite são recusados dentro de cidade (`NoticeDuelInCity` 38, #118 "UNVERIFIED").
- `duelTicks` = 121 a 1 s (cerca de 121 s) e `StartTime` com Parm 121.
- Não há `_NN_Battle_Started`.
- O resultado vai por `MessageBoxOk` com os códigos 35 (vitória), 36 (derrota) e 37 (empate), sem os nomes.
- O perdedor sai com HP 0.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| PV-01 | Arena de Armia, ninguém com K | A TK nv 300, B nv 50 lado a lado em (2135,2147) | 5 golpes de A em B | nenhum golpe tira HP | controle |
| PV-02 | Arena de Armia, A com K e B sem | idem, A com K | 5 golpes | nenhum golpe tira HP (tile `0x40`, alvo sem K) | controle |
| PV-03 | Arena de Armia, os dois com K | idem, os dois com K | golpes até B morrer | o golpe tira HP | feliz |
| PV-04 | Arena de Armia, sem Guilty | idem PV-03 | golpes | nenhum CreateMob de A/B com `MobName[12]` = 0 (é cidade) | controle |
| PV-05 | Arena de Armia, A mata B | idem PV-03 | golpes até HP 0; B dá Restart | "Na arena não há perda de EXP" para B, EXP de B igual no banco, `pk_point` de A = 66 (75 − 9), B revive em Armia | feliz |
| PV-06 | Praça de Armia | A com K, B sem, em (2110,2095), tile `0x01` | 4 golpes | o golpe entra e ninguém fica Guilty | borda |
| PV-07 | Campo | A com K, B sem, em (2185,2100), tile `0x00` | 4 golpes | o golpe entra e os dois ficam Guilty | feliz |
| PV-08 | Campo, A sem CP | `pk_point` de A = 10 | 4 golpes | dano 0 e `_DN_CantKillUser` | borda |
| PV-09 | K com troca aberta | A abriu a troca e B respondeu | A liga e desliga o K | `_NN_Cant_trade_pkmode` aos dois, `QuitTrade` aos dois, PKInfo 1 e depois 0 | borda |
| DU-01 | Declaração | A e B no campo | A manda 0x039F (Parm2 0) | B recebe 0x039F com Parm1 = A e Parm2 = 0 | feliz |
| DU-02 | Aceite | depois do DU-01 | B aceita (Parm2 4) | A em (147,4044), B em (189,4044), `StartTime` 240 e "Batalha entre … foi iniciada" aos dois | feliz |
| DU-03 | Duelo, alvo sem K | duelo iniciado, A ao lado de B | A com K dá 5 golpes em B sem K | nenhum golpe tira HP (tile `0x44`) | borda |
| DU-04 | Duelo, A mata B | duelo iniciado, os dois com K | golpes até HP 0 | "A é o vencedor, B é o perdedor" aos dois, os dois em (2572,1752), B com HP 1, "Na arena não há perda de EXP" e EXP de B igual no banco | feliz |
| DU-05 | B sai do jogo | duelo iniciado | B desconecta | A vence e vai para (2572,1752) | controle |
| DU-06 | B sai da caixa | duelo iniciado | B anda até x 201 | A vence e vai para (2572,1752) | controle |
| DU-07 | Arena ocupada | A×B em duelo | C desafia D e D aceita | "Há uma partida em progresso." para C e D, sem teleporte | controle |
| DU-08 | Duelo dentro de Armia | A e B na praça | pedido e aceite | o duelo começa (o legado não olha a posição) | borda |
| DU-09 | Aceite forjado | sem pedido | B manda o aceite com Parm1 = A | ninguém vai para a arena | controle |
| DU-10 | Fim do tempo | duelo iniciado, os dois parados | espera | "Este jogo com A e B finalizou em empate" aos dois em cerca de 242 s, com o muro (`EnvEffect` 32) | borda |
| DU-11 | Alvo com sussurro bloqueado | B digitou `whisper` | A desafia B | sem repasse e "Não é possível sussurrar para este jogador." para A | controle |

## Viabilidade do bot

Tudo roda com `npm run quest -- 15`.
- O personagem do runner é A. B (e C/D no DU-07) são contas novas de `secondChar`, semeadas pelo banco:
  - A: nível 300, Str 1000;
  - B: nível 50 com EXP 590 000;
  - `pk_point` 75 e `guilty` 0.
- O HP da vítima vem do cliente dela.
- O Guilty vem dos `CreateMob`.
- A EXP e o CP salvos são lidos no banco depois do logout.

## Divergências suspeitas no Go

- O golpe ignora o `0x40` do AttributeMap e exige o K só do atacante (PV-02, DU-03).
- O Guilty, o CantKill e a perda de EXP/CP ignoram a geografia: cidade, arena e mapa do duelo (PV-04, PV-05, PV-06).
- Duelo:
  - recusa dentro da cidade (DU-08);
  - dura cerca de 121 s com `StartTime` 121 (DU-02, DU-10);
  - não manda `_NN_Battle_Started` nem os textos do resultado com nomes (DU-02, DU-04, DU-05, DU-06, DU-07, DU-10);
  - deixa o perdedor com HP 0 (DU-04).
- `_MSG_PKMode` não manda `_NN_Cant_trade_pkmode` (PV-09).

## Reaproveitamento

- `src/bot/pvp.ts`: K, golpe em jogador, morte, duelo e mensagens.
- `src/world/quests/15-pvp-duelo.ts`: áreas, textos e sementes.

## Situação (2026-10-23/25)

`npm run quest -- 15` no Railway (main `4b661398`): 5 ✅ 15 ❌. Os casos rodaram em duas rodadas: 2026-10-23 11:16–14:52 UTC e 2026-10-25 17:50–17:56 UTC. No meio, o banco ficou saturado. PV-01 e DU-09 foram reconfirmados às 17:58 UTC de 2026-10-25, depois do rebase sobre o PR #5.

| ID | Resultado | Issue |
|---|---|---|
| PV-01, PV-03, PV-07 | ✅ | |
| PV-02, DU-03 | ❌ golpe em alvo sem K passa nos tiles `0x40`/`0x44` | [#420](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420) |
| PV-04, PV-05, PV-06 | ❌ Guilty, perda de EXP e de CP na cidade e na arena | [#421](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421) |
| PV-08, PV-09 | ❌ textos do CantKill e da troca com K | [#422](https://github.com/Jean1dev/w2pp-OpenWYD/issues/422) |
| DU-01, DU-09 | ✅ | |
| DU-02, DU-04…08, DU-10, DU-11 | ❌ duração, textos, HP do perdedor e recusa na cidade | [#424](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) |

Findings: [026](../findings/026-pvp-golpe-tile-0x40.md), [027](../findings/027-pvp-cidade-regra-de-campo.md), [028](../findings/028-pk-textos.md) e [029](../findings/029-duelo-paridade.md).

## Situação (2026-10-25, depois do #425)

`npm run quest -- 15` no Railway depois do [w2pp-OpenWYD#425](https://github.com/Jean1dev/w2pp-OpenWYD/pull/425) (main `2b10e77b`, deploy `66102a6b`), de 20:40 a 20:58 UTC: **19 ✅ 1 ❌**. As #420, #421, #422 e #424 foram verificadas.

| ID | Resultado | Issue |
|---|---|---|
| PV-01…09 | ✅ | [~~#420~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420), [~~#421~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421), [~~#422~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/422) |
| DU-01…03, DU-05…11 | ✅ | [~~#420~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420), [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) |
| DU-04 | ❌ falta "Na arena não há perda de EXP." para B; o resto (HP 1, saída, texto com os nomes, EXP igual) passa | [#427](https://github.com/Jean1dev/w2pp-OpenWYD/issues/427) |
