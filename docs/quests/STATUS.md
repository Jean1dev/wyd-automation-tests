# Status das quests

Situação de cada caso de uso de `docs/quests/`, validado no Railway com `npm run quest -- NN --case ID`. Cada caso roda numa conta nova e recebe a pré-condição pelo banco (`src/db/seed.ts`).

Legenda: ✅ passa · ❌ reprova (com issue) · ⏸️ bloqueado (motivo na nota) · ⏳ pendente.

## Resumo

| # | Quest | Casos | ✅ | ❌ | ⏸️ | ⏳ |
|---|---|---|---|---|---|---|
| [01](#01) | Novato: os quatro treinadores do Campo de Treino | 12 | 7 | 5 | 0 | 0 |
| [02](#02) | Quest 256: as cinco arenas e os troféus | 14 | 13 | 1 | 0 | 0 |
| [03](#03) | Capa Verde (Formatura Aprendiz) | 13 | 12 | 1 | 0 | 0 |
| [04](#04) | Molar do Gárgula | 10 | 6 | 4 | 0 | 0 |
| [05](#05) | Capa do Reino (azul / vermelha) e a borda | 13 | 10 | 3 | 0 | 0 |
| [06](#06) | Terra Mística (Defendendo a Terra Mística) | 11 | 4 | 7 | 0 | 0 |
| [07](#07) | Pílula do Poder Mágico (Conquista do Castelo Orc) | 5 | 0 | 5 | 0 | 0 |
| [08](#08) | Círculo Divino (Jeffi e Shama) | 7 | 3 | 4 | 0 | 0 |
| [09](#09) | Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei | 12 | 10 | 2 | 0 | 0 |
| [10](#10) | Destravas do Arch: Lindy 355/370 e Cristais | 14 | 14 | 0 | 0 | 0 |
| [11](#11) | Alma do Mortal (Kibita) | 7 | 7 | 0 | 0 | 0 |
| [12](#12) | Pedra Ideal e Arch → Celestial | 9 | 4 | 5 | 0 | 0 |
| [13](#13) | Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial | 10 | 5 | 5 | 0 | 0 |
| [14](#14) | Sub-Celestial e troca de subclasse (Urnammu) | 7 | 5 | 2 | 0 | 0 |
| | **Total** | **144** | **100** | **44** | **0** | **0** |

<a id="01"></a>
## 01 — Novato: os quatro treinadores do Campo de Treino

[Casos de uso](01-novato-treinadores.md) · `npm run quest -- 01`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| NOV-01 | Passo 1 sem a chave | controle | ✅ |  | 2026-10-19: Treinador1 sem a chave fala Cheerup1 ("Se não possuir a chave Gremlin Isca…"); nada muda no inventário |
| NOV-02 | Passo 1 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-19: com a 451: Kit 682 ×20 no inventário, 451 mantida; Kit e newbie_quest 1 no banco depois do relog |
| NOV-03 | Passo 1 de novo | controle | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-19: newbie_quest 1 semeado, com a 451: fala Already1 ("Deus te abençoe."), nada muda; flag continua 1 no banco |
| NOV-04 | Pular passo | controle | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-19: newbie_quest 1 semeado, Treinador3 com a 453: fala Already3, equipamento igual; flag continua 1 |
| NOV-05 | Passo 2 | feliz | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-19: newbie_quest 1 semeado: Lança_Curva (ReqLvl 23) com adicionais refeitos, salvos; newbie_quest 2 no banco |
| NOV-06 | Passo 2 com arma de ReqLvl > 39 | borda | ✅ | [~~#395~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) corrigida no #411 | 2026-10-19: newbie_quest 1 semeado, Lança_do_Vento (ReqLvl 43): arma igual no cliente e no banco, newbie_quest 2 |
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
| TM-06 | Recompensa antes da hora | controle | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) | terra_mistica 1 semeado, Cap.Explor.: sem resposta (vácuo: o Merchant 11 não tem rota no Go), inventário igual, mas a flag vira 0 no banco depois do relog (o save não leva a flag) |
| TM-07 | Concluir a missão | feliz | ❌ | [#402](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402) | terra_mistica 1, 77 kills de rosto 239/241 (25 Draco_Lich, 23 Dracorich, 18 Basilisco, 11 Basilisco_Ifrit) em 10 min, 0 mortes: nenhuma mensagem de conclusão, flag 1 no banco durante a caça (no legado 1,9 % de chance de não concluir) |
| TM-08 | Recompensa | feliz | ❌ | [#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) | terra_mistica 2, exibido 101: o Cap.Explor. não responde (Merchant 11 sem rota no Go), nenhum amuleto 559–562 no inventário nem no banco; a flag vira 0 no relog (#401) |
| TM-09 | Faixa do amuleto | borda | ❌ | [#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) | terra_mistica 2, exibido 50: o Cap.Explor. não responde, nenhum Amuleto_de_Prata 551–554 no inventário nem no banco; a flag vira 0 no relog (#401) |
| TM-10 | Recompensa repetida | controle | ❌ | [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) | terra_mistica 3 semeado, Cap.Explor.: sem resposta (vácuo: Merchant 11 sem rota, #403), nenhum amuleto; mas a flag vira 0 no banco depois do relog, e a quest fica refazível |
| TM-11 | Arch | controle | ✅ |  | Arch líder de grupo (com outro Arch), confirm 1: recusa (NoticeReqNotMet 15, o legado manda _NN_Hurry_Helping_them); terra_mistica 0 no banco |

<a id="07"></a>
## 07 — Pílula do Poder Mágico (Conquista do Castelo Orc)

[Casos de uso](07-pilula-orc.md) · `npm run quest -- 07`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| PO-01 | Pegar a pílula | feliz | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | Mortal armazenado 49, a 470 largada aos pés e pega (MSG_GetItem): CNFGetItem, a pílula volta ao inventário; SkillBonus 147→147; a 470 continua no banco depois do relog |
| PO-01b | Pegar com a flag já gravada | controle | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | PilulaOrc não tem coluna no banco e a 1ª pílula do chão não grava a flag: as duas 470 largadas e pegas voltam ao inventário (CNFGetItem), SkillBonus 147→147; a 2ª deveria ficar no chão com _NN_Youve_Done_It_Already |
| PO-02 | Usar a pílula | feliz | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | MSG_UseItem na 470: MessageBoxOk 39 (NoticeCantUseHere, Vol 6 cai no rejectUnimplementedConsumable) e o slot volta; SkillBonus 147→147; a 470 continua no banco depois do relog |
| PO-03 | Segunda pílula | controle | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | pré-condição inalcançável (PilulaOrc sem coluna; a 1ª pílula não aplica: NoticeCantUseHere 39). A 2ª também volta com 39 sem bônus e sem consumir — vácuo, não recusa por flag (o legado não responde) |
| PO-04 | Persistência | borda | ❌ | [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | base 147; a 1ª 470 não aplica (39); depois do relog SkillBonus 147 (sem os +9: deriveSkillBonus não soma a PilulaOrc) e as duas 470 no inventário; a 2ª volta com 39 |

<a id="08"></a>
## 08 — Círculo Divino (Jeffi e Shama)

[Casos de uso](08-circulo-divino.md) · `npm run quest -- 08`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CD-01 | Purificar sem gold | controle | ✅ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | 447 no Equip[13], gold 999.999: nada muda (Equip[13] 447 e gold iguais no cliente e no banco depois do relog) — vácuo: Jeffi sem rota no Go (#405); o legado manda _NN_Need_1000000_Gold |
| CD-02 | Purificar | feliz | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | 447 no Equip[13], gold 1.005.000: o Jeffi não responde (Merchant 12 sem rota); Equip[13] continua 447 e gold 1.005.000 no cliente e no banco depois do relog |
| CD-03 | Shama sem círculo puro | controle | ✅ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | 447 (não purificado) no Equip[13], Special [60,60,60,60], Learn 0xffffff: nada muda no cliente nem no banco depois do relog — vácuo: Shaman sem rota no Go (#405); o legado manda _NN_Need_Pure_Divine |
| CD-04 | Reiniciar | feliz | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | 448 no Equip[13], Special [60,60,60,60], Learn 0xffffff: a Shaman não responde (Merchant 13 sem rota); nada muda no cliente nem no banco (esperado SpecialBonus 200, Special [10,10,10,10], Learn 0xffff00, Equip[13] vazio, Circle 1) |
| CD-05 | Segundo círculo comum | controle | ✅ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | celestial_circle 1 semeado, 448 no Equip[13]: o círculo fica, nada muda e Circle continua 1 no banco depois do relog — vácuo: Shaman sem rota no Go (#405); o legado manda _NN_Youve_Done_It_Already |
| CD-06 | Círculo completo depois do comum | borda | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | Circle 1, 694 no Equip[13], Special [120×4]: a Shaman não responde; nada muda no cliente nem no banco (esperado SpecialBonus 400, Special [20×4], Learn 0xff00ff, Equip[13] vazio, Circle 1) |
| CD-07 | Special abaixo do teto | borda | ❌ | [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | 450 no Equip[13], Special [30,60,60,60]: a Shaman não responde; Special[0] continua 30 no cliente e no banco (esperado 0, SpecialBonus 180, Learn 0x00ffff) |

<a id="09"></a>
## 09 — Cadeia do Arch: almas, Pedra da Imortalidade, Pedras Arch, Sephirot e Rei

[Casos de uso](09-arch-cadeia.md) · `npm run quest -- 09`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| AR-01 | Oráculo sem almas | controle | ✅ |  | 10 safiras, sem almas: RedOracle responde notice 15 (ReqNotMet; o legado manda _NN_Set_Soul); inventário e gold iguais no cliente e no banco depois do relog |
| AR-02 | Almas fora de ordem | controle | ✅ |  | 1741 no slot 0, 1740 no 1, 10 safiras: notice 15 (o legado manda _NN_Set_Soul); nada some no cliente nem no banco depois do relog |
| AR-03 | Sem safiras | controle | ✅ |  | almas em ordem, 9 safiras: notice 15 (o legado manda _DN_Need_D_Sapphire); nada some no cliente nem no banco depois do relog |
| AR-04 | Pedra da Imortalidade | feliz | ✅ |  | almas nos slots 0/1 e 10 × 697: as 12 somem e a 1742 entra no slot 0, no cliente e no banco depois do relog |
| AR-05 | Pacote de safiras | borda | ✅ |  | almas nos slots 0/1 e 1 × 4131: o pacote e as almas somem e a 1742 entra no slot 0, no cliente e no banco depois do relog |
| AR-06 | Refino da pedra de boss | feliz | ✅ |  | 412 sobre a 1752 no inventário e no Equip[11]: "não pode ser mais refinado", poeira e pedra ficam (cliente e banco). O legado faz o mesmo: EF_NOSANC das 1752–1759 barra o PO/PL (_MSG_UseItem.cpp:188/365) antes do ramo :515 |
| AR-07 | Sephirot (ask) | controle | ✅ |  | 8 Pedras Arch, 30.001.000 de gold, confirm 0 no Cap.Cavaleiros: sem resposta (o legado só fala _NN_Soul_n_8_Sephera); nada muda no cliente nem no banco |
| AR-08 | Sephirot sem gold | controle | ✅ |  | 8 Pedras Arch, gold 29.999.999, confirm 1: notice 15 (o legado fala _NN_Need_8_Sephera); pedras e gold iguais no cliente e no banco |
| AR-09 | Sephirot faltando pedra | controle | ✅ |  | 1744–1750 + outra 1750 (falta a 1751), 30.001.000 de gold, confirm 1: notice 15; nada some no cliente nem no banco |
| AR-10 | Sephirot | feliz | ❌ | [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) | 8 Pedras Arch e 30.001.000 de gold, confirm 1 no Cap.Cavaleiros: pedras e 30M somem, mas entra a 1761 (Foema) no lugar da 1760 (cliente e banco) |
| AR-11 | Sephirot de cada mestre | feliz | ❌ | [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) | Foema_Ancian deu 1762 (esperado 1761), Mestre_Archi 1763 (1762), ForeLearner 1764 Poção_Combatente (1763); pedras e 30M somem |
| AR-12 | Rei | coberto | ✅ |  | 1742 no Equip[10], 1760 no Equip[11], armazenado 299: Rei_Glantuar volta à seleção com o Arch no slot 1 (SendArchEffect 1); banco: Arch class 0, master 1, nível 0, Equip[0] 6; mortal sem Equip[10]/[11] |

<a id="10"></a>
## 10 — Destravas do Arch: Lindy 355/370 e Cristais

[Casos de uso](10-arch-destravas.md) · `npm run quest -- 10`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| LD-01 | Mortal na Lindy | controle | ✅ |  | Mortal exibido 355 com a receita, ao lado da Lindy (1707,1728): CombineComplete 0; inventário e banco iguais, Level355 0 |
| LD-02 | Arch fora do nível | controle | ✅ |  | Arch exibido 354 (armazenado 353) com a receita: CombineComplete 0; inventário e banco iguais, Level355 0 |
| LD-03 | Receita errada | controle | ✅ |  | Arch exibido 355 sem a 4127 (posição 2 vazia): CombineComplete 0; as 413 ficam, banco igual, Level355 0 |
| LD-04 | Destrava 355 | feliz | ✅ |  | Arch exibido 355, clan 8: Poeira antes recusada ("Conclua a liberacao de nivel na Lindy"); combinação: CombineComplete 1, receita some, Level355 1, capa 3192 no Equip[15] (banco); Poeira depois sobe para exibido 356 (banco nível 355) |
| LD-05 | 355 de novo | controle | ✅ |  | Arch exibido 355 com Level355 1 e a receita: CombineComplete 0; nada some, banco igual (Level370 0) |
| LD-06 | 355 acima do nível | borda | ✅ |  | informativo (o legado recusa fora do 354): Arch exibido 360 sem Level355 — o Go aceita, CombineComplete 1, Level355 1, capa 3192; coerente com a trava archExpLocked (≥ 354), sem a qual o Arch ficaria preso |
| LD-07 | 370 sem Fame | controle | ✅ |  | Arch exibido 370 com Level355 1 e Fame 0: CombineComplete 0; nada some, Level370 0 no banco |
| LD-08 | Destrava 370 | feliz | ✅ |  | Arch exibido 370, Level355 1, Fame 3 (semeada): CombineComplete 1, receita some, Level370 1 e Fame 2 no banco |
| CR-01 | Cristal fora de ordem | controle | ✅ |  | Arch exibido 356, Cristal 0, com o 4107: "Conclua a etapa anterior da quest dos cristais primeiro."; o 4107 volta, exp/nível/Cristal/MaxHp/MaxMp iguais no banco, AC igual |
| CR-02 | Etapa 1 | feliz | ✅ |  | Arch exibido 356, Cristal 0: 4106 some; banco MaxMp 3000→3080, exp 2150M→2050M, nível igual, Cristal 1 |
| CR-03 | Etapa repetida | controle | ✅ |  | Cristal 1 com outro 4106: "Voce ja concluiu esta etapa da quest dos cristais."; o 4106 volta, banco igual |
| CR-04 | Quatro etapas | feliz | ✅ |  | 4106→4109 em sequência: banco MaxHp 25000→25140, MaxMp 3000→3140, exp −400M, nível igual, Cristal 4; AC do score 613→663 depois do relog; os quatro cristais somem |
| CR-05 | Mortal com cristal | borda | ✅ |  | informativo (o legado aceita, checagem comentada): Mortal exibido 356 com o 4106 — o Go recusa de propósito (#327), "Quest permitida somente a Archs de nivel 356 ou superior."; o 4106 volta, banco igual |
| CR-06 | Exp abaixo de 100M | borda | ✅ |  | informativo (o legado deixa a exp negativa e não rebaixa): Arch exibido 356 com exp 50M — o Go (#348) zera a exp e recalcula o nível: banco nível 355→0, exp 0, Cristal 1, MaxHp 25000→23935, MaxMp 3000→2725 (−355 níveis +80) |

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
| CE-01 | Pedra Ideal | feliz | ❌ | [#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) | Arch exibido 356 com 1742/1760 e 5334–5337: "Sao necessarias 13 safiras em pagamento exato." (serviço de capa); sem 5338, banco igual |
| CE-02 | Faltando uma Pedra Secreta | controle | ✅ |  | Mortal exibido 300 sem a 5337: sem 5338; o Rei cria o Arch (SendArchEffect slot 1), as 5334–5336 ficam no mortal |
| CE-03 | Mortal com as 4 pedras no Rei | borda | ❌ | [#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) | Mortal exibido 300 com as quatro pedras: o Go cria o Arch (slot 1) em vez da 5338; as 5334–5337 ficam no mortal |
| CE-04 | Celestial com armadura | controle | ✅ |  | Arch exibido 356 com elmo 100 no Equip[1]: 5338 → notice 39 (vácuo: sem caso no Go, #407); 1742 → "Remova a armadura antes de usar a Pedra Ideal."; banco igual |
| CE-05 | Arch abaixo do nível | controle | ✅ |  | Arch exibido 355: 5338 → notice 39 (vácuo, #407); 1742 → "Seu Arch precisa atingir o nivel 356"; banco igual |
| CE-06 | Mortal de origem baixo | controle | ✅ |  | Arch exibido 356 com MortalLevel 98: 5338 → notice 39 (vácuo, #407); 1742 → "O Mortal de origem precisa ter atingido o nivel 100"; banco igual |
| CE-07 | Celestial | feliz | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) | Arch exibido 356 sem armadura, MortalLevel 99: 5338 → notice 39, nada muda; a 1742 é que vira Celestial (nível 0, Cythera 3500, capa 3199, SpecialBonus 855) |
| CE-08 | 1742 com o botão direito | borda | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) | Arch exibido 356 com a 1742: SendArchEffect, vira Celestial (master 3, Cythera 3500, capa 3199); no legado a 1742 não faz nada |
| CE-09 | Faixa da Cythera | borda | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) | Arch exibido 400, Cristal 4: 5338 → notice 39, nada muda; pela 1742 o Go dá Cythera 3502 e ArchLevel 5 (faixa certa) |

<a id="13"></a>
## 13 — Destravas do Celestial: Lv40, Lv90, Arcana, Reset e os adds do Sub-Celestial

[Casos de uso](13-celestial-destravas.md) · `npm run quest -- 13`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| CL-01 | Lv40 fora do nível | controle | ✅ |  | Celestial exibido 39 com a receita: CombineComplete 0; receita nos slots 20–26 e Lv40 0 no banco depois do relog |
| CL-02 | Lv40 | feliz | ✅ |  | Celestial exibido 40 (exp no limiar do 41): 1ª combinação CombineComplete 1, receita some, Lv40 1; 1º Dracorich depois → nível exibido 41 no cliente e no banco |
| CL-03 | Lv40 de novo | controle | ✅ |  | Celestial exibido 40 com Lv40 1 e a receita: CombineComplete 0; receita fica nos slots 20–26 |
| CL-04 | Lv90 sem Fama | controle | ✅ |  | Celestial exibido 90, Fama 100: botão direito na 3020 sem resposta; pedra, Fama e Lv90 iguais (vácuo: a 3020 não tem uso no Go, #408) |
| CL-05 | Lv90 | feliz | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) | Celestial exibido 90, Fama 600: botão direito na 3020 sem resposta; Fama 600, Lv90 0, sem 3502, a pedra fica |
| CL-06 | Arcana | feliz | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) | Celestial exibido 200, Fama 600, 5334–5337, Equip[1] vazio: 3020 sem resposta; pedras, Fama e Circle 0 iguais, sem 3507 |
| CL-07 | Arcana herdando o `Circle` | borda | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) | Celestial exibido 200 com Circle 1: 3020 sem resposta; exp, Fama e pedras iguais (legado: ramo Reset, exp −20M) |
| CL-08 | Reset | feliz | ❌ | [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) | Circle 1, 3507 no Equip[1], Fama 600: 3020 sem resposta; exp 2219000000 e Fama iguais; o contador Reset nem existe no Go |
| CL-09 | Comandos que pulam quest | borda | ✅ |  | Celestial exibido 40 sem receita: /destravar40 → CombineComplete 1 e celestial_lv40 1 no banco (o Go grava como o legado; não usar nos cenários) |
| CL-10 | Adds do Sub | feliz | ❌ | [#409](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409) | Sub-Celestial armazenado 119 com Cythera 3500: kill do Basilisco_Ifrit sobe para 120 (cliente e banco), mas o Equip[1] fica sem EF_AC/EF_HP |

<a id="14"></a>
## 14 — Sub-Celestial e troca de subclasse (Urnammu)

[Casos de uso](14-sub-celestial.md) · `npm run quest -- 14`

| ID | Caso | Tipo | Resultado | Issue | Nota |
|---|---|---|---|---|---|
| SC-01 | Sub sem Sephirot | controle | ✅ |  | Celestial exibido 121 sem Sephirot: 5338 → notice 39, banco igual (vácuo: a 5338 não tem caso para o Celestial, #410) |
| SC-02 | Sub abaixo do nível | controle | ✅ |  | Celestial exibido 120 com Sephirot 1762: 5338 → notice 39, banco igual (vácuo, #410) |
| SC-03 | Criar o Sub | feliz | ❌ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | Celestial exibido 121 com Sephirot 1762: 5338 → notice 39; continua master 3, Sephirot e 5338 ficam |
| SC-04 | Sub de novo | controle | ✅ |  | CELESTIALCS exibido 121 com Sephirot: 5338 → notice 39, banco igual (vácuo, #410) |
| SC-05 | Urnammu sem Fama | controle | ✅ |  | CELESTIALCS, Fama 100: pergaminho 699 até (3235,1688), Urnammu (id 12901) sem resposta, banco igual (vácuo: Merchant 76 sem rota, #410) |
| SC-06 | Trocar a subclasse | feliz | ❌ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | CELESTIALCS, Sephirot 1763, Fama 2500: Urnammu (id 12901) sem resposta; Fama 2500 e Sephirot ficam |
| SC-07 | Urnammu para Celestial puro | controle | ✅ |  | Celestial puro, Sephirot, Fama 2500: Urnammu sem resposta, banco igual (vácuo: Merchant 76 sem rota, #410) |

## Issues abertas

Rodada de 2026-10-18, no tm-server do Railway (w2pp-OpenWYD `origin/main` b392705). Todas as issues estão em [Jean1dev/w2pp-OpenWYD](https://github.com/Jean1dev/w2pp-OpenWYD/issues). A coluna "Casos" traz os ❌ de cada uma: 49 no total.

| Issue | Tipo | O que falta ou está errado no Go | Casos ❌ | Finding |
|---|---|---|---|---|
| [#395](https://github.com/Jean1dev/w2pp-OpenWYD/issues/395) | bug | Quest do novato ausente. O Treinador1 é roteado como Coveiro | NOV-02…09, NOV-11, NOV-12 (10) | [007](../findings/007-quest-novato-ausente.md) |
| [#396](https://github.com/Jean1dev/w2pp-OpenWYD/issues/396) | bug | Troféu da Quest 256 usado sem grupo não dá os 10 % do líder | QST-09 | [008](../findings/008-trofeu-quest256-sem-bonus-de-lider.md) |
| [#397](https://github.com/Jean1dev/w2pp-OpenWYD/issues/397) | bug | Lider_Aprendiz sem rota: o Arch não recebe a Capa Verde | CV-10 | [009](../findings/009-lider-aprendiz-ausente.md) |
| [#398](https://github.com/Jean1dev/w2pp-OpenWYD/issues/398) | bug | O uso do Molar do Gárgula não refina; falta a flag | MG-05, MG-06, MG-08, MG-09 | 010 |
| [#399](https://github.com/Jean1dev/w2pp-OpenWYD/issues/399) | bug | O Rei não aceita o Emblema do Reino (4081) | CR-06, CR-11 | 011 |
| [#400](https://github.com/Jean1dev/w2pp-OpenWYD/issues/400) | bug | O Rei exige pagamento exato em safiras | CR-12 | 012 |
| [#401](https://github.com/Jean1dev/w2pp-OpenWYD/issues/401) | bug | `terra_mistica` não é salva (volta a 0 no relog) | TM-04, TM-05, TM-06, TM-10 | 013 |
| [#402](https://github.com/Jean1dev/w2pp-OpenWYD/issues/402) | bug | Terra Mística, passo 2: as mortes não contam | TM-07 | 014 |
| [#403](https://github.com/Jean1dev/w2pp-OpenWYD/issues/403) | bug | Terra Mística, passo 3: Cap.Explor. sem rota, sem amuleto | TM-08, TM-09 | 015 |
| [#404](https://github.com/Jean1dev/w2pp-OpenWYD/issues/404) | bug | Pílula do Poder Mágico (470) sem efeito e sem flag | PO-01, PO-01b, PO-02, PO-03, PO-04 | 016 |
| [#405](https://github.com/Jean1dev/w2pp-OpenWYD/issues/405) | bug | Jeffi e Shaman sem rota (Círculo Divino) | CD-02, CD-04, CD-06, CD-07 | 017 |
| [#390](https://github.com/Jean1dev/w2pp-OpenWYD/issues/390) | bug (já existia) | Mestres de skill entregam a Sephirot da classe seguinte | AR-10, AR-11 | 018 |
| [#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) | bug | O Rei não faz a Pedra Ideal (5338) | CE-01, CE-03 | 019 |
| [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) | bug | O Celestial sai pela 1742 e a 5338 é recusada | CE-07, CE-08, CE-09 | 020 |
| [#408](https://github.com/Jean1dev/w2pp-OpenWYD/issues/408) | enhancement | Pedra da Fúria (3020) sem uso: Lv90, Arcana e Reset | CL-05…CL-08 | 021 |
| [#409](https://github.com/Jean1dev/w2pp-OpenWYD/issues/409) | enhancement | Adds do diadema do Sub-Celestial (`SetCircletSubGod`) | CL-10 | 022 |
| [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) | enhancement | Sub-Celestial ausente: criação pela 5338 e Urnammu | SC-03, SC-06 | 023 |

As issues sem label no GitHub contam como bug nesta tabela: são divergências do legado.

## ✅ que precisam ser rodados de novo

Estes casos passaram, mas o resultado não prova a regra.

- **No vácuo:** são controles que só "passam" porque o NPC ou o item não tem código no Go, e o servidor não responde a ninguém. Rode de novo depois da correção da issue indicada:
  - CV-11 e CV-12 (#397);
  - MG-07 (#398);
  - CD-01, CD-03 e CD-05 (#405);
  - CE-04, CE-05 e CE-06 (#407);
  - CL-04 (#408);
  - SC-01, SC-02, SC-04, SC-05 e SC-07 (#410).
- **Informativos:** o Go diverge do legado de propósito. Esses ficam registrados e não viram issue.
  - QST-12 e QST-13: atalhos que só o Go tem para a arena do Coveiro (botão direito na Vela e o Mestre_Grifo).
  - LD-06: o Arch acima do 354 passa na Lindy sem a destrava do 355, por causa da trava de exp do Go.
  - 10/CR-05: o Mortal não usa os Cristais (#327).
  - 10/CR-06: o Cristal com exp insuficiente zera o nível (#348).
  - Os IDs `CR-` das quests 05 e 10 se repetem, por isso o prefixo "10/".

## Próximos passos

1. **Ordem sugerida das correções:**
   - #401 primeiro: é uma linha no `characterSaveToProto` e destrava os outros casos da Terra Mística;
   - depois #395, que bloqueia o novato inteiro;
   - depois as rotas de NPC ausentes: #397, #403 e #405;
   - depois os itens de uso: #398, #404 e #408;
   - por último as regras do Rei e do Celestial: #399, #400, #406, #407 e #390;
   - #409 e #410 são features grandes do Sub-Celestial.
2. **Depois de cada correção:**
   - conferir o deploy do tm-server;
   - rodar de novo a quest inteira (`npm run quest -- NN`) e os casos no vácuo dela;
   - marcar o finding como corrigido.
3. **Pendências de teste sem issue:**
   - Na Poeira de Fada, o Celestial usaria a curva de exp mortal (`item.go:877`, contra `_MSG_UseItem.cpp:1017`). Isso vem só da leitura do código e não foi medido.
   - O banco não guarda a 2ª ficha do Sub-Celestial (`SaveCelestial[1]`). A classe e o nível do Sub não dão para conferir.
   - O Pergaminho_Selado 4127 e a Fama ainda não têm fonte mapeada no jogo; nos casos, vêm do banco.
   - As arenas dos passos 2 a 5 da Quest 256 só estão cobertas pelo cenário 4. Os troféus delas não foram rodados.
