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
npm run account:create -- --arch     # conta do cenário do Arch (WYD_ACCOUNT_ARCH/WYD_PASSWORD_ARCH)
npm run account:create -- --foema    # conta do cenário da Magia Negra (WYD_ACCOUNT_FOEMA/WYD_PASSWORD_FOEMA)
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

## Cenário 4 — Quest 256, passos 2 a 5 (Colheita, Cura do Batedor, Mana e Emblema)

`npm run scenario:quest256`

Um personagem só faz as quatro arenas seguintes ao Coveiro, subindo de nível em cadeia com a Poeira de Fada.

| Passo | NPC | Item (Aki, grátis) | Nível exibido | Arena |
|---|---|---|---|---|
| 2 Jardineiro | Jardineiro (2222,1714) | Colheita do Jardineiro 4039 | 116–190 | (2228,1700)–(2257,1728) |
| 3 Kaizen | Patrulha_ (454,3910), Dungeon 1 | Cura do Batedor 4040 | 191–265 | (459,3887)–(497,3916) |
| 4 Hidra | Patrulha (668,3768), Dungeon 1 | Mana do Batedor 4041 | 266–320 | (658,3728)–(703,3762) |
| 5 Elfos | Guarda (1303,4036), Submundo | Emblema do Guarda 4042 | 321–350 | (1312,4027)–(1348,4055) |

Em cada passo, como um jogador comum:

1. **Nível.** Usa Poeira de Fada até um nível abaixo do mínimo do passo e distribui os pontos de cada nível pela build da classe (`src/bot/build.ts`).
   - A build do TransKnight segue o TK misto dos guias da comunidade: Con até ~600, Dex ≥ 400 e o resto em Str.
   - Antes da build, cumpre os requisitos de atributo do próximo equipamento (por exemplo, Str 132 e Dex 96 da Espada em Cruz).
2. **Equipamento.** Compra gulosa, guardando 10k de gold, na ordem Espada em Cruz (Berlund, Noatum), Luvas, Hrotti, Botas, Armadura e Calça do Set Melpômene (Set_TK e Arma_SemiDeus, Armia). A peça que sai do slot é vendida.
3. **Controle: item errado.** Vai até a NPC só com o item do passo anterior. Ela não pode teleportar nem consumir o item.
4. **Controle: intruso.** Entra a pé na arena. Deve ser mandado de volta para a cidade.
5. Compra o item do passo na Aki e confere que saiu de graça.
6. **Controle: nível.** Com o item, um nível abaixo do mínimo, a NPC tem que recusar e o item fica. Depois usa uma Poeira ali mesmo.
7. **Verificação A:** a entrega teleporta para dentro da arena e o item some.
8. **Verificação B:** o reset da arena manda o personagem de volta para a cidade (o bot espera no ponto mais longe dos spawns).

A viagem segue o caminho de um jogador:
- Jardineiro: Mestre Grifo "Jardim dos Deuses" (`MSG_MasterGriff`).
- Kaizen e Hidra: Grifo "Calabouço", tile do Armia Field para o Dungeon 1 e o resto a pé.
- Elfos: Grifo "Submundo" e tile do Azran Field para o Underworld.

Se a Aki não vender o Emblema (o `npc/Aki` do repositório tem o 4043 no slot 32), o bot farma o Argos, o Argos_Errante e o Troll_Ghoul, que soltam o 4042, por até `--emblem-farm` (padrão 30 min). Sem o Emblema, a entrega fica `blocked`, e a arena é testada entrando pelo Mestre Grifo.

| Opção | Efeito |
|---|---|
| `--budget 2h` / `--until-done` / `--fresh` / `--cleanup` | Como no cenário 1. Um personagem adotado não é apagado, só o estado. |
| `--adopt <nome>` | Usa um personagem que já existe na conta em vez de criar um (útil com os 4 slots ocupados). |
| `--step 3` | Repete um passo (exige nível abaixo do máximo dele). |
| `--emblem-farm 30m` | Tempo máximo do farm de reserva do Emblema. |
| `--reset-wait 12m` | Espera fixa pelo reset, contada da entrada na arena. |

