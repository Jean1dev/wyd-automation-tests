**Situação (2026-10-22): corrigido em w2pp-OpenWYD#411 (2866b8c), verificado com `npm run quest -- 12`.**

# 019 — Rei: a Pedra Ideal (5338) não existe no Go

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406)
**Cenário:** `npm run quest -- 12 --case CE-01 --case CE-03` (casos em [docs/quests/12-celestial.md](../quests/12-celestial.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `b392705`)

## O que acontece

Confirmado no Railway em 2026-10-18 (`reports/2026-10-18T21-*-quest-12`). Personagem novo, Clan 0, 1742 no Equip[10],
1760 no Equip[11] e 5334–5337 nos slots 20–23, `MSG_Quest` com confirm 1 no Rei_Glantuar:

| Caso | Horário (UTC) | Personagem | Legado | Go |
|---|---|---|---|---|
| CE-01 | 21:04:24 | Arch exibido 356 | 5334 → 5338; 5335–5337, Equip[10] e Equip[11] somem | ❌ "Sao necessarias 13 safiras em pagamento exato."; banco igual |
| CE-03 | 21:08:28 | Mortal exibido 300 | idem, sem criar o Arch | ❌ cria o Arch (slot 1); as quatro pedras ficam no mortal |

O controle CE-02 (sem a 5337) passa: o Mortal vira Arch nos dois servidores.

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_Quest.cpp:769-840`: com as quatro Pedras Secretas, o Rei faz a 5338 e sai antes da criação do Arch (`:842`), para qualquer ClassMaster.

## Comportamento atual (Go)

- `tmserver/internal/handler/misc.go:262` `kingQuest`: só Mortal ≥ 299 com 1742 + Sephirot vai para o `kingArch`; o resto cai no `kingCapeService`.
- `misc.go:514-524`: o ramo das essências ficou de fora de propósito.

## Onde corrigir

No `kingQuest`, antes do `kingArch` e do serviço de capa. Detalhes na issue.
