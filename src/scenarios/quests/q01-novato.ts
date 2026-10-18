// Quest 01 — Novato: os quatro treinadores do Campo de Treino (docs/quests/01-novato-treinadores.md).
//
// A flag QuestInfo.Mortal.Newbie não existe no banco do Go, então a pré-condição "Newbie = N" é
// montada jogando: o caso semeia as chaves e faz os passos anteriores com os treinadores. Cada
// passo é conferido pelo efeito (Kit no inventário, adicionais da arma, +3 nas peças, emblema
// consumido), não pelo texto da fala.
import { approachNpc, type NpcSpec, type QuestTalk, talkQuest } from '../../bot/npc.ts';
import { walkPath } from '../../bot/movement.ts';
import { useDustUntil } from '../../bot/quest.ts';
import { sleep } from '../../bot/util.ts';
import { CLASS_MASTER, type Db } from '../../db/seed.ts';
import * as P from '../../protocol/packets.ts';
import { isInTrainingField, ROUTE } from '../../world/trainingField.ts';
import { COVEIRO_ARENA, GEAR, ITEM, NPC, STEP4_REWARDS, STEP_ITEM, STEP_NPC } from '../../world/quests/01-novato.ts';
import { bonusEffs, carryOf, diffSlots, EF_SANC, effValue, equipOf, hasItem, type SlotItem } from './helpers.ts';
import type { CaseCtx, CaseResult, QuestSpec } from './runner.ts';

/** Personagem mortal com o nível ARMAZENADO dado e o inventário limpo nos slots usados pelo caso. */
async function mortal(db: Db, char: string, storedLevel: number): Promise<void> {
  await db.setCharacter(char, { level: storedLevel, class_master: CLASS_MASTER.MORTAL });
}

/** Põe as chaves/emblema dos passos `steps` nos slots 0.. do inventário. */
async function keys(db: Db, char: string, steps: number[]): Promise<void> {
  for (const [i, s] of steps.entries()) await db.putItem(char, 'carry', i, { index: STEP_ITEM[s] });
}

/** Equip[1..7]: conjunto do Artesão, a arma dada e o broquel; `skip` deixa slots vazios. */
async function gear(db: Db, char: string, weapon: number, skip: number[] = []): Promise<void> {
  for (let s = 1; s <= 7; s++) {
    if (skip.includes(s)) { await db.clearItem(char, 'equip', s); continue; }
    const index = s === 6 ? weapon : s === 7 ? GEAR.broquel : GEAR.artesao[s];
    await db.putItem(char, 'equip', s, { index });
  }
}

interface Talk {
  npc: string;
  talk: QuestTalk;
  carry: { gained: SlotItem[]; lost: SlotItem[] };
  equip: { gained: SlotItem[]; lost: SlotItem[] };
}

/** Entra no Campo de Treino (a pé, pela rota de Armia) se ainda não estiver nele. */
async function enterField(ctx: CaseCtx): Promise<void> {
  const me = ctx.c.self!;
  if (!isInTrainingField(me.x, me.y)) await walkPath(ctx.c, [ROUTE.armiaEdge, ROUTE.fieldEntry]);
}

/** Fala com o NPC (MSG_Quest, confirm 0) e devolve o que mudou no inventário e no equipamento. */
async function talk(ctx: CaseCtx, npc: NpcSpec): Promise<Talk> {
  await enterField(ctx);
  await approachNpc(ctx.c, npc);
  const carry0 = carryOf(ctx.c), equip0 = equipOf(ctx.c);
  const t = await talkQuest(ctx.c, ctx.log, npc, 4000);
  await sleep(1000);
  return { npc: npc.name, talk: t, carry: diffSlots(carry0, carryOf(ctx.c)), equip: diffSlots(equip0, equipOf(ctx.c)) };
}

const nothingChanged = (t: Talk) => !t.talk.teleport && !t.carry.gained.length && !t.carry.lost.length && !t.equip.gained.length && !t.equip.lost.length;

