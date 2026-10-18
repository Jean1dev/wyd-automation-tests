# 07 — Pílula do Poder Mágico (Conquista do Castelo Orc)

Esta é uma recompensa única de +9 pontos de skill (`SkillBonus`), dada pela Pílula_do_Poder_Mágico (470). A pílula cai do Orc Lord, no fim do Castelo Orc, ao norte de Armia. A flag `QuestInfo.Mortal.PilulaOrc` impede repetir. Os guias chamam a quest de "Conquista do Castelo Orc".

## Resumo

- **Item:** 470 Pilula_do_Poder_Mágico (`EF_VOLATILE`, Vol 6).
- **Drop:** templates OrcLord e Orc_Lorde (gerador Orc_Lord, `NPCGener.txt:13816`).
  - O castelo tem portas com chaves de mobs: OrcKeeper, OrcGuard, ChiefOrc e OrcLord.
  - O mapa do castelo e as chaves ainda não foram levantados.
- **Recompensa:** `SkillBonus += 9`, uma vez. A flag `PilulaOrc` vale para qualquer classe; o nome "Mortal" é só onde ela fica guardada.

## Fluxo

- **Legado (dois caminhos):**
  - **Pegar do chão** (`_MSG_GetItem.cpp:94-126`): se `PilulaOrc == 0`, a pílula é aplicada na hora (`SkillBonus += 9`, flag 1, o item some do chão). O cálculo de pontos de skill também conta a flag (`Basedef.cpp:865`).
  - **Usar** (`_MSG_UseItem.cpp:981-998`):
    - se `PilulaOrc` já é 1, `return` sem resposta;
    - senão, `SkillBonus += 9`, `PilulaOrc = 1`, emoção 14 e uma unidade consumida.
- **Go:** ❌. `handler/skill.go:20` diz que a PilulaOrc não está modelada, e não há caso para o Vol 6.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| PO-01 | Pegar a pílula | `PilulaOrc` 0, pílula no chão (drop do Orc Lord) | `MSG_GetItem` | a pílula some do chão (`MSG_DecayItem`) sem ir para o inventário; `PilulaOrc` = 1; `SkillBonus` +9 (`_MSG_GetItem.cpp:94-126`); mensagem `_NN_Get_Skill_Point` | feliz |
| PO-01b | Pegar com a flag já gravada | `PilulaOrc` 1 | `MSG_GetItem` | `_NN_Youve_Done_It_Already`; a pílula fica no chão | controle |
| PO-02 | Usar a pílula | `PilulaOrc` 0, 470 no inventário | `MSG_UseItem` | `SkillBonus` +9; a pílula some | feliz |
| PO-03 | Segunda pílula | `PilulaOrc` 1 | `MSG_UseItem` em outra 470 | nada muda: sem bônus e sem consumir | controle |
| PO-04 | Persistência | depois do PO-02 | relogin e PO-03 | continua recusando; o `SkillBonus` continua com os +9 | borda |

O `SkillBonus` chega ao bot pelo `UpdateEtc`/score. O cenário compara o valor antes e depois.

## Viabilidade do bot

- É cara: exige matar o Orc Lord e atravessar o Castelo Orc com chaves. O mapa do castelo não está levantado.
- Plano B, se a pílula aparecer em alguma loja ou troca: não aparece no inventário de nenhum NPC mapeado.
- **Recomendação:** deixar por último entre as mortais, ou combinar com outro cenário que já passe pelo norte de Armia.

## Divergências suspeitas no Go

- Quest inteira ausente: Vol 6 sem caso e sem a flag.

## Reaproveitamento

- `src/bot/combat.ts`, `src/bot/grind.ts`.
- Um `pickUp` de item no chão ainda não existe no `src/bot`. Ver se o `GameClient` já trata o `MSG_CreateItem` do drop.

## Situação (2026-10-18)

Validado no Railway com `npm run quest -- 07`, Mortal de nível armazenado 49 (`SkillBonus` derivado 147) e as pílulas 470 semeadas no inventário pelo banco. O drop do Orc Lord não é o objeto dos casos: para o caminho do chão, o bot larga a pílula aos pés (`MSG_DropItem`) e a pega de volta (`MSG_GetItem`); como o Go não manda o `MSG_CreateItem` do item largado, o id do chão é sondado (`src/bot/ground.ts`). Resultado: 0 ✅ e 5 ❌, todos pela mesma causa (#404).

- Pegar do chão: a 470 vira item comum e volta ao inventário (`CNFGetItem`), sem os +9 (PO-01, PO-01b).
- Usar: o Vol 6 não tem caso no `useItem` e cai no `rejectUnimplementedConsumable` (NoticeCantUseHere 39), sem consumir (PO-02).
- `PilulaOrc` não existe no Go nem no banco, e o `deriveSkillBonus` não soma os +9: as pré-condições de flag gravada (PO-01b, PO-03, PO-04) são inalcançáveis; a recusa da segunda pílula é vácuo.

| ID | Resultado | Issue |
|---|---|---|
| PO-01 | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) |
| PO-01b | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) |
| PO-02 | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) |
| PO-03 | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) |
| PO-04 | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) |
