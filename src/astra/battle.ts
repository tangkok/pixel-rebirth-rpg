// One-on-one turn battle engine (COMBAT_SPEC v0.3). Pure and deterministic: every hero
// action (act) and every enemy action (guard) is one transaction that validates, resolves
// against a snapshot and returns a new state plus an immutable event log. The screen only
// captures one timing result per action and plays the log back, so skip, resize or a
// double tap can never change results.
import { CLASSES, ENEMIES, ITEMS, talentById, type ClassId, type Element, type EnemyId, type ItemId, type Stats } from "./data";
import { effectiveStats } from "./hero";

export type Command = { type: "attack" } | { type: "skill" } | { type: "defend" } | { type: "burst" } | { type: "item"; item: ItemId };
export type IntentId = "bite" | "heavy_bite" | "ferocious_bite";
export type Timing = "perfect" | "good" | "normal";
export type ReactionId = "conduct" | "thermal" | "freeze" | "freeze_immune";

/** Forest Wolf intents (COMBAT_SPEC §2). Order = precedence when several apply. */
export const INTENTS: Record<IntentId, { name: string; thai: string; power: number }> = {
  heavy_bite: { name: "Heavy Bite", thai: "กัดรุนแรง", power: 14 },
  ferocious_bite: { name: "Ferocious Bite", thai: "กัดคลั่ง", power: 10 },
  bite: { name: "Bite", thai: "กัด", power: 4 },
};

/** Timing windows by absolute offset from the cue (§3–4), with damage multiplier and Astra gain. */
export const TIMING = {
  windowMs: { perfect: 80, good: 180 },
  strike: { perfect: [1.2, 15], good: [1.1, 10], normal: [1, 5] },
  guard: { perfect: [0.4, 15], good: [0.75, 10], normal: [1, 3] },
} as const;
export const judge = (offsetMs: number): Timing =>
  Math.abs(offsetMs) <= TIMING.windowMs.perfect ? "perfect" : Math.abs(offsetMs) <= TIMING.windowMs.good ? "good" : "normal";

/** Astra Burst per class (§5): multiplier on the normal-attack base. */
export const BURSTS: Record<ClassId, { mult: number; kind: "physical" | "magic" }> = {
  knight: { mult: 1.8, kind: "physical" }, // + enemy ATK -15% through its next action
  ranger: { mult: 1.8, kind: "physical" },
  sorcerer: { mult: 1.8, kind: "magic" },
  cleric: { mult: 1.4, kind: "magic" }, // + heal self 25% MaxHP
  berserk: { mult: 2.0, kind: "physical" }, // + spends up to 5% MaxHP, never below 1
};

export const REACTIONS: Record<ReactionId, string> = {
  conduct: "Conduct",
  thermal: "Thermal Shock",
  freeze: "Freeze",
  freeze_immune: "ต้านทาน Freeze",
};

export interface Fighter {
  hp: number;
  mp: number;
  defending: boolean;
}
type Slot = "hero" | "bonus" | "foe"; // bonus = Time Weaver extra action (not a normal turn)

export interface BattleState {
  encounterId: string;
  enemy: EnemyId;
  classId: ClassId;
  talentId: string;
  hero: Fighter & { astra: number; revived: boolean };
  foe: Fighter & {
    actions: number;
    aura: Element | null;
    /** Hero actions the aura has survived; it expires at the end of the next one. */
    auraAge: number;
    /** Thermal Shock: DEF -15% for physical hits while > 0 (counts hero actions). */
    shock: number;
    /** Aegis Breaker: ATK -15% on its next action. */
    weak: boolean;
    frozen: boolean;
    freezeImmune: number;
  };
  items: Record<ItemId, number>;
  intent: IntentId;
  round: number;
  /** Who acts now, then the rest of this round. */
  queue: Slot[];
  /** Ids of committed actions; a repeated id is ignored (double tap, replay). */
  done: string[];
  over: null | "win" | "lose";
}

export type BattleEvent =
  | {
      type: "hit";
      by: "hero" | "foe";
      name: string;
      damage: number;
      hp: number;
      timing?: Timing;
      reaction?: ReactionId;
      aura: Element | null;
      astra: number;
    }
  | { type: "defend"; by: "hero" | "foe" }
  | { type: "heal"; by: "hero"; name: string; amount: number; hp: number }
  | { type: "mp"; name: string; amount: number; mp: number }
  | { type: "recoil"; name: string; damage: number; hp: number }
  | { type: "frozen" }
  | { type: "revive"; hp: number }
  | { type: "intent"; intent: IntentId }
  | { type: "end"; result: "win" | "lose" };

