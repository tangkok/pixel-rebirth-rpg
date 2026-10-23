export type ClassId = "warden" | "arcanist" | "ranger";
export type Talent = "might" | "vitality" | "spirit" | "haste";
export type ActionId = "attack" | "skill" | "restore" | "guard" | "item";
export interface Build {
  id: string;
  name: string;
  classId: ClassId;
  talents: Record<Talent, number>;
  upgraded: boolean;
}
export interface TacticsSave {
  version: 3;
  level: number;
  xp: number;
  gold: number;
  potions: number;
  unlocked: number;
  cleared: number[];
  builds: Build[];
  sound: boolean;
}
export interface Fighter {
  id: string;
  name: string;
  side: "party" | "enemy";
  classId: ClassId | "sentinel" | "wisp" | "thorn" | "dragon";
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  bp: number;
  guarding: boolean;
  broken: number;
}
export interface Battle {
  stage: number;
  round: number;
  actors: Fighter[];
  queue: string[];
  cursor: number;
  phase: "ready" | "victory" | "defeat" | "retreated";
  potions: number;
  log: string[];
}
export interface CombatEvent {
  type: "damage" | "heal" | "guard" | "restore";
  actor: string;
  target: string;
  amount: number;
  element: string;
}
export const PARTY_KEY = "pixel-rebirth-tactics-v2";
export const TACTICS_KEY = "pixel-rebirth-solo-v3";
export const CLASSES: Record<
  ClassId,
  {
    name: string;
    thai: string;
    role: string;
    skill: string;
    description: string;
    color: string;
    weapon: string;
    upgrade: string;
    cost: number;
  }
> = {
  warden: {
    name: "Dawn Warden",
    thai: "อัศวินรุ่งอรุณ",
    role: "VANGUARD",
    skill: "Sunbreak",
    description: "นักดาบแนวหน้า ทนทานและทำลายเกราะศัตรู",
    color: "#e9b56e",
    weapon: "Dawnsteel blade",
    upgrade: "Solstice greatsword",
    cost: 12,
  },
  arcanist: {
    name: "Starweaver",
    thai: "จอมเวทดวงดาว",
    role: "ARCANIST",
    skill: "Astral Rain",
    description: "เวทดวงดาวรุนแรง พร้อมเวทฟื้นฟูพลังให้ตัวเอง",
    color: "#83d9de",
    weapon: "Lunar staff",
    upgrade: "Celestial scepter",
    cost: 18,
  },
  ranger: {
    name: "Veil Ranger",
    thai: "พรานแห่งม่านหมอก",
    role: "STRIKER",
    skill: "Piercing Gale",
    description: "ความเร็วสูง โจมตีแม่นยำและทะลุเกราะ",
    color: "#b3a1ed",
    weapon: "Whisperwood bow",
    upgrade: "Eclipse longbow",
    cost: 12,
  },
};
export const STAGES = [
  {
    name: "The Hollow Sanctuary",
    thai: "วิหารแห่งแสงที่ถูกลืม",
    chapter: "THE CRYSTAL WAKE",
    description:
      "ผลึกโบราณตื่นขึ้นอีกครั้ง ผู้พิทักษ์ที่ไร้ความทรงจำขวางทางอยู่",
    reward: 60,
    xp: 65,
  },
  {
    name: "The Sunken Archive",
    thai: "หอจารึกใต้ม่านหมอก",
    chapter: "ECHOES BENEATH",
    description: "แสงดาวที่สูญหายซ่อนอยู่หลังแนวป้องกันของเหล่าภูต",
    reward: 90,
    xp: 95,
  },
  {
    name: "Throne of the Eclipse",
    thai: "บัลลังก์แห่งคราส",
    chapter: "THE LAST LIGHT",
    description: "เผชิญราชันมังกรแห่งคราส ทลายเกราะก่อนปลดปล่อยพลังบูสต์",
    reward: 160,
    xp: 150,
  },
] as const;
const zeroTalents = () => ({ might: 0, vitality: 0, spirit: 0, haste: 0 });
export const freshTactics = (): TacticsSave => ({
  version: 3,
  level: 1,
  xp: 0,
  gold: 150,
  potions: 5,
  unlocked: 0,
  cleared: [],
  sound: false,
  builds: [
    {
      id: "ash",
      name: "ผู้เดินทาง",
      classId: "warden",
      talents: zeroTalents(),
      upgraded: false,
    },
  ],
});
export const totalPoints = (s: Pick<TacticsSave, "level">) =>
  3 + (s.level - 1) * 2;
