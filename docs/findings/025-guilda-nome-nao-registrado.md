# 025 — Guilda: o /create não registra o nome; o /nick mostra "nao registrada"

**Situação (2026-10-23): corrigido em w2pp-OpenWYD#418 (deploy 4b661398); reteste no Railway pendente (banco saturado).**

**Status:** corrigido, sem reteste.
**Issue:** [Jean1dev/w2pp-OpenWYD#417](https://github.com/Jean1dev/w2pp-OpenWYD/issues/417), fechada por [#418](https://github.com/Jean1dev/w2pp-OpenWYD/pull/418)
**Cenário:** `npm run scenario:guild` (caso GD-08 em [docs/guild.md](../guild.md))
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `55cbf4a3`)

## O que acontece

Confirmado no Railway em 2026-10-23 (`reports/2026-10-23T12-00-30-412Z-guild`). GD-01 a GD-07 passam: criar, recrutar, promover a
sub-líder, recrutar pelo sub-líder, e persistir no relogin. Só o nome da guilda fica fora do registro do mundo:

| Caso | Horário (UTC) | Ação | Legado | Go |
|---|---|---|---|---|
| GD-02 | 12:13:44 | `/create gd778tpggn` | guilda criada; nome registrado na hora; `_SN_CREATEGUILD` | guilda 3 criada (banco, CreateMob cargo 9, −100M); MessagePanel vazio |
| GD-08 | 12:20:39 | `/nick <líder>` | nome da guilda | `bot0c0vbyw0a [Guild #3 (nao registrada)] Cidadania: 1 / Fama: 0` |

## Comportamento esperado (legado)

- `Source/Code/TMSrv/_MSG_MessageWhisper.cpp:248-292`: grava em `Guilds.txt`, `CReadFiles::WriteGuild()` e
  `BASE_InitializeGuildName()`. O nome vale sem reiniciar.

## Comportamento atual (Go)

- `tmserver/internal/handler/guild.go:96-118` (`createGuild`): o callback não chama `w.SetGuildName`.
- O nome só entra no boot (`guild_state.go:81`). O `showNick` (`chat.go:686-693`) cai em "Guild #N (nao registrada)".

## Onde corrigir

No callback do `createGuild`: `w.SetGuildName(guild.ID, name)`. O MessagePanel vazio no lugar de `_SN_CREATEGUILD` só fica registrado
aqui; não reprova caso.

## Reteste (2026-10-23)

- Correção: `w.SetGuildName(guild.ID, name)` no callback do `createGuild`, com o teste `TestGuildCreateRegistersName` (`chat_test.go`). Merge `4b661398`, no ar no Railway às 12:44 UTC.
- 12:44–13:10 UTC (`reports/2026-10-23T12-44-56-589Z-guild`): nenhum caso rodou. O seed esperou ~25 min por uma conexão ("too many connections", 53300) e desistiu antes de criar o primeiro personagem. Ao mesmo tempo rodava a `quest -- 15` de outra sessão.
- O cenário cria uma guilda depois do boot, então o reteste cobre a correção, e não o `SetGuildName` do boot.
- Pendente: rodar `npm run scenario:guild` com o banco livre. Desde então, o bot desiste do banco em 5 min (README, "Banco saturado").
