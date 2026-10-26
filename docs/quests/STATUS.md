# Status das quests

Situação de cada caso de uso de `docs/quests/`, validado no Railway com `npm run quest -- NN --case ID`. Cada caso roda numa conta nova e recebe a pré-condição pelo banco (`src/db/seed.ts`).

Legenda: ✅ passa · ❌ reprova (com issue) · ⏸️ bloqueado (motivo na nota) · ⏳ pendente.

## Resumo

| # | Quest | Casos | ✅ | ❌ | ⏸️ | ⏳ |
|---|---|---|---|---|---|---|
| [01](#01) | Novato: os quatro treinadores do Campo de Treino | 12 | 12 | 0 | 0 | 0 |
| [02](#02) | Quest 256: as cinco arenas e os troféus | 14 | 14 | 0 | 0 | 0 |
| [03](#03) | Capa Verde (Formatura Aprendiz) | 13 | 13 | 0 | 0 | 0 |
| [04](#04) | Molar do Gárgula | 10 | 10 | 0 | 0 | 0 |
| [05](#05) | Capa do Reino (azul / vermelha) e a borda | 13 | 13 | 0 | 0 | 0 |
| [06](#06) | Terra Mística (Defendendo a Terra Mística) | 11 | 11 | 0 | 0 | 0 |
| [07](#07) | Pílula do Poder Mágico (Conquista do Castelo Orc) | 5 | 5 | 0 | 0 | 0 |
| [08](#08) | Círculo Divino (Jeffi e Shama) | 7 | 7 | 0 | 0 | 0 |
| [09](#09) | Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei | 12 | 12 | 0 | 0 | 0 |
| [10](#10) | Destravas do Arch: Lindy 355/370 e Cristais | 14 | 14 | 0 | 0 | 0 |
| [11](#11) | Alma do Mortal (Kibita) | 7 | 7 | 0 | 0 | 0 |
| [12](#12) | Pedra Ideal e Arch → Celestial | 9 | 9 | 0 | 0 | 0 |
| [13](#13) | Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial | 10 | 10 | 0 | 0 | 0 |
| [14](#14) | Sub-Celestial e troca de subclasse (Urnammu) | 15 | 13 | 0 | 2 | 0 |
| [15](#15) | PvP em Armia e duelo 1x1 | 20 | 20 | 0 | 0 | 0 |
| | **Total** | **172** | **170** | **0** | **2** | **0** |

<a id="01"></a>
## 01 — Novato: os quatro treinadores do Campo de Treino

[Casos de uso](01-novato-treinadores.md) · `npm run quest -- 01`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| NOV-01 | Passo 1 sem a chave | controle | ✅ |  | 2026-10-26: (17:29 UTC) regressão: Treinador1 sem a chave fala Cheerup1 ("Se não possuir a chave Gremlin Isca…"); nada muda no inventário |
| NOV-02 | Passo 1 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:29 UTC) regressão: com a 451, Kit 682 ×20 no inventário, 451 mantida; Kit e newbie_quest 1 no banco depois do relog |
| NOV-03 | Passo 1 de novo | controle | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:30 UTC) regressão: newbie_quest 1 semeado, com a 451: fala Already1 ("Deus te abençoe."), nada muda; flag continua 1 no banco |
| NOV-04 | Pular passo | controle | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:31 UTC) regressão: newbie_quest 1 semeado, Treinador3 com a 453: fala Already3, equipamento igual; flag continua 1 |
| NOV-05 | Passo 2 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:32 UTC) regressão: newbie_quest 1 semeado: Lança_Curva com adicionais refeitos ([[60,12],[59,0]]), salvos; newbie_quest 2 no banco |
| NOV-06 | Passo 2 com arma de ReqLvl > 39 | borda | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:33 UTC) regressão: newbie_quest 1 semeado, Lança_do_Vento (ReqLvl 43): arma igual no cliente e no banco, newbie_quest 2 |
| NOV-07 | Passo 3 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:34 UTC) regressão: newbie_quest 2 semeado: Equip[1..6] com adicional novo e +3, salvos; broquel (nPos 128) igual; newbie_quest 3 |
| NOV-08 | Passo 3 com slot vazio | borda | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:35 UTC) regressão: newbie_quest 2 semeado, Equip[2] vazio: peças com +3, Equip[2] continua vazio (efeitos zerados); newbie_quest 3 |
| NOV-09 | Passo 4 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:36 UTC) regressão: newbie_quest 3 semeado: 524 consumida, recompensa 481 salva; newbie_quest 4 no banco |
| NOV-10 | Acima do nível | controle | ✅ |  | 2026-10-26: (17:36 UTC) regressão: exibido 36 com a 451: fala Already1, nada muda |
| NOV-11 | Flag persiste | borda | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:38 UTC) regressão: passo 2 feito jogando, relog: newbie_quest 2 no banco; Treinador2 de novo fala Already2 ("Você é um cara de sorte."), arma igual |
| NOV-12 | Treinador1 não é Coveiro | controle | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-26: (17:38 UTC) regressão: exibido 40 com a Vela 4038: Treinador1 fala Already1, sem teleporte, Vela fica |

<a id="02"></a>
## 02 — Quest 256: as cinco arenas e os troféus

[Casos de uso](02-quest256-tickets.md) · `npm run quest -- 02`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| QST-01 | Entrega do ticket | feliz (cenários 2/4) | ✅ | 2026-10-26 17:41 UTC: exibido 40 com a Vela: Vela consumida, teleportado para (2395,2103) e ficou 6 s na arena (QuestFlag 1) |
| QST-02 | Sem ticket / ticket de outro passo | controle (cenários 2/4) | ✅ | 2026-10-26 17:43 UTC: exibido 40 com 4039 e 4041, sem a Vela: o Coveiro recusa (NoticeReqNotMet 15), nada some, sem teleporte |
| QST-03 | Um nível abaixo do mínimo | controle (cenário 4) | ✅ | 2026-10-26 17:44 UTC: exibido 39 com a Vela: o Coveiro recusa (NoticeReqNotMet 15), a Vela fica, sem teleporte |
| QST-04 | Intruso | controle (cenários 2/4) | ✅ | 2026-10-26 17:46 UTC: sem QuestFlag, entrou a pé em (2381,2112) e o guarda mandou para Armia (2092,2093) |
| QST-05 | Reset | feliz (cenários 2/4) | ✅ | 2026-10-26 17:48 UTC: o reset mandou para Armia (2098,2101) 80 s depois da entrada (17:48:58 UTC), dentro do ciclo de 10 min; 79 MSG_StartTime na espera |
| QST-06 | Relogin dentro da arena | borda | ✅ | 2026-10-26 17:50 UTC: relog dentro da arena: voltou em Armia (2088,2099), fora da arena |
| QST-07 | Acima do máximo | controle | ✅ | 2026-10-26 17:52 UTC: exibido 116 (armazenado 115 = máximo exclusivo) com a Vela: recusa (NoticeReqNotMet 15), a Vela fica, sem teleporte |
| QST-08 | Drop do troféu | feliz | ✅ | 2026-10-26 17:53 UTC: exibido 115 com equipamento semeado: a primeira Aparição morta pôs a Caixa_da_Sabedoria 4117 direto no inventário (slot 0) em 1,4 min |
| QST-09 | Usar o troféu | feliz | ✅ | [~~#396~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396) corrigida no #411 | 2026-10-26 17:54 UTC: exibido 115, 2 Caixas 4117 sem grupo: +33000 exp (30000 + 10 % de líder, como o legado), +10000 gold, sobrou 1; banco coin 11000 / exp 33000 |
| QST-10 | Troféu fora da faixa | controle | ✅ | 2026-10-26 17:54 UTC: exibido 116 com a 4117: recusa (NoticeReqNotMet 15), a Caixa fica no slot, exp e gold iguais |
| QST-11 | Troféu em grupo | borda | ✅ | 2026-10-26 17:54 UTC: grupo pela segunda conta; o membro usou a 4117: membro +30000, líder +3000 (10 %) |
| QST-12 | Ticket com o botão direito | borda | ✅ | 2026-10-26 17:54 UTC: informativo (só no Go): clique direito na Vela ×2 em Armia teleportou para (2397,2102), sobrou 1, ficou na arena (QuestFlag 1) |
| QST-13 | Mestre_Grifo dá a `QuestFlag` | borda | ✅ | 2026-10-26 17:55 UTC: informativo (só no Go): MSG_Quest no Mestre_Grifo no exibido 40, sem ticket, levou para (2399,2103) na arena do Coveiro e ficou (QuestFlag 1) |
| QST-14 | Arch na arena | borda | ✅ | 2026-10-26 17:57 UTC: Arch (class_master 1) no exibido 40: Vela consumida, teleportado para (2398,2103) e ficou na arena |

<a id="03"></a>
## 03 — Capa Verde (Formatura Aprendiz)

[Casos de uso](03-capa-verde.md) · `npm run quest -- 03`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CV-01 | Teleporte abaixo do nível | controle | ✅ | | 2026-10-26 17:59 UTC: exibido 99: o Diretor recusa (NoticeReqNotMet 15), sem teleporte, ficou em (2244,1597) |
| CV-02 | Teleporte | feliz | ✅ | | 2026-10-26 18:00 UTC: exibido 100: teleportado para (2246,1573), dentro da arena |
| CV-03 | Entrega sem emblema | controle | ✅ | | 2026-10-26 18:01 UTC: na arena (teleporte do Diretor) sem o 4080: o Chefe_Treina. recusa (NoticeReqNotMet 15), nada muda, Equip[15] vazio |
| CV-04 | Emblema no inventário, não equipado | controle | ✅ | | 2026-10-26 18:02 UTC: 4080 no inventário (slot 0): o Chefe_Treina. recusa (NoticeReqNotMet 15), o emblema fica, Equip[15] vazio |
| CV-05 | Drop do emblema | feliz | ✅ | | 2026-10-26 18:04 UTC: o 4080 caiu no inventário no 1º kill do Chefe_Taurus (1,1 min) |
| CV-06 | Entrega | feliz | ✅ | | 2026-10-26 18:05 UTC: exibido 101: equipou no Equip[13], entregou; Equip[13] vazio, Equip[15] = 4006, AC 1307→1337; banco igual depois do relog |
| CV-07 | Entrega com capa | controle | ✅ | | 2026-10-26 18:06 UTC: com o 4006 no Equip[15] e o 4080 no Equip[13]: o Chefe_Treina. recusa (NoticeAlreadyDone 47), o emblema fica |
| CV-08 | Acima do nível | controle | ✅ | | 2026-10-26 18:07 UTC: exibido 151 com o 4080 no Equip[13]: o Diretor recusa (15); entrou a pé; o Chefe_Treina. recusa (NoticeReqNotMet 15), nada muda |
| CV-09 | Reset da arena | feliz | ✅ | | 2026-10-26 18:08 UTC: entrou pelo Diretor; o reset mandou para Armia (2094,2097) 8 s depois (18:08:58 UTC), dentro do ciclo de 10 min |
| CV-10 | Arch pelo Lider_Aprendiz | feliz | ✅ | [~~#397~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) corrigida no #411 | 2026-10-26 18:11 UTC: Arch armazenado 99 sem capa: Equip[15] = 4006 (banco também), AC 1532→1562 |
| CV-11 | Arch fora da faixa | controle | ✅ | [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) | 2026-10-26 18:13 UTC: Arch armazenado 98: o Lider_Aprendiz recusa com _NN_Level_Limit2 ("Seu nível não permite o uso disto."), Equip[15] vazio, nada muda |
| CV-12 | Mortal no Lider_Aprendiz | controle | ✅ | [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) | 2026-10-26 18:15 UTC: Mortal exibido 100: o Lider_Aprendiz recusa com _SN_NEEDCLASS ("Somente personagem Arch."), Equip[15] vazio, nada muda |
| CV-13 | Arch no Diretor | controle | ✅ | | 2026-10-26 18:16 UTC: Arch exibido 100: o Diretor recusa (NoticeReqNotMet 15), sem teleporte |

<a id="04"></a>
## 04 — Molar do Gárgula

[Casos de uso](04-molar-gargula.md) · `npm run quest -- 04`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| MG-01 | Teleporte abaixo do nível | controle | ✅ | | 2026-10-26 18:21 UTC: Mortal exibido 199: a Patrulha__ recusa (NoticeReqNotMet 15), sem teleporte, ficou em (789,4060) |
| MG-02 | Teleporte | feliz | ✅ | | 2026-10-26 18:25 UTC: Mortal exibido 200: teleportado para (817,4060), dentro da arena |
| MG-03 | Arch | controle | ✅ | | 2026-10-26 18:28 UTC: Arch exibido 200: a Patrulha__ recusa (NoticeReqNotMet 15), sem teleporte |
| MG-04 | Drop | feliz | ✅ | | 2026-10-26 18:32 UTC: o 4122 caiu ao matar um Gargula_Inf, 7 kills (6 Servo, 1 Inf) em 4,3 min com a viagem |
| MG-05 | Uso do molar | feliz | ✅ | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida no #411 | 2026-10-26 18:33 UTC: refinação +0 +3 +5 +7 +1 → +6 +6 +6 +7 +6 (banco igual), o 4122 some, "Você concluiu a Quest Molar do Gargula.", molar_gargula 1 no banco, AC 1992→2324 |
| MG-06 | Uso repetido | controle | ✅ | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida no #411 | 2026-10-26 18:33 UTC: molar_gargula 1 semeado: "Você já completou esta Quest.", o 4122 volta ao slot, refinação intacta (banco igual) |
| MG-07 | Uso fora da faixa | controle | ✅ | [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | 2026-10-26 18:34 UTC: Mortal exibido 255: "Nível Insuficiente. Isto não pode ser utilizado." (_NN_Level_limit), o 4122 fica, refinação intacta, molar_gargula 0 |
| MG-08 | Slot vazio | borda | ✅ | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida no #411 | 2026-10-26 18:34 UTC: Equip[3] vazio: +0 +3 — +7 +1 → +6 +6 — +7 +6 (banco igual), o 4122 some, molar_gargula 1, AC 1512→1812 |
| MG-09 | Flag persiste | borda | ✅ | [~~#398~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) corrigida no #411 | 2026-10-26 18:35 UTC: primeiro uso refinou e gravou molar_gargula 1; relog com as peças em +0: "Você já completou esta Quest.", o 4122 fica, +0 intacto (banco igual) |
| MG-10 | Reset da arena | feliz | ✅ | | 2026-10-26 18:38 UTC: entrou pela Patrulha__; mandado para Armia (2091,2103) 18 s depois, às 18:38:58 UTC |

<a id="05"></a>
## 05 — Capa do Reino (azul / vermelha) e a borda

[Casos de uso](05-capa-real.md) · `npm run quest -- 05`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CR-01 | Teleporte abaixo do nível | controle | ✅ | | 2026-10-26 18:43 UTC: Mortal exibido 199: o Guarda_Real recusa (NoticeReqNotMet 15), sem teleporte, ficou em (1756,1585) |
| CR-02 | Teleporte | feliz | ✅ | | 2026-10-26 18:45 UTC: Mortal exibido 200: teleportado para (1741,1725), dentro da área dos Cav._Mortal |
| CR-03 | Drop do emblema | feliz | ✅ |  | 2026-10-26 18:49 UTC: o 4081 caiu no inventário (slot 0) na 1ª kill de Cav._Mortal____, 0 mortes, 3,1 min com a viagem |
| CR-04 | Rei abaixo do nível | controle | ✅ |  | 2026-10-26 18:52 UTC: exibido 219 com 4081 e 10 safiras: "Não possui nível suficiente, retorne mais tarde." (_NN_Need_Level); nada muda, banco igual |
| CR-05 | Preço (ask) | feliz | ✅ | | 2026-10-26 18:55 UTC: confirm 0, exibido 220 com o 4081 e 10 safiras: "Sao necessarias 10 safiras." (preço do sapphire_balance); nada muda, banco igual |
| CR-06 | Capa pelo emblema | feliz | ✅ | [~~#399~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) corrigida no #411 | 2026-10-26 18:58 UTC: exibido 220, 4081 e sem safiras: Equip[13] vazio, Equip[15] 545, clan 7 (banco igual), "Que a luz de Sephira o ilumine." |
| CR-07 | Sem emblema e sem safira | controle | ✅ |  | 2026-10-26 19:01 UTC: exibido 220 sem 4081 e sem safiras: "Sao necessarias 11 safiras." (preço do sapphire_balance); nada muda, banco igual |
| CR-08 | Rei do outro reino | controle | ✅ |  | 2026-10-26 19:03 UTC: 545 no Rei_Glantuar (exibido 256, 4081 e safiras): sem resposta, como o break do legado; nada muda, banco igual |
| CR-09 | Capa já com borda | controle | ✅ |  | 2026-10-26 19:06 UTC: 543 no Rei_Harabard: "Que a luz de Sephira o ilumine." (_NN_My_King_Bless1, CapeMode 2); nada muda, banco igual |
| CR-10 | Borda antes do nível | controle | ✅ |  | 2026-10-26 19:09 UTC: 545, exibido 255, 4081 e safiras: "Não possui nível suficiente, retorne mais tarde." (_NN_Need_Level); nada muda, banco igual |
| CR-11 | Borda pelo emblema | feliz | ✅ | [~~#399~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) corrigida no #411 | 2026-10-26 19:11 UTC: 545, exibido 256, 4081 e sem safiras: Equip[13] vazio, Equip[15] 543, clan 7 (banco igual), Bless1 |
| CR-12 | Pagamento em safiras | feliz | ✅ | [~~#400~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/400) corrigida no #411 | 2026-10-26 19:14 UTC: 2 × 4131 (20 safiras) para o preço 12: as safiras somem (0), Equip[15] 545, clan 7 (banco igual), Bless1 — o Clan pela guilda do líder (pendência do #411) não é coberto |
| CR-13 | Mortal acima de 254 no Guarda | controle | ✅ | | 2026-10-26 19:17 UTC: Mortal exibido 255: o Guarda_Real recusa (NoticeReqNotMet 15), sem teleporte |

<a id="06"></a>
## 06 — Terra Mística (Defendendo a Terra Mística)

[Casos de uso](06-terra-mistica.md) · `npm run quest -- 06`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| TM-01 | Sozinho | controle | ✅ |  | 2026-10-26: (19:21 UTC) regressão: Mortal sem grupo, confirm 1: recusa NoticeReqNotMet 15; terra_mistica 0 no banco, inventário igual |
| TM-02 | Ask | controle | ✅ |  | 2026-10-26: (19:23 UTC) regressão: líder de grupo, confirm 0: sem resposta; terra_mistica 0 no banco, inventário igual |
| TM-03 | Membro, não líder | controle | ✅ |  | 2026-10-26: (19:25 UTC) regressão: membro do grupo da conta B, confirm 1: recusa NoticeReqNotMet 15; terra_mistica 0 no banco |
| TM-04 | Aceitar | feliz | ✅ | [~~#401~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) corrigida no #411 | 2026-10-26: (19:27 UTC) regressão: líder com a conta B no grupo, confirm 1: terra_mistica 0 → 1 no banco depois do relog (sem fala) |
| TM-05 | Aceitar de novo | controle | ✅ | [~~#401~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) corrigida no #411 | 2026-10-26: (19:29 UTC) regressão: terra_mistica 1, líder com membro, confirm 1: recusa NoticeReqNotMet 15; flag segue 1 no banco |
| TM-06 | Recompensa antes da hora | controle | ✅ | [~~#401~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) corrigida no #411 | 2026-10-26: (19:30 UTC) regressão: terra_mistica 1 no Cap.Explor.: fala "Todos da cidade agradecem a sua ajuda <nome>.", inventário igual, flag 1 no banco |
| TM-07 | Concluir a missão | feliz | ✅ | [~~#402~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402) corrigida no #411; [~~#412~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/412) corrigida no #415 | 2026-10-26: (19:34 UTC) regressão: terra_mistica 1 → 2 depois de 20 kills em 3.3 min; "Quest: Você aprova a proteção da cidade." em cp1252 |
| TM-08 | Recompensa | feliz | ✅ | [~~#403~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) corrigida no #411 | 2026-10-26: (19:36 UTC) regressão: terra_mistica 2, exibido 101: recebeu o Amuleto_Místico 560 com efeitos [[43,0],[9,17],[9,7]]; terra_mistica 3 no banco |
| TM-09 | Faixa do amuleto | borda | ✅ | [~~#403~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) corrigida no #411 | 2026-10-26: (19:37 UTC) regressão: terra_mistica 2, exibido 50: recebeu o Amuleto_de_Prata 553 com efeitos [[43,0],[4,35],[26,13]]; terra_mistica 3 no banco |
| TM-10 | Recompensa repetida | controle | ✅ | [~~#401~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) corrigida no #411 | 2026-10-26: (19:39 UTC) regressão: terra_mistica 3 no Cap.Explor.: fala de agradecimento, nenhum amuleto, flag 3 no banco |
| TM-11 | Arch | controle | ✅ |  | 2026-10-26: (19:41 UTC) regressão: Arch líder de grupo, confirm 1: recusa NoticeReqNotMet 15; terra_mistica 0 no banco, inventário igual |

<a id="07"></a>
## 07 — Pílula do Poder Mágico (Conquista do Castelo Orc)

[Casos de uso](07-pilula-orc.md) · `npm run quest -- 07`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| PO-01 | Pegar a pílula | feliz | ✅ | [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411 | 2026-10-26: (19:42 UTC) regressão: a 470 largada aos pés e pega (MSG_GetItem): "Quest: Seu ponto de skill aumentou por 9.", não volta ao inventário, SkillBonus 147→156; depois do relog 470 ×0, pilula_orc 1 no banco, SkillBonus 156 |
| PO-01b | Pegar com a flag já gravada | controle | ✅ | [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411 | 2026-10-26: (19:43 UTC) regressão: pilula_orc 1 semeado (base 156): a 470 largada e pedida recebe "Você já completou esta Quest.", não volta ao inventário e o mesmo id do chão recusa de novo (continua no chão); SkillBonus 156, flag 1 depois do relog |
| PO-02 | Usar a pílula | feliz | ✅ | [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411 | 2026-10-26: (19:43 UTC) regressão: MSG_UseItem na 470: SkillBonus 147→156, a 470 consumida; depois do relog 470 ×0, pilula_orc 1 no banco, SkillBonus 156 |
| PO-03 | Segunda pílula | controle | ✅ | [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411 | 2026-10-26: (19:43 UTC) regressão: pilula_orc 1 semeado (base 156): a 470 usada não aplica nem é consumida (o slot volta); depois do relog 470 ×1, SkillBonus 156 |
| PO-04 | Persistência | borda | ✅ | [~~#404~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) corrigida no #411 | 2026-10-26: (19:44 UTC) regressão: base 147; a 1ª 470 aplica (156); depois do relog SkillBonus 156, pilula_orc 1 no banco, 470 ×1; a 2ª não aplica nem é consumida |

<a id="08"></a>
## 08 — Círculo Divino (Jeffi e Shama)

[Casos de uso](08-circulo-divino.md) · `npm run quest -- 08`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CD-01 | Purificar sem gold | controle | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:47 UTC) regressão: 447 no Equip[13], gold 999.999: o Jeffi diz "Requer 1000000 gold."; Equip[13] 447 e gold iguais no banco depois do relog |
| CD-02 | Purificar | feliz | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:49 UTC) regressão: 447 no Equip[13], gold 1.005.000: "Processo de combinação foi concluído.", Equip[13] 450 (puro, faixa sorteada) e gold 5.000 no cliente e no banco depois do relog |
| CD-03 | Shama sem círculo puro | controle | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:51 UTC) regressão: 447 no Equip[13], Special [60×4], Learn 0xffffff: a Shaman diz "Requer Círculo Divino Puro para a reiniciar as skills."; nada muda no banco depois do relog |
| CD-04 | Reiniciar | feliz | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:53 UTC) regressão: 448, Special [60×4], Learn 0xffffff: "Skills foram reiniciadas."; SpecialBonus 200, Special [10×4], Learn 0xffff00, Equip[13] vazio, Circle 1 no banco depois do relog |
| CD-05 | Segundo círculo comum | controle | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:55 UTC) regressão: celestial_circle 1 semeado, 448 no Equip[13]: a Shaman diz "Você já completou esta Quest."; o círculo fica, Circle 1 no banco depois do relog |
| CD-06 | Círculo completo depois do comum | borda | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:57 UTC) regressão: Circle 1, 694, Special [120×4]: aceita; SpecialBonus 400, Special [20×4], Learn 0xff00ff, Equip[13] vazio, Circle 1 no banco depois do relog |
| CD-07 | Special abaixo do teto | borda | ✅ | [~~#405~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) corrigida no #411 | 2026-10-26: (19:59 UTC) regressão: 450, Special [30,60,60,60]: SpecialBonus 180, Special [0,10,10,10], Learn 0x00ffff, Equip[13] vazio no banco depois do relog |

<a id="09"></a>
## 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei

[Casos de uso](09-arch-cadeia.md) · `npm run quest -- 09`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| AR-01 | Oráculo sem almas | controle | ✅ |  | 2026-10-26: (20:02 UTC) regressão: 10 safiras, sem almas: RedOracle responde notice 15; inventário e gold iguais no cliente e no banco depois do relog |
| AR-02 | Almas fora de ordem | controle | ✅ |  | 2026-10-26: (20:04 UTC) regressão: 1741 no slot 0, 1740 no 1, 10 safiras: notice 15; nada some no cliente nem no banco depois do relog |
| AR-03 | Sem safiras | controle | ✅ |  | 2026-10-26: (20:06 UTC) regressão: almas em ordem, 9 safiras: notice 15; nada some no cliente nem no banco depois do relog |
| AR-04 | Pedra da Imortalidade | feliz | ✅ |  | 2026-10-26: (20:08 UTC) regressão: almas nos slots 0/1 e 10 × 697: as 12 somem e a 1742 entra no slot 0, no cliente e no banco depois do relog |
| AR-05 | Pacote de safiras | borda | ✅ |  | 2026-10-26: (20:10 UTC) regressão: almas nos slots 0/1 e 1 × 4131: o pacote e as almas somem e a 1742 entra no slot 0, no cliente e no banco depois do relog |
| AR-06 | Refino da pedra de boss | feliz | ✅ |  | 2026-10-26: (20:11 UTC) regressão: 412 sobre a 1752 no inventário e no Equip[11]: "Este item não pode ser mais refinado.", poeira e pedra ficam (cliente e banco) |
| AR-07 | Sephirot (ask) | controle | ✅ |  | 2026-10-26: (20:12 UTC) regressão: 8 Pedras Arch, 30.001.000 de gold, confirm 0 no Cap.Cavaleiros: sem resposta; nada muda no cliente nem no banco |
| AR-08 | Sephirot sem gold | controle | ✅ |  | 2026-10-26: (20:12 UTC) regressão: 8 Pedras Arch, gold 29.999.999, confirm 1: notice 15; pedras e gold iguais no cliente e no banco |
| AR-09 | Sephirot faltando pedra | controle | ✅ |  | 2026-10-26: (20:13 UTC) regressão: 1744–1750 + outra 1750, 30.001.000 de gold, confirm 1: notice 15; nada some no cliente nem no banco |
| AR-10 | Sephirot | feliz | ✅ | [~~#390~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) corrigida no #411 | 2026-10-26: (20:13 UTC) regressão: 8 Pedras Arch e 30.001.000 de gold, confirm 1 no Cap.Cavaleiros: pedras e 30M somem, entra a 1760 no Carry[12], gold 1.000 (cliente e banco) |
| AR-11 | Sephirot de cada mestre | feliz | ✅ | [~~#390~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) corrigida no #411 | 2026-10-26: (20:15 UTC) regressão: Foema_Ancian deu 1761, Mestre_Archi 1762, ForeLearner 1763 |
| AR-12 | Rei | coberto | ✅ |  | 2026-10-26: (20:17 UTC) regressão: Rei_Glantuar desloga, lista nova com o Arch no slot 1 (SendArchEffect 1); banco: Arch class 0, master 1, nível 0, Equip[0] 6; mortal master 2, nível 299, Equip[0] 1, sem Equip[10]/[11] |

<a id="10"></a>
## 10 — Destravas do Arch: Lindy 355/370 e Cristais

[Casos de uso](10-arch-destravas.md) · `npm run quest -- 10`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| LD-01 | Mortal na Lindy | controle | ✅ |  | 2026-10-26: (20:25 UTC) regressão: Mortal exibido 355 com a receita, ao lado da Lindy (1707,1728): CombineComplete 0; inventário e banco iguais depois do relog, Level355 0 |
| LD-02 | Arch fora do nível | controle | ✅ |  | 2026-10-26: (20:27 UTC) regressão: Arch exibido 354 (armazenado 353) com a receita: CombineComplete 0; inventário e banco iguais, Level355 0 |
| LD-03 | Receita errada | controle | ✅ |  | 2026-10-26: (20:29 UTC) regressão: Arch exibido 355 sem a 4127 (posição 2 vazia): CombineComplete 0; as 413 ficam, banco igual, Level355 0 |
| LD-04 | Destrava 355 | feliz | ✅ |  | 2026-10-26: (20:32 UTC) regressão: Poeira antes recusada ("Conclua a liberacao de nivel na Lindy"); combinação: CombineComplete 1, receita some, banco Level355 1, MaxHp 25000→25200, capa 3192; Poeira depois sobe para exibido 356 (banco nível 355) |
| LD-05 | 355 de novo | controle | ✅ |  | 2026-10-26: (20:34 UTC) regressão: Arch exibido 355 com Level355 1 e a receita: CombineComplete 0; nada some, banco igual (Level370 0) |
| LD-06 | 355 acima do nível | borda | ✅ |  | 2026-10-26: (20:36 UTC) regressão, informativo: Arch exibido 360 sem Level355 — o Go aceita, CombineComplete 1, banco Level355 1, capa 3192 (coerente com archExpLocked ≥ 354) |
| LD-07 | 370 sem Fame | controle | ✅ |  | 2026-10-26: (20:38 UTC) regressão: Arch exibido 370 com Level355 1 e Fame 0: CombineComplete 0; nada some, Level370 0 no banco |
| LD-08 | Destrava 370 | feliz | ✅ |  | 2026-10-26: (20:41 UTC) regressão: Arch exibido 370, Level355 1, Fame 3: CombineComplete 1, receita some, banco Level370 1 e Fame 2 |
| CR-01 | Cristal fora de ordem | controle | ✅ |  | 2026-10-26: (20:41 UTC) regressão: Cristal 0 com o 4107: "Conclua a etapa anterior da quest dos cristais primeiro."; o 4107 volta, banco e score (MaxHp/MaxMp/AC) iguais |
| CR-02 | Etapa 1 | feliz | ✅ |  | 2026-10-26: (20:41 UTC) regressão: 4106 some; banco MaxMp 3000→3080, exp 2150M→2050M, nível igual, Cristal 1 |
| CR-03 | Etapa repetida | controle | ✅ |  | 2026-10-26: (20:42 UTC) regressão: Cristal 1 com outro 4106: "Voce ja concluiu esta etapa da quest dos cristais."; o 4106 volta, banco igual |
| CR-04 | Quatro etapas | feliz | ✅ |  | 2026-10-26: (20:42 UTC) regressão: 4106→4109 em sequência: banco MaxHp 25000→25140, MaxMp 3000→3140, exp −400M, nível igual, Cristal 4; AC do score 613→663; os quatro cristais somem |
| CR-05 | Mortal com cristal | borda | ✅ |  | 2026-10-26: (20:43 UTC) regressão, informativo: Mortal com o 4106 — o Go recusa (#327), "Quest permitida somente a Archs de nivel 356 ou superior."; o 4106 volta, banco igual |
| CR-06 | Exp abaixo de 100M | borda | ✅ |  | 2026-10-26: (20:43 UTC) regressão, informativo: Arch com exp 50M — o Go (#348) zera a exp e recalcula: banco nível 355→0, exp 0, Cristal 1, MaxHp 25000→23935, MaxMp 3000→2725 |

<a id="11"></a>
## 11 — Alma do Mortal (Kibita)

[Casos de uso](11-alma-mortal-kibita.md) · `npm run quest -- 11`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| KB-01 | Abaixo do nível | controle | ✅ |  | Mortal exibido 369 com a 5334: notice 15 (ReqNotMet), sem SendArchEffect; banco depois do relog: pedra fica, bit 30 0, capa 545 |
| KB-02 | Pedra de outra classe | controle | ✅ |  | TK exibido 370 com a 5336 (Sol): notice 15, sem SendArchEffect; banco depois do relog: a 5336 fica, bit 30 0, capa 545 |
| KB-03 | Alma do Mortal | feliz | ✅ |  | TK exibido 370, clan 7, 5334 e capa 545: CNFCharacterLogout + SendArchEffect slot 0; banco: a 5334 some, LearnedSkill 1<<30, capa 3194 (também no cliente) |
| KB-04 | Depois do relogin | feliz | ✅ |  | Alma concedida e dois relogins: bit 30 continua no banco (LearnedSkill 1<<30), capa 3194 no banco e no cliente |
| KB-05 | Repetir | controle | ✅ |  | bit 30 já ligado, com outra 5334 e capa 3194: notice 15, sem SendArchEffect; banco: a pedra fica, capa 3194 |
| KB-06 | Arch | controle | ✅ |  | Arch (class_master 1) exibido 370 com a 5334: notice 15, sem SendArchEffect; banco: pedra, bit 30 0 e capa 545 iguais |
| KB-07 | Sem reino | borda | ✅ |  | Mortal clan 0 com a 5334 e capa 545: SendArchEffect slot 0; banco: a 5334 some, bit 30 ligado, capa 3196 (também no cliente) |

<a id="12"></a>
## 12 — Pedra Ideal e Arch → Celestial

[Casos de uso](12-celestial.md) · `npm run quest -- 12`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CE-01 | Pedra Ideal | feliz | ✅ | [~~#406~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) corrigida no #411 | 2026-10-22: (09:23 UTC) Arch exibido 356 com 1742/1760 e 5334–5337, confirm 1: _NN_My_King_Bless1, a 5334 vira 5338 (Carry[20]), 5335–5337 somem, Equip[10]/[11] vazios, continua Arch (banco) |
| CE-02 | Faltando uma Pedra Secreta | controle | ✅ |  | 2026-10-22: (09:25 UTC) Mortal exibido 300 sem a 5337: sem 5338; o Rei cria o Arch (SendArchEffect slot 1), as 5334–5336 ficam no mortal |
| CE-03 | Mortal com as 4 pedras no Rei | borda | ✅ | [~~#406~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) corrigida no #411 | 2026-10-22: (09:27 UTC) Mortal exibido 300 com as quatro pedras: Bless1, 5338 no Carry[20], 5335–5337 e Equip[10]/[11] somem, nenhum Arch criado |
| CE-04 | Celestial com armadura | controle | ✅ | [~~#413~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) corrigida no #414 | 2026-10-22: (19:11 UTC, após w2pp-OpenWYD#414 55cbf4a3) elmo 100 no Equip[1]: a 5338 é recusada só com _NN_Cant_with_armor ("No momento você não pode equipar arma e armadura."), sem notice; pedra, classe e banco inalterados |
| CE-05 | Arch abaixo do nível | controle | ✅ | [~~#413~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) corrigida no #414 | 2026-10-22: (19:18 UTC, após w2pp-OpenWYD#414 55cbf4a3) Arch exibido 355: a 5338 é recusada calada (só o reenvio do slot), como o legado; banco inalterado |
| CE-06 | Mortal de origem baixo | controle | ✅ | [~~#413~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) corrigida no #414 | 2026-10-22: (19:19 UTC, após w2pp-OpenWYD#414 55cbf4a3) MortalLevel 98 sem armadura: a 5338 é recusada calada, como o legado; banco inalterado |
| CE-07 | Celestial | feliz | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida no #411 | 2026-10-22: (09:30 UTC) Arch exibido 356 pela 5338: SendArchEffect, a 5338 some; banco e cliente: Celestial nível 0, Cythera 3500, capa 3199, SpecialBonus 855, só a Alma, ArchLevel 1 |
| CE-08 | 1742 com o botão direito | borda | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida no #411 | 2026-10-22: (09:31 UTC) Arch exibido 356 com a 1742: sem SendArchEffect, nada muda (banco), como o legado |
| CE-09 | Faixa da Cythera | borda | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida no #411 | 2026-10-22: (09:32 UTC) Arch exibido 400 (Cristal 4, #327) pela 5338: Celestial nível 0, Cythera 3502, ArchLevel 5, capa 3199 |

<a id="13"></a>
## 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial

[Casos de uso](13-celestial-destravas.md) · `npm run quest -- 13`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CL-01 | Lv40 fora do nível | controle | ✅ |  | Celestial exibido 39 com a receita: CombineComplete 0; receita nos slots 20–26 e Lv40 0 no banco depois do relog |
| CL-02 | Lv40 | feliz | ✅ |  | Celestial exibido 40 (exp no limiar do 41): 1ª combinação CombineComplete 1, receita some, Lv40 1; 1º Dracorich depois → nível exibido 41 no cliente e no banco |
| CL-03 | Lv40 de novo | controle | ✅ |  | Celestial exibido 40 com Lv40 1 e a receita: CombineComplete 0; receita fica nos slots 20–26 |
| CL-04 | Lv90 sem Fama | controle | ✅ | [~~#408~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) corrigida no #411 | 2026-10-22: (09:48 UTC) Celestial exibido 90, Fama 100: a 3020 é recusada como o legado, só o SendItem do slot 27 (3020) calado; pedra, Fama e Lv90 iguais (banco) — deixou de ser vácuo |
| CL-05 | Lv90 | feliz | ✅ | [~~#408~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) corrigida no #411 | 2026-10-22: (09:43 UTC) Celestial exibido 90, Fama 600: 3020 → "Você concluiu a Quest Lv90.", Fama 100, Lv90 1, 3502 no inventário, a pedra some (banco) |
| CL-06 | Arcana | feliz | ✅ | [~~#408~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) corrigida no #411 | 2026-10-22: (09:44 UTC) Celestial exibido 200, Fama 600, 5334–5337, Equip[1] vazio: 3020 → "Você concluiu a Quest Cythera Arcana.", 3507 no Equip[1], Circle 1, Fama 100, pedras e 3020 somem (banco) |
| CL-07 | Arcana herdando o `Circle` | borda | ✅ | [~~#408~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) corrigida no #411 | 2026-10-22: (09:48 UTC) Celestial exibido 200 com Circle 1 e as 5334–5337: cai no Reset ("Reset Celestial"): exp 2219000000 → 2199000000, Reset 0 → 1, Fama 100; pedras ficam, sem 3507 (banco) |
| CL-08 | Reset | feliz | ✅ | [~~#408~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) corrigida no #411 | 2026-10-22: (09:49 UTC) Circle 1, 3507 no Equip[1], Fama 600: 3020 → "Reset Celestial": exp 2219000000 → 2199000000, nível 199, Reset 0 → 1, Fama 100, a pedra some (banco) |
| CL-09 | Comandos que pulam quest | borda | ✅ |  | Celestial exibido 40 sem receita: /destravar40 → CombineComplete 1 e celestial_lv40 1 no banco (o Go grava como o legado; não usar nos cenários) |
| CL-10 | Adds do Sub | feliz | ✅ | [~~#409~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409) corrigida no #411 | 2026-10-22: (09:51 UTC) Sub-Celestial armazenado 119 com Cythera 3500: kill do Basilisco sobe para 120 e o Equip[1] ganha EF_AC 30 / EF_HP 40 (cliente e banco), Add120 0 → 1 |

<a id="14"></a>
## 14 — Sub-Celestial e troca de subclasse (Urnammu)

[Casos de uso](14-sub-celestial.md) · `npm run quest -- 14`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| SC-01 | Sub sem Sephirot | controle | ✅ |  | 2026-10-22: (09:53 UTC) Celestial exibido 121 sem Sephirot: a 5338 volta só com o SendItem do slot 20, calado, como o legado; banco igual, sem ficha 2 — deixou de ser vácuo |
| SC-02 | Sub abaixo do nível | controle | ✅ |  | 2026-10-22: (09:54 UTC) Celestial exibido 120 com Sephirot 1762: SendItem calado do slot 20 (5338); banco igual, sem ficha 2 — deixou de ser vácuo |
| SC-03 | Criar o Sub | feliz | ✅ | [~~#410~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) corrigida no #411 (criação e Urnammu ok; reaberta após o #415 pela classe da 4148, SC-08/09) | 2026-10-22: (09:54 UTC) Celestial exibido 121 com Sephirot 1762: 5338 → "Que a luz de Sephira o ilumine.", master 4, Sephirot e 5338 somem; ficha 2 (save_celestial) BM nível 0, AC 230, HP 70 / MP 55, SID 8/4/7/6, 855 pontos |
| SC-04 | Sub de novo | controle | ✅ |  | 2026-10-22: (09:54 UTC) CELESTIALCS exibido 121 com Sephirot: SendItem calado do slot 20 (5338); banco igual — deixou de ser vácuo |
| SC-05 | Urnammu sem Fama | controle | ✅ |  | 2026-10-22: (09:55 UTC) CELESTIALCS, Fama 100: pergaminho 699 até (3235,1688), Urnammu → "Você precisa de 2000 pontos de fama." (_DN_NEEDFAME); banco igual — deixou de ser vácuo |
| SC-06 | Trocar a subclasse | feliz | ✅ | [~~#410~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) corrigida no #411 (criação e Urnammu ok; reaberta após o #415 pela classe da 4148, SC-08/09) | 2026-10-22: (09:56 UTC) Sub criado jogando (5338, ficha 2 BM) e depois Sephirot 1763 + Fama 2500 pelo banco: Urnammu → Bless1, Fama 500, Sephirot some, ficha 2 classe 3 (HT), SID 8/4/7/6, 855 pontos; continua master 4 |
| SC-07 | Urnammu para Celestial puro | controle | ✅ |  | 2026-10-22: (09:56 UTC) Celestial puro, Sephirot, Fama 2500: Urnammu → "Somente personagem Sub Celestial." (_SN_NEEDCLASS); banco igual — deixou de ser vácuo |
| SC-08 | Pedra Misteriosa: Celestial → Sub | feliz | ✅ | [~~#410~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) corrigida no #426 | 2026-10-26: (12:53 UTC, após w2pp-OpenWYD#426) Sub BM criado pela 5338; 4148 em Armia (2100,2105): SendItem [22:0], Equip[0], MSG_SetShortSkill; depois do relog o banco tem master 5, `class` 2 (BM), nível 0, exp 0, celestial_level 120, ficha 0 = TK nível 120 (SID 900/10/250/600), ficha 1 = BM nível 0 |
| SC-09 | Pedra Misteriosa: Sub → Celestial | feliz | ✅ | [~~#410~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) corrigida no #426 | 2026-10-26: (12:54 UTC, após w2pp-OpenWYD#426) a ida volta do relog com master 5 e `class` 2; a volta (4148 em (2088,2105)): SendItem [22:0], Equip[0], MSG_SetShortSkill; banco master 4, `class` 0 (TK), nível 120, exp 846000000; a ficha 1 guarda o BM nível 0 (SID 8/4/7/6, 855 pontos) |
| SC-10 | Pedra Misteriosa fora da cidade | controle | ✅ |  | 2026-10-22: (19:59 UTC) CELESTIALCS no Continente desconhecido (3235,1688): notice 42 (_NN_OnlyVillage) + SendItem [22:4148]; banco igual |
| SC-11 | Pedra Misteriosa no Celestial puro | controle | ✅ |  | 2026-10-22: (19:59 UTC) Celestial em Armia: só o SendItem [22:4148], calado; banco igual |
| SC-12 | /kefra com o Kefra vivo | controle | ✅ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | 2026-10-22: (19:57 UTC) kefra_state defeated false: /kefra → (2366,3884) + "O kefra ainda esta vivo, precisa ser derrotado" |
| SC-13 | Portal do Deserto com o Kefra vivo | controle | ✅ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | 2026-10-22: (19:58 UTC) /kefra → (2365,3885), a pé até o tile (2365,3925) e ReqTeleport: sem teleporte, como o legado com KefraLive 0 |
| SC-14 | /kefra com o Kefra derrotado | feliz | ⏸️ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | 2026-10-26: (12:54 UTC) precheck: Kefra continua vivo no mundo (kefra_state); o estado é global, só lido no boot do tmServer e divide o EXP de todos — não se semeia. O caso roda sozinho (precheck) quando o Kefra estiver derrotado |
| SC-15 | Portal do Deserto com o Kefra derrotado | feliz | ⏸️ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | 2026-10-26: (12:54 UTC) precheck: Kefra continua vivo no mundo (mesmo motivo do SC-14) |

<a id="15"></a>
## 15 — PvP em Armia e duelo 1x1

[Casos de uso](15-pvp-duelo.md) · `npm run quest -- 15`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| PV-01 | Arena de Armia, ninguém com K | controle | ✅ |  | 2026-10-26: (12:58 UTC, depois do #429) controle: 5 golpes com dano 0, HP de B 945; ninguém Guilty |
| PV-02 | Arena de Armia, A com K e B sem | controle | ✅ | [~~#420~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420) corrigida no #425 | 2026-10-26: (12:59 UTC, depois do #429) em (2135,2147), tile `0x40`, A com K e B sem: 5 golpes com dano 0, HP de B 945 |
| PV-03 | Arena de Armia, os dois com K | feliz | ✅ |  | 2026-10-26: (13:00 UTC, depois do #429) o golpe tira HP: 824 (945→200) e 748 (200→0); PKInfo 1 para os dois; ninguém Guilty (cidade) |
| PV-04 | Arena de Armia, sem Guilty | controle | ✅ | [~~#421~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421) corrigida no #425 | 2026-10-26: (13:00 UTC, depois do #429) o golpe entra (748, 778) e nenhum CreateMob de A ou B chega com `MobName[12]` 0 |
| PV-05 | Arena de Armia, A mata B | feliz | ✅ | [~~#421~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421) corrigida no #425 | 2026-10-26: (13:01 UTC, depois do #429) B recebe "Na arena não há perda de EXP." e a EXP continua 590000 no banco; A recebe "Seu ponto caos é -9" e fica com `pk_point` 66; B revive em Armia |
| PV-06 | Praça de Armia | borda | ✅ | [~~#421~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/421) corrigida no #425 | 2026-10-26: (13:01 UTC, depois do #429) em (2110,2095), tile `0x01`, o golpe entra (778, 808) e ninguém fica Guilty |
| PV-07 | Campo | feliz | ✅ |  | 2026-10-26: (13:02 UTC, depois do #429) em (2185,2100) o golpe entra (1039) e os dois ficam Guilty (sem regressão) |
| PV-08 | Campo, A sem CP | borda | ✅ | [~~#422~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/422) corrigida no #425 | 2026-10-26: (13:03 UTC, depois do #429) dano 0 e "Você não pode mais derrotar jogadores. (Atual : 10)" a cada golpe |
| PV-09 | K com troca aberta | borda | ✅ | [~~#422~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/422) corrigida no #425 | 2026-10-26: (13:03 UTC, depois do #429) a troca fecha para os dois, PKInfo 1/0 e o texto 331 chega aos dois |
| DU-01 | Declaração | feliz | ✅ |  | 2026-10-26: (13:03 UTC, depois do #429) B recebe 0x039F com Parm1 = A e Parm2 = 0 |
| DU-02 | Aceite | feliz | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:04 UTC, depois do #429) A em (147,4044), B em (189,4044), `StartTime` 240 e "Batalha entre … foi iniciada." aos dois |
| DU-03 | Duelo, alvo sem K | borda | ✅ | [~~#420~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/420) corrigida no #425 | 2026-10-26: (13:05 UTC, depois do #429) A com K e B sem K na arena do duelo: 5 golpes com dano 0 |
| DU-04 | Duelo, A mata B | feliz | ✅ | [~~#427~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/427) corrigida no #429 ([~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425) | 2026-10-26: (12:57 UTC, depois do #429) os dois em (2572,1752), B com HP 1, "A é o vencedor, B é o perdedor desta partida." e EXP de B 590000 no banco; B agora recebe "Na arena não há perda de EXP." (texto 143, #427 ok). Na regressão (13:06 UTC) igual |
| DU-05 | B sai do jogo | controle | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:07 UTC, depois do #429) B desconecta: A vai para (2572,1752) com "A é o vencedor, B é o perdedor desta partida." |
| DU-06 | B sai da caixa | controle | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:08 UTC, depois do #429) B sai da caixa: A vai para (2572,1752) com o texto do vencedor |
| DU-07 | Arena ocupada | controle | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:09 UTC, depois do #429) o pedido de C chega a D, ninguém é teleportado e os dois recebem "Há uma partida em progresso." |
| DU-08 | Duelo dentro de Armia | borda | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:09 UTC, depois do #429) na praça de Armia, o pedido chega a B e o aceite leva os dois à arena |
| DU-09 | Aceite forjado | controle | ✅ |  | 2026-10-26: (13:10 UTC, depois do #429) sem pedido, o aceite com Parm1 = A não leva ninguém para a arena |
| DU-10 | Fim do tempo | borda | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:15 UTC, depois do #429) empate em 241 s com "Este jogo com … finalizou em empate" aos dois e o muro (`EnvEffect` 32) |
| DU-11 | Alvo com sussurro bloqueado | controle | ✅ | [~~#424~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/424) corrigida no #425 | 2026-10-26: (13:16 UTC, depois do #429) sem repasse e "Não é possível sussurrar para este jogador." para A |

## Issues

Os casos rodaram pela primeira vez em 2026-10-18 (w2pp-OpenWYD b392705): 95 ✅ 49 ❌ de 144. O reteste foi em 2026-10-19/22: depois do [#411](https://github.com/Jean1dev/w2pp-OpenWYD/pull/411) (2866b8c), 141 ✅ 3 ❌; depois do [#414](https://github.com/Jean1dev/w2pp-OpenWYD/pull/414) e do [#415](https://github.com/Jean1dev/w2pp-OpenWYD/pull/415) (deploy 55cbf4a3), 148 ✅ 2 ❌ 2 ⏸️ de 152 (oito casos novos da quest 14). Todas as issues estão em [Jean1dev/w2pp-OpenWYD](https://github.com/Jean1dev/w2pp-OpenWYD/issues).

### Abertas

| Issue | Tipo | O que falta ou está errado no Go | Casos | Finding |
|---|---|---|---|---|
| [~~#410~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) corrigida no #426 | enhancement (reaberta depois do #415) | A Pedra Misteriosa 4148 já salva a coluna `class` (reteste de 2026-10-26, 12:53–12:54 UTC: SC-08/09 ✅). Falta só verificar o caminho com o Kefra derrotado | ⏸️ SC-14, SC-15 | [023](../findings/023-sub-celestial-ausente.md) |

**⏸️ bloqueados pelo estado do mundo:** SC-14 e SC-15 (`/kefra` e o portal do Deserto com o Kefra derrotado). O Kefra está vivo; o estado fica em `kefra_state`, é global, o tmServer só lê no boot e ele mexe no EXP de todos, então não se semeia pelo banco. O `precheck` do caso marca ⏸️ enquanto o Kefra estiver vivo.

### Corrigidas e verificadas no reteste

- No #411: #395 (NOV), #396 (QST-09), #397 (CV-10), #398 (MG), #399 (CR-06/11), #400 (CR-12), #401 (TM), #402 (TM-07), #403 (TM-08/09), #404 (PO), #405 (CD), #390 (AR-10/11), #406 (CE-01/03), #407 (CE-07/08/09), #408 (CL-05…08), #409 (CL-10). Findings 007–022.
- No #414: #413 (CE-04/05/06, finding 024).
- No #415: #412 (TM-07, acentos em cp1252) e, da #410, o caminho até o Urnammu com o Kefra vivo (SC-12/13) e as recusas da 4148 (SC-10/11). O #415 também fechou #392, #393 e #394, e o #416 fechou #391: essas só têm cobertura nas suítes antigas de conta fixa, que não foram rodadas.
- No #425 (deploy `66102a6b`, reteste de 2026-10-25 20:40–20:58 UTC): #420 (PV-02, DU-03), #421 (PV-04/05/06), #422 (PV-08/09) e #424 (DU-02, DU-05…08, DU-10/11; DU-04 só falta o texto da #427). Findings 026–029.
- No #429 (deploy de 2026-10-26 12:49 UTC; reteste de 2026-10-26 12:57 UTC e regressão da quest 15 de 12:58–13:16 UTC, 20 ✅ de 20): #427 (DU-04, texto 143 na morte do duelo no mapa (1,31)). Finding 029.

A #400 foi fechada, mas o Clan pela guilda do líder não foi portado. Nenhum caso cobre isso ainda.

## Controles e casos informativos

Os controles que passavam "no vácuo" foram refeitos no reteste e agora exigem a recusa real do legado (fala ou silêncio, e estado inalterado): CV-11/12, MG-07, CD-01/03/05, CE-04/05/06, CL-04, SC-01/02/04/05/07. Todos passam.

Estes casos ficam como **informativos**: o Go diverge do legado de propósito e isso não vira issue.
- QST-12 e QST-13: atalhos que só o Go tem para a arena do Coveiro (botão direito na Vela e o Mestre_Grifo).
- LD-06: o Arch acima do 354 passa na Lindy sem a destrava do 355, por causa da trava de exp do Go.
- 10/CR-05: o Mortal não usa os Cristais (#327).
- 10/CR-06: o Cristal com exp insuficiente zera o nível (#348).
- CE-09 semeia o Cristal 4, porque o Go exige isso para dar a Cythera 3501/3502 (#327).
- Os IDs `CR-` das quests 05 e 10 se repetem, por isso o prefixo "10/".

Diferenças sem efeito no estado, só anotadas: na segunda Pílula (07) o Go reenvia o slot e o legado fica calado; a Sephirot (09) cai na 1ª vaga livre e o Go não fala `_NN_Sepherot_created`.

## Próximos passos

1. **Corrigir no servidor:** salvar a coluna `class` (#410). Depois, `npm run quest -- 14 --case SC-08` e `--case SC-09`.
2. **Duelo (15):** depois da #427, `npm run quest -- 15 --case DU-04`.
3. **Kefra derrotado:** SC-14/SC-15 só rodam com o Kefra morto no mundo (matar o boss em grupo, ou um jeito de teste de mudar `kefra_state` com o tmServer recarregando). Rodar `npm run quest -- 14` de novo quando isso existir.
4. **Casos que faltam:** o Clan pela guilda do líder (#400), quando for portado.
5. **Infraestrutura de teste:** o papel do banco aceita só 5 conexões (o tmServer usa 2). Não aninhe `ctx.query` e não mate o runner no meio, porque a conexão fica presa no proxy do Railway.
6. **Pendências de teste sem issue:**
   - Na Poeira de Fada, o Celestial usaria a curva de exp mortal (`item.go:877`, contra `_MSG_UseItem.cpp:1017`). Isso vem só da leitura do código e não foi medido.
   - O Pergaminho_Selado 4127 e a Fama ainda não têm fonte mapeada no jogo; nos casos, vêm do banco.
   - As arenas dos passos 2 a 5 da Quest 256 só estão cobertas pelo cenário 4. Os troféus delas não foram rodados.
   - As suítes antigas de conta fixa (`npm run scenario`) não foram rodadas de novo: precisam das contas do `.env`. Elas cobrem #391–#394.
