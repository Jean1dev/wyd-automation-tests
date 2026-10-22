# 04 — Molar do Gárgula

Esta quest refina o equipamento do Mortal. A Patrulha__ do Dungeon leva o personagem a uma arena de Gárgulas. Lá ele pega o Molar_de_Gárgula (4122) e o usa com o botão direito. As peças do Equip[1..5] que estiverem abaixo de +6 sobem para +6, uma única vez (flag `QuestInfo.Mortal.MolarGargula`). Os guias chamam a quest de "Resistindo aos Kayzens".

## Resumo

- **NPC:** Patrulha__ `[3837]` em (787,4058), no Dungeon. Merchant 100 grade 15, igual nos dois servidores.
- **Teleporte:** (817,4062) ± variação.
- **Arena:** (793,4046)–(827,4080), com reset a cada 10 min no legado e no Go. Não há guarda de `QuestFlag`.
- **Mobs que soltam o 4122:**
  - Gargula_Inf (nv 201) `[3838-3839]`, em (817,4071) e (817,4053);
  - Gargula_Servo `[3841-3843]`;
  - o template GagoilChief.
  - O `[3840]` tem `MinuteGenerate -1` e não nasce.

## Pré-requisitos

- **NPC:** `ClassMaster == MORTAL` e armazenado `[199,254)`, que é exibido 200–254. Não consome item.
- **Uso do 4122 (Vol 194):**
  - Mortal, na mesma faixa de nível;
  - `MolarGargula == 0`.

## Fluxo

- **Legado:**
  - NPC em `_MSG_Quest.cpp:2236-2255`, só o teleporte.
  - Uso em `_MSG_UseItem.cpp:2494-2546`:
    - para i = 1..5, se o Equip[i] existe e tem refinação < 6, ela vira +6;
    - grava `MolarGargula = 1`, recalcula o score e consome uma unidade.
  - Se recusar, devolve o item ao slot.
- **Go:**
  - NPC em `handler/misc.go:692` ✅.
  - Uso ❌: não há caso para o Vol 194 nem para o item 4122, e a flag `MolarGargula` não existe (`grep` em `tmserver/internal`).

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| MG-01 | Teleporte abaixo do nível | Mortal exibido 199 | `MSG_Quest` na Patrulha__ | recusa; não teleporta | controle |
| MG-02 | Teleporte | Mortal exibido 200 | `MSG_Quest` na Patrulha__ | teleporta para (817±3,4062±3) | feliz |
| MG-03 | Arch | Arch exibido 200 | `MSG_Quest` na Patrulha__ | recusa (`_NN_Level_Limit2`) | controle |
| MG-04 | Drop | dentro da arena | matar Gargula_Inf e Gargula_Servo até o drop (tempo máximo) | o 4122 cai | feliz |
| MG-05 | Uso do molar | Equip[1..5] com peças de +0 a +5; uma peça +7 | `MSG_UseItem` no 4122 | as peças < +6 ficam +6; a +7 continua +7; o 4122 some; AC e dano sobem | feliz |
| MG-06 | Uso repetido | `MolarGargula` 1, outro 4122 | `MSG_UseItem` | "já fez"; o item volta ao slot | controle |
| MG-07 | Uso fora da faixa | Mortal exibido 255 com 4122 | `MSG_UseItem` | recusa (`_NN_Level_limit`); o item fica | controle |
| MG-08 | Slot vazio | Equip[3] vazio | `MSG_UseItem` | o slot vazio é pulado; os outros sobem | borda |
| MG-09 | Flag persiste | depois do MG-05 | relogin e MG-06 | continua recusando | borda |
| MG-10 | Reset da arena | dentro da arena | esperar ≤ 12 min | mandado para a cidade | feliz |

## Viabilidade do bot

- Nível exibido 200 com Poeira de Fada. Equipamento da loja do cenário 4, com as peças em Equip[1..5] para dar o que medir.
- **Ida:** Grifo "Calabouço" e tile do Armia Field para o Dungeon 1, como no Kaizen do cenário 4. Depois a pé até (787,4058).
  - A rota exata do Kaizen até a Patrulha__ ainda precisa ser levantada no mapa.
