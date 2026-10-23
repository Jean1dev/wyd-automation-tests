# 025 — Guilda: o /create não registra o nome; o /nick mostra "nao registrada"

**Situação (2026-10-23): aberto em w2pp-OpenWYD#417.**

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#417](https://github.com/Jean1dev/w2pp-OpenWYD/issues/417)
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
