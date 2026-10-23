# Guilda: criar, recrutar, sub-líder e recrutamento pelo sub-líder

Casos do cenário 12 (`npm run scenario:guild`, `src/scenarios/guild.ts`).

Fontes: `Jean1dev/w2pp-OpenWYD`, lido em 2026-10-22 em `origin/main` `55cbf4a3`.
- Legado: `Source/Code/TMSrv/*.cpp`.
- Go: `tmserver/internal/handler/guild.go` e `chat.go`.

## Como o jogo faz

Não há NPC de guilda. A guilda é criada e administrada por comandos de chat, que o cliente manda como cochicho (`MSG_MessageWhisper` 0x0334, `MobName` = comando sem a barra, `String` = argumentos). O recrutamento é um pacote próprio.

| Ação | Pacote | Quem | Custo | Efeito | Legado | Go |
|---|---|---|---|---|---|---|
| Criar | `/create <nome>` | sem guilda, Clan 7/8, cidadão; não aos domingos | 100M | `Guild = id`, `GuildLevel = 9` | `_MSG_MessageWhisper.cpp:187-298` | `guild.go:75-120` |
| Recrutar | `_MSG_InviteGuild` 0x03D5, `MSG_STANDARDPARM2` {TargetID, InviteType 0} | cargo ≠ 0 (líder ou sub-líder); alvo sem guilda e do mesmo Clan | 4M de quem convida | alvo entra direto, cargo 0, sem aceite | `_MSG_InviteGuild.cpp:21-99` | `guild.go:23-73` |
| Promover | `/subcreate <nome>` | só o líder (9); alvo online, da guilda, cargo 0 | 100M | alvo vira 6, 7 ou 8 (no máximo 3 sub-líderes) | `_MSG_MessageWhisper.cpp:300-393` | `guild.go:129-203` |

- **Cargos (`MOB.GuildLevel`):** 0 membro · 6/7/8 sub-líder 1/2/3 · 9 líder. No fio, o cargo vai no `GuildMemberType` do CreateMob (body 120, com a Guild u16 no body 118).
- **Confirmação no Go:** o `refreshGuildTag` manda o CreateMob novo ao próprio alvo e a quem o vê; quem pagou recebe o UpdateEtc com o gold novo. A recusa é calada, exceto sem gold (BoxOk 22).
- **`/subcreate` no Go:** põe líder e alvo em `UserWaitDB` até o banco responder. Um convite mandado nesse meio-tempo é descartado, então o cenário espera o CreateMob de sub-líder antes do próximo passo.
- **Banco (Go):** tabela `guild` (id, name UNIQUE, clan, citizen) e `guild_member` (guild_id, character_id, name, guild_level), da migração `0012_guild_system`; colunas `character.guild_id` e `guild_level`.

## Divergências vistas na leitura (suspeitas)

- O `/create` do Go não registra o nome da guilda na memória (`guild.go:108-117`; só o boot faz `SetGuildName`, `guild_state.go:81`). O `/nick` mostra "Guild #N (nao registrada)" até o servidor reiniciar. O GD-08 cobre isso.
- O Go manda MessagePanel vazio onde o legado manda texto (`_SN_CREATEGUILD`, `_SN_JOINGUILD`). O cenário só registra os textos e não reprova por eles.
- O nome aceita até 16 bytes no Go. O legado corta em 12 (`GUILDNAME_LENGTH`). O cenário usa nomes de 10.

## Casos

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado | Tipo |
|---|---|---|---|---|---|
| GD-01 | Criar sem gold | X: 50M, Clan 7, cidadão | `/create` | BoxOk 22; sem guilda; gold igual; nada no banco | controle |
| GD-02 | Criar guilda | L: 300M | `/create <nome>` | CreateMob de L com a guilda e cargo 9; −100M; `guild` e `guild_member` (L, 9) | feliz |
| GD-03 | Recrutar membro | GD-02 | L: InviteGuild(S) | S com a guilda e cargo 0; L −4M; `guild_member` (S, 0) | feliz |
| GD-04 | Membro não recruta | GD-03 | S (cargo 0): InviteGuild(X) | X segue sem guilda; S não paga | controle |
| GD-05 | Promover a sub-líder | GD-03 | L: `/subcreate <S>` | S com cargo 6..8; L −100M; `guild_member` (S, 6..8) | feliz |
| GD-06 | Sub-líder recruta | GD-05; S: 10M | S: InviteGuild(R) | R com a guilda e cargo 0; S −4M; `guild_member` (R, 0) | feliz |
| GD-07 | Persistência | GD-06 | os quatro relogam | `character.guild_id`/`guild_level` L 9, S 6..8, R 0, X sem guilda; gold do banco = gold ao vivo; CreateMob visto pelos outros igual | feliz |
| GD-08 | Nome registrado | GD-02 | L: `/nick <L>` | a linha traz o nome da guilda | borda |
