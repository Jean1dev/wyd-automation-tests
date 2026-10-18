# 06 — Terra Mística (Defendendo a Terra Mística)

Esta quest se faz uma vez por personagem e dá um amuleto com adicionais aleatórios. Ela tem três passos, gravados na flag `QuestInfo.Mortal.TerraMistica` (0 → 1 → 2 → 3):

1. Em grupo, o líder aceita a missão com o Cap.Mercenario de Azran (flag 1).
2. Matar um dos dragões ou imps da Terra Mística tem 1 chance em 20 de concluir a missão (flag 2).
3. O Cap.Explor. entrega o amuleto pela faixa de nível (flag 3).

## Resumo

| Papel | NPC (gerador) | Posição | Merchant (byte 17 / Go) |
|---|---|---|---|
| Aceitar | Cap.Mercenario `[985]` | (2445,1721), Azran | 10 / 10 |
| Recompensa | Cap.Explor. `[1140]` | (2398,1602) | 11 / 11 |

- **Mobs do passo 2** (rosto 239 ou 241, `MobKilled.cpp:2909-2921`): Draco_Lich e Dracorich, perto de (2380–2404,1560–1568), e também Basilisco_Ifrit, Imp_Inferno, Lagarto_Inferno e Zakum_Imp.
- **Amuleto** (`_MSG_Quest.cpp:1626-1743`):
  - Amuleto_de_Prata 551–554 para armazenado < 50;
  - Amuleto_de_Ouro 555–558 para 50–79;
  - Amuleto_Místico 559–562 para ≥ 80.
  - O efeito 0 é 43, mais dois adicionais sorteados.

Atenção: no legado, a **Lindy** `[3142]` (1705,1727) também tem o byte 17 = 10. Clicar nela abre esta quest, não a Alma do Mortal.

## Pré-requisitos

- **Passo 1:**
  - `ClassMaster == MORTAL` e `TerraMistica == 0`;
  - `confirm ≠ 0`, porque confirm 0 só dá a fala;
  - ser **líder** (`Leader == 0`) com pelo menos um membro no grupo.
- **Passo 2:** `TerraMistica == 1` e matar um mob de rosto 239/241, com sorte de 1 em 20.
- **Passo 3:** `TerraMistica == 2`. Não tem checagem de classe.

## Fluxo

- **Legado:** passo 1 em `_MSG_Quest.cpp:253-291`; passo 2 em `MobKilled.cpp:2909-2921`; passo 3 em `_MSG_Quest.cpp:1626-1743`.
- **Go:** passo 1 em `amuMistico`, `handler/misc.go:705` ✅. Os passos 2 e 3 ❌: não há hook no kill nem rota para o Merchant 11.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| TM-01 | Sozinho | Mortal sem grupo | `MSG_Quest` no Cap.Mercenario, confirm 1 | `_NN_Party_Only`; a flag fica 0 | controle |
| TM-02 | Ask | em grupo, líder | confirm 0 | só a fala; a flag fica 0 | controle |
| TM-03 | Membro, não líder | conta B lidera, conta A é membro | A pede com confirm 1 | `_NN_Party_Only` | controle |
| TM-04 | Aceitar | conta A lidera o grupo com B | A pede com confirm 1 | `TerraMistica` = 1; mensagem `_NN_Get_Watching_Town_Mission` | feliz |
| TM-05 | Aceitar de novo | `TerraMistica` 1 | confirm 1 | `_NN_Hurry_Helping_them`; nada muda | controle |
| TM-06 | Recompensa antes da hora | `TerraMistica` 1 | `MSG_Quest` no Cap.Explor. | fala de agradecimento; nada muda | controle |
| TM-07 | Concluir a missão | `TerraMistica` 1 | matar Draco_Lich ou Dracorich até a flag virar 2 (tempo máximo) | `TerraMistica` = 2 em algum kill | feliz |
| TM-08 | Recompensa | `TerraMistica` 2, exibido ≥ 81 | `MSG_Quest` no Cap.Explor. | recebe um Amuleto_Místico (559–562) com efeito 43; `TerraMistica` = 3 | feliz |
| TM-09 | Faixa do amuleto | `TerraMistica` 2, exibido ≤ 50 | `MSG_Quest` no Cap.Explor. | recebe um Amuleto_de_Prata (551–554) | borda |
| TM-10 | Recompensa repetida | `TerraMistica` 3 | `MSG_Quest` no Cap.Explor. | fala de agradecimento; nenhum amuleto | controle |
| TM-11 | Arch | Arch | `MSG_Quest` no Cap.Mercenario | recusa (só Mortal) | controle |