export const usedPoints = (b: Build) =>
  Object.values(b.talents).reduce((a, b) => a + b, 0);
export const pointsLeft = (s: TacticsSave, b: Build) =>
  totalPoints(s) - usedPoints(b);
export const requiredXp = (s: Pick<TacticsSave, "level">) => 80 + s.level * 30;
export function allocate(s: TacticsSave, id: string, talent: Talent): boolean {
  const b = s.builds.find((b) => b.id === id);
  if (!b || !(talent in b.talents) || pointsLeft(s, b) < 1) return false;
  b.talents[talent]++;
  return true;
}
export function respec(s: TacticsSave, id: string): boolean {
  const b = s.builds.find((b) => b.id === id);
  if (!b) return false;
  b.talents = zeroTalents();
  return true;
}
export function switchClass(
  s: TacticsSave,
  id: string,
  classId: ClassId,
): boolean {
  const b = s.builds.find((b) => b.id === id);
  if (!b || !Object.hasOwn(CLASSES, classId) || b.classId === classId)
    return false;
  b.classId = classId;
  return true;
}
export function upgradeWeapon(s: TacticsSave, id: string): boolean {
  const b = s.builds.find((b) => b.id === id);
  if (!b || b.upgraded || s.gold < 100) return false;
  s.gold -= 100;
  b.upgraded = true;
  return true;
}
export function buyPotions(s: TacticsSave): boolean {
  if (s.gold < 25 || s.potions >= 99) return false;
  s.gold -= 25;
  s.potions++;
  return true;
}
export function stats(b: Build, level: number): Fighter {
  const base = {
    warden: [240, 66, 40, 25, 17, 22],
    arcanist: [190, 90, 25, 48, 12, 24],
    ranger: [210, 72, 39, 30, 13, 31],
  }[b.classId];
  const hp = base[0] + (level - 1) * 18 + b.talents.vitality * 18,
    mp = base[1] + (level - 1) * 4 + b.talents.spirit * 6;
  return {
    id: b.id,
    name: b.name,
    side: "party",
    classId: b.classId,
    hp,
    maxHp: hp,
    mp,
    maxMp: mp,
    attack:
      base[2] + (level - 1) * 3 + b.talents.might * 4 + (b.upgraded ? 12 : 0),
    magic:
      base[3] + (level - 1) * 3 + b.talents.spirit * 4 + (b.upgraded ? 10 : 0),
    defense: base[4] + b.talents.vitality * 2,
    speed: base[5] + b.talents.haste * 3,
    bp: 2,
    guarding: false,
    broken: 0,
  };
}
function foe(
  id: string,
  name: string,
  classId: Fighter["classId"],
  hp: number,
  attack: number,
  defense: number,
  speed: number,
): Fighter {
  return {
    id,
    name,
    side: "enemy",
    classId,
    hp,
    maxHp: hp,
    mp: 0,
    maxMp: 0,
    attack,
    magic: attack,
    defense,
    speed,
    bp: 0,
    guarding: false,
    broken: 0,
  };
}
export function beginBattle(save: TacticsSave, stage = 0): Battle {
  const n = Math.max(0, Math.min(stage, save.unlocked, 2));
  const enemies =
    n === 0
      ? [foe("sentinel", "Hollow Sentinel", "sentinel", 155, 20, 10, 16)]
      : n === 1
        ? [foe("wisp", "Archive Wraith", "wisp", 255, 30, 10, 25)]
        : [foe("dragon", "Eclipse Sovereign", "dragon", 480, 38, 20, 29)];
  const actors = [stats(save.builds[0], save.level), ...enemies];
  const queue = actors
    .slice()
    .sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id))
    .map((a) => a.id);
  return {
    stage: n,
    round: 1,
    actors,
    queue,
    cursor: 0,
    phase: "ready",
    potions: save.potions,
    log: ["แสงผลึกส่องนำทาง — การต่อสู้เริ่มขึ้น"],
  };
}
export const activeFighter = (b: Battle) =>
  b.actors.find((a) => a.id === b.queue[b.cursor]);
export const living = (b: Battle, side: Fighter["side"]) =>
  b.actors.filter((a) => a.side === side && a.hp > 0);
