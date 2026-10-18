# 01 — Novato: os quatro treinadores do Campo de Treino

Esta é a primeira quest do jogo. Ela é feita no Campo de Treino, a leste e ao norte de Armia, e tem quatro passos em sequência. Em cada passo o personagem mostra ao treinador a chave da porta tirada de um mob do campo. O progresso fica na flag `QuestInfo.Mortal.Newbie` (0 → 4, `Basedef.h:637`). Os guias a chamam de "Campo de Treino". O cenário 1 já sobe o personagem até o nível 35 no campo, mas não fala com os treinadores.

## Resumo

| Passo | NPC (gerador) | Posição | Merchant (byte 17 / Go) | Mostrar | Consome? | Recompensa |
|---|---|---|---|---|---|---|
| 1 | Treinador1 `[3137]` | (2080,2018) | 36 / 100 | 451 Chave_da_Primeira_Porta | não | 682 Kit_de_Cura_(20_M.) ×20 |
| 2 | Treinador2 `[3138]` | (2142,1990) | 40 / 104 | 452 Chave_da_Segunda_Porta | não | refaz os adicionais da arma do Equip[6] com `SetItemBonus(50 + ReqLvl)`, só se o ReqLvl da arma for ≤ 39 |
| 3 | Treinador3 `[3139]` | (2078,1966) | 41 / 105 | 453 Chave_da_Ultima_Porta | não | Equip[1..7]: refaz os adicionais e põe refinação +3 |
| 4 | Chefe_de_Treino `[3140]` | (2121,2040) | 100 grade 16 / 100 | 524 Emblema_Orc | **sim** | um entre 682 ×20, 481 Olho_Crescente e 652 Rubi_do_Carbunkle (`rand()%3`) |

Todos os passos também dão o affect 44 (brilho) e mandam score e carry de novo.

De onde vêm os itens (`NPCGener.txt`; o drop está no template do mob, a conferir no cenário):
- 451: Gremlin_Artif `[1650]`, (2082,2028);
- 452: Krill_Gigante `[1671]`, (2147,2005);
- 453: Orc_Sniper `[1684]`, (2079,1976);
- 524: Orc_Guerreiro, (2142,1947).

## Pré-requisitos (iguais nos quatro passos)

- `ClassMaster == MORTAL`.
- `CurrentScore.Level < FREEEXP` (35, `Server.cpp:50`): armazenado ≤ 34, ou seja, exibido ≤ 35.
- `Newbie` igual ao número do passo − 1.
- A chave ou o emblema do passo em qualquer slot do inventário.

## Fluxo

- **Legado:** `_MSG_Quest.cpp:1895-2100` (regiões `TREINADORNEWBIE1..4`).
  - Fora dos requisitos, o NPC diz `_NN_NewbieQuest_AlreadyN`.
  - Sem o item, diz `_NN_NewbieQuest_CheerupN`.
  - Ao concluir, diz `_NN_NewbieQuest_CompleteN` e manda a mensagem `_NN_NewbieQuest_RewardN`.
- **Go:** ❌ não existe.
  - O dispatch (`handler/misc.go:142-260`) não tem caso para os Merchants 36, 40 e 41. A flag `Newbie` não existe na entidade.
  - O Treinador1 tem `CurrentScore.Merchant` 100 e grade 0, então cai no `quest256NPC` do Coveiro (`misc.go:165`):
    - um novato recebe a recusa de nível do Coveiro;
    - um personagem de nível exibido 40–115 com a Vela 4038 é teleportado para a arena do Coveiro (2398,2105).
  - Treinador2 e Treinador3 (104/105) caem no `quest NPC not implemented` e o jogador não recebe resposta.
  - O Chefe_de_Treino (100/16) também não tem rota.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| NOV-01 | Passo 1 sem a chave | Mortal novo, nível exibido 1, `Newbie` 0 | `MSG_Quest` no Treinador1 | fala "Cheerup1"; nenhum item, flag continua 0 | controle |
