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

### Situação (2026-10-16): meta de tempo cumprida, trava ausente

Execução de 2026-10-16 22:06–22:15 UTC (`--fresh --until-done`), com o multiplicador de exp do campo no servidor ([Jean1dev/w2pp-OpenWYD#384](https://github.com/Jean1dev/w2pp-OpenWYD/pull/384)). Veredito: **falhou**, só pela trava.

| Verificação | Resultado |
|---|---|
| Começa no nível exibido 1 | ✅ |
| Nível exibido 35 em até 15 min | ✅ **6,6 min** (nível 30 com 4 min) |
| Controle positivo (o 35 entra no campo) | ✅ |
| Controle negativo (o 36 é barrado) | ❌ entrou em (2100, 2032) sem mensagem nem teleporte |

- **Exp do campo:** resolvida com o #384 junto com uma correção no bot. Na execução anterior, das 21:07, o nível 35 levou 25,5 min. O bot não distribuía os pontos de atributo, então terminou com dano 57 e gastou ~15 min em lutas abandonadas (40 golpes sem matar) contra Chefe_Krill e Orc_Arqueiro_, que têm AC alta. Distribuindo os pontos, o dano chega a ~126 no nível 35, e a escolha de alvo pela exp por segundo eliminou as desistências. Foram 60 kills e nenhuma desistência.
- **Trava ausente:** confirmada no Railway. Veja [docs/findings/001-campo-de-treino-sem-trava.md](docs/findings/001-campo-de-treino-sem-trava.md).

## Estrutura

```
src/protocol/   codec CPSock (keytable, encode/decode, framer), opcodes e pacotes no layout do servidor Go
src/client/     GameClient (TCP, relógio de ClientTick, estado do mundo, waitFor) e logger
src/bot/        sessão (login/PIN/personagem), movimento, combate, grind, sobrevivência e progresso
src/world/      Campo de Treino (zona 0x80 e spawns extraídos dos dados do servidor)
src/scenarios/  cenários de teste
scripts/        create-account, extract-newbie-zone e smokes manuais em scripts/dev
tests/          testes unitários (vitest)
```

Para regenerar a zona a partir de um clone do servidor: `npm run zone:extract -- <w2pp-OpenWYD>/Release/TMsrv/run`.

### Referências de protocolo

- Transporte: `tmserver/internal/protocol/{codec,transform,checksum,keytable}.go` (servidor) e `tools/protocol/cpsock_ref.py` (webclient).
- Layout dos corpos: `tmserver/internal/protocol/messages.go`, `selchar.go`, `mob.go`, `createmob.go`, `score.go` e `shop.go`.
- Regras de movimento e ataque: `handler/movement.go` (janela de tick de +15 s/−120 s; o primeiro passo nos 3 s após o login é descartado) e `handler/combat.go` (ataques a no mínimo 800 ms um do outro).
