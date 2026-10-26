# 004 — Julgamento Divino com vários alvos soma o HP já reduzido da Foema

**Status:** corrigido no [#415](https://github.com/Jean1dev/w2pp-OpenWYD/pull/415) (issue [~~#392~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/392)). O reteste no Railway passou em 2026-10-26 (`reports/2026-10-26T14-05-54-749Z-foema-white-magic`), ver abaixo.

Confirmado no Railway em 2026-10-17 (execução `reports/2026-10-17T18-20-46-757Z-foema-white-magic`).
**Issue:** [Jean1dev/w2pp-OpenWYD#392](https://github.com/Jean1dev/w2pp-OpenWYD/issues/392)
**Cenário:** `npm run scenario:foema-white -- --skill 30`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `d896ae2f`)

## O que aconteceu

O Julgamento Divino (skill 30) soma o HP da Foema ao dano e a deixa com HP/6 + 1.
- **Legado:** guarda o HP uma vez, antes do laço dos alvos (`_MSG_Attack.cpp:281`), e soma esse valor a todos os alvos (`:1028-1033`).
- **Go:** soma o `e.HP` atual dentro do laço (`handler/combat.go:709-715`). Do 2º alvo em diante, o HP já caiu para um sexto.

Às 18:21:47 UTC, a Foema `bot05clvd48c` (nível exibido 220, Int 868, Special[1] 200, 768 de HP) acertou dois Gremlins com a mesma AC:

| | Dano | − 768 (legado) | − 129 (Go) |
|---|---|---|---|
| 1º | 2875 | 2107 | — |
| 2º | 2449 | 1681 ❌ | 2320 ✅ |

O dano base possível nesse Gremlin vai de 1914 a 2339:
- `SkillBaseDamage` 1136 × 5/4 = 1420;
- `SkillDamage` 90–110%;
- resistência ×1,5.

Só a hipótese do Go cabe na faixa. O HP final (22) é igual nas duas versões. O Go também manda um `SetHpMp` por alvo, e o legado manda um só.

## O que funciona (Magia Branca, cenário 7)

| Skill | Recusa um nível antes | Aprendida no nível exibido | Cast |
|---|---|---|---|
| 24 Flecha Mágica | ✅ `NotEnoughSkillPoint` no 4 | 5 | ✅ 57 de dano, MP 5 |
| 25 Desintoxicar | ✅ `ReqNotMet` no 19 | 20 | ✅ sem dano, MP 12 (tirar um debuff não foi exercitado) |
| 26 Flash | ✅ no 40 | 41 | ✅ sem dano, MP 40; o alvo parou de atacar (1 ataque antes, 0 depois) |
| 27 Cura | ✅ no 56 | 57 | ✅ +500 (2×200 + 100): HP 129 → 629 |
| 28 Choque Divino | ✅ no 82 | 83 | ✅ 1021 de dano, MP 42 |
| 29 Recuperar | ✅ no 98 | 99 | ✅ +450 (3×200/2 + 150): HP 129 → 579 |
| 30 Julgamento Divino | ✅ no 132 | 133 | ✅ 1 alvo: dano > HP e HP/6 + 1; ❌ 2 alvos (acima) |

- **Controles:** Desintoxicar ainda não aprendido, sem MP e alvo a 9 tiles (alcance 6). ✅
- **Compra da skill como item:** o Foema_Ancian deu a skill 5025 (Desintoxicar) pelo `MSG_Buy`. É o mesmo problema do finding 003 ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Renascimento sem os 50M:** `NotEnoughCoin`. ✅
- **Relogin:** Learn 0x7F e SkillBonus 281. ✅

## Reteste (2026-10-26)

Com o deploy de main de 12:49Z, que traz o #415, o Go guarda o HP da Foema antes do laço (`cast.casterHP`, `handler/combat.go:170`) e soma esse valor em todos os alvos (`:740`). Às 14:24:01 UTC, a Foema `bot0e0kcmjg6` (nível exibido 133, Special[1] 180, 495 de HP) acertou dois Gremlins com a mesma AC:

| | Dano | − 495 (legado) | − 83 (HP já reduzido) |
|---|---|---|---|
| 1º | 2113 | 1618 | — |
| 2º | 2197 | 1702 ✅ | 2114 ❌ |

- Com o 1º alvo, a faixa do dano base do 2º vai de 1323 (90/110) a 1977 (110/90). Só a soma do HP de antes cabe nela.
- O HP final foi 14 (495 → 83 → 14), e veio um `SetHpMp` só, depois do laço, como no legado (`_MSG_Attack.cpp:1749`).
- O MP debitado foi 285 (150 × (180/2 + 100)/100).

O resto do cenário 7 também passou, inclusive a compra da skill como item (finding 003).

## Como verificar

`npm run scenario:foema-white -- --skill 30`: a verificação `hpBonusEveryTarget` passa quando o dano base de cada alvo depois do primeiro (dano − HP de antes) fica em pelo menos 90/110 do dano base do primeiro.
