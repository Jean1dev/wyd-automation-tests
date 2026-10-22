# 12 — Pedra Ideal e Arch → Celestial

A evolução do Arch para Celestial tem dois passos:

1. **Pedra Ideal (5338):** o Rei transforma as quatro Pedras Secretas (5334–5337) na Pedra Ideal. Para isso o personagem leva a 1742 no Equip[10], a Sephirot no Equip[11] e as quatro pedras no inventário. A 1742 e a Sephirot são destruídas.
2. **Celestial:** o Arch exibido ≥ 356 usa a Pedra Ideal com o botão direito. Ele vira Celestial no nível 1:
   - atributos da classe, AC 230, 855 pontos de aprendizado e só a skill de Alma;
   - Cythera pela faixa de nível do Arch;
   - capa Mestre;
   - volta para a seleção com o efeito de evolução.

## Resumo

### Pedra Ideal (Rei)

- **Rei:** `KING`, `_MSG_Quest.cpp:769-840`.
- **Entrada:**
  - Equip[10] = 1742 e Equip[11] ∈ 1760–1763;
  - 5334, 5335, 5336 e 5337 no inventário.
  - Esse ramo vem **antes** da criação do Arch: um Mortal com as quatro pedras recebe a Pedra Ideal, não o Arch.
- **Saída:** a 5334 vira 5338; as 5335–5337 somem; Equip[10] e Equip[11] ficam vazios; fala `_NN_My_King_Bless1`.

### Arch → Celestial (Vol 211)

| Faixa do Arch (armazenado) | Cythera no Equip[1] | `Celestial.ArchLevel` |
|---|---|---|
| 355–369 | 3500 Cythera_Prateada | 1 |
| 370–379 | 3500 | 2 |
| 380–397 | 3501 | 3 |
| 398 | 3501 | 4 |
| 399 | 3502 Cythera_Mística | 5 |

- **Requisitos:**
  - Arch, `CurrentScore.Level ≥ 355` (exibido 356);
  - **Equip[1] (armadura) vazio**;
  - `QuestInfo.Arch.MortalLevel ≥ 99` (o mortal de origem passou do 398).
- **Saída:**
  - `ClassMaster = CELESTIAL`, nível 0, Str/Int/Dex/Con base da classe, Special zerados;
  - AC 230, `SpecialBonus` 855, `LearnedSkill = 1<<30`, Exp 0;
  - capa 3197 (clan 7), 3198 (clan 8) ou 3199 (sem reino);
  - efeitos 98 e 106 no Equip[0];
  - `CharLogOut` e `_MSG_SendArchEffect`.

## Fluxo

- **Legado:**
  - Pedra Ideal em `_MSG_Quest.cpp:769-840`;
  - Celestial em `_MSG_UseItem.cpp:3003-3182` (o ramo `CELESTIAL` dentro dele é o Sub-Celestial, no arquivo 14).