O cenário é retomável (`state/quest256-chain.json`). Cada execução grava `reports/<data>-quest256-chain/` com `report.json` (veredito e verificações por passo, Poeiras usadas, curva de nível, compras, peças vestidas com dano/AC/HP antes e depois, viagens) e `events.jsonl`.

### Situação (2026-10-17): passa nos quatro passos

Execução de 2026-10-17 14:23–15:01 UTC (`--adopt botq5cm1l --until-done`, TransKnight do nível exibido 7 ao 321). O veredito foi **passou**: 37,8 min de jogo, 314 Poeiras de Fada (2 pilhas), nenhuma morte e uma tentativa por passo.

| Passo | Item errado | Intruso | Abaixo do nível | A: entrega | B: reset |
|---|---|---|---|---|---|
| 2 Jardineiro | ✅ recusado (aviso 15) | ✅ volta para (2086,2095) | ✅ recusado no 115 | ✅ no 116 → (2234,1713), item consumido | ✅ 14:31:43, 230 s depois |
| 3 Kaizen | ✅ | ✅ | ✅ no 190 | ✅ no 191 → (465,3901) | ✅ 14:41:43, 227 s |
| 4 Hidra | ✅ | ✅ | ✅ no 265 | ✅ no 266 → (665,3756) | ✅ 14:51:43, 161 s |
| 5 Elfos | ✅ | ✅ | ✅ no 320 | ✅ no 321 → (1319,4041) | ✅ 15:01:43, 317 s |

- **Itens:** os quatro saíram de graça na Aki. No Railway o slot 32 dela vende o **Emblema do Guarda (4042)**; o `npc/Aki` do repositório tem o 4043 nesse slot, então a configuração das NPCs em tempo de execução difere do arquivo. O farm de reserva não foi necessário e não foi exercitado.
- **Reset:** todos vieram no mesmo ciclo de 10 min, em xx:x1:43, contados do boot, como no legado, e mandaram o personagem para Armia.
- **Build e equipamento:** no fim, Str 1872 (com o +210 do Hrotti), Dex 461 e Con 373.
  - A Espada em Cruz levou o dano de 539 para 633 no 190.
  - As Luvas Melpômene levaram a AC de 296 para 1520 no 265.
  - O Hrotti levou o dano de 1125 para 6027 no 320.
  - As Botas e a Armadura Melpômene levaram a AC a 4399.
  - A Calça ficou de fora por gold (sobraram 156k de 1M). As peças antigas foram vendidas.

## Cenário 5 — Criação do Arch

`npm run scenario:arch` (exige a conta do Arch no `.env`: `npm run account:create -- --arch`)

