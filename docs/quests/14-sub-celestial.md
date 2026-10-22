# 14 — Sub-Celestial e troca de subclasse (Urnammu)

O Celestial exibido ≥ 121 ganha uma segunda ficha, a do Sub-Celestial. Para isso ele equipa a Sephirot da classe desejada no Equip[11] e usa a Pedra Ideal (5338). O personagem vira `CELESTIALCS`, e a ficha do Sub é montada em `SaveCelestial[1]` com:
- nível 0;
- atributos e HP/MP da classe nova;
- AC 230 e 855 pontos de aprendizado;
- só as skills de bits 24–31.

Depois, o Urnammu troca a classe dessa ficha por 2000 de Fama e outra Sephirot.

## Resumo

| Passo | Gatilho | Requisitos (legado) | Resultado |
|---|---|---|---|
| Criar o Sub | uso da 5338 (Vol 211) | `ClassMaster == CELESTIAL`; armazenado ≥ 120; Sephirot 1760–1763 no Equip[11] | `ClassMaster = CELESTIALCS`; `SaveCelestial[1]` montado com a classe = Sephirot − 1760; a Sephirot e uma 5338 somem; fala `_NN_My_King_Bless1` |
| Trocar a subclasse | `MSG_Quest` no Urnammu `[4235]` (3232,1685), Merchant 76 | `CELESTIALCS`; Sephirot no Equip[11]; `Fame ≥ 2000` | Fama −2000; a classe do `SaveCelestial[1]` muda; atributos base da classe; devolve até 55 por Special; barras de skill limpas; `LearnedSkill &= 0xFF000000`; a Sephirot some |