- **Farm:** Gargula_Inf é nv 201. Com o personagem no topo da faixa (exibido 254) e o equipamento da loja, deve dar. Medir o tempo até o drop.
- **Verificação do refino:** comparar a refinação de cada `Equip[i]` antes e depois (`P.itemSanc`), e o score (AC e dano).

## Divergências suspeitas no Go

- O uso do molar não existe (MG-05). É a principal suspeita: hoje o item deve ser rejeitado ou cair no caminho de equipar.

## Reaproveitamento

- `src/world/quest256.ts`: viagem até o Dungeon (`TELEPORT.fieldToDungeon`, `GRIFF_WARP.calabouco`).
- `src/bot/quest.ts` `waitForReset`; `src/bot/npc.ts` `useItem`.
- Esqueleto de `src/scenarios/quest256Chain.ts` (nível, equipamento, viagem com mortes).

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 04`, com o nível, a classe, os atributos, o equipamento (com a refinação de cada Equip[1..5]) e o 4122 semeados pelo banco. O bot vai pelo Grifo "Calabouço" e pelo tile do Armia Field até o Dungeon 1 e anda até a Patrulha__ (o Go não valida o caminho). Resultado: 6 ✅ e 4 ❌.

- A ida (Patrulha__), o drop do 4122 e o reset da arena estão como no legado. O 4122 caiu no 7º kill, cerca de 1,5 min de caça no exibido 254.
- O uso do molar não existe no Go: o Vol 194 cai no `rejectUnimplementedConsumable` (NoticeCantUseHere) e a flag `MolarGargula` não existe. MG-06 e MG-09 dependem do primeiro uso e reprovam pela mesma causa; o MG-07 só passa porque o item é recusado para todos.

| ID | Resultado | Issue |
|---|---|---|
| MG-01 | ✅ | |
| MG-02 | ✅ | |
| MG-03 | ✅ | |
| MG-04 | ✅ | |
| MG-05 | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) |
| MG-06 | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) |
| MG-07 | ✅ (vácuo: o 4122 é recusado para todos; ver [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398)) | |
| MG-08 | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) |
| MG-09 | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) |
| MG-10 | ✅ | |

Finding: [010](../findings/010-molar-gargula-sem-uso.md).

## Situação (2026-10-22)

Reteste no Railway depois do [w2pp-OpenWYD#411](https://github.com/Jean1dev/w2pp-OpenWYD/pull/411) (`main` `2866b8c`), com `npm run quest -- 04`: 10 ✅. O Go agora trata o Vol 194 (`handler/molargargula.go`, porte de `_MSG_UseItem.cpp:2494-2546`) e salva a flag na coluna `molar_gargula`. MG-06 semeia `molar_gargula 1` pelo banco; MG-09 grava a flag jogando e confere no banco depois do relog. MG-07 deixou de passar no vácuo: exige a recusa `_NN_Level_limit` com o 4122 no slot. As peças +0 do seed levam o par EF_SANC, porque o `BASE_SetItemSanc` do legado (`Basedef.cpp:2280`) não cria o par: uma peça sem ele não sobe nem no legado.

| ID | Resultado | Issue |
|---|---|---|
| MG-01 | ✅ |  |
| MG-02 | ✅ |  |
| MG-03 | ✅ |  |
| MG-04 | ✅ drop no Gargula_Inf, 25 kills em 10,5 min |  |
| MG-05 | ✅ +0 +3 +5 +7 +1 → +6 +6 +6 +7 +6, molar_gargula 1 | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida |
| MG-06 | ✅ "Você já completou esta Quest." | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida |
| MG-07 | ✅ "Nível Insuficiente. Isto não pode ser utilizado." | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida |
| MG-08 | ✅ Equip[3] vazio pulado | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida |
| MG-09 | ✅ flag salva, recusa depois do relog | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida |
| MG-10 | ✅ reset 580 s depois da entrada |  |
