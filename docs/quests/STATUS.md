# Status das quests

Situação de cada caso de uso de `docs/quests/`, validado no Railway com `npm run quest -- NN --case ID`. Cada caso roda numa conta nova e recebe a pré-condição pelo banco (`src/db/seed.ts`).

Legenda: ✅ passa · ❌ reprova (com issue) · ⏸️ bloqueado (motivo na nota) · ⏳ pendente.

## Resumo

| # | Quest | Casos | ✅ | ❌ | ⏸️ | ⏳ |
|---|---|---|---|---|---|---|
| [01](#01) | Novato: os quatro treinadores do Campo de Treino | 12 | 2 | 10 | 0 | 0 |
| [02](#02) | Quest 256: as cinco arenas e os troféus | 14 | 11 | 1 | 0 | 2 |
| [03](#03) | Capa Verde (Formatura Aprendiz) | 13 | 0 | 0 | 0 | 13 |
| [04](#04) | Molar do Gárgula | 10 | 0 | 0 | 0 | 10 |
| [05](#05) | Capa do Reino (azul / vermelha) e a borda | 13 | 0 | 0 | 0 | 13 |
| [06](#06) | Terra Mística (Defendendo a Terra Mística) | 11 | 0 | 0 | 0 | 11 |
| [07](#07) | Pílula do Poder Mágico (Conquista do Castelo Orc) | 5 | 0 | 0 | 0 | 5 |
| [08](#08) | Círculo Divino (Jeffi e Shama) | 7 | 0 | 0 | 0 | 7 |
| [09](#09) | Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei | 12 | 0 | 0 | 0 | 12 |
| [10](#10) | Destravas do Arch: Lindy 355/370 e Cristais | 14 | 0 | 0 | 0 | 14 |
| [11](#11) | Alma do Mortal (Kibita) | 7 | 0 | 0 | 0 | 7 |
| [12](#12) | Pedra Ideal e Arch → Celestial | 9 | 0 | 0 | 0 | 9 |
| [13](#13) | Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial | 10 | 0 | 0 | 0 | 10 |
| [14](#14) | Sub-Celestial e troca de subclasse (Urnammu) | 7 | 0 | 0 | 0 | 7 |
| | **Total** | **144** | **13** | **11** | **0** | **120** |

<a id="01"></a>
## 01 — Novato: os quatro treinadores do Campo de Treino

[Casos de uso](01-novato-treinadores.md) · `npm run quest -- 01`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| NOV-01 | Passo 1 sem a chave | controle | ✅ | | nada mudou no inventário; o Go responde com o NoticeReqNotMet do Coveiro (não a fala Cheerup1) |
| NOV-02 | Passo 1 | feliz | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | com a 451 o Treinador1 responde NoticeReqNotMet (rota do Coveiro); sem Kit 682 |
| NOV-03 | Passo 1 de novo | controle | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 1 inalcançável (passo 1 sem efeito); Treinador1 de novo: NoticeReqNotMet, nada muda |
| NOV-04 | Pular passo | controle | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 1 inalcançável; Treinador3 com a 453 não responde e nada muda |
| NOV-05 | Passo 2 | feliz | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 1 inalcançável; Treinador2 com a 452 não responde, Lança_Curva sem adicional novo |
| NOV-06 | Passo 2 com arma de ReqLvl > 39 | borda | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 1 inalcançável; Treinador2 com a 452 e a Lança_do_Vento não responde |
| NOV-07 | Passo 3 | feliz | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 2 inalcançável; Treinador3 com a 453 não responde, Equip[1..7] sem +3 |
| NOV-08 | Passo 3 com slot vazio | borda | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 2 inalcançável; Treinador3 não responde, Equip[2] continua vazio |
| NOV-09 | Passo 4 | feliz | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 3 inalcançável; Chefe_de_Treino com a 524 não responde, emblema fica |
| NOV-10 | Acima do nível | controle | ✅ | | exibido 36 (Poeira ao lado do Treinador1) com a 451: nada mudou; resposta NoticeReqNotMet do Coveiro |
| NOV-11 | Flag persiste | borda | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | pré-condição Newbie 2 inalcançável (passo 1 sem efeito); Treinador2 não responde; a flag Newbie nem existe no banco |
| NOV-12 | Treinador1 não é Coveiro | controle | ❌ | [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | exibido 40 com a Vela 4038: o Treinador1 teleportou para (2395,2102), arena do Coveiro, e consumiu a Vela |

<a id="02"></a>
## 02 — Quest 256: as cinco arenas e os troféus

[Casos de uso](02-quest256-tickets.md) · `npm run quest -- 02`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| QST-01 | Entrega do ticket | feliz (cenários 2/4) | ✅ | | exibido 40 com a Vela: Vela consumida, teleportado para (2399,2103) e ficou 6 s na arena (QuestFlag 1) |
| QST-02 | Sem ticket / ticket de outro passo | controle (cenários 2/4) | ✅ | | exibido 40 com 4039 e 4041, sem a Vela: o Coveiro recusa (NoticeReqNotMet 15), nada some, sem teleporte |
| QST-03 | Um nível abaixo do mínimo | controle (cenário 4) | ✅ | | exibido 39 com a Vela: o Coveiro recusa (NoticeReqNotMet 15), a Vela fica, sem teleporte |
| QST-04 | Intruso | controle (cenários 2/4) | ✅ | | sem QuestFlag, entrou a pé em (2381,2112) e o guarda mandou para Armia (2096,2107) |
| QST-05 | Reset | feliz (cenários 2/4) | ✅ | | entrou 14:27:54 UTC; o reset mandou para Armia (2097,2099) 573 s depois (14:37:28 UTC), dentro do ciclo de 10 min |
| QST-06 | Relogin dentro da arena | borda | ✅ | | relog dentro da arena: voltou em Armia (2096,2102), fora da arena (o Go entra pela cidade, character.go:236; o guarda nem precisou agir) |
| QST-07 | Acima do máximo | controle | ✅ | | exibido 116 (armazenado 115 = máximo exclusivo) com a Vela: recusa (NoticeReqNotMet 15), a Vela fica, sem teleporte |
| QST-08 | Drop do troféu | feliz | ✅ | | exibido 115 com equipamento semeado: a primeira Aparição morta (14:43:02 UTC) pôs a Caixa_da_Sabedoria 4117 direto no inventário (Carry[56] do template, taxa 1) |
| QST-09 | Usar o troféu | feliz | ❌ | [#396](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396) | exibido 115, 2 Caixas 4117 sem grupo: +30000 exp (legado 33000, com os 10 % de líder para si), +10000 gold, sobrou 1; banco coin 11000 / exp 30000 |
| QST-10 | Troféu fora da faixa | controle | ✅ | | exibido 116 com a 4117: recusa (NoticeReqNotMet 15), a Caixa fica no slot, exp e gold iguais |
| QST-11 | Troféu em grupo | borda | ✅ | | grupo pela segunda conta (SendReqParty/AcceptParty); o membro usou a 4117: membro +30000, líder +3000 (10 %) |
| QST-12 | Ticket com o botão direito | borda | ✅ | | informativo (só no Go, sem caminho no legado): clique direito na Vela ×2 em Armia teleportou para (2397,2102), sobrou 1, ficou na arena (QuestFlag 1) |
| QST-13 | Mestre_Grifo dá a `QuestFlag` | borda | ⏳ | | |
| QST-14 | Arch na arena | borda | ⏳ | | |

<a id="03"></a>
## 03 — Capa Verde (Formatura Aprendiz)

[Casos de uso](03-capa-verde.md) · `npm run quest -- 03`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CV-01 | Teleporte abaixo do nível | controle | ⏳ | | |
| CV-02 | Teleporte | feliz | ⏳ | | |
| CV-03 | Entrega sem emblema | controle | ⏳ | | |
| CV-04 | Emblema no inventário, não equipado | controle | ⏳ | | |
| CV-05 | Drop do emblema | feliz | ⏳ | | |
| CV-06 | Entrega | feliz | ⏳ | | |
| CV-07 | Entrega com capa | controle | ⏳ | | |
| CV-08 | Acima do nível | controle | ⏳ | | |
| CV-09 | Reset da arena | feliz | ⏳ | | |
| CV-10 | Arch pelo Lider_Aprendiz | feliz | ⏳ | | |
| CV-11 | Arch fora da faixa | controle | ⏳ | | |
| CV-12 | Mortal no Lider_Aprendiz | controle | ⏳ | | |
| CV-13 | Arch no Diretor | controle | ⏳ | | |

<a id="04"></a>
## 04 — Molar do Gárgula

[Casos de uso](04-molar-gargula.md) · `npm run quest -- 04`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| MG-01 | Teleporte abaixo do nível | controle | ⏳ | | |
| MG-02 | Teleporte | feliz | ⏳ | | |
| MG-03 | Arch | controle | ⏳ | | |
| MG-04 | Drop | feliz | ⏳ | | |
| MG-05 | Uso do molar | feliz | ⏳ | | |
| MG-06 | Uso repetido | controle | ⏳ | | |
| MG-07 | Uso fora da faixa | controle | ⏳ | | |
| MG-08 | Slot vazio | borda | ⏳ | | |
| MG-09 | Flag persiste | borda | ⏳ | | |
| MG-10 | Reset da arena | feliz | ⏳ | | |

<a id="05"></a>
## 05 — Capa do Reino (azul / vermelha) e a borda

[Casos de uso](05-capa-real.md) · `npm run quest -- 05`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CR-01 | Teleporte abaixo do nível | controle | ⏳ | | |
| CR-02 | Teleporte | feliz | ⏳ | | |
| CR-03 | Drop do emblema | feliz | ⏳ | | |
| CR-04 | Rei abaixo do nível | controle | ⏳ | | |
| CR-05 | Preço (ask) | feliz | ⏳ | | |
| CR-06 | Capa pelo emblema | feliz | ⏳ | | |
| CR-07 | Sem emblema e sem safira | controle | ⏳ | | |
| CR-08 | Rei do outro reino | controle | ⏳ | | |
| CR-09 | Capa já com borda | controle | ⏳ | | |
| CR-10 | Borda antes do nível | controle | ⏳ | | |
| CR-11 | Borda pelo emblema | feliz | ⏳ | | |
| CR-12 | Pagamento em safiras | feliz | ⏳ | | |
| CR-13 | Mortal acima de 254 no Guarda | controle | ⏳ | | |

<a id="06"></a>
## 06 — Terra Mística (Defendendo a Terra Mística)

[Casos de uso](06-terra-mistica.md) · `npm run quest -- 06`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| TM-01 | Sozinho | controle | ⏳ | | |
| TM-02 | Ask | controle | ⏳ | | |
| TM-03 | Membro, não líder | controle | ⏳ | | |
| TM-04 | Aceitar | feliz | ⏳ | | |
| TM-05 | Aceitar de novo | controle | ⏳ | | |
| TM-06 | Recompensa antes da hora | controle | ⏳ | | |
| TM-07 | Concluir a missão | feliz | ⏳ | | |
| TM-08 | Recompensa | feliz | ⏳ | | |
| TM-09 | Faixa do amuleto | borda | ⏳ | | |
| TM-10 | Recompensa repetida | controle | ⏳ | | |
| TM-11 | Arch | controle | ⏳ | | |

<a id="07"></a>
## 07 — Pílula do Poder Mágico (Conquista do Castelo Orc)

[Casos de uso](07-pilula-orc.md) · `npm run quest -- 07`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| PO-01 | Pegar a pílula | feliz | ⏳ | | |
| PO-01b | Pegar com a flag já gravada | controle | ⏳ | | |
| PO-02 | Usar a pílula | feliz | ⏳ | | |
| PO-03 | Segunda pílula | controle | ⏳ | | |
| PO-04 | Persistência | borda | ⏳ | | |

<a id="08"></a>
## 08 — Círculo Divino (Jeffi e Shama)

[Casos de uso](08-circulo-divino.md) · `npm run quest -- 08`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CD-01 | Purificar sem gold | controle | ⏳ | | |
| CD-02 | Purificar | feliz | ⏳ | | |
| CD-03 | Shama sem círculo puro | controle | ⏳ | | |
| CD-04 | Reiniciar | feliz | ⏳ | | |
| CD-05 | Segundo círculo comum | controle | ⏳ | | |
| CD-06 | Círculo completo depois do comum | borda | ⏳ | | |
| CD-07 | Special abaixo do teto | borda | ⏳ | | |

<a id="09"></a>
## 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei

[Casos de uso](09-arch-cadeia.md) · `npm run quest -- 09`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| AR-01 | Oráculo sem almas | controle | ⏳ | | |
| AR-02 | Almas fora de ordem | controle | ⏳ | | |
| AR-03 | Sem safiras | controle | ⏳ | | |
| AR-04 | Pedra da Imortalidade | feliz | ⏳ | | |
| AR-05 | Pacote de safiras | borda | ⏳ | | |
| AR-06 | Refino da pedra de boss | feliz | ⏳ | | |
| AR-07 | Sephirot (ask) | controle | ⏳ | | |
| AR-08 | Sephirot sem gold | controle | ⏳ | | |
| AR-09 | Sephirot faltando pedra | controle | ⏳ | | |
| AR-10 | Sephirot | feliz | ⏳ | | |
| AR-11 | Sephirot de cada mestre | feliz | ⏳ | | |
| AR-12 | Rei | coberto | ⏳ | | |

<a id="10"></a>
## 10 — Destravas do Arch: Lindy 355/370 e Cristais

[Casos de uso](10-arch-destravas.md) · `npm run quest -- 10`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| LD-01 | Mortal na Lindy | controle | ⏳ | | |
| LD-02 | Arch fora do nível | controle | ⏳ | | |
| LD-03 | Receita errada | controle | ⏳ | | |
| LD-04 | Destrava 355 | feliz | ⏳ | | |
| LD-05 | 355 de novo | controle | ⏳ | | |
| LD-06 | 355 acima do nível | borda | ⏳ | | |
| LD-07 | 370 sem Fame | controle | ⏳ | | |
| LD-08 | Destrava 370 | feliz | ⏳ | | |
| CR-01 | Cristal fora de ordem | controle | ⏳ | | |
| CR-02 | Etapa 1 | feliz | ⏳ | | |
| CR-03 | Etapa repetida | controle | ⏳ | | |
| CR-04 | Quatro etapas | feliz | ⏳ | | |
| CR-05 | Mortal com cristal | borda | ⏳ | | |
| CR-06 | Exp abaixo de 100M | borda | ⏳ | | |

<a id="11"></a>
## 11 — Alma do Mortal (Kibita)

[Casos de uso](11-alma-mortal-kibita.md) · `npm run quest -- 11`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| KB-01 | Abaixo do nível | controle | ⏳ | | |
| KB-02 | Pedra de outra classe | controle | ⏳ | | |
| KB-03 | Alma do Mortal | feliz | ⏳ | | |
| KB-04 | Depois do relogin | feliz | ⏳ | | |
| KB-05 | Repetir | controle | ⏳ | | |
| KB-06 | Arch | controle | ⏳ | | |
| KB-07 | Sem reino | borda | ⏳ | | |

<a id="12"></a>
## 12 — Pedra Ideal e Arch → Celestial

[Casos de uso](12-celestial.md) · `npm run quest -- 12`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CE-01 | Pedra Ideal | feliz | ⏳ | | |
| CE-02 | Faltando uma Pedra Secreta | controle | ⏳ | | |
| CE-03 | Mortal com as 4 pedras no Rei | borda | ⏳ | | |
| CE-04 | Celestial com armadura | controle | ⏳ | | |
| CE-05 | Arch abaixo do nível | controle | ⏳ | | |
| CE-06 | Mortal de origem baixo | controle | ⏳ | | |
| CE-07 | Celestial | feliz | ⏳ | | |
| CE-08 | 1742 com o botão direito | borda | ⏳ | | |
| CE-09 | Faixa da Cythera | borda | ⏳ | | |

<a id="13"></a>
## 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial

[Casos de uso](13-celestial-destravas.md) · `npm run quest -- 13`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CL-01 | Lv40 fora do nível | controle | ⏳ | | |
| CL-02 | Lv40 | feliz | ⏳ | | |
| CL-03 | Lv40 de novo | controle | ⏳ | | |
| CL-04 | Lv90 sem Fama | controle | ⏳ | | |
| CL-05 | Lv90 | feliz | ⏳ | | |
| CL-06 | Arcana | feliz | ⏳ | | |
| CL-07 | Arcana herdando o `Circle` | borda | ⏳ | | |
| CL-08 | Reset | feliz | ⏳ | | |
| CL-09 | Comandos que pulam quest | borda | ⏳ | | |
| CL-10 | Adds do Sub | feliz | ⏳ | | |

<a id="14"></a>
## 14 — Sub-Celestial e troca de subclasse (Urnammu)

[Casos de uso](14-sub-celestial.md) · `npm run quest -- 14`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| SC-01 | Sub sem Sephirot | controle | ⏳ | | |
| SC-02 | Sub abaixo do nível | controle | ⏳ | | |
| SC-03 | Criar o Sub | feliz | ⏳ | | |
| SC-04 | Sub de novo | controle | ⏳ | | |
| SC-05 | Urnammu sem Fama | controle | ⏳ | | |
| SC-06 | Trocar a subclasse | feliz | ⏳ | | |
| SC-07 | Urnammu para Celestial puro | controle | ⏳ | | |

## Issues abertas

(nenhuma ainda)
