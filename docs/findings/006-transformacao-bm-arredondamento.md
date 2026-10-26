# 006 — Transformação do BM (Lobisomem) e Assalto do TK arredondam o desconto diferente do legado

**Status:** corrigido no BM pelo [#415](https://github.com/Jean1dev/w2pp-OpenWYD/pull/415) (Lobisomem retestado em 2026-10-26, ver abaixo). O Assalto do TK ainda não foi retestado (cenário 11). Confirmado no Railway em 2026-10-17 (execução `reports/2026-10-17T19-39-11-741Z-bm-transform`).
**Issue:** [Jean1dev/w2pp-OpenWYD#394](https://github.com/Jean1dev/w2pp-OpenWYD/issues/394)
**Cenário:** `npm run scenario:bm-transformacao -- --skill 64,65`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `d896ae2f`)

## O que aconteceu

O legado aplica a transformação como `AC×multi/100` e `MaxHp×multi/100` (`Basedef.cpp:4180-4196`). O Go soma um delta, `X + X×(multi − 100)/100` (`handler/transform.go:128` e `:134`). Com `multi < 100`, o delta é negativo, e o Go trunca em direção ao zero. Resultado: a AC e o HP máximo ficam 1 ponto acima. Só o Lobisomem chega a ter multiplicador abaixo de 100 (mínimo 95 na pTransBonus).

| UTC | Caso | Antes | Legado | Recebido |
|---|---|---|---|---|
| 19:40:14 | Lobisomem, Level 0, sem a passiva | AC 46 / HP 116 | 48 / 110 | 49 / 111 |
| 19:44:19 | Lobisomem, Level 0, com Coração de Lobo | AC 61 | 64 | 65 |

## O que funciona (transformações do BM, cenário 9)

| Skill | Aprendida no nível exibido | Resultado |
|---|---|---|
| 64 Lobisomem | 12 | affect 16 valor 1, corrida +1; ❌ AC/HP +1 (acima) |
| 65 Coração de Lobo (passiva) | 27 | ✅ o cast é recusado; ❌ o Lobisomem refeito tem AC +1 |
| 66 Homem-Urso | 49 | ✅ AC 83 → 83, HP máx. 226 → 248, exatos |
| 67 Escudo do Tormento (passiva) | 64 | ✅ recusado; Homem-Urso refeito com HP máx. 265 → 331, exato |
| 68 Astaroth | 97 | ✅ AC 131 → 142, HP máx. 382 → 412, corrida +1 |
| 69 Asas do Inferno (passiva) | 112 | ✅ recusado; Astaroth refeito com Level 200: AC 254 → 304, HP máx. 769 → 961 |
| 70 Titã | 156 | ✅ AC 190 → 247, HP máx. 568 → 641 |

- **Controles:** Homem-Urso não aprendido e sem MP (o MP gasto com Lobisomens em si mesmo). ✅
- **Compra da skill como item:** o Mestre_Archi deu a skill 5066 pelo `MSG_Buy` ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Éden sem os 50M:** `NotEnoughCoin`. ✅
- **Relogin:** Learn 0x7F0000 e SkillBonus 212. ✅

Na primeira execução, o Astaroth refeito com Asas do Inferno (Level 88) deu HP máximo 485 com 429 de base, enquanto a fórmula dá 484. Repetido com `--skill 69`, bateu exatamente. Ficou como inconclusivo, sem issue.

## Reteste do BM (2026-10-26)

Com o deploy de main de 12:49Z, que traz o #415 (`transform.go:127-137` passou a fazer `X×multi/100 − X`), a execução `npm run scenario:bm-transformacao -- --fresh --until-done` das 15:22–15:50 UTC (`reports/2026-10-26T15-22-45-135Z-bm-transform`), com o BM `bot0pt23obso`:

| UTC | Caso | Antes | Legado | Recebido |
|---|---|---|---|---|
| 15:23:49 | Lobisomem, Level 0, sem a passiva | AC 46 / HP 116 | 48 / 110 | ✅ 48 / 110 |
| 15:28:01 | Lobisomem, Level 0, com Coração de Lobo | AC 61 / HP 161 | 64 / 161 | ✅ 64 / 161 |

O arredondamento do multiplicador abaixo de 100 está corrigido no BM. O Homem-Urso, com e sem o Escudo do Tormento, também bateu exatamente.

### Outro desvio de 1 ponto no HP máximo: a ordem do EF_HPADD

Na mesma execução, o HP máximo do Astaroth e do Titã saiu 1 ponto fora do legado. A AC bateu em todos.

| UTC | Caso | HP antes | Legado | Recebido |
|---|---|---|---|---|
| 15:36:49 | Astaroth, Level 88 (multi 108) | 380 | 410 | ❌ 409 |
| 15:42:22 | Astaroth, Level 88, com Asas do Inferno (multi 113) | 427 | 482 | ❌ 481 |
| 15:47:57 | Titã, Level 140 (multi 113) | 565 | 638 | ❌ 639 |

A causa não é o truncamento do delta, e sim em que ordem entram o EF_HPADD e a transformação:
- o BM novo tem +5% de EF_HPADD no equipamento inicial (Robe 1406 com 4 e Calça 1409 com 1, BaseMob/BM);
- o legado aplica o EF_HPADD antes do laço dos affects (`Basedef.cpp:3886-3895`) e multiplica pela transformação o HP que já tem os 5% (`Basedef.cpp:4194-4200`): `⌊H×multi/100⌋`, com H o HP mostrado;
- o Go guarda o HP sem os 5% (M), soma a transformação sobre ele (`handler/transform.go:137`) e só aplica o EF_HPADD na leitura (`handler/item.go:2397`, `effectiveMaxHP`): `⌊⌊M×multi/100⌋×105/100⌋`.

Com M = 362, 407 e 539, a conta do Go dá exatamente 409, 481 e 639. Ela também explica os 4 casos de hoje que passam (Lobisomem e Homem-Urso, com e sem a passiva, em que os dois truncamentos coincidem) e o Astaroth com Asas do Inferno de 2026-10-17 que tinha ficado inconclusivo (429 → 485, legado 484). Ainda sem issue. Uma correção possível é aplicar o multiplicador da transformação sobre `MaxHP×(100+HpAddPct)/100`, ou levar o EF_HPADD para antes dos affects, como o legado.

O Assalto do TK (`affect_score.go:144`) também multiplica o HP sem o EF_HPADD. Isso fica para o reteste do cenário 11.

## O mesmo no Assalto do TransKnight (cenário 11)

O Assalto (skill 11, affect 13) faz `MaxHp×9/10` no legado (`Basedef.cpp:4036`) e `MaxHP − MaxHP/10` no Go (`affect_score.go:144`).

| UTC | Base M | Legado (com o EF_HPADD +5%) | Recebido |
|---|---|---|---|
| 22:56:47 | 435 | 410 | 411 |
| 23:27:53 | 1103 | 1041 | 1042 |

Registrado no mesmo [#394](https://github.com/Jean1dev/w2pp-OpenWYD/issues/394) ([comentário](https://github.com/Jean1dev/w2pp-OpenWYD/issues/394#issuecomment-6242824400)). A verificação é `npm run scenario:tk-2 -- --skill 11`.

## Como verificar

`npm run scenario:bm-transformacao -- --skill 64,65`: as verificações `acExact` e `maxHpExact` comparam com o `X×multi/100` do legado.
