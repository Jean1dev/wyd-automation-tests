# 026 — Coliseu: entrar na visão derruba a conexão (fila de saída de 64 frames)

**Situação (2026-10-26): corrigido.** O [w2pp-OpenWYD#428](https://github.com/Jean1dev/w2pp-OpenWYD/pull/428) foi mergeado (`33ecc76b`), com deploy no Railway às 11:41:45 UTC. O `testeup` foi até o Coliseu e voltou sem cair.

**Status:** corrigido.
**Issue:** [Jean1dev/w2pp-OpenWYD#419](https://github.com/Jean1dev/w2pp-OpenWYD/issues/419)
**Cenário:** `npm run scenario:coliseu -- --case CL-05` (ou `--no-db --case CL-05` com o banco saturado)
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `5340a445`)

## O que acontece

Caminhando de Azran para leste até o Coliseu (Regions.txt:19 `{2589,1671,2681,1785}`), o jogador cai com "disconnect from server". Um `MSG_Action` traz para a visão ~160 mobs de uma vez, e o servidor enfileira um CreateMob (0x0364, 220 B) para cada um no mesmo tick. A fila de saída lota e o servidor derruba a sessão:

| Quem | Horário (UTC) | Onde | Log do tm-server |
|---|---|---|---|
| `testeup` (HT, cliente real) | 13:58:33.219 | a leste de (2500,1718), após `/azran` | `session out queue full; dropping connection conn=1` · `frames=181 … 0x0364:127` |
| bot, CL-05 (passos de 7) | 14:02:25.657 | (2603,1726) | `session out queue full; dropping connection conn=1` · `frames=428 … 0x0364:200` |
| `testeup` (HT, cliente real), reteste 2026-10-26 | 11:06:59.967 | a leste de (2503,1715), ~27 s depois do login | high-water 37 → 44 → 49 → 64, depois `session out queue full; dropping connection conn=1` · `frames=396 … 0x0364:229 0x0165:140` |

### Reteste de 2026-10-26: ainda não corrigido

O usuário conseguiu andar um pouco mais antes de cair, mas isso foi só variação do trajeto. Nenhum commit em main mexeu na fila: no `8320279c`, `OutBuffer` continua em 64. `session out queue high` só registra recorde novo, então cada salto (37, 44, 49, ≥64) é um único tick de visão. O delta cresce conforme o jogador entra no Coliseu.

Achado secundário: depois do primeiro drop, o mesmo tick continua enfileirando na sessão morta. Saíram mais 12 linhas `dropping connection` para conn=1 às 11:06:59.968. Detalhes no [comentário da #419](https://github.com/Jean1dev/w2pp-OpenWYD/issues/419#issuecomment-6414744050).

### Reteste de 2026-10-26 após o #428: passa

O Go passou a limitar a fila por bytes não enviados (`DefaultOutBufferBytes` = 128 KB), como o legado. Um enqueue numa sessão já fechada virou no-op.

| Quem | Horário (UTC) | Log do tm-server |
|---|---|---|
| `testeup` (HT, cliente real) | 11:51:01 → 11:51:57 | sem `session out queue full`. `frames=1161 bytes=133392 out_high_water=83 out_high_water_bytes=19256 … 0x0364:426 0x0165:283`. A sessão terminou com `connection drop reason err=EOF` (o cliente fechou). |

O pico de 83 frames teria derrubado a sessão com o limite antigo de 64. Em bytes, ficou em 19 KB, bem abaixo dos 128 KB.

Com passos de 4 tiles (CL-01 a CL-04, `reports/2026-10-23T13-4*-quest-90`), o bot faz ida e volta sem cair. O pico foi de 61 CreateMob em um segundo, logo abaixo do limite. Pausar a leitura do socket por 2 s (CL-03) não derruba: o buffer TCP absorve. O gatilho é o tamanho do delta de visão num único tick, não um cliente lento.

## Comportamento esperado (legado)

- `Source/Code/CPSock.h:36`: `SEND_BUFFER_SIZE` = 128 KB por socket.
- `CPSock.cpp:513-520` (`AddMessage`): só falha ao passar de 128 KB. 200 CreateMob ≈ 44 KB cabem.
- Os geradores do Coliseu (`MinuteGenerate<=0`) só nascem por evento, então a área fica vazia fora dele.

## Comportamento antes da correção (Go)

- `tmserver/internal/world/world.go:202`: `OutBuffer` padrão de 64 frames. `cmd/tmserver/main.go` não configura esse valor.
- `world.go:640-658` (`enqueue`): com o canal cheio, chama `dropSession`.
- `cmd/tmserver/main.go:404-409` (`spawnNPCs`): popula todos os geradores no boot, inclusive os do Coliseu.

## Onde corrigir

- Limitar a fila de saída por bytes, como o legado (128 KB), ou subir bastante o `OutBuffer` e torná-lo configurável.
- Opcional: não popular os geradores do Coliseu no boot.
