# 006 — A transformação do BM com multiplicador abaixo de 100 arredonda diferente do legado

**Status:** aberto. Confirmado no Railway em 2026-10-17 (execução `reports/2026-10-17T19-39-11-741Z-bm-transform`).
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

## Como verificar

`npm run scenario:bm-transformacao -- --skill 64,65`: as verificações `acExact` e `maxHpExact` comparam com o `X×multi/100` do legado.
