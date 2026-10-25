# 026 — PvP: o golpe em alvo sem K passa nos tiles 0x40

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#420](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420) (relacionada à #67)
**Cenário:** `npm run quest -- 15 --case PV-01 --case PV-02 --case PV-03 --case DU-03` (casos em [docs/quests/15-pvp-duelo.md](../quests/15-pvp-duelo.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `4b661398`)

## O que acontece

Confirmado no Railway em 2026-10-23. A (nível 300, com K) acerta B (nível 50, sem K e sem Guilty) parado ao lado:

| Caso | Horário (UTC) | Onde | Golpes (dano: HP de B) |
|---|---|---|---|
| PV-02 | 11:17 | arena de Armia (2135,2147), tile `0x40` | 771: 945→253, 778: 253→0 |
| DU-03 | 14:43 | arena do duelo, tile `0x44` | 763: 945→182, 816: 261→0 |

Controles que passam: PV-01 (ninguém com K, dano 0) e PV-03 (os dois com K, o dano entra).

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Attack.cpp:405-419`: zera o golpe quando o tile do **atacante** tem o bit `0x40` do AttributeMap e o alvo está sem K e sem Guilty.
- Fora dos tiles `0x40` (a praça é `0x01`, o campo é `0x00`) o servidor não bloqueia.

## Comportamento atual (Go)

- `tmserver/internal/handler/combat.go:223` exige o K do atacante em todo lugar e não olha nem o alvo nem o AttributeMap.
- No duelo, `dueling()` libera o golpe.

## Onde corrigir

No gate do `combat.go:223`, ler `d.attrs` no tile do atacante (o Go já carrega o AttributeMap, `combat.go:946`). Não é o mesmo problema da #67, que nasceu do retângulo de cidade.