O Arch nasce de um mortal nível 400. Ele mantém o nome e o corpo e ganha a classe da Sephirot escolhida. Isso segue os guias do WYD ([Wyd 2.0 Tutorials: Criando Arch](https://wydtutoriais.wordpress.com/criando-arch/), [WYD BR Loucos: Criando a classe Arch](http://wydbrloucos.blogspot.com/p/criando-classe-arch.html)) e o servidor:
- o Rei (`handler/misc.go` `kingQuest`/`kingArch`) exige mortal com nível armazenado ≥ 299, a Pedra da Imortalidade (1742) no Equip[10] e a Sephirot (1760 + classe) no Equip[11];
- o DB (`dbserver` `CreateArchCharacter`) cria o Arch no primeiro slot livre, com o mesmo nome, nível 0, sem itens e `Equip[0] = rosto do mortal + 5 + classe`.

O cenário roda numa conta só dele, porque o Arch precisa de um slot livre. Os passos são:

1. Cria um mortal (`WYD_CHAR_CLASS`) e o leva ao nível exibido 400 com a Poeira de Fada, distribuindo os pontos pela build da classe.
2. Compra na Evolução a Pedra da Imortalidade (5.000) e a Sephirot da classe do Arch (7.000). O caminho dos guias (Oráculo com as Almas e Safiras; Mestre de Skills com as 8 Pedras Arch e 30M) não serve para um jogador comum neste conteúdo, porque as Pedras 1744–1751 não são vendidas nem caem de nenhum mob.
3. **Controles** no Rei_Glantuar (1750,1880), cada um sem criar Arch:
   - com a Pedra e a Sephirot só no inventário;
   - com tudo equipado, mas a conta cheia (o bot cria 3 personagens extras e depois os apaga): também precisa manter os itens equipados;
   - na pergunta (confirmação 0).
4. **Verificação A:** no "sim" (confirmação 1) o servidor volta para a seleção de personagem, lista o Arch num slot livre, manda `SendArchEffect` com esse slot e tira a Pedra e a Sephirot do mortal.
5. **Verificação B:** o Arch entra no mundo com:
   - o mesmo nome;
   - a classe da Sephirot;
   - nível exibido 1;
   - só o corpo equipado (o mesmo rosto na seleção e no login) e o inventário vazio.
6. **Verificação C:** o mortal continua no slot dele, no nível exibido 400, com o mesmo rosto e sem a Pedra e a Sephirot.

| Opção | Efeito |
|---|---|
| `--arch-class 2` | Classe do Arch: 0 TK, 1 FM, 2 BM (padrão), 3 HT. |
| `--budget` / `--until-done` / `--fresh` / `--cleanup` | Como no cenário 1. A limpeza apaga o mortal, o Arch e os extras. |

O estado fica em `state/arch-creation.json`. Cada execução grava `reports/<data>-arch-creation/`.

### Situação (2026-10-17): passa

Execução de 2026-10-17 15:54–16:10 UTC (`--until-done`): um TransKnight virou Arch BeastMaster. O veredito foi **passou**.

| Verificação | Resultado |
|---|---|
| Mortal no nível exibido 400 | ✅ 399 Poeiras em 12 min. Build TK: Str 2115, Dex 400, Con 600 |
| Pedra e Sephirot só no inventário | ✅ sem Arch. O Rei responde com o serviço de capa: "Sao necessarias 14 safiras em pagamento exato." |
| Conta cheia | ✅ sem Arch, aviso 31 (sem slot livre), Pedra e Sephirot continuam equipadas |
| Pergunta (confirmação 0) | ✅ sem Arch: "Sao necessarias 14 safiras." |
| A: criação | ✅ CNFCharacterLogout + CNFNewCharacter, Arch no slot 1, `SendArchEffect(1)`, Equip[10]/[11] do mortal vazios |
| B: Arch | ✅ mesmo nome, classe 2 (BM), nível exibido 1, rosto 8 (= 1 + 5 + 2), só o corpo, inventário vazio |
| C: mortal | ✅ slot 0, nível exibido 400, rosto 1, sem a Pedra e a Sephirot |

Duas diferenças do legado, que o cenário não reprova:
- **Gold do Arch:** ele nasce com 1.000.000 de gold. No legado o BaseSet dá 5.000.000; o Go usa 1.000.000 para todo personagem novo (valor provisório em `dbserver` `server.go`).
- **Sephirot do Mestre de Skills:** pela leitura do código, o `compSephi` do Go dá `1760 + Class`, enquanto o legado (`_MSG_Quest.cpp:2149`) dá `1759 + Class`. Isso daria a Sephirot de outra classe. Não dá para testar sem as 8 Pedras Arch. Issue: [Jean1dev/w2pp-OpenWYD#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390).

## Cenário 6 — Skills de Magia Negra da Foema

`npm run scenario:foema-black` (exige a conta do cenário no `.env`: `npm run account:create -- --foema`)

A Foema tem três árvores de skills. A Magia Negra é a segunda: skills 32–39, bits 8–15 do `LearnedSkill`, maestria `Special[2]`. Os nomes e as regras seguem o servidor (`SkillData.csv`, `ItemList.csv` 5032–5039, `handler/skill.go`, `handler/combat.go`) e os guias da comunidade ([WYD Tutoriais: Guia FM](https://wydtutoriais.wordpress.com/guia-fm/)).

| id | Skill | Pontos | Requisito (nível exibido / Special[2]) | Tipo |
|---|---|---|---|---|
| 32 | Ataque de Fogo | 18 | 1 / 0 | 1 alvo |
| 33 | Relâmpago | 51 | 1 / 0 | 1 alvo |
| 34 | Lança de Gelo | 69 | 30 / 0 | 1 alvo |
| 35 | Tempestade de Meteoros | 72 | 46 / 0 | área |
| 36 | Nevasca | 72 | 76 / 112 | 1 alvo |
| 37 | Trovão | 90 | 100 / 148 | buff: dispara Relâmpagos sozinho a cada 8 s |
| 38 | Fênix de Fogo | 81 | 140 / 190 | 1 alvo |
| 39 | Inferno (8ª) | 224 | 220 / 200, mais as 7 anteriores e 50M de gold | área |

Como um jogador comum, numa conta só do cenário:

1. Cria uma Foema e sobe de nível com a Poeira de Fada.
   - Cada nível dá 3 pontos de skill (4 a partir do 200) e 2 de maestria.
   - Os atributos vão quase todos em Int (`FOEMA_NEGRA` em `src/bot/build.ts`).
   - A maestria vai em `Special[2]`, só até o que a próxima skill pede.
2. Em cada skill, na ordem:
   - **Controle "antes da hora":** um nível antes, o Foema_Ancian (2094,2126) tem que recusar o aprendizado sem mexer no `Learn`.
   - **Aprender:** abre a janela de skills (`MSG_REQShopList`, ShopType 3) e manda `MSG_ApplyBonus` BonusType 2. Tem que ligar só o bit da skill, descontar exatamente os pontos dela e não cobrar gold.
   - **Aprender de novo:** tem que ser recusado sem mexer em nada. Como no legado, os pontos são conferidos antes de "já aprendida".
   - **Conjurar** nos Gremlins a leste de Armia (`MSG_AttackOne`, ou `MSG_Attack` em área, com `SkillIndex` e `Dam = -1`). O eco tem que voltar com a skill e dano no alvo, e o MP debitado tem que ser `ManaSpent × (Special/2 + 100) / 100`.
   - Na Tempestade de Meteoros, o cast tem que acertar 2 ou mais alvos.
   - O Trovão tem que disparar Relâmpagos (skill 33, Motion 254) sozinho.
3. **Controles de cast**, com só o Ataque de Fogo aprendido:
   - conjurar o Relâmpago ainda não aprendido;
   - conjurar sem MP, gastando o MP antes num alvo fora do alcance, para não subir de nível;
   - conjurar num alvo fora do alcance;
   - comprar a skill do mestre como item (`MSG_Buy`), o que o legado só permite com o Merchant 1.
4. **Inferno:** no nível exibido 220, com as 7 aprendidas e cerca de 1M de gold, o aprendizado tem que ser recusado com `NotEnoughCoin`.
   - Antes disso, reaprender o Ataque de Fogo com 224 pontos livres tem que dar `AlreadyLearned`.
   - Aprender e conjurar o Inferno fica bloqueado, porque um jogador comum não junta 50M.
5. **Relogin:** o `Learn` tem que ser 0x7F00, e o `SkillBonus` igual a `3×nível + (nível − 199) − pontos gastos`.

| Opção | Efeito |
|---|---|
| `--budget 2h` / `--until-done` / `--fresh` / `--cleanup` | Como no cenário 1. |
| `--skill 37` | Repete o cast de uma skill já aprendida (depois, a recusa do Inferno e o relogin). |

O estado fica em `state/foema-black-magic.json`. Cada execução grava `reports/<data>-foema-black-magic/` com o `report.json` e o `events.jsonl`. O relatório traz, por skill, o nível em que ela foi aprendida, os pontos, a máscara, o MP e o dano de cada cast, além dos controles, da curva de nível e dos pontos de maestria.

### Situação (2026-10-17): tudo passa, menos a compra da skill como item

Execuções de 2026-10-17 entre 17:02 e 17:28 UTC (`--fresh --until-done`, retomada, e `--skill 37`), com a Foema `bot0fagjhyod`: 21 min de jogo e 210 Poeiras de Fada.

| Skill | Antes da hora | Aprendida no nível exibido | Cast: dano / MP (esperado) |
|---|---|---|---|
| 32 Ataque de Fogo | ✅ recusada no 6 | 7 | ✅ 67 / 7 (7) |
| 33 Relâmpago | ✅ no 23 | 24 | ✅ 214 / 10 (10) |
| 34 Lança de Gelo | ✅ no 46 | 47 | ✅ 343 / 15 (15) |
| 35 Tempestade de Meteoros | ✅ no 70 | 71 | ✅ 400 e 381, dois alvos / 25 (25) |
| 36 Nevasca | ✅ no 94 | 95 | ✅ 1111 / 54 (54) |
| 37 Trovão | ✅ no 124 | 125 | ✅ affect 22 no personagem e um Relâmpago de 1746, 6 s depois / 150 (150) |
| 38 Fênix de Fogo | ✅ no 151 | 152 | ✅ 1927 / 169 (169) |

- **Controles:**
  - Relâmpago não aprendido: descartado, sem eco nem MP. ✅
  - Sem MP: descartado com SetHpMp (MP 1, custo 7). ✅
  - Alvo a 9 tiles, com alcance 5: dano 0. ✅ O Go ainda cobra o MP; o legado não confere o alcance.
- **Reaprender e Inferno:**
  - Reaprender com 224 pontos livres: `AlreadyLearned`. ✅
  - Inferno sem os 50M: `NotEnoughCoin`, e nada muda. ✅
- **Relogin:** `Learn` 0x7F00 e `SkillBonus` 224. ✅
- **Lentidão:** a da Lança de Gelo e da Nevasca não pega em mob, porque `SetAffect` só vale para jogadores, como no legado. Fica só no relatório.
- **Compra da skill como item:** ❌ o Foema_Ancian (Merchant 19) entregou o Relâmpago (5033) de graça pelo `MSG_Buy`. O legado recusa com "Pode comprar itens apenas do mercador." (`_MSG_Buy.cpp:55`); o Go só recusa Merchant 0 (`shop.go:64`), e a venda tem a mesma diferença.
  - Issue: [Jean1dev/w2pp-OpenWYD#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391).
  - Veja [docs/findings/003-mestre-de-skills-vende-skill-como-item.md](docs/findings/003-mestre-de-skills-vende-skill-como-item.md).

Na primeira tentativa do Trovão, a conexão caiu 4 s depois do cast. Um processo órfão de uma execução anterior, que tinha sido interrompida, entrou na mesma conta ("Conta desconectada por conexão simultânea."). O `--skill 37` repetiu o cast numa sessão estável, e ele passou.

## Estrutura

```
src/protocol/   codec CPSock (keytable, encode/decode, framer), opcodes e pacotes no layout do servidor Go
src/client/     GameClient (TCP, relógio de ClientTick, estado do mundo, waitFor) e logger
src/bot/        sessão (login/PIN/personagem), movimento, viagens (Grifo, tiles), combate, grind, sobrevivência, NPCs (loja, itens, quest), quests de arena, build de atributos e maestria, skills (aprender e conjurar), equipamento, troca entre jogadores e progresso
src/world/      Campo de Treino (zona 0x80 e spawns), Quest do Coveiro, Quest 256 passos 2–5 (NPCs, arenas, rotas, equipamento), criação do Arch e Magia Negra da Foema (skills, mestre e campo de teste)
src/scenarios/  cenários de teste e peças comuns (common.ts)
scripts/        create-account, extract-newbie-zone e smokes manuais em scripts/dev (sessão, grind, loja, equipamento/Grifo, lista de personagens)
tests/          testes unitários (vitest)
```

Para regenerar a zona a partir de um clone do servidor: `npm run zone:extract -- <w2pp-OpenWYD>/Release/TMsrv/run`.

### Referências de protocolo

- Transporte: `tmserver/internal/protocol/{codec,transform,checksum,keytable}.go` (servidor) e `tools/protocol/cpsock_ref.py` (webclient).
- Layout dos corpos: `tmserver/internal/protocol/messages.go`, `selchar.go`, `mob.go`, `createmob.go`, `score.go`, `shop.go` e `carry.go`; troca em `messages.go` (`MsgTradeBody`); equipar em `messages.go` (`MsgTradingItemBody`, `handler/item.go tradingItem`), venda em `handler/shop.go sell` e Mestre Grifo em `handler/misc.go masterGriff`.
- Regras de movimento e ataque: `handler/movement.go` (janela de tick de +15 s/−120 s; o primeiro passo nos 3 s após o login é descartado) e `handler/combat.go` (ataques a no mínimo 800 ms um do outro).
