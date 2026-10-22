# Mapa das quests principais

Este mapa lista as quests principais do jogo e os casos de uso que cada uma deve ter num cenário de bot. Ele é a base para escolher os próximos cenários de `src/scenarios/`. As quests secundárias ficam fora do mapa; a lista delas está no fim.

Fontes:
- Servidor: `Jean1dev/w2pp-OpenWYD`, lido em 2026-10-17 em `origin/main` `d896ae2` (depois do #388).
  - Legado: `Source/Code/TMSrv/*.cpp`.
  - Go: `tmserver/internal/handler/*.go`.
  - Dados: `Release/TMsrv/run/NPCGener.txt`, `Release/TMsrv/run/npc/*` e `Release/Common/ItemList.csv`.
- Guias da comunidade: [WYD Global — Guia Quest Mortal](https://wydglobal.raidhut.com/pt-br/2402), [Guia do WYD — Quests Mortais](http://guiadowyd.blogspot.com/2009/09/quests-mortais.html), [WYD Galahan — Tudo sobre as Quests](https://wydgalahan.wordpress.com/guia-de-jogo/guia-basico/tudo-sobre-as-quests/), [Point dos XD — Celestial e Sub](https://pointdosxd.blogspot.com/2011/06/mega-tutorial-celestial-e-sub-celestial.html) e [WYD Brazuca — Evoluindo para Arch](https://wydbrazuca.com.br/guias-do-wyd/99-Evoluindo-para-Arch/).
  - Quando o guia e o código discordam, vale o código do legado. O guia só ajuda a dar nome às quests e a entender a intenção.

Convenções:
- **Nível:** o código confere o nível armazenado (`CurrentScore.Level`); o jogo mostra o armazenado + 1. As faixas aparecem como "armazenado `[a,b)` = exibido a+1…b".
- **Go:**
  - ✅ implementado como no legado;
  - ⚠️ implementado em parte ou com diferença;
  - ❌ ausente.
  - Isso vem da leitura do código. Cada ⚠️/❌ é uma **suspeita** até um cenário reprovar no Railway. Só então abrimos a issue, como nos cenários anteriores.
- **Casos de uso:** cada arquivo tem uma tabela com ID, pré-condição, ação do bot e resultado esperado. O tipo é *feliz*, *controle* (o servidor tem que recusar sem mexer em nada) ou *borda*.

## O que conta como quest principal

Uma quest é principal quando faz pelo menos uma destas coisas:
- muda a classe (Mortal → Arch → Celestial → Sub-Celestial);
- destrava um teto de nível;
- grava uma flag permanente (`STRUCT_MOBEXTRA.QuestInfo`, `Basedef.h:633-681`, ou um bit do `LearnedSkill`);
- dá atributo ou ponto de skill permanente;
- é um passo da cadeia de progressão: novato → Quest 256 → capas → Arch → Celestial → Sub-Celestial.

Trocas repetíveis, serviços, instâncias com horário, eventos e a quest diária são secundárias.

## Matriz

| # | Quest | Classe | Nível exibido | NPC (cidade) | Go | Cenário hoje | Prioridade |
|---|---|---|---|---|---|---|---|
| [01](01-novato-treinadores.md) | Novato: quatro treinadores | Mortal | 1–35 | Treinador1/2/3 e Chefe_de_Treino (Armia, Campo de Treino) | ❌ (o Treinador1 cai no Coveiro) | `npm run quest -- 01`: 12 ✅ (2026-10-19, [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411) | 1 |
| [02](02-quest256-tickets.md) | Quest 256: Coveiro, Jardineiro, Kaizen, Hidra e Elfos, com troféus | Mortal/Arch | 40–350 | Coveiro, Jardineiro, Patrulha_, Patrulha e Guarda | ✅ (reset no #388) | `npm run quest -- 02`: 14 ✅ (2026-10-19, [~~#396~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396) corrigida no #411) | 2 |
| [03](03-capa-verde.md) | Capa Verde (Formatura Aprendiz) | Mortal / Arch | 100–150 | Diretor_Treina. e Chefe_Treina. (sul de Azran); Lider_Aprendiz para o Arch | Mortal ✅, Arch ❌ | `npm run quest -- 03`: 13 ✅ (2026-10-22, [~~#397~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) corrigida no #411) | 3 |
| [04](04-molar-gargula.md) | Molar do Gárgula | Mortal | 200–254 | Patrulha__ (Dungeon) | ⚠️ (o uso do molar não existe) | `npm run quest -- 04`: 10 ✅ (2026-10-22, [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida no #411) | 4 |
| [05](05-capa-real.md) | Capa do Reino (azul/vermelha) e borda | Mortal (+ Celestial) | 200–254; Rei a partir de 220 | Guarda_Real e Rei | ⚠️ (sem o Emblema do Reino; preço em safiras diferente) | `npm run quest -- 05`: 13 ✅ (2026-10-22, [~~#399~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) e [~~#400~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/400) corrigidas no #411; o Clan por guilda do líder segue pendente) | 5 |
| [06](06-terra-mistica.md) | Terra Mística (amuleto) | Mortal | qualquer | Cap.Mercenario e Cap.Explor. (Azran) | ⚠️ (só o passo 1) | `npm run quest -- 06`: 11 ✅ (2026-10-22, [~~#401~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401), [~~#402~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402) e [~~#403~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) corrigidas no #411; mensagem do passo 2 em UTF-8, [#412](https://github.com/Jean1dev/w2pp-OpenWYD/issues/412)) | 6 |
| [07](07-pilula-orc.md) | Pílula do Poder Mágico | qualquer | qualquer | (drop do Orc Lord) | ❌ | `npm run quest -- 07`: 5 ✅ (2026-10-22, [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411) | 7 |
| [08](08-circulo-divino.md) | Círculo Divino (Jeffi e Shama) | qualquer | qualquer | Jeffi e Shaman (Azran) | ❌ | `npm run quest -- 08`: 7 ✅ (2026-10-22, [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411) | 8 |
| [09](09-arch-cadeia.md) | Cadeia do Arch: almas, Oráculo, Pedras Arch, Sephirot e Rei | Mortal | 300–400 | Oráculos, mestres de skill e Rei | ⚠️ (sem o refino das pedras; Sephirot da classe errada, #390) | `npm run quest -- 09`: 12 ✅ (2026-10-22, [~~#390~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) corrigida no #411) | 9 |
| [10](10-arch-destravas.md) | Destravas do Arch: Lindy 355/370 e Cristais | Arch | 355–400 | Lindy (centro dos reinos); cristais por uso | ⚠️ | `npm run quest -- 10`: 14 ✅ (2026-10-22, sem regressão após o #411; 3 informativos: LD-06, CR-05 #327, CR-06 #348) | 10 |
| [11](11-alma-mortal-kibita.md) | Alma do Mortal (Kibita) | Mortal | 370+ | Kibita (Armia) | ✅ | `npm run quest -- 11`: 7 ✅ | 10 |
| [12](12-celestial.md) | Pedra Ideal e Arch → Celestial | Arch | 356+ | Rei; Pedra Ideal por uso | ⚠️ (o Go usa a 1742 no lugar da 5338) | `npm run quest -- 12`: 5 ✅ 4 ❌ ([#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406), [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407)) | 11 |
| [13](13-celestial-destravas.md) | Destravas do Celestial: Lv40, Lv90, Arcana, Reset e adds do Sub | Celestial | 40–200 | Alquimista_Odin; Pedra da Fúria por uso | ⚠️ (só o Lv40) | `npm run quest -- 13`: 6 ✅ 4 ❌ ([#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408), [#409](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409)) | 12 |
| [14](14-sub-celestial.md) | Sub-Celestial e troca de subclasse (Urnammu) | Celestial | 121+ | Pedra Ideal por uso; Urnammu | ❌ | `npm run quest -- 14`: 5 ✅ (vácuo) 2 ❌ ([#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410)) | 13 |

A coluna **Prioridade** dá a ordem sugerida para os próximos cenários. Ela pesa duas coisas: o custo para o bot (nível com Poeira de Fada, itens à venda, nada de boss em grupo) e o valor (divergência já suspeita, ou peça da cadeia de progressão).

- **01 a 04** cabem num personagem novo em menos de uma hora: sobem com Poeira de Fada, e os itens são de drop fácil ou não existem.
- **05 a 08** exigem farm de drop, grupo ou boss.
- **09 a 14** exigem o Arch, e o cenário 5 já cria um.
  - Dá para reaproveitar a conta do Arch e encadear os cenários da 09 em diante.
  - Itens que custam muito gold ou vêm de boss são o gargalo: Pedras Arch, 30M da Sephirot e Pedras Secretas.
  - A viabilidade de cada um está no arquivo da quest.

## Armadilhas que valem para todos os cenários

1. **O NPC é identificado por bytes diferentes.**
   - O legado usa `MOB.Merchant`, o byte 17 do template (`_MSG_Quest.cpp:33`).
   - O Go usa `CurrentScore.Merchant`, no offset 104 (`protocol/mob.go:46`). Só o Rei, o Sobrevivente e o Uxmal têm tratamento à parte.
   - Nos templates de `npc/*` os dois bytes diferem nestes NPCs:

   | NPC | byte 17 (legado) | CurrentScore (Go) | Efeito no Go |
   |---|---|---|---|
   | Treinador1 | 36 | 100, grade 0 | cai no Coveiro: recusa o novato e teleporta para a arena do Coveiro quem tem a Vela |
   | Treinador2 / Treinador3 | 40 / 41 | 104 / 105 | nada |
   | Lindy | 10 (AMU_MISTICO) | 74 (Kibita) | o clique de quest roda a Alma do Mortal |
   | Mestre_Grifo | 7 | 23 | atalho só do Go para as arenas da Quest 256 |
   | Rei_Harabard / Rei_Glantuar | 15 | 111 | tratado (`isKingQuestNPC`, `misc.go:482`) |
   | Uxmal | 72 | 104 | tratado (`isUxmalNPC`) |

2. **A QuestFlag não é salva.**
   - Ela zera no relogin (`ProcessDBMessage.cpp:775`; Go `character.go:738`) e no reset da área.
   - Um cenário não retoma dentro da arena: ao reconectar, volta à compra do ticket, como no cenário 2.
3. **Reset das áreas a cada 10 min, contados do boot.**
   - No legado: `ProcessSecMinTimer.cpp:560-577`.
   - No Go: `quest_area_reset.go`, desde o #388. Cobre Coveiro, Capa Verde, Jardim, Kaizen, Hidra, Elfos, Gárgula e Lan House. A Capa Real (1740,1725) não tem reset nem guarda.
   - O legado tem um segundo bloco "Reset Quests" (`ProcessSecMinTimer.cpp:972-1002`). Ele limpa as cinco arenas da Quest 256 **a cada segundo**, porque o `CheckQuest` (`CMob.h:94`) nunca recebe valor. É um bug do legado e o Go não o copia (finding 002).
   - O `MSG_StartTime` (contador da arena) continua sem porte.
4. **Comandos que pulam quest.** `/destravar40`, `/destravar90` e `/arcana` (legado `_MSG_MessageWhisper.cpp:627-697`, Go `chat.go:350-359`) gravam as flags das destravas do Celestial. Os cenários não usam esses comandos. Um caso de controle pode conferir que eles não funcionam fora da classe certa.
5. **Itens sem GM.**
   - A Aki (2144,2088) vende os tickets 4038–4041 e 4043, as entradas da Lan House e as poeiras 412/413.
   - A Evolucao (2085,2101) vende a Poeira de Fada 4142 (pilha de 255 por 5000), a 1742, as Sephirot 1760–1763, as Pedras Secretas 5334–5337, a Pedra Ideal 5338, a Pedra da Fúria 3020 e os Cristais 4106–4109.
   - Isso vem do inventário do template `npc/*`. Cada cenário confere preço e disponibilidade na loja do Go antes de depender dela, como o cenário 5 fez com a 1742 e a Sephirot.
6. **Confirmação.** O `MSG_Quest` leva `Parm2` = confirm.
   - O `talkQuest` (`src/bot/npc.ts`) manda confirm 0. Isso basta para a Quest 256, a Capa Verde e o Oráculo, que não conferem o confirm.
   - O Rei, o COMP_SEPHI e o Cap.Mercenario exigem confirm ≠ 0. Nesses casos, usar o padrão `talkKing` de `src/scenarios/archCreation.ts`.

## Fora do mapa (secundárias)

Estas não entram no mapa, pelos motivos da regra acima. O código delas está em `_MSG_Quest.cpp` e `_MSG_UseItem.cpp`.

| Quest / serviço | NPC ou gatilho | Por que é secundária |
|---|---|---|
| Troca de montaria (Perzen N/M/A) | Perzen (Merchant 100, grade 7–9) | troca repetível |
| Kefra (ticket) | Sobrevivente | repetível; entrada de evento |
| Pista de Runas (salas +0 a +6, Carbuncle) | Uxmal | instância com horário, repetível. As runas entram na receita da destrava Lv40 (arquivo 13) |
| Bolsa da Sorte | Guarda_da_Sorte | evento |
| Buff do Carbuncle | Ajudante (Merchant 120) | serviço |
| Curandeiro, Mestre de Habilidade (reset de atributos), Mestre de Montaria | Merchants 200, 31 e 58 | serviços |
| Ori/Lac do Jeffi | Jeffi (sem círculo equipado) | troca repetível |
| Dragão Dourado, Dragão de Azran | Merchants 4 e 62 | trocas |
| GodGovernment, Kingdom_Broker, info do Zakum | Merchants 68, 26 e 30 | serviços |
| Castelo Zakum, Lan House, Pedidos de Caça, Pergaminho da Água, Pesadelo, Carta de Duelo | itens de entrada | instâncias e zonas de farm |
| Quest Diária | login (pacote 0xD00) | diária |
| Receitas do Odin (exceto a Lv40) | Alquimista_Odin | combinação |