export const heroStats = (b: Pick<BattleState, "classId" | "talentId">): Stats => effectiveStats(b.classId, b.talentId);
export const foeStats = (b: Pick<BattleState, "enemy">): Stats => ENEMIES[b.enemy].stats;
const has = (b: Pick<BattleState, "talentId">, id: string) => b.talentId === id;
const isBoss = (b: BattleState) => "boss" in ENEMIES[b.enemy];

/** Percentage MP cost rounded up once (§1); integer math so 10 × 1.10 is 11, not 12. */
export function skillCost(b: Pick<BattleState, "classId" | "talentId">): number {
  const mp = CLASSES[b.classId].skill.mp;
  return has(b, "time_weaver") || has(b, "divine_chosen") ? Math.ceil((mp * 110) / 100) : mp;
}

/** The enemy's next action, chosen from state before it acts and then locked (never rerolled). */
export function chooseIntent(actions: number, hp: number, maxHp: number): IntentId {
  if ((actions + 1) % 3 === 0) return "heavy_bite"; // scripted: every third enemy action
  if (hp * 10 < maxHp * 3) return "ferocious_bite"; // below 30% HP
  return "bite";
}

/** Hero first in round 1 (MVP opener); later rounds strictly by SPD, hero wins ties. */
const order = (b: BattleState): Slot[] =>
  b.round === 1 ? (has(b, "time_weaver") ? ["hero", "bonus", "foe"] : ["hero", "foe"]) : heroStats(b).spd >= foeStats(b).spd ? ["hero", "foe"] : ["foe", "hero"];

export function startBattle(
  hero: { classId: ClassId; talentId: string; hp: number; mp: number },
  items: Record<ItemId, number>,
  encounterId: string,
  enemy: EnemyId,
): BattleState {
  const max = foeStats({ enemy }).maxHp;
  const b: BattleState = {
    encounterId,
    enemy,
    classId: hero.classId,
    talentId: hero.talentId,
    hero: { hp: hero.hp, mp: hero.mp, defending: false, astra: 0, revived: false },
    foe: { hp: max, mp: 0, defending: false, actions: 0, aura: null, auraAge: 0, shock: 0, weak: false, frozen: false, freezeImmune: 0 },
    items: { ...items },
    intent: chooseIntent(0, max, max), // revealed at battle entry
    round: 1,
    queue: [],
    done: [],
    over: null,
  };
  b.queue = order(b);
  heroTurnStart(b, []);
  return b;
}

/** Integer damage, modifiers multiplied once and floored once (COMBAT_SPEC §1). */
export function damage(base: number, ...mods: number[]): number {
  return Math.max(1, Math.floor(mods.reduce((a, m) => a * m, base) + 1e-9));
}
export const physicalBase = (atk: number, power: number, def: number) => Math.max(1, atk + power - def);
export const magicBase = (mag: number, power: number, res: number) => Math.max(1, mag + power - res);
const clampAstra = (n: number) => Math.max(0, Math.min(100, n));

/** Why a command cannot be used right now, or null if it is legal. */
export function illegal(b: BattleState, c: Command): string | null {
  if (b.over) return "การต่อสู้จบแล้ว";
  if (b.queue[0] === "foe") return "รอศัตรู";
  if (c.type === "skill" && b.hero.mp < skillCost(b)) return "MP ไม่พอ";
  if (c.type === "burst" && b.hero.astra < 100) return "Astra ยังไม่เต็ม";
  if (c.type === "item") {
    if (!(c.item in ITEMS) || (b.items[c.item] ?? 0) < 1) return "ไม่มีไอเทมนี้";
    if ("heal" in ITEMS[c.item] && b.hero.hp >= heroStats(b).maxHp) return "HP เต็มแล้ว";
  }
  return null;
}

/** Normal-turn passives (§7 notes): never on the Time Weaver bonus action. */
function heroTurnStart(b: BattleState, ev: BattleEvent[]) {
  const s = heroStats(b);
  const gain = (has(b, "mana_flow") ? 5 : 0) + (has(b, "divine_chosen") ? 8 : 0);
  const mp = Math.min(gain, s.maxMp - b.hero.mp);
  if (mp > 0) {
    b.hero.mp += mp;
    ev.push({ type: "mp", name: talentById(b.talentId)!.name, amount: mp, mp: b.hero.mp });
  }
  if (has(b, "vital_surge") && b.hero.hp < s.maxHp) heal(b, ev, "Vital Surge", Math.floor(s.maxHp / 20));
}

