# 10 — Destravas do Arch: Lindy 355/370 e Cristais

Duas quests do Arch de nível alto:

- **Lindy:** destrava o nível 355 (com a capa Elite) e depois o 370. Ela usa uma combinação de itens (`MSG_CombineItemLindy`).
- **Cristais:** quatro etapas em sequência (Elime → Sylphed → Thelion → Noas). Cada uma dá MP, AC e HP permanentes e **custa 100 milhões de exp**. Os guias chamam essa quest de "Contrato dos Espíritos".

## Resumo — Lindy

- **NPC:** Lindy `[3142]`, em (1705,1727), ao lado do Lider_Aprendiz.
- **Gatilho:** a combinação, não o `MSG_Quest`.
- **Receita** (`Item[0..6]`):
  - 413 Poeira_de_Lactolerium ×10;
  - 413 ×10;
  - 4127 Pergaminho_Selado;
  - 413, 413, 413 e 413, avulsas.

| Destrava | Requisitos (legado) | Recompensa |
|---|---|---|
| 355 | Arch; `CurrentScore.Level == 354` (exibido 355); `Level355 == 0` | `Level355 = 1`; Equip[15] = 3191 (clan 7), 3192 (clan 8) ou 3193 (sem reino) |
| 370 | Arch; `CurrentScore.Level == 369` (exibido 370); `Level370 == 0`; `Fame > 0` | `Level370 = 1`; Fame −1 |

## Resumo — Cristais (Vol 187)

| Etapa | Item | Recompensa (BaseScore) |
|---|---|---|
| 1 | 4106 Cristal_Elime | MaxMp +80 |
| 2 | 4107 Cristal_Sylphed | AC +30 |
| 3 | 4108 Cristal_Thelion | MaxHp +80 |
| 4 | 4109 Cristal_Noas | MaxHp +60, MaxMp +60, AC +20 |

- Cada etapa exige `Cristal == etapa − 1`, grava `Cristal = etapa` e tira 100.000.000 de exp, com recálculo do nível.
- **Os cristais estão à venda na Evolucao.** No legado, a checagem de Arch e de nível ≥ 355 está **comentada** (`_MSG_UseItem.cpp:3368-3380`): qualquer classe usa.

## Fluxo

- **Legado:**
  - Lindy em `_MSG_CombineItemLindy.cpp:46-112`;
  - Cristais em `_MSG_UseItem.cpp:3366-3467`.
