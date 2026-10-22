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

- A alternância entre Celestial e Sub-Celestial (`SCELESTIAL`) usa a Pedra Misteriosa, que é tratada no Go fora do caminho de equipar (`item.go`). Ela não faz parte desta quest.
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