function heal(b: BattleState, ev: BattleEvent[], name: string, raw: number) {
  const amount = Math.min(heroStats(b).maxHp - b.hero.hp, Math.max(1, raw));
  if (amount <= 0) return;
  b.hero.hp += amount;
  ev.push({ type: "heal", by: "hero", name, amount, hp: b.hero.hp });
}

/** Moves to the next actor; a frozen enemy loses its action here (§6). */
function advance(b: BattleState, ev: BattleEvent[]) {
  b.queue.shift();
  for (;;) {
    if (!b.queue.length) {
      b.round += 1;
      b.queue = order(b);
    }
    const next = b.queue[0];
    if (next === "hero") return heroTurnStart(b, ev);
    if (next === "bonus") return;
    b.foe.defending = false;
    if (!b.foe.frozen) return;
    b.foe.frozen = false;
    ev.push({ type: "frozen" });
    b.queue.shift();
  }
}

/** Elemental reaction of an `element` hit on the current aura, or the aura it leaves (§6). */
function react(aura: Element | null, element: Element | undefined): { reaction?: ReactionId; mod: number; aura: Element | null } {
  if (!element) return { mod: 1, aura };
  if (aura === "water" && element === "lightning") return { reaction: "conduct", mod: 1.25, aura: null };
  if ((aura === "fire" && element === "ice") || (aura === "ice" && element === "fire")) return { reaction: "thermal", mod: 1.2, aura: null };
  if (aura === "water" && element === "ice") return { reaction: "freeze", mod: 1, aura: null };
  return { mod: 1, aura: element };
}

/** Commits the hero's action. `timing` is the one captured result (Normal when skipped/auto). */
export function act(prev: BattleState, actionId: string, c: Command, timing: Timing = "normal"): { state: BattleState; events: BattleEvent[] } {
  if (prev.done.includes(actionId) || illegal(prev, c)) return { state: prev, events: [] }; // no mutation
  const b: BattleState = structuredClone(prev);
  b.done = [...b.done, actionId].slice(-32);
  const ev: BattleEvent[] = [];
  const hs = heroStats(b);
  const fs = foeStats(b);
  const auraBefore = b.foe.aura;
  if (b.queue[0] === "hero") b.hero.defending = false; // Defend lasts until the next normal turn

  const strike = (name: string, kind: "physical" | "magic", power: number, mods: number[], element?: Element, timed?: Timing) => {
    const def = b.foe.shock > 0 ? Math.floor((fs.def * 85) / 100) : fs.def;
    const base = kind === "magic" ? magicBase(hs.mag, power, fs.res) : physicalBase(hs.atk, power, def);
    const r = react(b.foe.aura, element);
    const marked = b.foe.hp * 2 < fs.maxHp; // target HP before this hit
    const outgoing = [
      timed ? TIMING.strike[timed][0] : 1,
      r.mod,
      has(b, "hunters_mark") ? (marked ? 1.2 : 0.96) : 1,
      has(b, "guardian_spirit") ? 0.95 : 1,
      has(b, "arcane_mastery") && kind === "magic" ? 1.3 : 1,
      b.foe.defending ? 0.5 : 1,
    ];
    const dmg = Math.min(b.foe.hp, damage(base, ...mods, ...outgoing));
    b.foe.hp -= dmg;
    let reaction = r.reaction;
    if (reaction === "thermal") b.foe.shock = 2; // from the next hit on, through the next hero action
    if (reaction === "freeze") {
      if (b.foe.freezeImmune > 0) reaction = "freeze_immune";
      else {
        b.foe.frozen = true;
        if (isBoss(b)) b.foe.freezeImmune = 2;
      }
    }
    if (element) {
      b.foe.aura = r.aura;
      b.foe.auraAge = 0;
    }
    if (timed) b.hero.astra = clampAstra(b.hero.astra + TIMING.strike[timed][1]);
    ev.push({ type: "hit", by: "hero", name, damage: dmg, hp: b.foe.hp, timing: timed, reaction, aura: b.foe.aura, astra: b.hero.astra });
    if (has(b, "blood_hunter") && dmg > 0 && b.hero.hp < hs.maxHp) heal(b, ev, "Blood Hunter", Math.floor(dmg / 5));
  };

  if (c.type === "attack") strike("Attack", "physical", 0, [], undefined, timing);
  else if (c.type === "skill") {
    const skill = CLASSES[b.classId].skill;
    b.hero.mp -= skillCost(b);
    strike(skill.name, skill.kind, skill.power, [], skill.element, timing);
  } else if (c.type === "burst") {
    const burst = BURSTS[b.classId];
    b.hero.astra = 0;
    strike(CLASSES[b.classId].burst, burst.kind, 0, [burst.mult]);
    if (b.classId === "knight") b.foe.weak = true;
    if (b.classId === "cleric") heal(b, ev, CLASSES.cleric.burst, Math.floor(hs.maxHp / 4));
    if (b.classId === "berserk") {
      const cost = Math.min(Math.floor(hs.maxHp / 20), b.hero.hp - 1);
      if (cost > 0) {
        b.hero.hp -= cost;
        ev.push({ type: "recoil", name: CLASSES.berserk.burst, damage: cost, hp: b.hero.hp });
      }
    }
  } else if (c.type === "defend") {
    b.hero.defending = true;
    ev.push({ type: "defend", by: "hero" });
  } else {
    const item = ITEMS[c.item];
    b.items[c.item] -= 1;
    if ("heal" in item) heal(b, ev, item.name, item.heal);
    else strike(item.name, "magic", item.power, [], item.element); // PLACEHOLDER: consumables hit as magic
  }

  // End of a hero action: an older aura that was not used expires; Thermal Shock ticks down.
  if (b.foe.aura && b.foe.aura === auraBefore && b.foe.auraAge >= 1) b.foe.aura = null;
  else if (b.foe.aura) b.foe.auraAge += 1;
  if (b.foe.shock > 0) b.foe.shock -= 1;
  if (b.foe.hp <= 0) return finish(b, ev, "win");
  advance(b, ev);
  return { state: b, events: ev };
}

