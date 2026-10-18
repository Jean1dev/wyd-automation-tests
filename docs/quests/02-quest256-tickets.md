# 02 — Quest 256: as cinco arenas e os troféus

A "Quest 256" é a cadeia das cinco arenas por faixa de nível. Em cada uma, o personagem entrega o ticket da faixa ao NPC e é teleportado para uma arena. Lá dentro ele mata os mobs, que soltam um **troféu**. O troféu, usado com o botão direito, dá exp e gold. Os guias chamam as arenas de Defensor da Alma (Coveiro), Jardim de Deus, Ressurreição do Cavaleiro Negro (Kaizen), Hidra Imortal e Início da Infelicidade (Elfos).

Os cenários 2 (Coveiro) e 4 (passos 2–5) já testam a entrada, o controle de intruso e o reset. **Falta testar os troféus**: o drop dentro da arena e o uso.

## Resumo

| Passo | NPC (gerador, posição) | Ticket | Nível exibido | Entrada | Arena | Mobs (troféu) | Troféu → exp (mortal/arch) / gold |
|---|---|---|---|---|---|---|---|
| 1 Coveiro | Coveiro `[3445]` (2375,2104) | 4038 Vela_do_Coveiro | 40–115 | (2398,2105) | (2379,2076)–(2426,2133) | Aparicao, Esqueleto | 4117 Caixa_da_Sabedoria → 30.000 / 10.000 |
| 2 Jardim | Jardineiro `[3446]` (2222,1714) | 4039 Colheita_do_Jardineiro | 116–190 | (2234,1714) | (2228,1700)–(2257,1728) | Grande_Carb, Servo_Carbuncle | 4118 Lágrima_Angelical → 60.000 / 20.000 |
| 3 Kaizen | Patrulha_ `[3447]` (454,3910) | 4040 Cura_do_Batedor | 191–265 | (464,3902) | (459,3887)–(497,3916) | Cav._Kaizen, Cav._Servo | 4119 Coração_do_Kaizen → 200.000 / 100.000 |
| 4 Hidra | Patrulha `[3448]` (668,3768) | 4041 Mana_do_Batedor | 266–320 | (668,3756) | (658,3728)–(703,3762) | Hidra_Dourada, Hidra_Imortal | 4120 Olho_de_Sangue → 500.000 / 250.000 |
| 5 Elfos | Guarda `[3449]` (1303,4036) | 4042 Emblema_do_Guarda | 321–350 | (1322,4041) | (1312,4027)–(1348,4055) | Mestre_Elfo, Servo_Elfo | 4121 Pedra_Espiritual_dos_Elfos → 780.000 / 500.000 |

- Exp, gold e faixas vêm de `Release/Common/Settings/QuestsRate.txt`. O exp do Arch é igual ao do mortal nesse arquivo.
- O drop do troféu está no inventário dos templates em `npc/*`. Os mesmos templates trazem também as versões em inglês (`Skelton@`, `KaizenKnight`…).

## Pré-requisitos

- **NPC:**
  - Mortal ou Arch, com o nível armazenado na faixa `[min,max)` do passo.
  - O ticket do passo em qualquer slot. O slot inteiro some.
  - Ganha a `QuestFlag` do passo (1–5, volátil) e é teleportado com variação de `rand()%5-3`.
- **Troféu (Vol 191):**
  - Nível na faixa da linha `Level` do `QuestsRate.txt`. As colunas 0/1 valem para o mortal e as 2/3 para o arch.
  - A checagem de classe está comentada no legado.
  - O líder e os membros do grupo ganham 10 % do exp.

## Fluxo

- **Legado:**
  - NPCs em `_MSG_Quest.cpp:293-512`;
  - troféus em `_MSG_UseItem.cpp:2344-2490`;
  - guarda de intruso em `ProcessSecMinTimer.cpp:1658-1678`;
  - reset a cada 10 min em `ProcessSecMinTimer.cpp:560-577`.
- **Go:**
  - NPCs em `handler/misc.go:875` (`quest256NPC`);
  - ticket com o botão direito em `item.go:627` (`useQuest256Ticket`);
  - troféus em `item.go:996` (`useQuestReward`, com as tarifas de `content/rates.go`);
  - guarda em `mobai.go:133`;
  - reset em `quest_area_reset.go`;
  - atalho do Mestre_Grifo em `misc.go:927` e `MSG_MasterGriff` (0x0AD9) em `misc.go:941`.

## Casos de uso

