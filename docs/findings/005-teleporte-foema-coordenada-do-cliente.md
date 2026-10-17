# 005 — O Teleporte da Foema leva o alvo para a coordenada que o cliente manda

**Status:** aberto. Confirmado no Railway em 2026-10-17 (execução `reports/2026-10-17T18-32-29-064Z-foema-special-magic`).
**Issue:** [Jean1dev/w2pp-OpenWYD#393](https://github.com/Jean1dev/w2pp-OpenWYD/issues/393)
**Cenário:** `npm run scenario:foema-special -- --skill 42`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `d896ae2f`)

## O que aconteceu

O Teleporte (skill 42, InstanceType 9) puxa o alvo para junto da Foema. No legado, o destino é a posição da Foema no servidor, `DoSummon(idx, pMob[conn].TargetX, pMob[conn].TargetY)` (`_MSG_Attack.cpp:781`). Antes disso, o legado confere:
- se o alvo está vivo;
- se o tile da Foema não tem o atributo 0x4;
- se o HP do alvo não passa do HP da Foema + Special + 30;
- se a posição do alvo é válida.

O Go usa o `TargetX/TargetY` do pacote (`handler/combat.go:915-932`, `applyFoemaSummon`) e não faz essas checagens. O Teleporte custa 0 de MP e aceita a própria Foema como alvo.

Às 18:37:35 UTC a Foema `bot06f6ashwa`, em (2195,2108), usou o Teleporte em si mesma com (2210,2118) no pacote. O servidor a teleportou para **(2210,2118)**, 15 tiles adiante. Com a própria posição no pacote, ela foi para a célula livre ao lado, (2195,2108).

## O que funciona (Magia Especial, cenário 8)

| Skill | Recusa um nível antes | Aprendida no nível exibido | Cast |
|---|---|---|---|
| 40 Névoa Venenosa | ✅ `NotEnoughSkillPoint` no 8 | 9 | ✅ 78 de dano, MP 9 |
| 41 Velocidade | ✅ no 21 | 22 | ✅ affect 2; corrida 4 → 5 |
| 42 Teleporte | ✅ no 39 | 40 | ❌ vai para a coordenada do pacote (acima) |
| 43 Escudo Mágico | ✅ no 60 | 61 | ✅ affect 11; AC +15 (Level/3 + 15) |
| 44 Arma Mágica | ✅ no 85 | 86 | ✅ affect 9; dano +471 ((60×5/20 + 90)×3/2, ×3 com o Escudo aprendido) |
| 45 Toque de Athena | ✅ no 109 | 110 | ✅ affect 15; as 4 maestrias +14 (76/10 + 7) |
| 46 Controle de Mana | ✅ `ReqNotMet` no 140 | 141 | ✅ affect 18 (o dano virar gasto de MP não foi exercitado) |

- **Controles:** Velocidade ainda não aprendida, sem MP e alvo a 9 tiles (alcance 6). ✅
- **Compra da skill como item:** o Foema_Ancian deu a skill 5041 pelo `MSG_Buy` ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Cancelamento sem os 50M:** `NotEnoughCoin`. ✅
- **Relogin:** Learn 0x7F0000 e SkillBonus 269. ✅

Duas diferenças do legado, vistas só na leitura do código, que o cenário não observa:
- a Arma Mágica (affect 9) do Go não soma o `DAMAGEMULTI` (+5, e +10 numa Foema com o bit 19), que o legado soma em `Basedef.cpp:4004-4012`;
- o Toque de Athena (affect 15) limita a maestria a 400 na leitura; o legado limita o Special[0] a 200 e os demais a 255.

## Como verificar

`npm run scenario:foema-special -- --skill 42`: a verificação `noRemoteTeleport` passa quando o Teleporte em si mesma, com outra coordenada no pacote, não move a Foema mais de 2 tiles.
