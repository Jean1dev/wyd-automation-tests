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
npm run account:create -- --foema    # conta dos cenários da Foema (WYD_ACCOUNT_FOEMA/WYD_PASSWORD_FOEMA)
npm run account:create -- --bm       # conta dos cenários do BeastMaster (WYD_ACCOUNT_BM/WYD_PASSWORD_BM)
npm run account:create -- --ht       # conta dos cenários da Huntress (WYD_ACCOUNT_HT/WYD_PASSWORD_HT)
npm run account:create -- --tk       # conta dos cenários do TransKnight (WYD_ACCOUNT_TK/WYD_PASSWORD_TK)
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

### Situação (2026-10-26): passa, compra da skill como item corrigida

Reteste com o deploy de main de 12:49 UTC, que inclui o [w2pp-OpenWYD#416](https://github.com/Jean1dev/w2pp-OpenWYD/pull/416). A execução `--fresh --until-done` das 13:43–14:00 UTC (`reports/2026-10-26T13-43-41-340Z-foema-black-magic`) **passou**: 16 min de jogo.

| Skill | Antes da hora | Aprendida no nível exibido | Cast: dano / MP (esperado) |
|---|---|---|---|
| 32 Ataque de Fogo | ✅ recusada no 6 | 7 | ✅ 75 / 7 (7) |
| 33 Relâmpago | ✅ no 23 | 24 | ✅ 199 / 10 (10) |
| 34 Lança de Gelo | ✅ no 46 | 47 | ✅ 397 / 15 (15) |
| 35 Tempestade de Meteoros | ✅ no 70 | 71 | ✅ 381 e 399, dois alvos / 25 (25) |
| 36 Nevasca | ✅ no 94 | 95 | ✅ 1206 / 54 (54) |
| 37 Trovão | ✅ no 124 | 125 | ✅ affect 22 no personagem / 130 (130) |
| 38 Fênix de Fogo | ✅ no 151 | 152 | ✅ 1852 / 165 (165) |

- **Controles:** não aprendido, alvo fora do alcance e sem MP (27 casts de dreno, último com MP 1) ✅. `AlreadyLearned`, Inferno com `NotEnoughCoin` e relogin (`Learn` 0x7F00, `SkillBonus` 224) ✅.
- **Compra da skill como item:** ✅ o Foema_Ancian recusa com "Pode comprar itens apenas do mercador." (MessagePanel, como o legado), nenhum item e gold igual. [~~#391~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391) corrigida no #416.

Duas execuções antes (13:22 e 13:40 UTC) reprovaram por erro do bot, não do jogo. O controle de compra só contava `MessageBoxOk` e não lia o texto do `MessagePanel` da recusa. E o controle "sem MP" perdia a corrida com a regeneração (`SetHpMp` a cada ~10 s), que devolvia MP entre o último dreno e o cast final. O bot agora lê o texto da recusa, mede o MP no envio do cast e volta a drenar se o MP regenerou.

## Cenário 7 — Skills de Magia Branca da Foema

`npm run scenario:foema-white` (a mesma conta do cenário 6, com outra Foema: `npm run account:create -- --foema`)

O mesmo cenário do 6 (`src/scenarios/skillTree.ts --tree branca`), agora na árvore 1. São as skills 24–31, bits 0–7 do `LearnedSkill`, com maestria em `Special[1]`. Nos requisitos do ItemList, o campo "ReqInt" é comparado com `Special[1]`.

| id | Skill | Pontos | Requisito (nível exibido / Special[1]) | Como o bot testa |
|---|---|---|---|---|
| 24 | Flecha Mágica | 12 | 1 / 0 | dano num mob |
| 25 | Desintoxicar | 42 | 20 / 0 | em si mesma: sem dano, MP certo |
| 26 | Flash | 66 | 34 / 0 | nos mobs em volta: sem dano, MP certo; conta os ataques dos alvos antes e depois |
| 27 | Cura | 48 | 1 / 0 | em si mesma, depois de perder HP: +2×Special + 100 (teto 1100) |
| 28 | Choque Divino | 78 | 58 / 86 | dano num mob |
| 29 | Recuperar | 48 | 69 / 102 | em si mesma, depois de perder HP: +3×Special/2 + 150 |
| 30 | Julgamento Divino | 102 | 133 / 180 | em mobs colados: dano + o HP da Foema em cada alvo, e ela fica com HP/6 + 1 a cada alvo |
| 31 | Renascimento (8ª) | 281 | 220 / 200, mais as 7 anteriores e 50M de gold | só a recusa sem o gold |

Os Gremlins não atacam sozinhos, porque o clã deles não puxa briga. Por isso, para testar as curas, a Foema usa o Julgamento Divino em si mesma (fica com HP/6 + 1) quando ele já está aprendido; antes disso, espera os mobs tirarem HP.

Para o Julgamento em vários alvos, o bot espera dois Gremlins, andando, ficarem a até 2 tiles um do outro e para colado nos dois. O dano base sorteia entre 90% e 110% (`combat.SkillDamage`). Então, entre alvos com a mesma AC, o dano base de cada alvo (dano − HP de antes) tem que ser pelo menos 90/110 do primeiro.

As opções são as do cenário 6. `--skill` aceita uma lista, por exemplo `--skill 27,29,30`. O estado fica em `state/foema-white-magic.json` e os relatórios em `reports/<data>-foema-white-magic/`.

### Situação (2026-10-17): falha no Julgamento Divino com vários alvos

Execuções de 2026-10-17 entre 17:50 e 18:22 UTC (`--until-done` e duas vezes `--skill 27,29,30`), com a Foema `bot05clvd48c`: 29 min de jogo e 219 Poeiras de Fada.

| Skill | Antes da hora | Aprendida no nível exibido | Cast |
|---|---|---|---|
| 24 Flecha Mágica | ✅ recusada no 4 | 5 | ✅ 57 de dano / MP 5 (5) |
| 25 Desintoxicar | ✅ `ReqNotMet` no 19 | 20 | ✅ sem dano / MP 12 (12) |
| 26 Flash | ✅ no 40 | 41 | ✅ sem dano / MP 40 (40); o alvo parou de atacar (1 ataque antes, 0 depois) |
| 27 Cura | ✅ no 56 | 57 | ✅ +500, HP 129 → 629 / MP 30 (30) |
| 28 Choque Divino | ✅ no 82 | 83 | ✅ 1021 de dano / MP 42 (42) |
| 29 Recuperar | ✅ no 98 | 99 | ✅ +450, HP 129 → 579 / MP 60 (60) |
| 30 Julgamento Divino | ✅ no 132 | 133 | ✅ num alvo; ❌ em dois (abaixo) |

- **Controles:**
  - Desintoxicar não aprendido: descartado. ✅
  - Sem MP: descartado. ✅
  - Alvo a 9 tiles, com alcance 6: dano 0. ✅
- **Compra da skill como item:** ❌ o Foema_Ancian deu a skill 5025 pelo `MSG_Buy`, o mesmo problema do cenário 6 ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Reaprender e Renascimento:**
  - Reaprender com 281 pontos livres: `AlreadyLearned`. ✅
  - Renascimento sem os 50M: `NotEnoughCoin`, e nada muda. ✅
- **Relogin:** `Learn` 0x7F e `SkillBonus` 281. ✅
- **O que não foi exercitado:**
  - o Desintoxicar tirando um debuff: nenhum mob daqui aplica debuff, e a lentidão só vem de outro jogador;
  - o Renascimento revivendo alguém.
- **Julgamento Divino em dois Gremlins:** ❌ a Foema estava com 768 de HP.
  - O 1º alvo levou 2875 e o 2º, 2449.
  - Com o HP de antes somado aos dois, como no legado, o dano base do 2º seria 1681, abaixo do mínimo possível (1914).
  - Somando o HP já reduzido (129), ele dá 2320, dentro da faixa.
  - O Go soma o `e.HP` atual alvo a alvo (`combat.go:710`); o legado soma o HP guardado antes do laço (`_MSG_Attack.cpp:281`).
  - Issue: [Jean1dev/w2pp-OpenWYD#392](https://github.com/Jean1dev/w2pp-OpenWYD/issues/392). Veja [docs/findings/004-julgamento-divino-hp-por-alvo.md](docs/findings/004-julgamento-divino-hp-por-alvo.md).

Na primeira execução, os mobs não tiraram HP e só um Gremlin ficou colado. O bot passou a derrubar o HP com o Julgamento e a procurar dois Gremlins juntos. Na segunda tentativa, o filtro de alvos usava o nome igual ao do primeiro ("Gremlin" e "Gremlin_" são nomes diferentes); agora usa a mesma AC.

### Situação (2026-10-26): passa, Julgamento Divino e compra da skill como item corrigidos

Reteste com o deploy de main de 12:49 UTC, que inclui o [w2pp-OpenWYD#415](https://github.com/Jean1dev/w2pp-OpenWYD/pull/415) e o [#416](https://github.com/Jean1dev/w2pp-OpenWYD/pull/416). A execução `--fresh --until-done` das 14:05–14:27 UTC (`reports/2026-10-26T14-05-54-749Z-foema-white-magic`), com a Foema `bot0e0kcmjg6`, **passou** de primeira: 21 min de jogo e 219 Poeiras de Fada.

| Skill | Antes da hora | Aprendida no nível exibido | Cast |
|---|---|---|---|
| 24 Flecha Mágica | ✅ recusada no 4 | 5 | ✅ 49 de dano / MP 5 (5) |
| 25 Desintoxicar | ✅ `ReqNotMet` no 19 | 20 | ✅ sem dano / MP 12 (12) |
| 26 Flash | ✅ no 40 | 41 | ✅ sem dano em dois alvos / MP 40 (40) |
| 27 Cura | ✅ no 56 | 57 | ✅ +100 (2×0 + 100) / MP 15 (15) |
| 28 Choque Divino | ✅ no 82 | 83 | ✅ 906 de dano / MP 42 (42) |
| 29 Recuperar | ✅ no 98 | 99 | ✅ +303 (3×102/2 + 150) / MP 45 (45) |
| 30 Julgamento Divino | ✅ no 132 | 133 | ✅ dois Gremlins, 14:24:01 UTC (abaixo) / MP 285 (285) |

- **Julgamento Divino em dois Gremlins:** ✅ a Foema estava com 495 de HP.
  - O 1º alvo levou 2113 e o 2º, 2197. Com os 495 somados aos dois, como no legado, os danos base são 1618 e 1702, dentro da faixa (mínimo 1323).
  - Somando o HP já reduzido (83), como antes da correção, o 2º daria 2114, acima do máximo possível (1977).
  - A Foema ficou com 14 de HP (495 → 83 → 14) e veio um `SetHpMp` só, depois do laço, como no legado.
  - [~~#392~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/392) corrigida no #415.
- **Controles:**
  - Desintoxicar não aprendido: descartado. ✅
  - Sem MP (42 casts de dreno, cast final com MP 0): descartado com `SetHpMp`. ✅
  - Alvo a 10 tiles, com alcance 6: dano 0. ✅
- **Compra da skill como item:** ✅ o Foema_Ancian recusa o 5025 com "Pode comprar itens apenas do mercador." (MessagePanel), nenhum item e gold igual. [~~#391~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391) corrigida no #416.
- **Reaprender e Renascimento:** `AlreadyLearned` com 281 pontos livres, e o Renascimento sem os 50M dá `NotEnoughCoin`, sem mudar nada. ✅
- **Relogin:** `Learn` 0x7F e `SkillBonus` 281. ✅
- **Curas:** os mobs não tiraram HP antes do Julgamento ser aprendido, então a Cura e a Recuperar foram conjuradas com o HP quase cheio. O valor do eco bate com a fórmula, mas o HP só subiu até o máximo (248 → 256 e 386 → 388).
- **Flash:** sem dano e com o MP certo. Os alvos voltaram a atacar logo depois (4 ataques nos 4 s antes, 5 depois), o que fica só no relatório.

## Cenário 8 — Skills de Magia Especial da Foema

`npm run scenario:foema-special` (a mesma conta dos cenários 6 e 7, com uma terceira Foema)

O mesmo cenário dos 6 e 7 (`src/scenarios/skillTree.ts --tree especial`), agora na árvore 3: skills 40–47, bits 16–23 do `LearnedSkill`, com maestria em `Special[3]`. O SkillData troca os nomes de 41 e 42. Os dados e o ItemList (5041 Velocidade, 5042 Teleporte) mostram que a 41 é a Velocidade (affect 2, grupo) e a 42 é o Teleporte (InstanceType 9, sem MP).

| id | Skill | Pontos | Requisito (nível exibido / Special[3]) | Como o bot testa |
|---|---|---|---|---|
| 40 | Névoa Venenosa | 24 | 1 / 0 | dano num mob |
| 41 | Velocidade | 39 | 22 / 0 | em si mesma: affect 2 e corrida + 1 |
| 42 | Teleporte | 54 | 1 / 0 | em si mesma: com a própria posição e com outra coordenada no pacote, não pode sair do lugar |
| 43 | Escudo Mágico | 63 | 34 / 0 | affect 11 e AC + Level/3 + 15 |
| 44 | Arma Mágica | 75 | 61 / 60 | affect 9 e dano + (Level×5/20 + 90)×3/2, ×3 com o Escudo aprendido |
| 45 | Toque de Athena | 72 | 77 / 76 | affect 15 e as 4 maestrias + Level/10 + 7 |
| 46 | Controle de Mana | 81 | 141 / 0 | affect 18 |
| 47 | Cancelamento (8ª) | 269 | 220 / 200, mais as 7 anteriores e 50M de gold | só a recusa sem o gold |

O Level do affect é a maestria da Foema no cast. As fórmulas são as do `BASE_GetCurrentScore` (`Basedef.cpp:3950-4090`), que o Go repete em `handler/affect_score.go`. O estado fica em `state/foema-special-magic.json` e os relatórios em `reports/<data>-foema-special-magic/`.

### Situação (2026-10-17): falha no Teleporte

Execuções de 2026-10-17 entre 18:32 e 18:50 UTC (`--until-done` e `--skill 41`), com a Foema `bot06f6ashwa`: 16,5 min de jogo e 219 Poeiras de Fada.

| Skill | Antes da hora | Aprendida no nível exibido | Cast |
|---|---|---|---|
| 40 Névoa Venenosa | ✅ recusada no 8 | 9 | ✅ 78 de dano / MP 9 (9) |
| 41 Velocidade | ✅ no 21 | 22 | ✅ corrida 4 → 5 |
| 42 Teleporte | ✅ no 39 | 40 | ❌ foi para a coordenada do pacote (abaixo) |
| 43 Escudo Mágico | ✅ no 60 | 61 | ✅ AC +15 |
| 44 Arma Mágica | ✅ no 85 | 86 | ✅ dano +471 |
| 45 Toque de Athena | ✅ no 109 | 110 | ✅ as 4 maestrias +14 |
| 46 Controle de Mana | ✅ `ReqNotMet` no 140 | 141 | ✅ affect 18 |

O MP de todos os casts bateu com a fórmula.

- **Controles:** Velocidade não aprendida, sem MP e alvo fora do alcance. ✅
- **Compra da skill como item:** ❌ o Foema_Ancian deu a skill 5041 ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Reaprender e Cancelamento:**
  - Reaprender com 269 pontos livres: `AlreadyLearned`. ✅
  - Cancelamento sem os 50M: `NotEnoughCoin`. ✅
- **Relogin:** `Learn` 0x7F0000 e `SkillBonus` 269. ✅
- **Teleporte:** ❌ em si mesma, de (2195,2108) e com (2210,2118) no pacote, a Foema foi teleportada para (2210,2118).
  - O legado puxa o alvo para a posição da Foema no servidor (`_MSG_Attack.cpp:781`); o Go usa o `TargetX/TargetY` do cliente (`combat.go:915`).
  - Issue: [Jean1dev/w2pp-OpenWYD#393](https://github.com/Jean1dev/w2pp-OpenWYD/issues/393). Veja [docs/findings/005-teleporte-foema-coordenada-do-cliente.md](docs/findings/005-teleporte-foema-coordenada-do-cliente.md).
- **Diferenças vistas só na leitura do código** (não observáveis no cenário):
  - a Arma Mágica do Go não soma o `DAMAGEMULTI`;
  - o teto do Toque de Athena é 400 no Go e 200/255 no legado.

Na primeira execução, a Velocidade falhou por erro do bot: ele lia a corrida no nibble alto do `AttackRun`, que é o ataque. O `AttackRun` é `ataque × 16 + corrida` (`Basedef.cpp:4711`). Corrigido, o `--skill 41` passou.

## Cenário 9 — Skills do BeastMaster (três árvores)

```
npm run account:create -- --bm       # conta própria (WYD_ACCOUNT_BM): um BM por árvore
npm run scenario:bm-magia            # magias, 48–55, Special[1]
npm run scenario:bm-evocacao         # evocações, 56–63, Special[2]
npm run scenario:bm-transformacao    # transformações, 64–71, Special[3]
```

O mesmo cenário das árvores da Foema (`src/scenarios/skillTree.ts --tree bm-…`), com um BM novo por árvore. O mestre é o **Mestre_Archi** (2077,2123), que tem Merchant 19 e vende 5048–5071. Os dados vêm do `SkillData.csv` e do `ItemList.csv`. Os nomes divergem entre os dois em algumas skills; aqui seguem o que a skill faz:
- a 59 evoca o Urso e a 60 o Tigre;
- a 54 é a Aura Bestial.

| Árvore | Skill | Como o bot testa |
|---|---|---|
| Magias | 48 Fera Flamejante, 50 Som das Fadas | dano num mob |
| | 49 Chamas Etéreas | cast e MP; em mob não age (no legado e no Go, só queima MP ou tira buffs de jogador) |
| | 51 Enfraquecer | nos mobs ao alcance, sem dano; o debuff só pega em jogador |
| | 52 Fúria de Gaia | em área, 2 ou mais alvos |
| | 53 Proteção Elemental | affect 25: três resistências + (10 + Level/4)/10 |
| | 54 Aura Bestial | dispara Fúria de Gaia (skill 52) sozinha, como o Trovão |
| | 55 Espírito Vingador (8ª) | só a recusa sem os 50M |
| Evocações | 56–62 | evoca `Special[2]/30` (Condor, Javali), `/40` (Lobo, Urso, Tigre) ou `/80` (Gorila, Dragão Negro) bichos do modelo certo; antes sobe a maestria até evocar 1; depois reloga, porque o logout recolhe os bichos e uma evocação de outro tipo falha com bicho vivo |
| | 63 Succubus (8ª) | só a recusa sem os 50M; os pontos da árvore somam 727, então a recusa vem no nível exibido 233 |
| Transformações | 64 Lobisomem, 66 Homem-Urso, 68 Astaroth, 70 Titã | affect 16; AC e HP máximo pela fórmula exata do legado (`X×multi/100`, multi = (max − min)×Level/200 + min da `pTransBonus`) e a corrida |
| | 65, 67, 69 (passivas) | o cast é recusado; depois refaz a forma que a passiva melhora (Lobo, Urso, Astaroth) e confere o bônus |
| | 71 Éden (8ª) | só a recusa sem os 50M |

Os affects voltam no login, então relogar não desfaz a transformação. Antes de cada forma, o bot espera a anterior acabar, pelo `SendAffect`. Os estados ficam em `state/bm-{magic,summon,transform}.json`.

### Situação (2026-10-17): falha no Lobisomem (arredondamento)

Execuções de 2026-10-17 entre 19:07 e 20:30 UTC:

| Árvore | BM | Jogo | Resultado |
|---|---|---|---|
| Magias | `bot06j35hct3` | 16,6 min | ✅ tudo |
| Evocações | `bot09xrjdyv0` | 14,4 min | ✅ tudo (depois de corrigir o nome do Dragão no bot) |
| Transformações | `bot0bq49uyyr` | 32,6 min | ❌ Lobisomem com AC e HP máximo 1 ponto acima do legado |

- **Magias:**
  - recusa um nível antes nas 7;
  - dano: Fera 82, Som das Fadas 415, Fúria de Gaia 1087/1098 em dois alvos;
  - Proteção Elemental: resistências 0/0/0/0 → 3/3/0/3;
  - Aura Bestial: a Fúria de Gaia disparou sozinha, com 1458 de dano.
- **Evocações:** a quantidade bateu com a fórmula em todas:

  | Skill | Special[2] | Bichos |
  |---|---|---|
  | Condor | 30 | 1 |
  | Javali | 30 | 1 |
  | Lobo | 40 | 1 |
  | Urso | 40 | 1 |
  | Tigre | 86 | 2 |
  | Gorila | 112 | 1 |
  | Dragão Negro | 200 | 2 |

  Os bichos aparecem com o nome do modelo e um "^" no fim ("Dragao Negro^").
- **Transformações:**
  - Homem-Urso, Astaroth e Titã bateram exatamente, assim como as passivas Escudo do Tormento e Asas do Inferno;
  - Lobisomem, Level 0: AC 46 → 49 e HP máximo 116 → 111, quando o legado daria 48 e 110;
  - com Coração de Lobo: AC 61 → 65 (legado 64);
  - o Go soma `X×(multi − 100)/100`, que com multiplicador abaixo de 100 trunca em direção ao zero (`transform.go:128`, `:134`).
  - Issue: [Jean1dev/w2pp-OpenWYD#394](https://github.com/Jean1dev/w2pp-OpenWYD/issues/394). Veja [docs/findings/006-transformacao-bm-arredondamento.md](docs/findings/006-transformacao-bm-arredondamento.md).
- **Nas três árvores:**
  - controles de cast (alcance e falta de MP só onde a 1ª skill se aplica) ✅;
  - recusa da 8ª sem os 50M ✅;
  - reaprender: `AlreadyLearned` ✅;
  - relogin ✅;
  - a compra da skill como item reprova também no Mestre_Archi ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Notas:**
  - Na primeira execução das magias, o bot usou o mestre da Foema, e o BM aprendeu as skills dele no Foema_Ancian. Nem o legado nem o Go conferem qual mestre ensina, só o `TargetID` (`_MSG_ApplyBonus.cpp:139`). A execução final usou o Mestre_Archi.
  - Um HP máximo +1 no Astaroth com Asas do Inferno não se repetiu com `--skill 69` e ficou como inconclusivo.

## Cenário 10 — Skills da Huntress (três árvores)

```
npm run account:create -- --ht   # conta própria (WYD_ACCOUNT_HT): uma Huntress por árvore
npm run scenario:ht-1            # 72–79, Special[1]
npm run scenario:ht-2            # 80–87, Special[2]
npm run scenario:ht-3            # 88–95, Special[3]
```

É o mesmo cenário das outras classes (`src/scenarios/skillTree.ts --tree ht-…`):
- **Mestre:** o **ForeLearner** (2130,2125), que tem Merchant 19 e vende 5072–5095.
- **Build:** de Str, porque o dano da HT é 3×arma + 3×Str + nível/2 + Special + base.
- **Nomes:** seguem o SkillData e o `docs/migration/skills/huntress.md` do servidor. O ItemList troca os nomes de 74/75, 83/84, 85/86 e 90–92; os requisitos vêm do ItemList pelo índice.

| Árvore | Skill | Como o bot testa |
|---|---|---|
| 1 | 72 Ataque Fatal | dano (alcance 2) |
| | 73 Ilusão | não é cast: o `MSG_Action3` move a HT e cobra 45 de MP, conferido pelo eco do cast seguinte |
| | 75 Agressividade, 76 Imunidade | affect 27 / 19 |
| | 77 Meditação | AC − (Level/3 + 10) |
| | 74 Encantar Gelo, 78 Lança de Ferro | passivas: o cast é recusado |
| | 79 Tempestade de Raios (8ª) | só a recusa sem os 50M |
| 2 | 80 Golpe Felino | dano (alcance 2) |
| | 81 Ligação Espectral | affect 37 |
| | 82 Perícia do Caçador | passiva |
| | 83 Alquimia, 84 Extração | só o aprendizado: são usadas na combinação de itens |
| | 85 Explosão Etérea | affect 31: AC + Level/2 + 150, e cobra 100 × Special[2] de gold |
| | 86 Escudo Dourado | dano em área |
| | 87 Troca de Espíritos (8ª) | só a recusa |
| 3 | 88 Lâmina das Sombras | dano |
| | 89 Evasão Aprimorada, 92 Olhos de Águia | affect 26 / 36 |
| | 90 Toxina, 91 Visão Caçadora, 93 Lâmina Aérea | passivas |
| | 94 Proteção das Sombras | passiva; a AC ao aprender, pela regra do legado (abaixo) |
| | 95 Invisibilidade (8ª) | só a recusa; os pontos da árvore somam 680, então ela vem no nível exibido 221 |

O efeito dos affects 19, 26, 27, 36 e 37 só aparece em combate ou com a arma certa: bloqueio, parry, congelar com arma de gelo, drenar com arma 41, dano extra. Para esses, vale o affect. Os estados ficam em `state/ht-tree{1,2,3}.json`.

### Situação (2026-10-17): passa (só a compra da skill como item reprova)

Execuções de 2026-10-17 entre 21:04 e 21:46 UTC, cerca de 13 min de jogo por árvore:

| Árvore | HT | Destaques |
|---|---|---|
| 1 | `bot0ul7emabi` | Ataque Fatal 253; Ilusão −45 de MP exato; Meditação AC 148 → 97 (−51 = 123/3 + 10) |
| 2 | `bot0f2gutoo6` | Golpe Felino 244; Explosão Etérea AC 150 → 341 (+191 = 82/2 + 150) e gold −8200 (100 × 82); Escudo Dourado 3466/3288 em dois alvos |
| 3 | `bot0rpd4a5ih` | Lâmina das Sombras 232; Evasão e Olhos de Águia com o affect |

- **Nas três árvores:**
  - recusa um nível antes ✅;
  - aprender descontando os pontos exatos ✅;
  - controles de cast ✅;
  - reaprender: `AlreadyLearned` ✅;
  - recusa da 8ª sem os 50M ✅;
  - relogin ✅.
- **Compra da skill como item:** ❌ o ForeLearner também entrega a skill pelo `MSG_Buy` ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Proteção das Sombras (94):** ao ser aprendida, a AC não mudou (181 → 181). É o que o legado faz:
  - o legado confere o bit 23 (`Basedef.cpp:3867`, `LearnedSkill & (1 << 23) // 22`), que é a Invisibilidade (95), e não o bit 22 da própria 94;
  - o Go copia o legado (`score_derive.go:331`);
  - então a passiva só dá AC com a 8ª aprendida;
  - não é uma divergência do Go, e por isso não há issue; o comentário "// 22" do legado sugere que o bit certo seria o 22.
  - Na primeira execução, o bot esperava +65; a verificação agora segue o legado.

## Cenário 11 — Skills do TransKnight (três árvores)

```
npm run account:create -- --tk   # conta própria (WYD_ACCOUNT_TK): um TK por árvore
npm run scenario:tk-1            # 0–7, Special[1]
npm run scenario:tk-2            # 8–15, Special[2]
npm run scenario:tk-3            # 16–23, Special[3]
```

É o mesmo cenário das outras classes (`src/scenarios/skillTree.ts --tree tk-…`):
- **Mestre:** o **Cap.Cavaleiros** (2144,2120), que tem Merchant 19 e vende 5000–5023.
- **Build:** "TransKnight misto".
- **Nomes:** seguem o SkillData e o `docs/migration/skills/transknight.md` (o ItemList troca 3 e 13).

| Árvore | Skill | Como o bot testa |
|---|---|---|
| 1 | 0 Giro da Fúria | dano em área |
| | 1 Toque Sagrado | debuff sem dano |
| | 2 Golpe Duplo, 4 Fanatismo | dano |
| | 3 Possuído | affect 14: Con + v e HP máximo + 2v, v = Level×3/4 + 10 (a conta do Go, que segue o "Buff Loop.txt" de propósito; o HP sai × o EF_HPADD do equipamento) |
| | 5 Aura da Vida | affect (tick 17) |
| | 6 Fúria Divina | puxa o mob para junto do TK (com chance; até 6 casts num mob a 3–5 tiles) |
| | 7 Destino (8ª) | a recusa; os pontos somam 689, então ela vem no nível exibido 223 |
| 2 | 8 Carga, 10 Golpe Mortal, 12 Espada da Fênix | dano (alcance 1) |
| | 9 Mestre das Armas, 14 Noção de Combate | passivas |
| | 11 Assalto | affect 13: HP máximo ⌊M×9/10⌋ do legado, com o EF_HPADD; o dano fica informativo |
| | 13 Samaritano | affect 24 (o Go diverge do legado de propósito, issue #267) |
| | 15 Armadura Crítica (8ª) | a recusa |
| 3 | 16 Perseguição | debuff sem dano |
| | 17 Espada Flamejante | dano em área |
| | 18, 19, 20, 21 | dano |
| | 22 Exterminar | gasta todo o MP e soma MP + Int/2 ao dano |
| | 23 Tempestade de Gelo (8ª) | a recusa |

Os estados ficam em `state/tk-tree{1,2,3}.json`. Antes de medir um buff, o bot espera o mesmo affect de uma execução anterior acabar.

### Situação (2026-10-17): falha no Assalto (HP máximo +1)

Execuções de 2026-10-17 entre 22:10 e 23:30 UTC:

| Árvore | TK | Destaques |
|---|---|---|
| 1 | `bot0cm6n9gu5` | Giro da Fúria em área; Golpe Duplo 103; Fanatismo 498; Possuído com Con +160 e HP máximo +336 (= 2×160 × 1,05 do HPADD); Fúria Divina puxou o mob no 3º cast |
| 2 | `bot075uxuiek` | Carga 171; Golpe Mortal 1038; Espada da Fênix 1978; Samaritano com o affect; ❌ Assalto |
| 3 | `bot0a4p1o285` | Espada Flamejante em área; dano de 157 a 607; Exterminar com o MP 262 → 0 e dano 1072 |

- **Nas três árvores:**
  - recusa um nível antes ✅;
  - aprender com o desconto exato ✅;
  - controles ✅;
  - reaprender ✅;
  - 8ª sem os 50M ✅;
  - relogin ✅.
- **Compra da skill como item:** ❌ também no Cap.Cavaleiros ([#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)).
- **Assalto:** ❌ o HP máximo ficou 1 acima do legado.
  - O legado faz `MaxHp×9/10` (`Basedef.cpp:4036`); o Go faz `MaxHP − MaxHP/10` (`affect_score.go:144`).
  - Com M = 435: legado 410, Go 411. Com M = 1103: legado 1041, Go 1042.
  - É o mesmo arredondamento da transformação. O caso entrou no [#394](https://github.com/Jean1dev/w2pp-OpenWYD/issues/394), que agora cobre os dois.
- **A investigar:** o dano do Assalto (654 → 830, Level 200) não é comparável direto.
  - O Go separa o dano da arma e aplica os +15% e o `DAMAGEMULTI` só na parte base (`item.go` `effectiveDamage`, que o próprio comentário diz divergir "alguns pontos").
  - Falta confirmar se o legado põe a arma no `CurrentScore.Damage`.
- **Correções no bot durante as execuções:**
  - a Fúria Divina mirava Gremlins já colados (puxar não mudava nada);
  - o controle de MP da Carga procurava mob a −1 tile;
  - o HP do Possuído não levava em conta o EF_HPADD +5% do equipamento inicial do TK.

## Cenário 12 — Guilda

`npm run scenario:guild` (exige `WYD_DATABASE_URL` no `.env`; as contas do `.env` não são usadas)

1. Cria quatro contas novas no portal, com um personagem em cada:
   - L: líder, 300M;
   - S: membro que vira sub-líder, 10M;
   - R: recruta do sub-líder, sem gold;
   - X: controles, 50M.
2. Com os personagens na seleção, grava pelo banco Clan 7, cidadania e o gold. Depois os quatro entram juntos em Armia.
3. Roda os casos de [docs/guild.md](docs/guild.md) em série. Um caso que reprova bloqueia os que dependem dele:
   - criar a guilda (`/create`) e o controle sem gold;
   - o líder recruta S (`_MSG_InviteGuild` 0x03D5) e o controle do membro que tenta recrutar;
   - o líder promove S a sub-líder (`/subcreate`);
   - o sub-líder recruta R;
   - relogin;
   - `/nick`.

Cada passo confere o CreateMob do alvo (guilda e cargo), o gold de quem pagou (UpdateEtc) e as tabelas `guild`/`guild_member`.

Códigos de saída: `0` passou · `1` algum caso reprovou · `3` erro de execução. Cada execução grava `reports/<data>-guild/` com `report.json` (casos, frames de cada passo, gold e linhas do banco) e `events.jsonl`.

### Situação (2026-10-26): 8 ✅, GD-08 corrigido

Reteste no Railway em 2026-10-26, de 13:19 a 13:21 UTC, com o main de 12:49 UTC, que inclui o [w2pp-OpenWYD#418](https://github.com/Jean1dev/w2pp-OpenWYD/pull/418) (`reports/2026-10-26T13-19-03-107Z-guild`): 8 ✅ 0 ❌.

| Caso | Horário (UTC) | Resultado |
|---|---|---|
| GD-01 sem 100M | 13:19:48 | ✅ `/create` recusado, sem guilda nem débito |
| GD-02 `/create` | 13:19:52 | ✅ guilda 4 criada (banco, CreateMob cargo 9, −100M) |
| GD-03 líder recruta | 13:19:56 | ✅ |
| GD-04 membro não recruta | 13:20:08 | ✅ |
| GD-05 `/subcreate` | 13:20:12 | ✅ |
| GD-06 sub-líder recruta | 13:20:16 | ✅ |
| GD-07 persistência | 13:20:58 | ✅ banco e CreateMob conferem depois do relogin |
| GD-08 `/nick` | 13:20:58 | ✅ `bot0noxv6jqj [gdcotwuudg (Fama guilda: 0)] Cidadania: 1 / Fama: 0`: o nome vale sem reiniciar. [finding 025](docs/findings/025-guilda-nome-nao-registrado.md) corrigido |

A primeira tentativa (13:17 UTC, `reports/2026-10-26T13-17-46-438Z-guild`) parou com código 3 antes do GD-01. O login do S levou notice 8 (banco saturado), e o servidor fecha o socket depois do aviso. O bot tentava de novo na mesma conexão ("envio de AccountLogin com a conexão fechada"). Era um bug do bot: agora o `login` (`src/bot/session.ts`) abre uma conexão nova antes de tentar de novo. Na segunda execução, o L também levou notice 8 às 13:19:10 e entrou na nova tentativa.

O MessagePanel vazio onde o legado manda `_SN_CREATEGUILD`/`_SN_JOINGUILD` só fica registrado; não reprova caso.

### Banco saturado

O Postgres do db-server (Clever Cloud) limita conexões por role, e o db-server (pgxpool), o portal e os bots de todas as sessões disputam as mesmas vagas. Quando lota, a conexão nova recebe 53300 "too many connections", e o tm-server responde notice 8 (`NoticeDBError`) no login. Isso já foi investigado em [w2pp-OpenWYD#256](https://github.com/Jean1dev/w2pp-OpenWYD/issues/256): sem `MaxConns`, cada pool pgx usa `max(4, NumCPU)`, até 8 no Railway, e db-server e api-server dividem o mesmo role. A issue foi fechada como *not planned*, porque o banco é provisório e vai ser trocado. Por isso o contorno fica no bot:

- **Espera máxima de 5 min** (`WYD_DB_WAIT_MS`, padrão 300000). O bot tenta a cada 15 s e então sai com código 3 e "banco saturado". O login também tenta de novo a cada 30 s com notice 8, por no máximo ~5 min.
- **Banco primeiro:** o cenário e o `npm run quest` abrem a conexão antes de criar contas ou logar. Se o banco estiver lotado, desistem sem gastar nada.
- **Uma conexão por processo:** a conexão fica aberta até o fim, e só o primeiro uso pode esperar. Antes, cada leitura ou escrita abria e fechava uma conexão e disputava a vaga de novo.
- **Não rode dois cenários com banco ao mesmo tempo**, nem em worktrees diferentes.

## Cenário 13 — Caminhada até os Coliseus (Azran)

`npm run scenario:coliseu` (casos `CL-01` a `CL-05` em [q90-coliseu.ts](src/scenarios/quests/q90-coliseu.ts); usa o runner das quests e precisa de `WYD_DATABASE_URL`). Com `--no-db`, roda com personagem nível 1 sem seed e salta do Jardim até Azran; serve para quando o banco está saturado.

Cada caso pega o Grifo até o Jardim dos Deuses, segue até Azran (2510,1730), caminha até o centro do Coliseu (2630,1726) e volta. O `report.json` registra:
- onde e quando a conexão caiu;
- os frames por segundo antes da queda, por opcode;
- o máximo de mobs à vista e os avisos do servidor.

As variantes:
- CL-01: passos de 4 tiles;
- CL-02: passos de 1 tile;
- CL-03: leitura pausada por 2 s;
- CL-04: `MSG_NoViewMob` como o cliente legado;
- CL-05: passos de 7 tiles, como o cliente com velocidade 6.

### Situação (2026-10-23): queda confirmada (corrigida em 2026-10-26, ver abaixo)

| Caso | Resultado |
|---|---|
| CL-01 a CL-04 | ✅ ida e volta sem queda; até 159 mobs à vista, pico de 61 CreateMob/s |
| CL-05 passos de 7 tiles | ❌ caiu em (2603,1726) às 14:02:25Z: `session out queue full; dropping connection` (200 CreateMob na sessão) |

Também reproduzido com o cliente real (`testeup`, 13:58:33Z). O Go limita a fila de saída a 64 frames; o legado aceitava 128 KB. [finding 026](docs/findings/026-coliseu-fila-de-saida.md), [w2pp-OpenWYD#419](https://github.com/Jean1dev/w2pp-OpenWYD/issues/419).

Reteste de 2026-10-26 com o cliente real (`testeup`): **ainda cai**, às 11:06:59Z, com `frames=396` (229 CreateMob, 140 RemoveMob). A fila continua em 64 frames no main `8320279c`.

### Situação (2026-10-26): corrigido

O [w2pp-OpenWYD#428](https://github.com/Jean1dev/w2pp-OpenWYD/pull/428) limita a fila de saída por bytes (128 KB, como o legado), com deploy às 11:41:45Z. O `testeup` foi até o Coliseu e voltou sem cair: o pico foi de 83 frames e 19 KB na fila, e nenhum `session out queue full`.

## Mapa das quests principais

[docs/quests/README.md](docs/quests/README.md) mapeia as quests principais do jogo para os próximos cenários. São 14 grupos, do novato ao Sub-Celestial. Para cada quest, o mapa traz:
- NPC, requisitos e recompensa, com file:line do legado e do Go;
- a situação no Go (✅/⚠️/❌);
- os casos de uso: caminho feliz, controles e bordas;
- a viabilidade para o bot sem GM.

O mapa também sugere a ordem dos cenários. As divergências que ele aponta são suspeitas da leitura do código e só viram issue quando um cenário reprovar no Railway.

### Casos das quests (`npm run quest`)

Os casos de uso do mapa rodam no runner `src/scenarios/quests/runner.ts`. A situação de cada caso fica em [docs/quests/STATUS.md](docs/quests/STATUS.md).

Cada caso roda isolado:
1. cria uma **conta nova** no portal e um personagem novo nela;
2. com o personagem na seleção, grava a pré-condição direto no banco (`src/db/seed.ts`): nível, classe, flags e itens;
3. entra no mundo, faz a ação do bot e confere o efeito pelo estado (slots, posição, flags), não pelo texto da resposta.

```
npm run quest -- 03 --list            # casos da quest 03
npm run quest -- 03 --case CV-06      # um caso (pode repetir --case)
npm run quest -- 03                   # todos os casos da quest, em série
npm run quest:status                  # recalcula o resumo do STATUS.md
```

- **Requisito:** `WYD_DATABASE_URL` no `.env`, que é o `W2PP_DB_DSN` do serviço db-server no Railway (`railway variables --service db-server`). As contas do `.env` não são usadas.
- **Relatório:** `reports/<data>-quest-NN/<ID>/report.json` e `<ID>.events.jsonl`.
- **Saída:**
  - 0: todos passaram ou estão bloqueados;
  - 1: algum reprovou;
  - 3: erro de execução.

## Estrutura

```
src/protocol/   codec CPSock (keytable, encode/decode, framer), opcodes e pacotes no layout do servidor Go
src/client/     GameClient (TCP, relógio de ClientTick, estado do mundo, waitFor) e logger
src/bot/        sessão (login/PIN/personagem), movimento, viagens (Grifo, tiles), combate, grind, sobrevivência, NPCs (loja, itens, quest), quests de arena, build de atributos e maestria, skills (aprender e conjurar), equipamento, troca entre jogadores e progresso
src/world/      Campo de Treino (zona 0x80 e spawns), Quest do Coveiro, Quest 256 passos 2–5 (NPCs, arenas, rotas, equipamento), criação do Arch e as árvores de skills das quatro classes (skills, mestre e campo de teste)
src/scenarios/  cenários de teste e peças comuns (common.ts)
scripts/        create-account, extract-newbie-zone e smokes manuais em scripts/dev (sessão, grind, loja, equipamento/Grifo, lista de personagens, resumo de árvore de skills)
tests/          testes unitários (vitest)
```

Para regenerar a zona a partir de um clone do servidor: `npm run zone:extract -- <w2pp-OpenWYD>/Release/TMsrv/run`.

### Referências de protocolo

- Transporte: `tmserver/internal/protocol/{codec,transform,checksum,keytable}.go` (servidor) e `tools/protocol/cpsock_ref.py` (webclient).
- Layout dos corpos: `tmserver/internal/protocol/messages.go`, `selchar.go`, `mob.go`, `createmob.go`, `score.go`, `shop.go` e `carry.go`; troca em `messages.go` (`MsgTradeBody`); equipar em `messages.go` (`MsgTradingItemBody`, `handler/item.go tradingItem`), venda em `handler/shop.go sell` e Mestre Grifo em `handler/misc.go masterGriff`.
- Regras de movimento e ataque: `handler/movement.go` (janela de tick de +15 s/−120 s; o primeiro passo nos 3 s após o login é descartado) e `handler/combat.go` (ataques a no mínimo 800 ms um do outro).