Os casos QST-01 a QST-07 já estão cobertos pelos cenários 2 e 4 e entram aqui só para fechar o mapa.

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| QST-01 | Entrega do ticket | nível na faixa, com o ticket | `MSG_Quest` no NPC | ticket some; teleporta para a entrada; `QuestFlag` = passo | feliz (cenários 2/4) |
| QST-02 | Sem ticket / ticket de outro passo | — | `MSG_Quest` no NPC | recusa; nada some | controle (cenários 2/4) |
| QST-03 | Um nível abaixo do mínimo | ticket certo | `MSG_Quest` no NPC | recusa; o ticket fica | controle (cenário 4) |
| QST-04 | Intruso | sem `QuestFlag` | andar para dentro da arena | mandado para a cidade | controle (cenários 2/4) |
| QST-05 | Reset | dentro da arena | esperar ≤ 12 min | mandado para a cidade no ciclo de 10 min | feliz (cenários 2/4) |
| QST-06 | Relogin dentro da arena | `QuestFlag` ativa | relogin | a flag zera; o guarda manda para fora | borda |
| QST-07 | Acima do máximo | nível = máximo do passo, com ticket | `MSG_Quest` no NPC | recusa; o ticket fica | controle |
| QST-08 | Drop do troféu | dentro da arena | matar os mobs do passo até o drop (tempo máximo) | o troféu do passo cai | feliz |
| QST-09 | Usar o troféu | troféu do passo, nível na faixa | `MSG_UseItem` no troféu | +exp e +gold da tabela; o troféu some (uma unidade) | feliz |
| QST-10 | Troféu fora da faixa | nível acima do máximo (Poeira de Fada depois do drop) | `MSG_UseItem` | recusa (`_NN_Level_limit`); o troféu volta ao slot | controle |
| QST-11 | Troféu em grupo | grupo com a segunda conta | o membro usa o troféu | o líder ganha 10 % do exp | borda |
| QST-12 | Ticket com o botão direito | ticket do passo, nível na faixa | `MSG_UseItem` no ticket | o legado não tem esse caminho (nenhum 4038–4042 no `_MSG_UseItem.cpp`). O Go (`useQuest256Ticket`) consome uma unidade e teleporta com a `QuestFlag`. Registrar o resultado | borda |
| QST-13 | Mestre_Grifo dá a `QuestFlag` | sem ticket, nível na faixa | `MSG_MasterGriff` | o legado não tem esse caminho. No Go, entra na arena **sem gastar ticket** (já usado como plano B no cenário 4) | borda |
| QST-14 | Arch na arena | Arch no nível do passo | entregar o ticket | o Arch também entra (a classe é conferida no NPC) | borda |

## Viabilidade do bot

- A entrada já está pronta no cenário 4, e os tickets saem de graça na Aki.
- Os troféus exigem matar mobs fortes para o nível em que a arena abre: Aparição nv 98 contra um personagem de nível 40, e Servo_Carbuncle nv 240 no Jardim. No cenário 2, o bot espera o reset escondido num canto.
  - Saída prática: subir o personagem com Poeira de Fada até o **topo** da faixa (por exemplo exibido 115 no Coveiro), com o melhor equipamento da loja, e só então entrar e caçar o troféu.
  - QST-10 aproveita o mesmo personagem: depois do drop, uma Poeira passa o nível para fora da faixa.
- O reset de 10 min limita cada entrada. Com o troféu em mãos, o bot sai e usa.

## Divergências suspeitas no Go

- O ticket com o botão direito (QST-12) e o Mestre_Grifo (QST-13) são entradas que o legado não tem. Isso parece decisão de conteúdo do Go. Registrar como informativo e não abrir issue sem conversar.
- O `MSG_StartTime` (contador da arena) não é enviado. Isso já está registrado no finding 002.

## Reaproveitamento

- `src/scenarios/quest256Chain.ts` e `coveiroQuest.ts` (fases `level → gear → probe → ticket → handin → reset`). A fase nova `trophy` entra entre `handin` e `reset`.
- `src/world/quest256.ts` e `coveiro.ts` (NPCs, arenas, spawns, `safeSpot`).
- `src/bot/combat.ts` `fight` e `src/bot/grind.ts` para caçar dentro da arena; `src/bot/npc.ts` `useItem` para o troféu.

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 02`, todos os casos na arena do Coveiro (passo 1), com o nível, a classe, os tickets, os troféus e o equipamento semeados pelo banco. Resultado: 13 ✅ e 1 ❌. O único ❌ é o exp do troféu usado sem grupo: o legado dá 110 % da tabela (os 10 % de líder vão para quem usa), e o Go dá 100 %.

| ID | Resultado | Issue |
|---|---|---|
| QST-01 | ✅ |  |
| QST-02 | ✅ |  |
| QST-03 | ✅ |  |
| QST-04 | ✅ |  |
| QST-05 | ✅ |  |
| QST-06 | ✅ |  |
| QST-07 | ✅ |  |
| QST-08 | ✅ |  |
| QST-09 | ❌ | [#396](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396) |
| QST-10 | ✅ |  |
| QST-11 | ✅ |  |
| QST-12 | ✅ (informativo, só no Go) |  |
| QST-13 | ✅ (informativo, só no Go) |  |
| QST-14 | ✅ |  |

Finding: [008](../findings/008-trofeu-quest256-sem-bonus-de-lider.md).
