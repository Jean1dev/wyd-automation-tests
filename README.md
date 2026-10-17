# wyd-automation-tests

Bots headless que automatizam casos de teste de gameplay do nosso WYD: o cliente web [w2pp-OpenWyd-WebClient](https://github.com/Jean1dev/w2pp-OpenWyd-WebClient) e o servidor Go [w2pp-OpenWYD](https://github.com/Jean1dev/w2pp-OpenWYD).

Os bots não usam navegador. Eles falam o protocolo CPSock direto com o tm-server por TCP, como um cliente, e jogam como um jogador comum, sem comandos de GM.

## Requisitos

- Node 22 ou mais novo.
- Uma conta comum de jogador no servidor de teste.

```
npm install
cp .env.example .env
npm run account:create     # cria uma conta no portal e preenche WYD_ACCOUNT/WYD_PASSWORD/WYD_PIN
npm run account:create -- --second   # segunda conta (WYD_ACCOUNT_B/WYD_PASSWORD_B), só para o cenário de troca
```

O `.env` aponta por padrão para o tm-server do Railway (`reseau.proxy.rlwy.net:56950`, versão de cliente 12000). Ele nunca vai para o Git.

## Verificações locais

```
npm run typecheck
npm test                   # codec contra os 97 vetores de transporte do webclient, pacotes e zona
```

## Cenário 1 — Campo de Treino até o nível 35

`npm run scenario:training-field`

1. Cria um personagem novo (classe de `WYD_CHAR_CLASS`) e confere que ele começa no nível exibido 1.
2. Sai de Armia, entra no Campo de Treino e upa até o nível exibido 35 matando os mobs do campo. Como um jogador comum, o bot distribui os pontos de atributo de cada nível (tudo em Str). A área e o alvo são escolhidos pela exp por segundo que o dano atual rende, calculada a partir do AC e do HP de cada mob. Um mob que não morre em 40 golpes fica de fora. O bot recua para descansar com HP baixo e revive se morrer.
3. **Controle positivo:** no nível exibido 35, sai para Armia e volta ao campo. Deve entrar normalmente.
4. Continua upando até o nível exibido 36.
5. **Controle negativo:** sai para Armia e tenta entrar de novo. Deve receber a mensagem "Somente nível 35 ou inferior pode entrar no campo de treinamento." e/ou ser teleportado para Armia, sem ficar dentro do campo.

Nível exibido = nível armazenado + 1. A regra legada barra o campo a partir do armazenado 35, isto é, do **exibido 36**.

O cenário é **retomável**. O estado fica em `state/training-field-lv35.json`; cada execução continua de onde a anterior parou.

| Opção | Efeito |
|---|---|
| `--budget 2h` | Tempo máximo desta execução (padrão: 60 min). Ao estourar, sai como "em progresso". |
| `--until-done` | Roda até concluir. |
| `--stall 10m` | Falha se ficar esse tempo sem ganhar exp (padrão: 10 min). |
| `--target-time 15m` | Meta de tempo de jogo do nível exibido 1 ao 35 (padrão: 15 min). O resultado sai em `timeToLevel35` no relatório. |
| `--phase negative` | Repete só a verificação final (exige personagem com nível exibido ≥ 36). |
| `--fresh` | Apaga o personagem e o estado e recomeça. |
| `--cleanup` | Apaga o personagem e o estado e sai. |

Códigos de saída: `0` passou ou ainda em progresso · `1` falhou · `3` erro de execução.

Cada execução grava `reports/<data>-training-field-lv35/` com `report.json` (veredito, verificações, curva de nível, kills e exp por mob) e `events.jsonl` (log sanitizado, sem senha nem PIN).

### Situação (2026-10-17): passa, trava corrigida

A trava foi corrigida em [Jean1dev/w2pp-OpenWYD#388](https://github.com/Jean1dev/w2pp-OpenWYD/pull/388). A execução de 2026-10-17 13:17–13:25 UTC (`--fresh --until-done`) **passou**:

| Verificação | Resultado |
|---|---|
| Começa no nível exibido 1 | ✅ |
| Nível exibido 35 em até 15 min | ✅ **6,2 min** |
| Controle positivo (o 35 entra no campo) | ✅ |
| Controle negativo (o 36 é barrado) | ✅ recebe "Somente nível 35 ou inferior pode entrar no campo de treinamento." e é teleportado para Armia (2091,2101) |

Como no legado, o personagem que vira 36 dentro do campo é mandado para Armia no primeiro passo. Na execução anterior, das 13:01, o bot tentava voltar pela rota de saída e era expulso de novo a cada ~13 s, até reconectar 7 min depois. Agora a saída trata esse teleporte como chegada a Armia.

### Antes da correção (2026-10-16): meta de tempo cumprida, trava ausente

Execução de 2026-10-16 22:06–22:15 UTC (`--fresh --until-done`), com o multiplicador de exp do campo no servidor ([Jean1dev/w2pp-OpenWYD#384](https://github.com/Jean1dev/w2pp-OpenWYD/pull/384)). Veredito: **falhou**, só pela trava.

| Verificação | Resultado |
|---|---|
| Começa no nível exibido 1 | ✅ |
| Nível exibido 35 em até 15 min | ✅ **6,6 min** (nível 30 com 4 min) |
| Controle positivo (o 35 entra no campo) | ✅ |
| Controle negativo (o 36 é barrado) | ❌ entrou em (2100, 2032) sem mensagem nem teleporte |

- **Exp do campo:** resolvida com o #384 junto com uma correção no bot. Na execução anterior, das 21:07, o nível 35 levou 25,5 min. O bot não distribuía os pontos de atributo, então terminou com dano 57 e gastou ~15 min em lutas abandonadas (40 golpes sem matar) contra Chefe_Krill e Orc_Arqueiro_, que têm AC alta. Distribuindo os pontos, o dano chega a ~126 no nível 35, e a escolha de alvo pela exp por segundo eliminou as desistências. Foram 60 kills e nenhuma desistência.
- **Trava ausente:** confirmada no Railway. Issue: [Jean1dev/w2pp-OpenWYD#385](https://github.com/Jean1dev/w2pp-OpenWYD/issues/385). Veja [docs/findings/001-campo-de-treino-sem-trava.md](docs/findings/001-campo-de-treino-sem-trava.md).

## Cenário 2 — Quest do Coveiro

`npm run scenario:coveiro`

1. **Nível 40.** Cria um personagem novo e o leva ao nível exibido 40 com a **Poeira de Fada**, que dá +1 nível por uso. A pilha de 255 custa 5000 gold na NPC Evolução, em Armia. O personagem novo já nasce com gold suficiente. Se faltar gold, o bot faz grind no Campo de Treino até juntar.
2. **Controles**, antes da entrega:
   - falar com o Coveiro (2375,2104) **sem** a vela não pode teleportar;
   - entrar a pé na arena, sem QuestFlag, deve mandar o personagem para a cidade.
3. Compra a **Vela do Coveiro** na Aki, em Armia. O preço é 0.
4. **Verificação A:** entrega a vela ao Coveiro. O personagem deve ser teleportado para dentro da arena, (2379,2076)–(2426,2133), e a vela deve sumir do inventário.
5. **Verificação B:** fica na arena até o reset da quest, que deve mandá-lo de volta para a cidade.
   - No legado o reset vem a cada 10 min contados do boot do servidor, não no minuto 00 (finding 002).
   - O bot espera até o maior entre a entrada + 12 min e a próxima hh:00 + 2 min, para cobrir as duas hipóteses.
   - A arena tem Aparição (nv 98) e Esqueleto (nv 84). O bot espera no canto mais longe dos spawns, em (2403,2131). Se morrer, continua lá sem reviver, porque o reset legado também revive e expulsa quem está morto.

O cenário é retomável (`state/coveiro-quest.json`), mas a espera do reset não: se a conexão cair dentro da arena, a tentativa recomeça na compra da vela. Isso acontece porque o QuestFlag não sobrevive ao relogin.

| Opção | Efeito |
|---|---|
| `--budget 2h` / `--until-done` / `--stall 10m` / `--fresh` / `--cleanup` | Como no cenário 1. A espera do reset sempre vai até o fim da janela. |
| `--phase handin` | Repete vela + entrega + reset (exige nível exibido ≥ 40). `--phase controls` repete também os controles. |
| `--reset-wait 20m` | Espera fixa pelo reset, contada da entrada na arena. |

Cada execução grava `reports/<data>-coveiro-quest/` com `report.json` (veredito e verificações; no reset, o horário UTC, o minuto e os segundos desde a entrada) e `events.jsonl`.

### Situação (2026-10-17): passa, reset corrigido

O reset foi corrigido em [Jean1dev/w2pp-OpenWYD#388](https://github.com/Jean1dev/w2pp-OpenWYD/pull/388), com deploy no Railway às 12:51:46 UTC. A execução de 2026-10-17 13:00 UTC (`--phase handin --reset-wait 12m`) **passou**:

- A: a entrega teleportou para a arena, em (2397,2104).
- B: o reset mandou o personagem para Armia (2096,2107) às 13:01:43 UTC, 59 s depois da entrada. Isso é 10 min depois do boot, como no legado. O `MSG_StartTime` continua ausente (ficou fora do escopo do #388).

Antes da correção, a execução de 2026-10-16 22:58 a 2026-10-17 00:02 UTC (`--until-done`) tinha **falhado**, só pelo reset:

| Verificação | Resultado |
|---|---|
| Nível exibido 40 com Poeira de Fada (+1 por uso) | ✅ em 0,9 min de jogo |
| Coveiro sem vela não teleporta | ✅ MessageBoxOk 15 |
| Intruso na arena volta para a cidade | ✅ teleportado para (2100,2095) |
| Vela do Coveiro de graça na Aki | ✅ |
| A: a entrega teleporta para a arena | ✅ (2398,2105), vela consumida |
| B: o reset manda de volta | ❌ 59,5 min vivo na arena, passando pela virada da hora (00:00 UTC), sem teleporte. O legado teria resetado pelo menos 5 vezes. |

O servidor Go não tinha o reset das áreas de quest. Issue: [Jean1dev/w2pp-OpenWYD#386](https://github.com/Jean1dev/w2pp-OpenWYD/issues/386). Veja [docs/findings/002-quest-coveiro-sem-reset.md](docs/findings/002-quest-coveiro-sem-reset.md).

## Cenário 3 — Troca entre jogadores

`npm run scenario:trade` (exige a segunda conta no `.env`)

1. Cada conta entra com um personagem: o A na conta principal e o B na `WYD_ACCOUNT_B`. Na primeira execução os personagens são criados, e depois são reaproveitados (`state/player-trade.json`).
2. Os dois vão até a Aki, em Armia, e ficam lado a lado. Ali o A compra a **Vela do Coveiro** (4038) e o B a **Colheita do Jardineiro** (4039). As duas são grátis e podem ser trocadas.
3. **Verificação A, item por item:** o A oferece a vela, o B oferece a colheita e os dois confirmam. Passa quando:
   - o servidor repassa a cada lado exatamente a oferta do outro;
   - a troca conclui com UpdateCarry para os dois;
   - cada inventário perde o item que deu e ganha o que recebeu, idêntico (índice e efeitos);
   - nada mais muda, nem o gold.
4. **Verificação B, só gold:** o A oferece um valor (`--gold`, padrão 12345) e o B não oferece nada. Passa quando o A perde o valor, o B ganha o mesmo valor e os inventários não mudam.
5. **Verificação C, relogin:** os dois saem e entram de novo. O inventário e o gold precisam ser os mesmos do fim das trocas.

O fluxo de pacotes segue o cliente (`handler/trade.go`):
- o A abre a troca com a sua oferta, e o B responde com a dele;
- o A confirma e recebe CNFCheck;
- o B confirma, e o servidor troca tudo de uma vez, manda UpdateCarry aos dois e fecha com QuitTrade.

Um QuitTrade antes do UpdateCarry é recusa.

| Opção | Efeito |
|---|---|
| `--gold 50000` | Valor da troca de gold. |
| `--fresh` | Apaga os dois personagens e o estado e recomeça. |
| `--cleanup` | Apaga os dois personagens e o estado e sai. |

Códigos de saída: `0` passou · `1` falhou · `3` erro de execução. Cada execução grava `reports/<data>-player-trade/` com `report.json` (ofertas, repasses, inventário e gold antes, depois e no relogin, com as diferenças) e `events.jsonl`.

### Situação (2026-10-17): passa

Foram três execuções no Railway entre 01:28 e 01:30 UTC. As duas últimas **passaram** em todas as verificações: item por item, gold (12345 do A para o B) e relogin.

A primeira acusou falha na troca de gold, mas o erro era do bot. O gold tinha passado certo, e o QuitTrade que fecha a troca chegou ao A antes do UpdateCarry do B. O bot leu esse QuitTrade como recusa e foi corrigido. Nenhuma issue foi necessária.

## Estrutura

```
src/protocol/   codec CPSock (keytable, encode/decode, framer), opcodes e pacotes no layout do servidor Go
src/client/     GameClient (TCP, relógio de ClientTick, estado do mundo, waitFor) e logger
src/bot/        sessão (login/PIN/personagem), movimento, combate, grind, sobrevivência, NPCs (loja, itens, quest), troca entre jogadores e progresso
src/world/      Campo de Treino (zona 0x80 e spawns) e Quest do Coveiro (NPCs, arena, rotas)
src/scenarios/  cenários de teste e peças comuns (common.ts)
scripts/        create-account, extract-newbie-zone e smokes manuais em scripts/dev (sessão, grind, loja)
tests/          testes unitários (vitest)
```

Para regenerar a zona a partir de um clone do servidor: `npm run zone:extract -- <w2pp-OpenWYD>/Release/TMsrv/run`.

### Referências de protocolo

- Transporte: `tmserver/internal/protocol/{codec,transform,checksum,keytable}.go` (servidor) e `tools/protocol/cpsock_ref.py` (webclient).
- Layout dos corpos: `tmserver/internal/protocol/messages.go`, `selchar.go`, `mob.go`, `createmob.go`, `score.go`, `shop.go` e `carry.go`; troca em `messages.go` (`MsgTradeBody`).
- Regras de movimento e ataque: `handler/movement.go` (janela de tick de +15 s/−120 s; o primeiro passo nos 3 s após o login é descartado) e `handler/combat.go` (ataques a no mínimo 800 ms um do outro).
