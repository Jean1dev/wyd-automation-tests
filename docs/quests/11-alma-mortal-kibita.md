# 11 — Alma do Mortal (Kibita)

A Kibita, em Armia, destrava a "Alma do Mortal": o bit 30 do `LearnedSkill`, com a capa Herói. Para isso, o Mortal precisa estar no nível exibido 370 ou mais e levar a Pedra Secreta da sua classe. Depois disso, o personagem volta para a seleção de personagem e recebe o efeito de evolução (`_MSG_SendArchEffect`).

## Resumo

- **NPC:** Kibita `[3811]`, em (2135,2104), Armia. Merchant 74 nos dois servidores.

| Classe | Pedra Secreta (consumida) |
|---|---|
| TransKnight (0) | 5334 Pedra_Secreta_(Água) |
| Foema (1) | 5336 Pedra_Secreta_(Sol) |
| BeastMaster (2) | 5335 Pedra_Secreta_(Terra) |
| Huntress (3) | 5337 Pedra_Secreta_(Vento) |

- **Capa:** 3194 Herói_de_Hekalotia (clan 7), 3195 Herói_de_Akelonia (clan 8) ou 3196 Herói_dos_Aventureiros (sem reino). Ela **substitui** a capa atual.
- As Pedras Secretas estão no inventário da Evolucao (`npc/Evolucao`).

## Pré-requisitos

- `ClassMaster == MORTAL`.
- `CurrentScore.Level ≥ 369` (exibido 370).
- O bit 30 do `LearnedSkill` desligado.
- A Pedra Secreta da classe em qualquer slot.

## Fluxo

- **Legado:** `_MSG_Quest.cpp:2518-2558`.
  - Apaga a pedra, liga o bit 30 e troca a capa.
  - `CharLogOut` e `_MSG_SendArchEffect` com o slot.
  - Fora dos requisitos: `_DN_TOWN_SORRY`.
  - A mesma região tem a cidadania (4M de gold, `:2433-2463`), que é secundária.
- **Go:** `kibitaSoul`, `handler/misc.go:436` ✅. Volta para a seleção (`returnToCharacterSelection`) e manda o `MsgSendArchEffect`.

## Casos de uso

| ID | Caso | Pré-condição | Ação do bot | Resultado esperado (legado) | Tipo |
|---|---|---|---|---|---|
| KB-01 | Abaixo do nível | Mortal exibido 369, com a pedra | `MSG_Quest` na Kibita | `_DN_TOWN_SORRY`; a pedra fica | controle |
| KB-02 | Pedra de outra classe | TK exibido 370 com a 5336 (Sol) | `MSG_Quest` | recusa; a pedra fica | controle |
| KB-03 | Alma do Mortal | TK exibido 370 com a 5334, capa 545 | `MSG_Quest` | a pedra some; bit 30 ligado; capa 3194; volta para a seleção com o efeito do Arch | feliz |
| KB-04 | Depois do relogin | depois do KB-03 | entrar de novo | o bit 30 continua (`UpdateEtc`); a capa é a 3194 | feliz |
| KB-05 | Repetir | bit 30 ligado, outra pedra | `MSG_Quest` | recusa; a pedra fica | controle |
| KB-06 | Arch | Arch com a pedra | `MSG_Quest` | recusa | controle |
| KB-07 | Sem reino | Mortal sem clan | KB-03 | capa 3196 | borda |

## Viabilidade do bot

- É barata se a Evolucao vender a Pedra Secreta no Go. Conferir preço e estoque no início do cenário, como o cenário 5 fez com a 1742.
- O nível exibido 370 sai com Poeira de Fada, uns 369 usos.
  - O cenário 5 já leva um mortal ao 400 (`levelMortal`). Dá para reaproveitar o mortal que sobra depois do Arch.
- A volta para a seleção é tratada como no cenário 5 (fase que termina em `in-progress` e reconecta).

## Divergências suspeitas no Go

- Nenhuma no fluxo.
- O Go roteia também a **Lindy** (`CurrentScore.Merchant` 74) para a Kibita. Um Mortal 370 com a pedra que clicar na Lindy recebe a Alma. No legado, a Lindy abre a Terra Mística (arquivo 06). Caso extra:
  - **KB-08:** Mortal 370 com a pedra, `MSG_Quest` na **Lindy**. No legado a Alma não muda. No Go, a suspeita é que a Alma seja concedida.

## Reaproveitamento

- `src/scenarios/archCreation.ts` (mortal 400, relogin pela seleção, efeito do Arch), `src/world/arch.ts` (`NPC.evolucao`), `src/bot/npc.ts` `buyItem`/`talkQuest`.
