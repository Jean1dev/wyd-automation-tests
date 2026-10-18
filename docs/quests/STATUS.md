# Status das quests

Situação de cada caso de uso de `docs/quests/`, validado no Railway com `npm run quest -- NN --case ID`. Cada caso roda numa conta nova e recebe a pré-condição pelo banco (`src/db/seed.ts`).

Legenda: ✅ passa · ❌ reprova (com issue) · ⏸️ bloqueado (motivo na nota) · ⏳ pendente.

## Resumo

| # | Quest | Casos | ✅ | ❌ | ⏸️ | ⏳ |
|---|---|---|---|---|---|---|
| [01](#01) | Novato: os quatro treinadores do Campo de Treino | 12 | 2 | 10 | 0 | 0 |
| [02](#02) | Quest 256: as cinco arenas e os troféus | 14 | 13 | 1 | 0 | 0 |
| [03](#03) | Capa Verde (Formatura Aprendiz) | 13 | 12 | 1 | 0 | 0 |
| [04](#04) | Molar do Gárgula | 10 | 6 | 4 | 0 | 0 |
| [05](#05) | Capa do Reino (azul / vermelha) e a borda | 13 | 10 | 3 | 0 | 0 |
| [06](#06) | Terra Mística (Defendendo a Terra Mística) | 11 | 3 | 2 | 0 | 6 |
| [07](#07) | Pílula do Poder Mágico (Conquista do Castelo Orc) | 5 | 0 | 0 | 0 | 5 |
| [08](#08) | Círculo Divino (Jeffi e Shama) | 7 | 0 | 0 | 0 | 7 |
| [09](#09) | Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei | 12 | 0 | 0 | 0 | 12 |
| [10](#10) | Destravas do Arch: Lindy 355/370 e Cristais | 14 | 0 | 0 | 0 | 14 |
| [11](#11) | Alma do Mortal (Kibita) | 7 | 0 | 0 | 0 | 7 |
| [12](#12) | Pedra Ideal e Arch → Celestial | 9 | 0 | 0 | 0 | 9 |
| [13](#13) | Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial | 10 | 0 | 0 | 0 | 10 |
| [14](#14) | Sub-Celestial e troca de subclasse (Urnammu) | 7 | 0 | 0 | 0 | 7 |
| | **Total** | **144** | **46** | **21** | **0** | **77** |

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
| QST-13 | Mestre_Grifo dá a `QuestFlag` | borda | ✅ | | informativo (só no Go): MSG_Quest no Mestre_Grifo no exibido 40, sem ticket, levou para (2399,2106) na arena do Coveiro e ficou (QuestFlag 1) |
| QST-14 | Arch na arena | borda | ✅ | | Arch (class_master 1) no exibido 40: Vela consumida, teleportado para (2395,2105) e ficou na arena |

<a id="03"></a>
## 03 — Capa Verde (Formatura Aprendiz)

[Casos de uso](03-capa-verde.md) · `npm run quest -- 03`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CV-01 | Teleporte abaixo do nível | controle | ✅ | | exibido 99: o Diretor recusa (NoticeReqNotMet 15), sem teleporte, ficou em (2244,1597) |
| CV-02 | Teleporte | feliz | ✅ | | exibido 100: teleportado para (2242,1576), dentro da arena |
| CV-03 | Entrega sem emblema | controle | ✅ | | na arena (teleporte do Diretor) sem o 4080: o Chefe_Treina. recusa (NoticeReqNotMet 15), nada muda, Equip[15] vazio |
| CV-04 | Emblema no inventário, não equipado | controle | ✅ | | 4080 no inventário (slot 0): o Chefe_Treina. recusa (NoticeReqNotMet 15), o emblema fica, Equip[15] vazio |
| CV-05 | Drop do emblema | feliz | ✅ | | exibido 140: o 4080 caiu no inventário no 1º kill do Chefe_Taurus (1,2 min, 15:20 UTC); a 1ª rodada fez 5 Chefe + 63 Taurus_Maligno em 15 min sem drop (chance ≈ 1/4 e 1/225 por kill) |
| CV-06 | Entrega | feliz | ✅ | | exibido 101 (o 4080 pede ReqLvl 100 contra o armazenado, como no legado): equipou no Equip[13], entregou; Equip[13] vazio, Equip[15] = 4006, AC 1307→1337; banco igual depois do relog |
| CV-07 | Entrega com capa | controle | ✅ | | com o 4006 no Equip[15] e o 4080 no Equip[13]: o Chefe_Treina. recusa (NoticeAlreadyDone 47), o emblema fica |
| CV-08 | Acima do nível | controle | ✅ | | exibido 151 com o 4080 no Equip[13]: o Diretor recusa (15); entrou a pé; o Chefe_Treina. recusa (NoticeReqNotMet 15), nada muda |
| CV-09 | Reset da arena | feliz | ✅ | | entrou pelo Diretor; o reset mandou para Armia (2100,2096) 523 s depois (15:37:29 UTC), dentro do ciclo de 10 min |
| CV-10 | Arch pelo Lider_Aprendiz | feliz | ❌ | [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) | Arch armazenado 99 sem capa: o Lider_Aprendiz não responde (Merchant 100 grade 5 sem rota no Go, misc.go:259); Equip[15] vazio, também no banco |
| CV-11 | Arch fora da faixa | controle | ✅ | | Arch armazenado 98: nada muda, Equip[15] vazio — mas o Lider_Aprendiz não responde a ninguém no Go (#397) |
| CV-12 | Mortal no Lider_Aprendiz | controle | ✅ | | Mortal exibido 100: nada muda, Equip[15] vazio — mas o Lider_Aprendiz não responde a ninguém no Go (#397) |
| CV-13 | Arch no Diretor | controle | ✅ | | Arch exibido 100: o Diretor recusa (NoticeReqNotMet 15), sem teleporte |

<a id="04"></a>
## 04 — Molar do Gárgula

[Casos de uso](04-molar-gargula.md) · `npm run quest -- 04`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| MG-01 | Teleporte abaixo do nível | controle | ✅ | | Mortal exibido 199: a Patrulha__ recusa (NoticeReqNotMet 15), sem teleporte |
| MG-02 | Teleporte | feliz | ✅ | | Mortal exibido 200: teleportado para (817,4060), dentro da arena |
| MG-03 | Arch | controle | ✅ | | Arch exibido 200: a Patrulha__ recusa (NoticeReqNotMet 15), sem teleporte |
| MG-04 | Drop | feliz | ✅ | | o 4122 caiu ao matar um Gargula_Inf, 7 kills (6 Servo, 1 Inf) em 4,5 min com a viagem |
| MG-05 | Uso do molar | feliz | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | MessageBoxOk 39 (NoticeCantUseHere): refinação +0 +3 +5 +7 +1 igual (banco também), o 4122 fica, AC 1992→1992 |
| MG-06 | Uso repetido | controle | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | pré-condição não acontece: o primeiro 4122 já é recusado (NoticeCantUseHere) e não refina; o segundo também (não há flag MolarGargula) |
| MG-07 | Uso fora da faixa | controle | ✅ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | exibido 255: recusa (NoticeCantUseHere 39), o 4122 fica, refinação intacta — vácuo: o Vol 194 é recusado para todos (#398) |
| MG-08 | Slot vazio | borda | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | Equip[3] vazio: NoticeCantUseHere, as outras peças continuam +0 +3 +7 +1 (banco também), AC 1512→1512 |
| MG-09 | Flag persiste | borda | ❌ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | pré-condição (MG-05) não acontece: o primeiro 4122 é recusado (NoticeCantUseHere); depois do relog, idem; não há flag MolarGargula para persistir |
| MG-10 | Reset da arena | feliz | ✅ | | entrou pela Patrulha__; mandado para Armia (2097,2095) 53 s depois, às 16:17:29 UTC |

<a id="05"></a>
## 05 — Capa do Reino (azul / vermelha) e a borda

[Casos de uso](05-capa-real.md) · `npm run quest -- 05`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CR-01 | Teleporte abaixo do nível | controle | ✅ | | Mortal exibido 199: o Guarda_Real recusa (NoticeReqNotMet 15), sem teleporte |
| CR-02 | Teleporte | feliz | ✅ | | Mortal exibido 200: teleportado para (1740,1722), dentro da área dos Cav._Mortal |
| CR-03 | Drop do emblema | feliz | ✅ | | o 4081 caiu ao matar um Cav._Mortal____, 15 kills (13 Cav._Mortal___, 2 Cav._Mortal____) em 8,7 min com a viagem, 0 mortes |
| CR-04 | Rei abaixo do nível | controle | ✅ | | exibido 219 com o 4081 no Equip[13] e 4 safiras (preço exato): Rei_Harabard recusa (NoticeReqNotMet 15, o legado manda _NN_Need_Level); nada muda, banco igual |
| CR-05 | Preço (ask) | feliz | ✅ | | confirm 0, exibido 220 com o 4081 e 4 safiras: "Sao necessarias 4 safiras." (preço do sapphire_balance); nada muda, banco igual |
| CR-06 | Capa pelo emblema | feliz | ❌ | [#399](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) | exibido 220, 4081 no Equip[13], sem safiras: "Sao necessarias 4 safiras em pagamento exato."; o 4081 fica, Equip[15] vazio (banco igual) |
| CR-07 | Sem emblema e sem safira | controle | ✅ | | exibido 220 sem 4081 e sem safiras: "Sao necessarias 4 safiras em pagamento exato."; nada muda, banco igual |
| CR-08 | Rei do outro reino | controle | ✅ | | 545 no Rei_Glantuar (exibido 256, 4081 e 14 safiras): NoticeReqNotMet 15 (o legado sai calado); nada muda, banco igual |
| CR-09 | Capa já com borda | controle | ✅ | | 543 no Rei_Harabard (exibido 256, 4081 e 4 safiras): "A capa deste reino ja esta completa."; nada muda, banco igual |
| CR-10 | Borda antes do nível | controle | ✅ | | 545, exibido 255, 4081 e 4 safiras: NoticeReqNotMet 15 (o legado manda _NN_Need_Level); nada muda, banco igual |
| CR-11 | Borda pelo emblema | feliz | ❌ | [#399](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) | 545, exibido 256, 4081 e sem safiras: "Sao necessarias 4 safiras em pagamento exato."; a 545 e o 4081 ficam (banco igual) |
| CR-12 | Pagamento em safiras | feliz | ❌ | [#400](https://github.com/Jean1dev/w2pp-OpenWYD/issues/400) | 1 × 4131 para o preço 4: "Sao necessarias 4 safiras em pagamento exato.", nada muda; com 4 × 697 (exato) recebe a 545 e o clan vira 7 |
| CR-13 | Mortal acima de 254 no Guarda | controle | ✅ | | Mortal exibido 255: o Guarda_Real recusa (NoticeReqNotMet 15), sem teleporte |

<a id="06"></a>
## 06 — Terra Mística (Defendendo a Terra Mística)

[Casos de uso](06-terra-mistica.md) · `npm run quest -- 06`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| TM-01 | Sozinho | controle | ✅ |  | Mortal sem grupo, confirm 1: o Cap.Mercenario recusa (NoticeReqNotMet 15, o legado manda _NN_Party_Only); terra_mistica 0 no banco depois do relog |
| TM-02 | Ask | controle | ✅ |  | líder de grupo (convite aceito, 0x037D), confirm 0: nada muda, terra_mistica 0 no banco; o Go não responde (o legado manda a fala _NN_Monster_Attaking_Us_Help) |
| TM-03 | Membro, não líder | controle | ✅ |  | membro do grupo da conta B, confirm 1: recusa (NoticeReqNotMet 15, o legado manda _NN_Party_Only); terra_mistica 0 no banco |
| TM-04 | Aceitar | feliz | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) | líder com a conta B no grupo, confirm 1: sem resposta; o segundo pedido já recusa (NoticeReqNotMet 15, flag 1 em memória), mas terra_mistica 0 no banco depois do relog (o save não leva a flag) |
| TM-05 | Aceitar de novo | controle | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) | terra_mistica 1 semeado, líder com membro, confirm 1: recusa na hora (NoticeReqNotMet 15, o legado manda _NN_Hurry_Helping_them), mas a flag vira 0 no banco depois do relog (o save não leva a flag) |
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