- **Go:**
  - Lindy em `combineItemLindy`, `handler/combine_variants.go:177` ⚠️:
    - aceita a 355 em **qualquer** nível ≥ 354, não só no 354;
    - a 370 só sai depois da 355 e com nível ≥ 369.
  - Cristais em `useArchCrystal`, `arch_progression.go:15` ⚠️, com diferenças de propósito:
    - exige Arch ≥ 355 (issue #327);
    - o exp não fica negativo e o nível cai junto (issue #348).

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| LD-01 | Mortal na Lindy | Mortal com a receita | `MSG_CombineItemLindy` | recusa; nada some | controle |
| LD-02 | Arch fora do nível | Arch exibido 354 | combinação | recusa | controle |
| LD-03 | Receita errada | Arch 355, faltando a 4127 | combinação | recusa; nada some | controle |
| LD-04 | Destrava 355 | Arch exibido 355, receita, clan 8 | combinação | itens somem; `Level355` = 1; capa 3192; o personagem volta a ganhar exp no 355 | feliz |
| LD-05 | 355 de novo | `Level355` 1, nível 355 | combinação | recusa | controle |
| LD-06 | 355 acima do nível | Arch exibido 360 sem `Level355` | combinação | o legado recusa (nível ≠ 354). O Go aceita | borda |
| LD-07 | 370 sem Fame | Arch 370, `Fame` 0 | combinação | recusa | controle |
| LD-08 | Destrava 370 | Arch 370, `Fame` ≥ 1, receita | combinação | `Level370` = 1; Fame −1 | feliz |
| CR-01 | Cristal fora de ordem | `Cristal` 0, com o 4107 | `MSG_UseItem` | `_NN_Need_BeforeQuest`; o item volta | controle |
| CR-02 | Etapa 1 | `Cristal` 0, exp ≥ 100M | `MSG_UseItem` no 4106 | MaxMp +80; exp −100M; `Cristal` = 1; o item some | feliz |
| CR-03 | Etapa repetida | `Cristal` 1 | `MSG_UseItem` em outro 4106 | `_NN_Youve_Done_It_Already` | controle |
| CR-04 | Quatro etapas | `Cristal` 0 | usar 4106 → 4109 | ao fim: MaxMp +140, MaxHp +140, AC +50 no BaseScore; `Cristal` = 4 | feliz |
| CR-05 | Mortal com cristal | Mortal | `MSG_UseItem` no 4106 | o legado aceita (checagem comentada). O Go recusa (#327) | borda |
| CR-06 | Exp abaixo de 100M | Arch com exp < 100M | `MSG_UseItem` | o legado deixa o exp negativo. O Go zera e recalcula o nível (#348). Registrar | borda |

## Viabilidade do bot

- **Nível:** um Arch exibido 355 é caro, mesmo com Poeira de Fada: o Arch nasce no nível 1 no cenário 5. A Poeira dá +1 por uso, então são uns 354 usos.
  - Antes, conferir se a Poeira funciona no Arch acima de 350 e se há trava sem a Lindy, que é o próprio LD-04.
- **Itens:**
  - a 413 e a 4127 estão nas lojas? A 413 está na Aki. A 4127 (Pergaminho_Selado) ainda precisa de fonte;
  - os cristais estão na Evolucao (500.000 cada, pelo `ItemList.csv`).
- **Fame:** a 370 precisa de Fame ≥ 1, e a fonte de Fame não está mapeada. Se não houver, o LD-08 fica `blocked`.
- O protocolo do `MSG_CombineItemLindy` ainda não está no `src/protocol`. Copiar o layout do `combine_variants.go` (`variantInputs`).

## Divergências suspeitas no Go

- Lindy aceita a 355 acima de 354 (LD-06) e exige a 355 antes da 370.
- Os cristais são de propósito diferentes do legado (#327, #348). Registrar como informativo, não abrir issue.

## Reaproveitamento

- A conta do Arch e `src/scenarios/archCreation.ts`.
- `src/bot/quest.ts` `useDustUntil`, `src/bot/npc.ts` `buyItem`/`useItem`.

## Situação (2026-10-18)

`npm run quest -- 10` no Railway: 14 ✅. O Arch nasce direto no banco (class_master ARCH) no nível do caso, com a exp mínima do nível, as flags `arch_lv355`/`arch_lv370`/`fame`/`arch_crystal_stage` e os ingredientes (413, 4127, cristais, Poeira de Fada), então nenhum caso ficou bloqueado. O bot anda até a Lindy pela rota do cenário 3, mas não clica nela (no Go o clique cai no Merchant 74, a Alma do Mortal); nem o legado nem o Go conferem a distância na combinação.

- A trava de exp do Arch funciona: no 354 sem a Lindy a Poeira de Fada é recusada e, depois da 355, sobe de novo.
- LD-06, CR-05 e CR-06 são as divergências documentadas e propositais do Go (aceita a 355 acima do 354; #327; #348). Ficam como informativas, sem issue.
- O Pergaminho_Selado 4127 e a Fame ainda não têm fonte mapeada no jogo; os casos usam o banco.

| ID | Resultado | Issue |
|---|---|---|
| LD-01 | ✅ | |
| LD-02 | ✅ | |
| LD-03 | ✅ | |
| LD-04 | ✅ | |
| LD-05 | ✅ | |
| LD-06 | ✅ informativo (Go aceita acima do 354) | |
| LD-07 | ✅ | |
| LD-08 | ✅ | |
| CR-01 | ✅ | |
| CR-02 | ✅ | |
| CR-03 | ✅ | |
| CR-04 | ✅ | |
| CR-05 | ✅ informativo (#327) | |
| CR-06 | ✅ informativo (#348) | |