| NOV-02 | Passo 1 | 451 no inventário | `MSG_Quest` no Treinador1 | recebe 682 com 20 cargas; a 451 **continua** no inventário; `Newbie` = 1 | feliz |
| NOV-03 | Passo 1 de novo | `Newbie` 1 | `MSG_Quest` no Treinador1 | fala "Already1"; nenhum Kit novo | controle |
| NOV-04 | Pular passo | `Newbie` 1, com a 453 | `MSG_Quest` no Treinador3 | fala "Already3"; nada muda | controle |
| NOV-05 | Passo 2 | 452 no inventário, arma de ReqLvl ≤ 39 no Equip[6] | `MSG_Quest` no Treinador2 | os efeitos 0..2 da arma são refeitos (adicional novo); `Newbie` = 2 | feliz |
| NOV-06 | Passo 2 com arma de ReqLvl > 39 | arma de ReqLvl ≥ 40 | `MSG_Quest` no Treinador2 | `Newbie` = 2, mas a arma não muda (o `break` sai antes do `SetItemBonus`) | borda |
| NOV-07 | Passo 3 | 453; Equip[1..7] com peças | `MSG_Quest` no Treinador3 | Equip[1..7] com adicional novo e +3; `Newbie` = 3 | feliz |
| NOV-08 | Passo 3 com slot vazio | Equip[2] vazio | `MSG_Quest` no Treinador3 | o legado usa o ReqLvl do Equip[6] para todos os slots e grava efeito e +3 até em slot vazio. Registrar o que o Go fizer; é bug do legado | borda |
| NOV-09 | Passo 4 | 524 no inventário | `MSG_Quest` no Chefe_de_Treino | a 524 some; recebe 682 ×20, 481 ou 652; `Newbie` = 4 | feliz |
| NOV-10 | Acima do nível | `Newbie` 0, nível exibido 36 | `MSG_Quest` no Treinador1 | fala "Already1"; nada muda | controle |
| NOV-11 | Flag persiste | `Newbie` 2 | relogin e `MSG_Quest` no Treinador2 | fala "Already2" (a flag foi salva) | borda |
| NOV-12 | Treinador1 não é Coveiro | nível exibido 40, com a Vela 4038 | `MSG_Quest` no Treinador1 | o legado fala "Already1" e não teleporta. No Go, a suspeita é que teleporte para a arena do Coveiro e consuma a vela | controle |

## Viabilidade do bot

- É barato: personagem novo, grind no próprio Campo de Treino (`grindUntil`, cenário 1) e sem gold.
- Falta confirmar se os mobs soltam as chaves. Medir a taxa de drop num farm com tempo máximo (`--key-farm 20m`), como o farm do Emblema no cenário 4.
- O Orc_Guerreiro é nível 60. Um personagem de nível exibido ≤ 35 pode não dar conta dele. Plano B: grupo com a segunda conta (`WYD_ACCOUNT_B`), ou marcar o passo 4 como `blocked`.
- A trava do Campo de Treino (finding 001) manda para Armia quem passa do nível 35. O cenário tem que entregar o passo 4 antes disso.

## Divergências suspeitas no Go

- Quest inteira ausente: sem rota para os quatro NPCs e sem a flag `Newbie`.
- O Treinador1 é roteado como Coveiro por causa do `CurrentScore.Merchant` (NOV-12). O efeito colateral é real mesmo sem a quest do novato: um jogador com a Vela entra na arena do Coveiro pelo NPC errado.

## Reaproveitamento

- `src/world/trainingField.ts`: zona, spawns e rota de saída.
- `src/bot/grind.ts` `grindUntil`, `src/bot/npc.ts` `approachNpc`/`talkQuest`, `src/bot/equip.ts` (arma e peças nos slots certos para NOV-05/07).
- Esqueleto de `src/scenarios/trainingFieldLv35.ts`. O novato pode ser uma fase depois do grind dele, ou um cenário próprio `scenario:newbie`.

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 01` (servidor `main` `b392705`). A quest do novato não existe no Go: o passo 1 não funciona, então a pré-condição `Newbie ≥ 1` dos casos seguintes não é alcançável (e a flag não existe no banco para semear). Os casos fazem os passos anteriores jogando e, quando não chegam lá, falam com o NPC do caso para registrar a resposta.

| ID | Resultado | Issue |
|---|---|---|
| NOV-01 | ✅ nada muda (a resposta é a `NoticeReqNotMet` do Coveiro) | |
| NOV-02 | ❌ sem Kit 682 | [w2pp-OpenWYD#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-03 | ❌ pré-condição inalcançável | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-04 | ❌ pré-condição inalcançável; Treinador3 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-05 | ❌ pré-condição inalcançável; Treinador2 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-06 | ❌ pré-condição inalcançável; Treinador2 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-07 | ❌ pré-condição inalcançável; Treinador3 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-08 | ❌ pré-condição inalcançável; Treinador3 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-09 | ❌ pré-condição inalcançável; Chefe_de_Treino sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-10 | ✅ exibido 36 com a 451: nada muda | |
| NOV-11 | ❌ pré-condição inalcançável; Treinador2 sem resposta | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |
| NOV-12 | ❌ teleporte para a arena do Coveiro (2395,2102) e Vela consumida | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) |

Finding: [007](../findings/007-quest-novato-ausente.md).
