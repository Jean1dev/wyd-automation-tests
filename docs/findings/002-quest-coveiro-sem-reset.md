# 002 — Quest do Coveiro (e demais arenas da Quest 256) sem reset no servidor Go

**Status:** **corrigido** por [w2pp-OpenWYD#388](https://github.com/Jean1dev/w2pp-OpenWYD/pull/388) e verificado no Railway em 2026-10-17 (`reports/2026-10-17T12-59-21-572Z-coveiro-quest`). A entrega teleportou para a arena às 13:00:43 UTC, e o reset mandou o personagem para Armia (2096,2107) às 13:01:43, 10 min depois do boot do tm-server (deploy às 12:51:46). O `MSG_StartTime` ficou fora do escopo da correção.

**Antes da correção:** confirmado no Railway em 2026-10-16 (execução `reports/2026-10-16T22-58-44-311Z-coveiro-quest`). O personagem entregou a Vela do Coveiro às 23:02:27 UTC e foi teleportado para dentro da arena. Ficou lá, vivo, até o fim da janela de espera às 00:02:00 UTC, **59,5 min** sem ser mandado de volta. A janela passou pela virada da hora (00:00 UTC), e nesse intervalo o legado teria resetado pelo menos cinco vezes.
**Issue:** [Jean1dev/w2pp-OpenWYD#386](https://github.com/Jean1dev/w2pp-OpenWYD/issues/386)
**Cenário:** `npm run scenario:coveiro`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `4181ce3`)

## O que funciona

| Verificação | Resultado |
|---|---|
| Poeira de Fada (4142) comprada na Evolução: pilha de 255 por 5000 gold | ✅ |
| Cada Poeira de Fada sobe exatamente +1 nível (exibido 1 → 40 em 39 usos) | ✅ |
| Coveiro sem a vela: recusa (MessageBoxOk 15, `NoticeReqNotMet`) e não teleporta | ✅ |
| Entrar a pé na arena sem QuestFlag: o guarda manda para Armia (2100,2095) | ✅ |
| Vela do Coveiro (4038) comprada de graça na Aki | ✅ |
| Entregar a vela ao Coveiro: teleporta para (2398,2105), dentro da arena, e consome a vela | ✅ |
| **Reset da quest manda o personagem de volta** | ❌ 59,5 min dentro da arena, passando por 00:00 UTC, sem teleporte e sem `MSG_StartTime` |

## Comportamento esperado (legado)

`Source/Code/TMSrv/ProcessSecMinTimer.cpp:560-577`, no `ProcessSecTimer`:

```cpp
if(SecCounter % 1200 == 0)
{
    ClearAreaQuest(2379, 2076, 2426, 2133);// Coveiro
    ClearAreaQuest(2232, 1564, 2263, 1592);// Capa Verde
    ClearAreaQuest(2640, 1966, 2670, 2004);//Reset habilidades
    ClearAreaQuest(2228, 1700, 2257, 1728);//Carbuncle
    ClearAreaQuest(1950, 1586, 1988, 1614);//Reset habilidades
    ClearAreaQuest(459, 3887, 497, 3916);//Kaizen
    ClearAreaQuest(658, 3728, 703, 3762);//Hidras
    ClearAreaQuest(1312, 4027, 1348, 4055);//Elfos
    ClearAreaQuest(793, 4046, 827, 4080);//Quest Gargula
    ClearArea(3570, 3446, 3965, 3711);//Lanhouse
    for (int x = 1; x < MAX_USER; x++)
        if (pMob[x].QuestFlag && pUser[x].Mode == USER_PLAY)
            pMob[x].QuestFlag = 0;
}
```

- O `SecCounter` sobe a cada `TIMER_SEC` de **500 ms** (`Server.cpp:4086`, `ProcessSecMinTimer.cpp:123`). Então 1200 ticks dão **10 min, contados a partir do boot do servidor**. O reset não acontece no minuto 00 do relógio: ele cai em qualquer minuto, conforme a hora em que o servidor subiu.
- `ClearAreaQuest` (`Server.cpp:6263-6285`) pega todo jogador dentro do retângulo. Se ele estiver morto, revive com HP 2 (`SendScore`). Depois zera o `QuestFlag` e chama `DoRecall`, que manda o jogador para o spawn da cidade.
- Depois disso o `QuestFlag` de todos os jogadores é zerado. Quem continuar na arena é expulso pelo guarda (`ProcessSecMinTimer.cpp:1659`).

## Comportamento atual (Go)

- `handler/misc.go`: `quest256NPC` e `teleportQuest256Step` ligam o `QuestFlag` e teleportam. Essa parte está certa.
- `handler/mobai.go:133-146`: `guardQuest256Areas` expulsa quem está na arena **sem** o flag.
- **Nada zera o `QuestFlag` periodicamente nem expulsa quem está na arena com o flag.** O único `e.QuestFlag = 0` do tmServer fica no próprio `recall` (`handler/character.go:738`). Não existe equivalente a `ClearAreaQuest`.

O resultado é que, depois de entrar com a vela, o jogador fica na arena da Quest 256 por tempo indefinido. O mesmo vale para as outras arenas (Jardineiro/Carbuncle, Kaizen, Hidra, Elfos) e para as áreas Capa Verde, Reset de habilidades e Gárgula.

## Onde corrigir

No tick do mundo (`handler/mobai.go` `Tick`, que roda a cada 1 s), adicionar um contador. A cada 600 ticks (10 min), percorrer as áreas da lista legada e, para cada jogador dentro de uma delas:

1. se `HP <= 0`, colocar HP 2 e mandar o score;
2. zerar o `QuestFlag` e chamar `d.recall(w, s, e)`.

Depois, zerar o `QuestFlag` de todos os jogadores, como no legado. Vale considerar mandar o `MSG_StartTime` (0x03A1) com o tempo restante, que o cliente usa para mostrar o contador da arena.

## Como verificar

`npm run scenario:coveiro -- --phase handin` com o personagem do cenário (nível exibido ≥ 40). O teste passa quando o personagem é teleportado para fora da arena dentro da janela de espera. A janela vai até o maior entre a entrada + 12 min e a próxima hh:00 + 2 min. O `report.json` registra o horário UTC, o minuto e os segundos desde a entrada.