- A alternância entre Celestial e Sub-Celestial (`SCELESTIAL`) usa a Pedra Misteriosa 4148 (`_MSG_UseItem.cpp:3186-3289`; Go `usePedraMisteriosa`, `handler/subcelestial.go`, w2pp-OpenWYD#415): casos SC-08…SC-11.
- O caminho ao Urnammu (Continente desconhecido) é o portal do Deserto (2364,3924) → (3250,1703) e o `/kefra` (`GetFunc.cpp:1006-1010`, `_MSG_MessageWhisper.cpp:836-850`), os dois dependentes do Kefra derrotado: casos SC-12…SC-15. O estado do Kefra é global (tabela `kefra_state`), o tmServer só o lê no boot e ele divide o EXP de todos por 2 quando vivo: não se semeia. Os casos do estado que o mundo não tem viram ⏸️ (`precheck` do runner).
- Os adds do Sub-Celestial estão no arquivo 13.

## Fluxo

- **Legado:**
  - criar o Sub em `_MSG_UseItem.cpp:3029-3085`, no ramo `CELESTIAL` do Vol 211;
  - Urnammu em `_MSG_Quest.cpp:1247-1311`.
- **Go:** ❌ para os dois.
  - A 5338 não tem caso.
  - O `useIdealStone` (1742) só aceita Arch.
  - O Urnammu (Merchant 76) não tem rota no `quest` (`handler/misc.go:142-260`).

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| SC-01 | Sub sem Sephirot | Celestial 121 sem Sephirot no Equip[11] | `MSG_UseItem` na 5338 | nada (`return`) | controle |
| SC-02 | Sub abaixo do nível | Celestial exibido 120, com Sephirot | `MSG_UseItem` na 5338 | nada | controle |
| SC-03 | Criar o Sub | Celestial exibido 121, Sephirot 1762 (BM) | `MSG_UseItem` na 5338 | a 5338 e a Sephirot somem; `CELESTIALCS`; a ficha 2 é BM nível 1 | feliz |
| SC-04 | Sub de novo | já `CELESTIALCS` | `MSG_UseItem` na 5338 | nada (a classe não é mais `CELESTIAL`) | controle |
| SC-05 | Urnammu sem Fama | `CELESTIALCS`, Sephirot, `Fame` < 2000 | `MSG_Quest` no Urnammu | recusa; nada muda | controle |
| SC-06 | Trocar a subclasse | `CELESTIALCS`, Sephirot 1763 (HT), `Fame` ≥ 2000 | `MSG_Quest` no Urnammu | Fama −2000; a ficha 2 vira HT, com os pontos devolvidos; a Sephirot some | feliz |
| SC-07 | Urnammu para Celestial puro | `CELESTIAL` | `MSG_Quest` no Urnammu | recusa | controle |
| SC-08 | Pedra Misteriosa: Celestial → Sub | `CELESTIALCS` (Sub criado pela 5338), em Armia, 4148 no inventário | `MSG_UseItem` na 4148 | `SCELESTIAL`; a ficha do Sub vira a ativa (classe, nível, exp, atributos, skills, Soul); a do Celestial vai para `SaveCelestial[0]`; `CelestialLevel` = nível que saiu; `MSG_SetShortSkill`; rosto = MortalFace + 5 + classe; a 4148 some | feliz |
| SC-09 | Pedra Misteriosa: Sub → Celestial | `SCELESTIAL` (depois do SC-08), em Armia | `MSG_UseItem` na 4148 | `CELESTIALCS`; volta a ficha do Celestial de antes; a do Sub vai para `SaveCelestial[1]`; `SubCelestialLevel` = nível que saiu | feliz |
| SC-10 | Pedra Misteriosa fora da cidade | `CELESTIALCS` no Continente desconhecido | `MSG_UseItem` na 4148 | `_NN_OnlyVillage` + SendItem da pedra; nada muda | controle |
| SC-11 | Pedra Misteriosa no Celestial puro | `CELESTIAL` em Armia | `MSG_UseItem` na 4148 | só o SendItem da pedra, calado; nada muda | controle |
| SC-12 | /kefra com o Kefra vivo | Kefra vivo no mundo | `/kefra` | (2365..2367,3884..3886) + "O kefra ainda esta vivo, precisa ser derrotado" | controle |
| SC-13 | Portal do Deserto com o Kefra vivo | Kefra vivo; `/kefra` e a pé até (2364,3924) | `MSG_ReqTeleport` | sem teleporte (`KefraLive == 0`, GetFunc.cpp:1006) | controle |
| SC-14 | /kefra com o Kefra derrotado | Kefra derrotado; `CELESTIALCS`, Fama 100 | `/kefra` e `MSG_Quest` no Urnammu | (3250..3252,1695..1697) + `_NN_TP_KEFRA`; o Urnammu responde (`_DN_NEEDFAME`) | feliz |
| SC-15 | Portal do Deserto com o Kefra derrotado | Kefra derrotado; no tile (2364,3924) | `MSG_ReqTeleport` | (3250..3252,1703..1705) | feliz |

## Viabilidade do bot

- Depende do Celestial do arquivo 12 e de levá-lo ao nível exibido 121 (Poeira de Fada, com a destrava Lv40 e a Lv90 no caminho, arquivo 13).
- A Fama (2000) não tem fonte simples, então o SC-06 provavelmente fica `blocked`.
- **Recomendação:** é o último cenário da cadeia. Os controles SC-01, SC-02, SC-04, SC-05 e SC-07 rodam assim que houver um Celestial.

## Divergências suspeitas no Go

- O Sub-Celestial e o Urnammu não existem.

## Reaproveitamento

- A cadeia de personagens dos arquivos 09 → 12 → 13; `src/world/arch.ts` (Evolucao: 5338 e Sephirot).

## Situação (2026-10-18)

`npm run quest -- 14` no Railway: 5 ✅ 2 ❌, os cinco controles no vácuo. O Celestial (class_master 3, ou 4 para `CELESTIALCS`) nasce no banco no armazenado 119/120, com a exp da curva do Celestial do Go, `celestial_lv40/lv90` 1, a Fama, a Sephirot no Equip[11] e a 5338 no slot 20. Para chegar ao Urnammu, o ponto da Gema Estelar é semeado em (3235,1688) (`save_x/save_y`) e o bot usa o Pergaminho_do_Teleporte (699). O Go não tem o teleporte Deserto → Kefra do legado, e o `/kefra` dele vai para outro lugar.

- **Sub-Celestial (#410):** a 5338 é recusada para o Celestial (notice 39). O Urnammu aparece (id 12901), mas não responde ao `MSG_Quest`. O Go não tem a ficha `SaveCelestial[1]`, então a classe e o nível do Sub não dá para conferir em nenhum caso.
- Os controles SC-01/02/04 (5338) e SC-05/07 (Urnammu) "passam" só porque nada acontece.

| ID | Resultado | Issue |
|---|---|---|
| SC-01 | ✅ (vácuo) | |
| SC-02 | ✅ (vácuo) | |
| SC-03 | ❌ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) |
| SC-04 | ✅ (vácuo) | |
| SC-05 | ✅ (vácuo) | |
| SC-06 | ❌ | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) |
| SC-07 | ✅ (vácuo) | |

## Situação (2026-10-22)