export function damageAmount(
  attacker: Fighter,
  defender: Fighter,
  multiplier = 1,
  magic = false,
  ignoreArmor = false,
): number {
  const armor = ignoreArmor
    ? 0
    : defender.defense * (defender.broken > 0 ? 0.35 : 1);
  return Math.max(
    1,
    Math.round(
      ((magic ? attacker.magic : attacker.attack) * multiplier - armor * 0.6) *
        (defender.guarding ? 0.45 : 1),
    ),
  );
}
export function canAct(
  b: Battle,
  action: ActionId,
  boost = false,
): string | null {
  const a = activeFighter(b);
  if (b.phase !== "ready" || !a || a.hp <= 0) return "การต่อสู้จบแล้ว";
  if (boost && a.bp < 2) return "ต้องการ 2 BP เพื่อบูสต์";
  if (
    action === "skill" &&
    a.side === "party" &&
    a.mp < CLASSES[a.classId as ClassId].cost
  )
    return "MP ไม่พอสำหรับทักษะนี้";
  if (action === "restore" && a.mp < 16) return "ต้องการ 16 MP เพื่อฟื้นฟู";
  if (action === "item" && b.potions < 1) return "ยาฟื้นฟูหมดแล้ว";
  if (
    (action === "item" || action === "restore") &&
    !b.actors.some((p) => p.side === a.side && p.hp < p.maxHp)
  )
    return "HP ของคุณเต็มแล้ว";
  return null;
}
function advance(b: Battle) {
  if (!living(b, "enemy").length) {
    b.phase = "victory";
    return;
  }
  if (!living(b, "party").length) {
    b.phase = "defeat";
    return;
  }
  for (let i = 0; i <= b.queue.length; i++) {
    b.cursor++;
    if (b.cursor >= b.queue.length) {
      b.cursor = 0;
      b.round++;
    }
    const a = activeFighter(b);
    if (a && a.hp > 0) {
      a.guarding = false;
      if (a.side === "party") a.mp = Math.min(a.maxMp, a.mp + 3);
      return;
    }
  }
}
export function performAction(
  b: Battle,
  action: ActionId,
  targetId?: string,
  boost = false,
): CombatEvent[] {
  boost =
    boost &&
    (action === "attack" || action === "skill" || action === "restore");
  if (canAct(b, action, boost)) return [];
  const a = activeFighter(b)!;
  const events: CombatEvent[] = [];
  const targets = living(b, a.side === "party" ? "enemy" : "party");
  const target = targets.find((t) => t.id === targetId) ?? targets[0];
  if (!target) return [];
  const multiplier = boost ? 1.65 : 1;
  if (boost) a.bp -= 2;
  if (action === "guard") {
    a.guarding = true;
    a.mp = Math.min(a.maxMp, a.mp + 8);
    a.bp = Math.min(3, a.bp + 1);
    events.push({
      type: "guard",
      actor: a.id,
      target: a.id,
      amount: 0,
      element: "guard",
    });
    b.log.push(`${a.name} ตั้งรับและรวบรวมพลัง`);
  } else if (action === "item" || action === "restore") {
    const party = b.actors.filter((p) => p.side === a.side);
    const ally =
      party.find((p) => p.id === targetId) ??
      party.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    if (action === "item") b.potions--;
    else a.mp -= 16;
    const amount = Math.min(
      ally.maxHp - ally.hp,
      Math.round((action === "item" ? 90 : 75 + a.magic) * multiplier),
    );
    ally.hp += amount;
    events.push({
      type: "heal",
      actor: a.id,
      target: ally.id,
      amount,
      element: "heal",
    });
    b.log.push(`${a.name} ฟื้นฟู ${ally.name} +${amount} HP`);
  } else {
    const cls = a.classId as ClassId;
    const skill = action === "skill" && a.side === "party";
    if (skill) a.mp -= CLASSES[cls].cost;
    const victims = skill && cls === "arcanist" ? targets : [target];
    for (const victim of victims) {
      const magic = skill && cls === "arcanist",
        factor = skill
          ? cls === "arcanist"
            ? targets.length === 1
              ? 1.8
              : 1.35
            : 1.8
          : 1;
      const amount = damageAmount(
        a,
        victim,
        multiplier * factor,
        magic,
        skill && cls === "ranger",
      );
      victim.hp = Math.max(0, victim.hp - amount);
      if (skill && cls === "warden") victim.broken = 3;
      events.push({
        type: "damage",
        actor: a.id,
        target: victim.id,
        amount,
        element: skill ? cls : boost ? "boost" : "physical",
      });
    }
    b.log.push(
      `${a.name} ใช้ ${skill ? CLASSES[cls].skill : boost ? "Boosted Strike" : "Attack"}${victims.length === 1 ? ` → ${target.name}` : ""}`,
    );
  }
  if (a.side === "party") a.bp = Math.min(3, a.bp + 1);
  a.broken = Math.max(0, a.broken - 1);
  b.log = b.log.slice(-8);
  advance(b);
  return events;
}
export function enemyAction(b: Battle): CombatEvent[] {
  const a = activeFighter(b);
  if (!a || a.side !== "enemy") return [];
  const party = living(b, "party");
  const target = party[(b.round + b.cursor) % party.length];
  return performAction(b, "attack", target?.id);
}
export function awardVictory(
  s: TacticsSave,
  b: Battle,
): { gold: number; xp: number; leveled: boolean } | null {
  if (b.phase !== "victory" || b.log.includes("REWARDS_CLAIMED")) return null;
  b.log.push("REWARDS_CLAIMED");
  const stage = STAGES[b.stage];
  s.gold += stage.reward;
  s.xp += stage.xp;
  s.potions = b.potions;
  let leveled = false;
  while (s.xp >= requiredXp(s)) {
    s.xp -= requiredXp(s);
    s.level++;
    leveled = true;
  }
  s.unlocked = Math.max(s.unlocked, Math.min(2, b.stage + 1));
  if (!s.cleared.includes(b.stage)) s.cleared.push(b.stage);
  return { gold: stage.reward, xp: stage.xp, leveled };
}
export function readTactics(
  raw: string | null,
  legacy?: string | null,
): TacticsSave {
  const fresh = freshTactics();
  try {
    if (!raw) {
      if (legacy) {
        const p = JSON.parse(legacy);
        if (p.version === 1 && Number.isInteger(p.gold) && p.gold >= 0)
          fresh.gold += p.gold;
      }
      return fresh;
    }
    const s = JSON.parse(raw) as Omit<TacticsSave, "version"> & {
      version: number;
    };
    if (
      ![2, 3].includes(s.version) ||
      !Number.isInteger(s.level) ||
      s.level < 1 ||
      s.level > 100 ||
      !Number.isInteger(s.xp) ||
      s.xp < 0 ||
      s.xp >= requiredXp(s) ||
      !Number.isInteger(s.gold) ||
      s.gold < 0 ||
      !Number.isInteger(s.potions) ||
      s.potions < 0 ||
      s.potions > 99 ||
      !Number.isInteger(s.unlocked) ||
      s.unlocked < 0 ||
      s.unlocked > 2 ||
      !Array.isArray(s.cleared) ||
      s.cleared.some((n) => !Number.isInteger(n) || n < 0 || n > 2) ||
      !Array.isArray(s.builds) ||
      s.builds.length !== (s.version === 2 ? 3 : 1) ||
      typeof s.sound !== "boolean"
    )
      return fresh;
    for (let i = 0; i < s.builds.length; i++) {
      const b = s.builds[i];
      if (
        !b ||
        b.id !== ["ash", "lyra", "kael"][i] ||
        !Object.hasOwn(CLASSES, b.classId) ||
        typeof b.upgraded !== "boolean" ||
        !b.talents ||
        Object.keys(b.talents).length !== 4 ||
        !["might", "vitality", "spirit", "haste"].every(
          (k) =>
            Number.isInteger(b.talents[k as Talent]) &&
            b.talents[k as Talent] >= 0,
        ) ||
        usedPoints(b) > totalPoints(s)
      )
        return fresh;
      b.name = cleanName(b.name);
    }
    return {
      ...s,
      version: 3,
      builds: [{ ...s.builds[0], upgraded: s.builds.some((b) => b.upgraded) }],
    };
  } catch {
    return fresh;
  }
}

export function cleanName(value: unknown): string {
  return typeof value === "string"
    ? Array.from(
        value
          .normalize("NFC")
          .replace(/[^\p{L}\p{M}\p{N} ._-]/gu, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
        .slice(0, 20)
        .join("") || "ผู้เดินทาง"
    : "ผู้เดินทาง";
}
export function renameHero(save: TacticsSave, name: string): void {
  save.builds[0].name = cleanName(name);
}