/** Resolves the enemy's locked intent against the hero's one Perfect Guard result. */
export function guard(prev: BattleState, actionId: string, timing: Timing = "normal"): { state: BattleState; events: BattleEvent[] } {
  if (prev.over || prev.queue[0] !== "foe" || prev.done.includes(actionId)) return { state: prev, events: [] };
  const b: BattleState = structuredClone(prev);
  b.done = [...b.done, actionId].slice(-32);
  const ev: BattleEvent[] = [];
  const hs = heroStats(b);
  const fs = foeStats(b);
  const intent = INTENTS[b.intent];
  const atk = b.foe.weak ? Math.floor((fs.atk * 85) / 100) : fs.atk;
  b.foe.weak = false;
  const low = b.hero.hp * 10 < hs.maxHp * 3; // own HP before this hit
  const dmg = Math.min(
    b.hero.hp,
    damage(
      physicalBase(atk, intent.power, hs.def),
      b.hero.defending ? 0.5 : 1,
      TIMING.guard[timing][0],
      has(b, "guardian_spirit") ? 0.85 : 1,
      has(b, "undying_resolve") ? (low ? 0.65 : 1.05) : 1,
    ),
  );
  b.hero.hp -= dmg;
  b.hero.astra = clampAstra(b.hero.astra + TIMING.guard[timing][1]);
  b.foe.actions += 1;
  if (b.foe.freezeImmune > 0) b.foe.freezeImmune -= 1;
  ev.push({ type: "hit", by: "foe", name: intent.name, damage: dmg, hp: b.hero.hp, timing, aura: b.foe.aura, astra: b.hero.astra });
  if (b.hero.hp <= 0) {
    // Phoenix Soul fires before the defeat check, once per encounter.
    if (!has(b, "phoenix_soul") || b.hero.revived) return finish(b, ev, "lose");
    b.hero.revived = true;
    b.hero.hp = Math.floor(hs.maxHp / 2);
    ev.push({ type: "revive", hp: b.hero.hp });
  }
  b.intent = chooseIntent(b.foe.actions, b.foe.hp, fs.maxHp);
  ev.push({ type: "intent", intent: b.intent });
  advance(b, ev);
  return { state: b, events: ev };
}

function finish(b: BattleState, ev: BattleEvent[], result: "win" | "lose") {
  b.over = result;
  ev.push({ type: "end", result });
  return { state: b, events: ev };
}