- **Go:**
  - Pedra Ideal no Rei ❌. O comentário em `handler/misc.go:510-523` diz que esse ramo ficou de fora de propósito: com as pedras no inventário, o Go cria o Arch.
  - Celestial ⚠️: `useIdealStone`, `item.go:1525`, é disparado pela **1742** (Pedra da Imortalidade), não pela 5338 (issue #222).
    - Exige Arch ≥ 355, `MortalLevel ≥ 99` e armadura vazia (`item.go:1528-1545`).
    - A 5338 não tem caso no Go.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| CE-01 | Pedra Ideal | Arch (ou Mortal) com 1742 no Equip[10], Sephirot no Equip[11], 5334–5337 no inventário | `MSG_Quest` no Rei, confirm 1 | 5334 → 5338; 5335–5337 somem; Equip[10] e Equip[11] vazios | feliz |
| CE-02 | Faltando uma Pedra Secreta | sem a 5337 | `MSG_Quest` no Rei | nada da Pedra Ideal. Um Mortal ≥ 299 segue para a criação do Arch | controle |
| CE-03 | Mortal com as 4 pedras no Rei | Mortal 300 com 1742, Sephirot e 5334–5337 | `MSG_Quest` no Rei, confirm 1 | o legado dá a **Pedra Ideal** e **não** cria o Arch. O Go cria o Arch | borda |
| CE-04 | Celestial com armadura | Arch 356 com Equip[1] | `MSG_UseItem` na 5338 | `_NN_Cant_with_armor`; nada muda | controle |
| CE-05 | Arch abaixo do nível | Arch exibido 355 | `MSG_UseItem` na 5338 | nada (`return` sem resposta) | controle |
| CE-06 | Mortal de origem baixo | Arch criado de mortal < 398 (`MortalLevel` < 99) | `MSG_UseItem` na 5338 | nada | controle |
| CE-07 | Celestial | Arch exibido 356, sem armadura, `MortalLevel` ≥ 99 | `MSG_UseItem` na 5338 | a 5338 some; volta para a seleção; ao entrar: Celestial nível 1, Cythera 3500 no Equip[1], capa 3197/3198/3199, `SpecialBonus` 855, só a skill de Alma | feliz |
| CE-08 | 1742 com o botão direito | Arch 356 com 1742 | `MSG_UseItem` na 1742 | o legado não faz nada (a 1742 não é volátil). O Go transforma em Celestial | borda |
| CE-09 | Faixa da Cythera | Arch exibido 400 | CE-07 | Cythera 3502; `ArchLevel` 5 | borda |

## Viabilidade do bot

- **Base:** o Arch do cenário 5 nasceu de um mortal 400, então já tem `MortalLevel ≥ 99`. É o personagem certo.
- **Nível do Arch:** 356 exige uns 355 usos de Poeira de Fada e passar pela Lindy 355 (arquivo 10).
- **Itens:** a Evolucao tem 1742, Sephirot, 5334–5337 e 5338. Conferir a venda no Go primeiro.
- Comprar a 5338 direto permite testar CE-04 a CE-07 sem o Rei. CE-01 testa o Rei à parte.
- A volta para a seleção segue o padrão do cenário 5 e da Kibita.

## Divergências suspeitas no Go

- O gatilho do Celestial é a 1742 em vez da 5338 (CE-07, CE-08). O #222 decidiu isso, então abrir issue só depois de conversar.
- A Pedra Ideal no Rei não existe (CE-01, CE-03).

## Reaproveitamento

- `src/scenarios/archCreation.ts` e a conta do Arch; `src/world/arch.ts`; `talkKing`.

## Situação (2026-10-18)

`npm run quest -- 12` no Railway: 5 ✅ 4 ❌. O Arch (ou o Mortal exibido 300) nasce no banco com a exp mínima do nível, `mortal_level`, `arch_crystal_stage`, Clan 0 e os itens (1742/Sephirot no Equip[10]/[11], Pedras Secretas, 5338 e 1742 em slots altos); nos casos de uso o elmo inicial (1103), que o 1º login põe no Equip[1], é limpo pelo banco.

- **Rei (#406):** o ramo da Pedra Ideal não existe no Go. O Arch cai no serviço de capa ("13 safiras") e o Mortal com as quatro pedras vira Arch.
- **Celestial (#407):** a suspeita do mapa se confirmou. A 5338 é recusada (notice 39) e a 1742 é que transforma o Arch. A transformação em si está certa: nível 0, Cythera pela faixa, capa 3199, SpecialBonus 855, só a Alma e a volta para a seleção.
- Os controles CE-04/05/06 recusam nas duas pedras; na 5338 é vácuo (sem caso no Go), na 1742 são os requisitos do `useIdealStone`.
- A Cythera 3501/3502 do Go exige Cristal 4 (#327); o CE-09 semeia Cristal 4.

| ID | Resultado | Issue |
|---|---|---|
| CE-01 | ❌ | [#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) |
| CE-02 | ✅ | |
| CE-03 | ❌ | [#406](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) |
| CE-04 | ✅ (vácuo na 5338) | |
| CE-05 | ✅ (vácuo na 5338) | |
| CE-06 | ✅ (vácuo na 5338) | |
| CE-07 | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) |
| CE-08 | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) |
| CE-09 | ❌ | [#407](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) |

## Situação (2026-10-22)

Reteste depois do w2pp-OpenWYD#411 (2866b8c): `npm run quest -- 12` no Railway, 6 ✅ 3 ❌.

- **Rei (#406 corrigida):** com 1742/Sephirot equipadas e as quatro Pedras Secretas, o Rei dá a 5338 (Arch ou Mortal), consome o Equip[10]/[11] e não cria o Arch.
- **Celestial (#407 corrigida):** a 5338 transforma o Arch (nível 0, Cythera pela faixa, capa 3199, SpecialBonus 855, só a Alma); a 1742 não faz nada.
- **Controles:** deixaram de ser vácuo e agora exigem a resposta do legado. A recusa e o estado estão certos, mas o Go fala onde o legado fica calado (nível < 355, MortalLevel < 99) e, com armadura, manda outro texto e o notice 24 no lugar de só _NN_Cant_with_armor ([#413](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413)).
- A Cythera 3501/3502 do Go continua exigindo Cristal 4 (#327); o CE-09 semeia Cristal 4.

| ID | Resultado | Issue |
|---|---|---|
| CE-01 | ✅ | [~~#406~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) corrigida |
| CE-02 | ✅ | |
| CE-03 | ✅ | [~~#406~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/406) corrigida |
| CE-04 | ✅ | [~~#413~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) corrigida no #414 |
| CE-05 | ❌ | [#413](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) |
| CE-06 | ❌ | [#413](https://github.com/Jean1dev/w2pp-OpenWYD/issues/413) |
| CE-07 | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida |
| CE-08 | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida |
| CE-09 | ✅ | [~~#407~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/407) corrigida |