/** O efeito esperado do passo N (legado _MSG_Quest.cpp:1895-2100) aconteceu nesta fala? */
function stepDone(n: number, t: Talk, c: CaseCtx['c'], weaponReqLvlOk = true): boolean {
  switch (n) {
    case 1: // +682 com 20 cargas; a 451 fica
      return t.carry.gained.some((x) => x.index === ITEM.kitDeCura && effValue(x, P.EF_AMOUNT) === 20) && hasItem(carryOf(c), ITEM.chave1);
    case 2: // adicionais da arma refeitos (só com ReqLvl ≤ 39); a chave fica
      return (weaponReqLvlOk ? t.equip.gained.some((x) => x.slot === 6 && bonusEffs(x).length > 0) : true) && hasItem(carryOf(c), ITEM.chave2);
    case 3: { // Equip[1..7] com +3
      const eq = equipOf(c);
      return eq.filter((x) => x.slot >= 1 && x.slot <= 7).every((x) => effValue(x, EF_SANC) === 3) && t.equip.gained.length > 0;
    }
    case 4: // a 524 some; aparece 682 ×20, 481 ou 652
      return !hasItem(carryOf(c), ITEM.emblemaOrc) && t.carry.gained.some((x) => STEP4_REWARDS.includes(x.index));
    default:
      return false;
  }
}

/**
 * Faz os passos 1..upTo em sequência (pré-condição "Newbie = upTo"). Para no primeiro passo
 * sem efeito e devolve até onde chegou.
 */
async function advance(ctx: CaseCtx, upTo: number, ev: Record<string, unknown>, weaponReqLvlOk = true): Promise<number> {
  for (let n = 1; n <= upTo; n++) {
    const t = await talk(ctx, STEP_NPC[n]);
    const ok = stepDone(n, t, ctx.c, weaponReqLvlOk);
    ev[`passo${n}`] = { ok, ...summary(t) };
    if (!ok) return n - 1;
  }
  return upTo;
}

function summary(t: Talk) {
  return {
    npc: t.npc, notices: t.talk.notices, texts: t.talk.texts, teleport: t.talk.teleport,
    carryGained: t.carry.gained, carryLost: t.carry.lost, equipGained: t.equip.gained, equipLost: t.equip.lost,
  };
}

const unreached = (want: number, got: number) => `pré-condição Newbie = ${want} não alcançada: o passo ${got + 1} não teve efeito`;

/**
 * A pré-condição não foi alcançada: ainda fala com o NPC do caso, para registrar como ele
 * responde fora da sequência (evidência para a issue), e reprova.
 */
async function unreachedAt(ctx: CaseCtx, ev: Record<string, unknown>, want: number, got: number, npc: NpcSpec): Promise<CaseResult> {
  const t = await talk(ctx, npc);
  ev.alvo = summary(t);
  const resp = t.talk.notices.length ? `notices ${t.talk.notices.join(',')}` : t.talk.texts.length ? `"${t.talk.texts.join(' | ')}"` : 'sem resposta';
  return { pass: false, evidence: ev, note: `${unreached(want, got)}; ${npc.name} direto: ${resp}${nothingChanged(t) ? ', nada mudou' : ', mexeu no personagem'}` };
}

/** Itens do banco depois de um relog (o que o servidor salvou). */
async function savedItems(ctx: CaseCtx) {
  await ctx.relog();
  return ctx.query(async (db, char) => ({ carry: await db.items(char, 'carry'), equip: await db.items(char, 'equip') }));
}

const quest: QuestSpec = {
  id: '01',
  name: 'Novato: os quatro treinadores do Campo de Treino',
  cases: [
    {
      id: 'NOV-01',
      title: 'Passo 1 sem a chave',
      type: 'controle',
      seed: (db, char) => mortal(db, char, 0),
      run: async (ctx) => {
        const t = await talk(ctx, NPC.treinador1);
        const pass = nothingChanged(t);
        return { pass, evidence: summary(t), note: pass ? `nada mudou (notices ${t.talk.notices.join(',') || '—'})` : 'o Treinador1 mexeu no personagem sem a chave' };
      },
    },
    {
      id: 'NOV-02',
      title: 'Passo 1',
      type: 'feliz',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1]); },
      run: async (ctx) => {
        const t = await talk(ctx, NPC.treinador1);
        const ok = stepDone(1, t, ctx.c);
        const ev: Record<string, unknown> = summary(t);
        if (!ok) return { pass: false, evidence: ev, note: `sem Kit 682 ×20 (notices ${t.talk.notices.join(',') || '—'}, inventário igual: ${!t.carry.gained.length})` };
        const saved = await savedItems(ctx);
        ev.saved = saved;
        const pass = saved.carry.some((x) => x.index === ITEM.kitDeCura) && saved.carry.some((x) => x.index === ITEM.chave1);
        return { pass, evidence: ev, note: pass ? 'Kit 682 ×20 recebido e salvo; 451 mantida' : 'o Kit não foi salvo no banco' };
      },
    },
    {
      id: 'NOV-03',
      title: 'Passo 1 de novo',
      type: 'controle',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1]); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 1, ev);
        if (got < 1) return unreachedAt(ctx, ev, 1, got, NPC.treinador1);
        const t = await talk(ctx, NPC.treinador1);
        ev.denovo = summary(t);
        const pass = nothingChanged(t);
        return { pass, evidence: ev, note: pass ? 'segundo pedido sem Kit novo' : 'o Treinador1 deu a recompensa de novo' };
      },
    },
    {
      id: 'NOV-04',
      title: 'Pular passo',
      type: 'controle',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 3]); await gear(db, char, GEAR.lancaCurva); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 1, ev);
        if (got < 1) return unreachedAt(ctx, ev, 1, got, NPC.treinador3);
        const t = await talk(ctx, NPC.treinador3);
        ev.treinador3 = summary(t);
        const pass = nothingChanged(t);
        return { pass, evidence: ev, note: pass ? 'Treinador3 com Newbie 1 não mexeu no equipamento' : 'o Treinador3 aceitou o passo 3 com Newbie 1' };
      },
    },
    {
      id: 'NOV-05',
      title: 'Passo 2',
      type: 'feliz',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2]); await gear(db, char, GEAR.lancaCurva); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 2, ev);
        if (got < 1) return unreachedAt(ctx, ev, 1, got, NPC.treinador2);
        if (got < 2) return { pass: false, evidence: ev, note: 'Treinador2 não refez os adicionais da Lança_Curva (ReqLvl 23)' };
        const weapon = equipOf(ctx.c).find((x) => x.slot === 6);
        const saved = await savedItems(ctx);
        ev.saved = saved.equip.find((x) => x.slot === 6);
        const pass = JSON.stringify(bonusEffs(saved.equip.find((x) => x.slot === 6))) === JSON.stringify(bonusEffs(weapon));
        return { pass, evidence: ev, note: pass ? `arma com adicionais ${JSON.stringify(bonusEffs(weapon))}, salvos` : 'os adicionais novos não foram salvos' };
      },
    },
    {
      id: 'NOV-06',
      title: 'Passo 2 com arma de ReqLvl > 39',
      type: 'borda',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2, 3]); await gear(db, char, GEAR.lancaDoVento); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 1, ev);
        if (got < 1) return unreachedAt(ctx, ev, 1, got, NPC.treinador2);
        const t2 = await talk(ctx, NPC.treinador2);
        ev.passo2 = summary(t2);
        const weaponSame = !t2.equip.gained.some((x) => x.slot === 6);
        // Newbie = 2 só se vê pelo passo 3 funcionar em seguida.
        const t3 = await talk(ctx, NPC.treinador3);
        ev.passo3 = summary(t3);
        const flag2 = stepDone(3, t3, ctx.c);
        const pass = weaponSame && flag2;
        return { pass, evidence: ev, note: `arma ${weaponSame ? 'igual' : 'mudou'}; passo 3 em seguida ${flag2 ? 'funcionou (Newbie = 2)' : 'sem efeito (Newbie ≠ 2)'}` };
      },
    },
    {
      id: 'NOV-07',
      title: 'Passo 3',
      type: 'feliz',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2, 3]); await gear(db, char, GEAR.lancaCurva); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 3, ev);
        if (got < 2) return unreachedAt(ctx, ev, 2, got, NPC.treinador3);
        if (got < 3) return { pass: false, evidence: ev, note: 'Treinador3 não pôs +3 nas peças' };
        const saved = await savedItems(ctx);
        ev.saved = saved.equip;
        const pass = saved.equip.filter((x) => x.slot >= 1 && x.slot <= 7).every((x) => effValue(x, EF_SANC) === 3);
        return { pass, evidence: ev, note: pass ? 'Equip[1..7] com +3, salvo' : 'o +3 não foi salvo' };
      },
    },
    {
      id: 'NOV-08',
      title: 'Passo 3 com slot vazio',
      type: 'borda',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2, 3]); await gear(db, char, GEAR.lancaCurva, [2]); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 3, ev);
        const slot2 = ctx.c.self!.equip[2];
        ev.equip2 = slot2;
        if (got < 2) return unreachedAt(ctx, ev, 2, got, NPC.treinador3);
        if (got < 3) return { pass: false, evidence: ev, note: 'Treinador3 não pôs +3 nas peças' };
        return { pass: true, evidence: ev, note: `peças com +3; Equip[2] vazio ficou ${slot2?.index ? `com o item ${slot2.index}` : `vazio (efeitos ${JSON.stringify(slot2?.eff ?? [])})`}` };
      },
    },
    {
      id: 'NOV-09',
      title: 'Passo 4',
      type: 'feliz',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2, 3, 4]); await gear(db, char, GEAR.lancaCurva); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 4, ev);
        if (got < 3) return unreachedAt(ctx, ev, 3, got, NPC.chefe);
        if (got < 4) return { pass: false, evidence: ev, note: 'Chefe_de_Treino não trocou o Emblema_Orc' };
        const saved = await savedItems(ctx);
        ev.saved = saved.carry;
        const pass = !saved.carry.some((x) => x.index === ITEM.emblemaOrc) && saved.carry.some((x) => STEP4_REWARDS.includes(x.index));
        return { pass, evidence: ev, note: pass ? '524 consumida e recompensa salva' : 'a troca não foi salva' };
      },
    },
    {
      id: 'NOV-10',
      title: 'Acima do nível',
      type: 'controle',
      // Exibido 35 para entrar no campo a pé; a Poeira de Fada sobe para 36 ao lado do treinador.
      seed: async (db, char) => {
        await mortal(db, char, 34);
        await keys(db, char, [1]);
        await db.putItem(char, 'carry', 5, { index: ITEM.poeiraDeFada, eff: [[P.EF_AMOUNT, 1]] });
      },
      run: async (ctx) => {
        await enterField(ctx);
        await approachNpc(ctx.c, NPC.treinador1);
        const fail = await useDustUntil(ctx.c, ctx.log, 35, () => {});
        if (fail || ctx.c.self!.level !== 35) return { pass: false, evidence: { dust: fail }, note: 'a Poeira de Fada não subiu para o exibido 36 (falha do bot)' };
        const t = await talk(ctx, NPC.treinador1);
        const pass = nothingChanged(t);
        return { pass, evidence: summary(t), note: pass ? 'exibido 36 com a 451: nada mudou' : 'o Treinador1 deu o Kit acima do nível' };
      },
    },
    {
      id: 'NOV-11',
      title: 'Flag persiste',
      type: 'borda',
      seed: async (db, char) => { await mortal(db, char, 9); await keys(db, char, [1, 2]); await gear(db, char, GEAR.lancaCurva); },
      run: async (ctx) => {
        const ev: Record<string, unknown> = {};
        const got = await advance(ctx, 2, ev);
        if (got < 2) return unreachedAt(ctx, ev, 2, got, NPC.treinador2);
        await ctx.relog();
        const t = await talk(ctx, NPC.treinador2);
        ev.depoisDoRelog = summary(t);
        const pass = nothingChanged(t);
        return { pass, evidence: ev, note: pass ? 'depois do relog o Treinador2 não refez a arma (Newbie salvo)' : 'depois do relog o passo 2 rodou de novo (Newbie não persistiu)' };
      },
    },
    {
      id: 'NOV-12',
      title: 'Treinador1 não é Coveiro',
      type: 'controle',
      // Exibido 35 para entrar no campo; 5 Poeiras sobem para 40 ao lado do Treinador1.
      seed: async (db, char) => {
        await mortal(db, char, 34);
        await db.putItem(char, 'carry', 0, { index: ITEM.velaDoCoveiro });
        await db.putItem(char, 'carry', 5, { index: ITEM.poeiraDeFada, eff: [[P.EF_AMOUNT, 5]] });
      },
      run: async (ctx) => {
        await enterField(ctx);
        await approachNpc(ctx.c, NPC.treinador1);
        const fail = await useDustUntil(ctx.c, ctx.log, 39, () => {});
        if (fail || ctx.c.self!.level !== 39) return { pass: false, evidence: { dust: fail }, note: 'a Poeira de Fada não subiu para o exibido 40 (falha do bot)' };
        const t = await talk(ctx, NPC.treinador1);
        const me = ctx.c.self!;
        const inArena = me.x > COVEIRO_ARENA.x1 && me.y > COVEIRO_ARENA.y1 && me.x < COVEIRO_ARENA.x2 && me.y < COVEIRO_ARENA.y2;
        const vela = hasItem(carryOf(ctx.c), ITEM.velaDoCoveiro);
        const pass = !t.talk.teleport && vela;
        return {
          pass,
          evidence: { ...summary(t), final: { x: me.x, y: me.y }, inArena, vela },
          note: pass ? 'sem teleporte; a Vela ficou' : `teleportado para (${t.talk.teleport?.to.x},${t.talk.teleport?.to.y})${inArena ? ' (arena do Coveiro)' : ''}; Vela ${vela ? 'ficou' : 'consumida'}`,
        };
      },
    },
  ],
};

export default quest;
