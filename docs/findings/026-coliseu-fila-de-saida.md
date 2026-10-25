# 026 — Coliseu: entrar na visão derruba a conexão (fila de saída de 64 frames)

**Situação (2026-10-23): confirmado no Railway, com o cliente real e com o bot.**

**Status:** aberto.
**Issue:** [Jean1dev/w2pp-OpenWYD#419](https://github.com/Jean1dev/w2pp-OpenWYD/issues/419)
**Cenário:** `npm run scenario:coliseu -- --case CL-05` (ou `--no-db --case CL-05` com o banco saturado)
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `5340a445`)

## O que acontece

Caminhando de Azran para leste até o Coliseu (Regions.txt:19 `{2589,1671,2681,1785}`), o jogador cai com "disconnect from server". Um `MSG_Action` traz para a visão ~160 mobs de uma vez, e o servidor enfileira um CreateMob (0x0364, 220 B) para cada um no mesmo tick. A fila de saída lota e o servidor derruba a sessão:

| Quem | Horário (UTC) | Onde | Log do tm-server |
|---|---|---|---|
| `testeup` (HT, cliente real) | 13:58:33.219 | a leste de (2500,1718), após `/azran` | `session out queue full; dropping connection conn=1` · `frames=181 … 0x0364:127` |
| bot, CL-05 (passos de 7) | 14:02:25.657 | (2603,1726) | `session out queue full; dropping connection conn=1` · `frames=428 … 0x0364:200` |

Com passos de 4 tiles (CL-01 a CL-04, `reports/2026-10-23T13-4*-quest-90`), o bot faz ida e volta sem cair. O pico foi de 61 CreateMob em um segundo, logo abaixo do limite. Pausar a leitura do socket por 2 s (CL-03) não derruba: o buffer TCP absorve. O gatilho é o tamanho do delta de visão num único tick, não um cliente lento.

## Comportamento esperado (legado)

- `Source/Code/CPSock.h:36`: `SEND_BUFFER_SIZE` = 128 KB por socket.
- `CPSock.cpp:513-520` (`AddMessage`): só falha ao passar de 128 KB. 200 CreateMob ≈ 44 KB cabem.
- Os geradores do Coliseu (`MinuteGenerate<=0`) só nascem por evento, então a área fica vazia fora dele.

## Comportamento atual (Go)

- `tmserver/internal/world/world.go:202`: `OutBuffer` padrão de 64 frames. `cmd/tmserver/main.go` não configura esse valor.
- `world.go:640-658` (`enqueue`): com o canal cheio, chama `dropSession`.
- `cmd/tmserver/main.go:404-409` (`spawnNPCs`): popula todos os geradores no boot, inclusive os do Coliseu.

## Onde corrigir

- Limitar a fila de saída por bytes, como o legado (128 KB), ou subir bastante o `OutBuffer` e torná-lo configurável.
- Opcional: não popular os geradores do Coliseu no boot.