## Viabilidade do bot

- Precisa das duas contas (`WYD_ACCOUNT` e `WYD_ACCOUNT_B`, como no cenário 3) e de **grupo**, mas o bot ainda não forma grupo.
  - Falta implementar `MSG_SendReqParty` e o aceite no `src/bot`. Esse é o custo novo principal.
- Como a flag 2 sai com 1 chance em 20 por kill, o passo 2 exige farm de Draco_Lich, que é forte. O personagem tem que estar num nível alto.
  - Isso conflita com o TM-09, que pede o amuleto de faixa baixa. O TM-09 fica opcional, com outro personagem.
- A flag não aparece no protocolo: o progresso só se vê pelas respostas do NPC e pelo amuleto.

## Divergências suspeitas no Go

- Passos 2 e 3 ausentes: hoje a quest trava na flag 1 (TM-07/08).
- O Go identifica a Lindy como Kibita (74), então clicar nela não abre esta quest. O caminho do legado é acidental, pelo byte 17 = 10. Registrar como informativo.

## Reaproveitamento

- `src/scenarios/playerTrade.ts` (duas contas na mesma sessão de teste).
- `src/bot/combat.ts` e `src/bot/grind.ts` para o farm do passo 2.
- O grupo é peça nova (`src/bot/party.ts`). Ela também serve para o QST-11 (troféu em grupo).

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 06`, com o nível, a classe, os atributos, o equipamento e a flag `terra_mistica` semeados pelo banco. O bot vai pelo Grifo até o Jardim dos Deuses e anda até Azran, saindo pelo norte da arena do Jardineiro (quem entra nela sem a QuestFlag volta para Armia). O grupo usa uma segunda conta nova (`secondChar`/`makeParty` em `src/scenarios/quests/helpers.ts`). Resultado: 4 ✅ e 7 ❌.

- As travas do Cap.Mercenario (sozinho, confirm 0, membro, Arch) estão como no legado; o Go responde NoticeReqNotMet 15 onde o legado manda fala, e fica calado no confirm 0 e no aceite.
- O aceite grava a flag 1 só em memória: o `characterSaveToProto` não envia `MortalTerraMistica`, e todo save grava 0 (TM-04). Pelo mesmo motivo, as flags semeadas 1 e 3 viram 0 no relog (TM-05, TM-06, TM-10); com a flag 3 perdida, a quest fica refazível.
- O passo 2 não existe: 77 kills de rosto 239/241 em 10 min sem concluir; no legado a chance disso é de 1,9 % (TM-07).
- O passo 3 não existe: o Cap.Explor. (Merchant 11) não tem rota no Go, e nenhum amuleto sai (TM-08, TM-09).

| ID | Resultado | Issue |
|---|---|---|
| TM-01 | ✅ | |
| TM-02 | ✅ | |
| TM-03 | ✅ | |
| TM-04 | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) |
| TM-05 | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) |
| TM-06 | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) |
| TM-07 | ❌ | [#402](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402) |
| TM-08 | ❌ | [#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) |
| TM-09 | ❌ | [#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) |
| TM-10 | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) |
| TM-11 | ✅ | |
