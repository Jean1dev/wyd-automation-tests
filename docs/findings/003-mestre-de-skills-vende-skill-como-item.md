# 003 — O mestre de skills vende a skill como item pelo MSG_Buy

**Status:** corrigido no [#416](https://github.com/Jean1dev/w2pp-OpenWYD/pull/416) (issue [~~#391~~](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)). Na Magia Negra, o reteste no Railway passou em 2026-10-26 (`reports/2026-10-26T13-43-41-340Z-foema-black-magic`), ver abaixo.

Confirmado no Railway em 2026-10-17 (execução `reports/2026-10-17T17-02-07-259Z-foema-black-magic`).
Reproduzido de novo em todas as árvores seguintes:
- Magia Branca (5025);
- Magia Especial (5041);
- no mestre do BeastMaster, o Mestre_Archi (Merchant 19): 5049, 5057 e 5066 (cenário 9).
- no mestre da Huntress, o ForeLearner (Merchant 19): 5073, 5081 e 5089 (cenário 10).
- no mestre do TransKnight, o Cap.Cavaleiros (Merchant 19): 5001, 5010 e 5017 (cenário 11).
**Issue:** [Jean1dev/w2pp-OpenWYD#391](https://github.com/Jean1dev/w2pp-OpenWYD/issues/391)
**Cenário:** `npm run scenario:foema-black`
**Servidor:** `Jean1dev/w2pp-OpenWYD`, tmServer Go (main `d896ae2f`)

## O que aconteceu

Às 17:03:25 UTC a Foema `bot0fagjhyod` abriu a janela do Foema_Ancian (Merchant 19, (2094,2126)) e mandou um `MSG_Buy` para o slot 28 dele, onde fica o Relâmpago (5033). O servidor respondeu como numa loja comum:
- veio o eco do `MSG_Buy`, depois `UpdateEtc` e `SendItem`;
- o **item 5033 apareceu no slot 5 do inventário**;
- o gold não mudou (995.000), porque as skills custam 0 no ItemList.

No legado, só o mercador comum vende: `_MSG_Buy.cpp:55` recusa `Merchant != 1` com `_NN_Only_Merchant_Sells` ("Pode comprar itens apenas do mercador."). O Go só recusa `Merchant == 0` (`handler/shop.go:64`). A venda tem a mesma diferença (`_MSG_Sell.cpp:105` contra `shop.go:134`). Pela leitura do código, o `buy` do Go também não confere se o NPC está à vista (`GetInView` no legado).

O item 5033 não tem `EF_VOLATILE`, então não ensina a skill pelo `MSG_UseItem`. O efeito é um item que o jogador não deveria ter, mas a mesma regra deixa comprar o Carry de qualquer NPC com Merchant diferente de 0 e de 1.

## O que funciona (o resto do cenário)

| Verificação | Resultado |
|---|---|
| Aprender 32–38 no Foema_Ancian assim que há pontos, nível e maestria | ✅ níveis exibidos 7, 24, 47, 71, 95, 125 e 152 |
| Um nível antes, a recusa | ✅ `NotEnoughSkillPoint` sem mexer no Learn |
| Aprender liga só o bit da skill e desconta exatamente os pontos dela, sem gold | ✅ |
| Aprender de novo | ✅ com o saldo zerado, `NotEnoughSkillPoint` (o legado confere os pontos primeiro); com 224 livres, `AlreadyLearned` |
| Cast: eco com a skill, dano no alvo, MP pela fórmula `ManaSpent*(Special/2+100)/100` | ✅ nas 7 skills |
| Tempestade de Meteoros acerta vários alvos | ✅ 400/381 |
| Trovão instala o tick (affect 22) e dispara Relâmpagos sozinho | ✅ 1746 de dano 6 s depois do cast |
| Skill não aprendida, sem MP, alvo fora do alcance | ✅ descartado / SetHpMp sem dano / dano 0 |
| Inferno sem os 50M de gold | ✅ `NotEnoughCoin`, nada muda. Aprender e conjurar fica bloqueado. |
| Relogin | ✅ Learn 0x7F00, SkillBonus 224 = 3×219 + 20 − 453 |
| **Comprar a skill como item no mestre** | ❌ entregou o item 5033 |

## Reteste (2026-10-26)

Com o deploy de main de 12:49Z, que traz o #416, o mesmo `MSG_Buy` para o slot 28 do Foema_Ancian (Relâmpago, 5033) foi recusado:
- 13:24:02 UTC: veio um `MessagePanel` e nenhum `SendItem`, e o slot de destino continuou vazio;
- 13:41:24 UTC: o texto do painel é "Pode comprar itens apenas do mercador.", como no legado (`_MSG_Buy.cpp:55`);
- o gold não mudou (995.000).

Na Magia Branca (cenário 7), às 14:05–14:27 UTC (`reports/2026-10-26T14-05-54-749Z-foema-white-magic`), o `MSG_Buy` do Desintoxicar (5025, slot 2 do Foema_Ancian) também foi recusado com "Pode comprar itens apenas do mercador.", sem item e com o gold igual (995.000).

Na Magia Especial (cenário 8), às 14:31:30 UTC (`reports/2026-10-26T14-30-11-048Z-foema-special-magic`), o `MSG_Buy` da Velocidade (5041, slot 55 do Foema_Ancian) também foi recusado com "Pode comprar itens apenas do mercador.", sem item e com o gold igual (995.280).

No BeastMaster (cenário 9), o Mestre_Archi recusou as três árvores com "Pode comprar itens apenas do mercador.", sem item e com o gold igual (995.000): o 5049 às 14:50:53 UTC (`reports/2026-10-26T14-49-25-363Z-bm-magic`), o 5057 às 15:08:48 (`reports/2026-10-26T15-07-02-294Z-bm-summon`) e o 5066 às 15:24:24 (`reports/2026-10-26T15-22-45-135Z-bm-transform`).

Na Huntress (cenário 10), o ForeLearner recusou as três árvores com "Pode comprar itens apenas do mercador.", sem item e com o gold igual: o 5073 às 15:56:10 UTC (`reports/2026-10-26T15-55-00-744Z-ht-tree1`), o 5081 às 16:10:11 (`reports/2026-10-26T16-09-04-556Z-ht-tree2`) e o 5089 às 16:24:38 (`reports/2026-10-26T16-23-27-748Z-ht-tree3`).

No TransKnight (cenário 11), o Cap.Cavaleiros recusou as três árvores com "Pode comprar itens apenas do mercador.", sem item e com o gold igual: o 5001 às 16:41:08 UTC (`reports/2026-10-26T16-40-00-146Z-tk-tree1`), o 5010 às 16:54:44 (`reports/2026-10-26T16-53-37-788Z-tk-tree2`) e o 5017 às 17:08:55 (`reports/2026-10-26T17-07-12-403Z-tk-tree3`).

## Como verificar

`npm run scenario:foema-black -- --fresh --until-done`: o controle `buyAsItem` passa quando o `MSG_Buy` no Foema_Ancian não entrega nenhum item.
