# 08 — Círculo Divino (Jeffi e Shama)

Esta quest reinicia os pontos de skill.

1. O jogador leva o Pedaço_do_Círculo_Divino (447) ou o Pedaço_do_Círc_Div_Comp (692), equipado no Equip[13], ao **Jeffi**. Com o gold, o Jeffi purifica a peça num Círculo_Divino_Puro.
2. Com o círculo puro equipado, a **Shama** devolve até 50 (comum) ou 100 (completo) pontos de cada `Special[0..3]` e apaga **uma árvore de skills**: qual árvore depende do círculo sorteado.
3. O círculo comum só vale uma vez por personagem (`QuestInfo.Circle`). O completo pode repetir.

## Resumo

| Papel | NPC (gerador) | Posição | Merchant |
|---|---|---|---|
| Purificar | Jeffi | (2517,1727) Azran; outro em (1112,290) | 12 / 12 |
| Reiniciar | Shaman | (2506,1727) Azran | 13 / 13 |

| Pedaço (Equip[13]) | Preço | Resultado | Shama devolve | Repetível |
|---|---|---|---|---|
| 447 Pedaço_do_Círculo_Divino | 1.000.000 | 448/449/450 Círculo_Divino_Puro (`rand()%3`) | até 50 por Special | não (`Circle = 1`) |
| 692 Pedaço_do_Círc_Div_Comp | 5.000.000 | 693/694/695 Círculo_Divino_Comp_Puro | até 100 por Special | sim |

- **Árvore apagada** (`ncircle` = círculo − 448, ou − 693): 0 apaga os bits 0–7 do `LearnedSkill`, 1 apaga os 8–15 e 2 apaga os 16–23.
- **Drop dos pedaços** (templates em `npc/*`):
  - o 447 vem de Gremlins antigos, Trolls e Seguidores (16 templates);
  - o 692 vem de Ciclopes, Espectros, Esqueletos e Gárgulas (29 templates).

## Fluxo

- **Legado:**
  - Jeffi em `_MSG_Quest.cpp:514-610`. Sem círculo equipado, ele faz a troca Ori/Lac, que é secundária.
  - Shama em `_MSG_Quest.cpp:612-691`: devolve os pontos para o `SpecialBonus`, grava `Circle` quando o círculo é o comum, apaga a árvore, recalcula os pontos (`BASE_GetBonusSkillPoint`) e consome o Equip[13].
- **Go:** ❌, sem rota para os Merchants 12 e 13.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| CD-01 | Purificar sem gold | 447 no Equip[13], gold < 1M | `MSG_Quest` no Jeffi | `_NN_Need_1000000_Gold`; nada muda | controle |
| CD-02 | Purificar | 447 no Equip[13], gold ≥ 1M | `MSG_Quest` no Jeffi | gold −1M; o Equip[13] vira 448, 449 ou 450 | feliz |
| CD-03 | Shama sem círculo puro | 447 (não purificado) no Equip[13] | `MSG_Quest` na Shama | `_NN_Need_Pure_Divine` | controle |
| CD-04 | Reiniciar | 448–450 no Equip[13]; Special com pontos; skills da árvore aprendidas | `MSG_Quest` na Shama | `SpecialBonus` sobe pelo devolvido (até 50 por Special); os bits da árvore somem; o Equip[13] fica vazio; `Circle` = 1 | feliz |
| CD-05 | Segundo círculo comum | `Circle` 1, outro 448 | `MSG_Quest` na Shama | `_NN_Youve_Done_It_Already`; o círculo fica | controle |
| CD-06 | Círculo completo depois do comum | `Circle` 1, 693 no Equip[13] | `MSG_Quest` na Shama | aceita (até 100 por Special); `Circle` continua 1 | borda |
| CD-07 | Special abaixo do teto | Special[0] = 30 | CD-04 | devolve 30 e o Special[0] vira 0 | borda |

## Viabilidade do bot

- **Gold:** 1M ou 5M. Grind, ou venda do equipamento da loja do cenário 4. A medir.
- **Pedaço:** o drop é de mobs comuns, mas a taxa é desconhecida. Fazer farm com tempo máximo.
- **Skills:** os cenários 6–11 já ensinam as skills. Dá para reaproveitar um personagem de árvore completa e conferir quais bits sumiram com o `LearnedSkill` do `UpdateEtc`.

## Divergências suspeitas no Go

- Jeffi (purificação) e Shama ausentes.

## Reaproveitamento

- `src/bot/skills.ts` (estado do `LearnedSkill`), `src/world/skillTrees.ts`, `src/bot/equip.ts` (Equip[13]).
