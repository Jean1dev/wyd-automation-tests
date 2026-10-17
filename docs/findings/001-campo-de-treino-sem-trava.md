# 001 — Campo de Treino sem trava de nível no servidor Go

**Status:** **corrigido** por [w2pp-OpenWYD#388](https://github.com/Jean1dev/w2pp-OpenWYD/pull/388) e verificado no Railway em 2026-10-17 (`reports/2026-10-17T13-17-57-271Z-training-field-lv35`). O exibido 35 entra; o exibido 36 recebe "Somente nível 35 ou inferior pode entrar no campo de treinamento." e é teleportado para Armia (2091,2101).

**Antes da correção:** confirmado no Railway em 2026-10-16 (execuções `reports/2026-10-16T21-07-12-674Z-training-field-lv35` e `reports/2026-10-16T22-06-51-007Z-training-field-lv35`): o personagem com nível exibido 36 entrou no campo em (2100, 2032) sem mensagem nem teleporte. O PR [w2pp-OpenWYD#384](https://github.com/Jean1dev/w2pp-OpenWYD/pull/384) corrigiu a exp do campo, mas deixou a trava fora do escopo. Issue: [w2pp-OpenWYD#385](https://github.com/Jean1dev/w2pp-OpenWYD/issues/385).
**Cenário:** `npm run scenario:training-field`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (commit inspecionado `931f097`)

## Comportamento esperado (legado)

`Source/Code/TMSrv/_MSG_Action.cpp:213-221`, executado em todo movimento:

```cpp
if (mapAttribute & 0x80 && (Level >= 35 && Level <= 999 || ClassMaster != MORTAL)) {
    SendClientMessage(conn, g_pMessageStringTable[_NN_Newbie_zone]);
    DoTeleport(conn, 2091 + rand() % 3, 2101 + rand() % 3); // teleporta pra armia
    return;
}
```

- `mapAttribute & 0x80` são as células "Newbie Zone" do `AttributeMap.dat`: o Campo de Treino, X 2064–2159, Y 1932–2051, ao norte de Armia.
- `Level` é o nível **armazenado** (o cliente exibe +1). Até o nível exibido 35 o personagem entra; a partir do **exibido 36** ele é barrado. Personagens não mortais são sempre barrados.
- Mensagem #46 de `Language.txt`: "Somente nível 35 ou inferior pode entrar no campo de treinamento."
- O personagem é teleportado para Armia em (2091–2093, 2101–2103).

## Comportamento atual (Go)

`tmserver/internal/handler/movement.go` (`action`) valida o estado de jogo, a janela de tick, os limites do mapa, o castelo e a quest das runas, mas **nunca lê o bit 0x80** do atributo do destino. O `AttributeMap` só é carregado para o pathfinding dos mobs (`cmd/tmserver/main.go:632`, `route.Bake`). Não há uso de `_NN_Newbie_zone` nem de (2091, 2101) no tmServer.

Resultado: um personagem com qualquer nível anda para dentro do Campo de Treino sem mensagem nem teleporte.

## Onde corrigir

Em `handler/movement.go`, depois da checagem de limites e antes de `w.SetEntityPos`:

1. Ler o atributo do destino (`attr[TargetY/4][TargetX/4]`).
2. Se tiver o bit `0x80` e (`e.Level >= 35 && e.Level <= 999` ou `e.ClassMaster != MORTAL`):
   - enviar o `MSG_MessagePanel` com o texto #46 (`sendClientMessage`);
   - chamar `d.doTeleport(w, s, 2091+rand%3, 2101+rand%3)`;
   - retornar sem mover.

## Como verificar

`npm run scenario:training-field -- --phase negative` com o personagem do cenário (nível exibido ≥ 36). O teste passa quando a tentativa de entrar resulta na mensagem #46 e/ou em um teleporte forçado (`MSG_Action` com `Effect=1`) para Armia, e o personagem não fica dentro do campo.