`npm run quest -- 14` no Railway depois do w2pp-OpenWYD#411 (2866b8c): 7 ✅. Os controles deixaram de ser vácuo e agora exigem a recusa do legado. A ficha 2 (`SaveCelestial[1]`) é lida do blob `save_celestial` (`db.saveCelestial`, layout de `world/celestial_sheet.go`), sem semear o blob à mão.

- **Criar o Sub (#410, parte feita):** a 5338 vira o Celestial com Sephirot em `CELESTIALCS` e fala `_NN_My_King_Bless1`. A Sephirot e a pedra somem. A ficha 2 persiste com a classe da Sephirot, nível 0, AC 230, 855 pontos, Str..Con da classe ativa e HP/MP da classe da Sephirot. Sem Sephirot, abaixo do 120 ou já `CELESTIALCS`, a pedra volta só com o SendItem do slot, calado, como o legado.
- **Urnammu (#410, parte feita):** troca a classe da ficha 2 (BM → HT), cobra 2000 de Fama e tira a Sephirot. As recusas falam `_DN_NEEDFAME` e `_SN_NEEDCLASS`, como o legado. No SC-06 o Sub nasce jogando, pela 5338, antes do Urnammu.
- **Pendente no #410:** a Pedra Misteriosa 4148 e o caminho até o Urnammu (Deserto → Kefra, `/kefra`). O bot segue chegando pelo `save_x/save_y` e o Pergaminho 699. Nenhum caso desta quest depende disso.

| ID | Resultado | Issue |
|---|---|---|
| SC-01 | ✅ (recusa calada do legado) | |
| SC-02 | ✅ (recusa calada do legado) | |
| SC-03 | ✅ | ~~#410~~ corrigida no #411 (parcial) |
| SC-04 | ✅ (recusa calada do legado) | |
| SC-05 | ✅ (`_DN_NEEDFAME`) | |
| SC-06 | ✅ | ~~#410~~ corrigida no #411 (parcial) |
| SC-07 | ✅ (`_SN_NEEDCLASS`) | |

## Situação (2026-10-22, depois do #415)

`npm run quest -- 14` no Railway depois do [w2pp-OpenWYD#415](https://github.com/Jean1dev/w2pp-OpenWYD/pull/415) (deploy `55cbf4a3`): 11 ✅ 2 ❌ 2 ⏸️. SC-01…07 seguem passando. Os casos SC-08…15 são novos e cobrem a Pedra Misteriosa e o caminho ao Urnammu.

- **Pedra Misteriosa 4148:** a troca acontece. `class_master` vira 5, nível/exp vêm da ficha do Sub, `celestial_level` recebe o nível que saiu, a ficha do Celestial vai para `SaveCelestial[0]`, chega `MSG_SetShortSkill` e a pedra some. Mas a **classe ativa não persiste**: depois do relog `class` continua 0 (TK) em vez de 2 (BM). O Go não salva a coluna `class` (`characterSaveToProto` em dbclient/client.go:776, `SaveCharacter` em store_live.go:396). A volta (SC-09) então estacionaria a classe errada na ficha do Sub. [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) reaberta. Fora da cidade sai `_NN_OnlyVillage` (notice 42), e no Celestial puro só o SendItem calado, como o legado.
- **Caminho ao Urnammu:** com o Kefra vivo, `/kefra` leva a (2366,3884) com "O kefra ainda esta vivo, precisa ser derrotado", e o portal do Deserto (2364,3924), alcançado a pé a partir dali, não teleporta. Os casos com o Kefra derrotado ficam ⏸️ pelo `precheck`. O estado do Kefra (`kefra_state`) é global, o tmServer só o lê no boot e ele divide o EXP de todos, então não se semeia. Eles rodam sozinhos quando o mundo tiver o Kefra derrotado. SC-05…07 seguem chegando ao Urnammu pelo `save_x/save_y` e pelo Pergaminho 699, porque não são sobre o caminho.

| ID | Resultado | Issue |
|---|---|---|
| SC-01…07 | ✅ (sem regressão) | |
| SC-08 | ❌ `class` não persiste depois da 4148 | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) reaberta |
| SC-09 | ❌ mesma causa | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) reaberta |
| SC-10 | ✅ `_NN_OnlyVillage` | |
| SC-11 | ✅ SendItem calado | |
| SC-12 | ✅ /kefra → cidade de Kefra | |
| SC-13 | ✅ portal sem teleporte | |
| SC-14 | ⏸️ Kefra vivo no mundo | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) |
| SC-15 | ⏸️ Kefra vivo no mundo | [#410](https://github.com/Jean1dev/w2pp-OpenWYD/issues/410) |
