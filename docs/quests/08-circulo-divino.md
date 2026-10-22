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

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 08`, Mortal de nível armazenado 99 com o pedaço ou o círculo no Equip[13], o gold, o `Special[0..3]`, o `LearnedSkill` e a flag `Circle` (coluna `celestial_circle`, o mesmo `QuestInfo.Circle` da Arcana) semeados pelo banco (`db.setSpecial` em `src/db/seed.ts`). O bot vai pelo Grifo ao Jardim dos Deuses e anda até Azran. Resultado: 3 ✅ e 4 ❌, todos pela mesma causa ([#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405)).

- O Jeffi e a Shaman estão no mundo, mas os Merchants 12 e 13 não têm rota no `MSG_Quest` do Go: nenhuma resposta, nada muda (CD-02, CD-04, CD-06, CD-07).
- Os controles (CD-01, CD-03, CD-05) passam só por vácuo: o legado responderia com fala, o Go fica calado.
- A #249 (Jeffi) está fechada como concluída, mas não há código do Jeffi no `main`.

| ID | Resultado | Issue |
|---|---|---|
| CD-01 | ✅ (vácuo) | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-02 | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-03 | ✅ (vácuo) | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-04 | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-05 | ✅ (vácuo) | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-06 | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |
| CD-07 | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) |

## Situação (2026-10-22)

Reteste no Railway depois do [w2pp-OpenWYD#411](https://github.com/Jean1dev/w2pp-OpenWYD/pull/411) (`main` `2866b8c`), com `npm run quest -- 08`: 7 ✅. O Jeffi e a Shaman agora têm rota pelo byte 17 do template (Merchant 12 e 13, `handler/circle.go`). O Jeffi purifica o 447 por 1M. A Shaman devolve até 50 pontos por Special com o círculo comum, ou até 100 com o completo, apaga a árvore do círculo, esvazia o Equip[13] e grava `Circle` 1 só no comum. Tudo isso sobrevive ao relog. Os controles CD-01, CD-03 e CD-05 deixaram de passar no vácuo: agora exigem a fala de recusa do legado (`_NN_Need_1000000_Gold`, `_NN_Need_Pure_Divine` e `_NN_Youve_Done_It_Already`), além do estado inalterado.

| ID | Resultado | Issue |
|---|---|---|
| CD-01 | ✅ "Requer 1000000 gold.", nada muda | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-02 | ✅ 447 → 448, gold −1M | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-03 | ✅ "Requer Círculo Divino Puro…", nada muda | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-04 | ✅ SpecialBonus 200, Special [10×4], Learn 0xffff00, Circle 1 | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-05 | ✅ "Você já completou esta Quest.", o círculo fica | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-06 | ✅ SpecialBonus 400, Special [20×4], Learn 0xff00ff, Circle 1 | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
| CD-07 | ✅ Special[0] 30 → 0, SpecialBonus 180, Learn 0x00ffff | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida |
