// One-on-one turn battle engine (COMBAT_SPEC v0.3, milestone 3 scope). Pure and
// deterministic: act() validates a command, resolves the hero's action and every enemy
// action until the hero's next turn, and returns a new state plus an immutable event log.
// The screen only plays that log back, so skipping or resizing can never change results.
//
// Not in milestone 3 (COMBAT_SPEC §3–7, milestone 4): Perfect Strike/Guard timing (always
// Normal here), Astra Burst, elemental reactions and combat-trigger talents. Stat talents
// already apply through effectiveStats().
import { CLASSES, ENEMIES, ITEMS, type ClassId, type EnemyId, type ItemId, type Stats } from "./data";
import { effectiveStats } from "./hero";

export type Command = { type: "attack" } | { type: "skill" } | { type: "defend" } | { type: "item"; item: ItemId };
export type IntentId = "bite" | "heavy_bite" | "ferocious_bite";

/** Forest Wolf intents (COMBAT_SPEC §2). Order = precedence when several apply. */
export const INTENTS: Record<IntentId, { name: string; thai: string; power: number }> = {
  heavy_bite: { name: "Heavy Bite", thai: "กัดรุนแรง", power: 14 },
  ferocious_bite: { name: "Ferocious Bite", thai: "กัดคลั่ง", power: 10 },
  bite: { name: "Bite", thai: "กัด", power: 4 },
};

export interface Fighter {
  hp: number;
  mp: number;
  defending: boolean;
}

export interface BattleState {
  encounterId: string;
  enemy: EnemyId;
  classId: ClassId;
  talentId: string;
  hero: Fighter;
  foe: Fighter & { actions: number };
  items: Record<ItemId, number>;
  intent: IntentId;
  round: number;
  /** Ids of committed actions; a repeated id is ignored (double tap, replay). */
  done: string[];
  over: null | "win" | "lose";
}

export type BattleEvent =
  | { type: "hit"; by: "hero" | "foe"; name: string; damage: number; hp: number }
  | { type: "defend"; by: "hero" | "foe" }
  | { type: "heal"; by: "hero"; name: string; amount: number; hp: number }
  | { type: "intent"; intent: IntentId }
  | { type: "end"; result: "win" | "lose" };

export const heroStats = (b: Pick<BattleState, "classId" | "talentId">): Stats => effectiveStats(b.classId, b.talentId);
export const foeStats = (b: Pick<BattleState, "enemy">): Stats => ENEMIES[b.enemy].stats;

/** The enemy's next action, chosen from state before it acts and then locked (never rerolled). */
export function chooseIntent(actions: number, hp: number, maxHp: number): IntentId {
  if ((actions + 1) % 3 === 0) return "heavy_bite"; // scripted: every third enemy action
  if (hp * 10 < maxHp * 3) return "ferocious_bite"; // below 30% HP
  return "bite";
}

export function startBattle(
  hero: { classId: ClassId; talentId: string; hp: number; mp: number },
  items: Record<ItemId, number>,
  encounterId: string,
  enemy: EnemyId,
): BattleState {
  const max = foeStats({ enemy }).maxHp;
  return {
    encounterId,
    enemy,
    classId: hero.classId,
    talentId: hero.talentId,
    hero: { hp: hero.hp, mp: hero.mp, defending: false },
    foe: { hp: max, mp: 0, defending: false, actions: 0 },
    items: { ...items },
    intent: chooseIntent(0, max, max), // revealed at battle entry
    round: 1,
    done: [],
    over: null,
  };
}

/** Integer damage, modifiers multiplied once and floored once (COMBAT_SPEC §1). */
export function damage(base: number, ...mods: number[]): number {
  return Math.max(1, Math.floor(mods.reduce((a, m) => a * m, base)));
}
export const physicalBase = (atk: number, power: number, def: number) => Math.max(1, atk + power - def);
export const magicBase = (mag: number, power: number, res: number) => Math.max(1, mag + power - res);

/** Why a command cannot be used right now, or null if it is legal. */
export function illegal(b: BattleState, c: Command): string | null {
  if (b.over) return "การต่อสู้จบแล้ว";
  if (c.type === "skill" && b.hero.mp < CLASSES[b.classId].skill.mp) return "MP ไม่พอ";
  if (c.type === "item") {
    if (!(c.item in ITEMS) || (b.items[c.item] ?? 0) < 1) return "ไม่มีไอเทมนี้";
    if (!("heal" in ITEMS[c.item])) return "ไอเทมธาตุใช้ได้ในขั้นที่ 4";
    if (b.hero.hp >= heroStats(b).maxHp) return "HP เต็มแล้ว";
  }
  return null;
}

/** Hero goes first in round 1 (MVP opener); later rounds strictly by SPD, hero wins ties. */
const heroFirst = (b: BattleState) => b.round === 1 || heroStats(b).spd >= foeStats(b).spd;

export function act(prev: BattleState, actionId: string, c: Command): { state: BattleState; events: BattleEvent[] } {
  if (prev.done.includes(actionId) || illegal(prev, c)) return { state: prev, events: [] }; // no mutation
  const b: BattleState = structuredClone(prev);
  b.done = [...b.done, actionId].slice(-32);
  const ev: BattleEvent[] = [];
  const hs = heroStats(b);
  const fs = foeStats(b);

  // Hero's normal turn: its own Defend ends now.
  b.hero.defending = false;
  if (c.type === "attack" || c.type === "skill") {
    const skill = c.type === "skill" ? CLASSES[b.classId].skill : null;
    const magic = skill?.kind === "magic";
    const base = magic ? magicBase(hs.mag, skill!.power, fs.res) : physicalBase(hs.atk, skill?.power ?? 0, fs.def);
    const dmg = Math.min(b.foe.hp, damage(base, b.foe.defending ? 0.5 : 1));
    if (skill) b.hero.mp -= skill.mp;
    b.foe.hp -= dmg;
    ev.push({ type: "hit", by: "hero", name: skill?.name ?? "Attack", damage: dmg, hp: b.foe.hp });
  } else if (c.type === "defend") {
    b.hero.defending = true;
    ev.push({ type: "defend", by: "hero" });
  } else {
    const heal = (ITEMS[c.item] as { heal: number }).heal;
    const amount = Math.min(hs.maxHp - b.hero.hp, Math.max(1, heal));
    b.items[c.item] -= 1;
    b.hero.hp += amount;
    ev.push({ type: "heal", by: "hero", name: ITEMS[c.item].name, amount, hp: b.hero.hp });
  }
  if (b.foe.hp <= 0) return finish(b, ev, "win");

  // Enemy acts after the hero this round if the hero went first; then, if the enemy is
  // faster, it also opens the next round before the hero's next turn.
  const enemyTurn = () => {
    b.foe.defending = false;
    const intent = INTENTS[b.intent];
    const dmg = Math.min(b.hero.hp, damage(physicalBase(fs.atk, intent.power, hs.def), b.hero.defending ? 0.5 : 1));
    b.hero.hp -= dmg;
    b.foe.actions += 1;
    ev.push({ type: "hit", by: "foe", name: intent.name, damage: dmg, hp: b.hero.hp });
    if (b.hero.hp > 0) {
      b.intent = chooseIntent(b.foe.actions, b.foe.hp, fs.maxHp);
      ev.push({ type: "intent", intent: b.intent });
    }
  };
  if (heroFirst(b)) {
    enemyTurn();
    if (b.hero.hp <= 0) return finish(b, ev, "lose");
    b.round += 1;
    if (!heroFirst(b)) {
      enemyTurn();
      if (b.hero.hp <= 0) return finish(b, ev, "lose");
    }
  } else {
    // Hero acted second this round; the next round opens with the faster enemy.
    b.round += 1;
    enemyTurn();
    if (b.hero.hp <= 0) return finish(b, ev, "lose");
  }
  return { state: b, events: ev };
}

function finish(b: BattleState, ev: BattleEvent[], result: "win" | "lose") {
  b.over = result;
  ev.push({ type: "end", result });
  return { state: b, events: ev };
}
