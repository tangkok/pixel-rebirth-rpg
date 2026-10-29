// Echoes of Astra design data (GDD v1.8). Values flagged PLACEHOLDER are not in the
// design doc yet; search for "PLACEHOLDER" to find everything that needs real numbers.

export type StatId = "maxHp" | "maxMp" | "atk" | "def" | "mag" | "res" | "spd";
export type Stats = Record<StatId, number>;
export type ClassId = "knight" | "ranger" | "sorcerer" | "cleric" | "berserk";
export type Gender = "male" | "female";
export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";
export type Element = "fire" | "water" | "ice" | "lightning";

export const STAT_IDS: StatId[] = [
  "maxHp",
  "maxMp",
  "atk",
  "def",
  "mag",
  "res",
  "spd",
];
export const STAT_LABEL: Record<StatId, string> = {
  maxHp: "MaxHP",
  maxMp: "MaxMP",
  atk: "ATK",
  def: "DEF",
  mag: "MAG",
  res: "RES",
  spd: "SPD",
};
export const GENDERS: Gender[] = ["male", "female"];

export interface ClassDef {
  name: string;
  thai: string;
  identity: string;
  base: Stats; // provisional per GDD
  /** First Tier 1 Active node (SKILL_NODE_SYSTEM). Unlocked by spending SP, which starts at 0. */
  skill: { name: string; mp: number; power: number; kind: "physical" | "magic"; element?: Element };
  burst: string;
  weapon: { name: string; thai: string; art: boolean }; // art: Heroes99 has a matching layer
}

export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    name: "Knight",
    thai: "อัศวิน",
    identity: "ป้องกันสูง",
    base: { maxHp: 160, maxMp: 30, atk: 14, def: 16, mag: 3, res: 12, spd: 8 },
    skill: { name: "Power Slash", mp: 8, power: 16, kind: "physical" }, // PLACEHOLDER power
    burst: "Aegis Breaker",
    weapon: { name: "Sword", thai: "ดาบ", art: true },
  },
  ranger: {
    name: "Ranger",
    thai: "พราน",
    identity: "ว่องไว โจมตีระยะไกล",
    base: { maxHp: 110, maxMp: 40, atk: 16, def: 8, mag: 5, res: 8, spd: 18 },
    skill: { name: "Power Shot", mp: 8, power: 18, kind: "physical" },
    burst: "Celestial Arrow",
    weapon: { name: "Bow", thai: "ธนู", art: false },
  },
  sorcerer: {
    name: "Sorcerer",
    thai: "จอมเวท",
    identity: "เวทธาตุ",
    base: { maxHp: 85, maxMp: 100, atk: 5, def: 5, mag: 20, res: 12, spd: 11 },
    skill: { name: "Firebolt", mp: 10, power: 12, kind: "magic", element: "fire" }, // PLACEHOLDER power
    burst: "Astral Nova",
    weapon: { name: "Staff", thai: "คทา", art: true },
  },
  cleric: {
    name: "Cleric",
    thai: "นักบวช",
    identity: "ฟื้นฟูตัวเองและเวทศักดิ์สิทธิ์",
    base: { maxHp: 105, maxMp: 85, atk: 7, def: 9, mag: 15, res: 15, spd: 9 },
    skill: { name: "Holy Bolt", mp: 10, power: 10, kind: "magic" }, // PLACEHOLDER power
    burst: "Divine Judgment",
    weapon: { name: "Mace", thai: "กระบอง", art: false },
  },
  berserk: {
    name: "Berserk",
    thai: "เบอร์เซิร์ก",
    identity: "ระยะประชิด ดาเมจสูง",
    base: { maxHp: 180, maxMp: 20, atk: 22, def: 6, mag: 2, res: 6, spd: 10 },
    skill: { name: "Crushing Blow", mp: 10, power: 20, kind: "physical" }, // PLACEHOLDER power
    burst: "Crimson Rupture",
    weapon: { name: "Axe", thai: "ขวาน", art: true },
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

// Per-draw odds in thousandths so the boundaries are exact integers.
export const RARITY_ODDS: { rarity: Rarity; thai: string; per1000: number }[] = [
  { rarity: "common", thai: "ทั่วไป", per1000: 600 },
  { rarity: "uncommon", thai: "ไม่ธรรมดา", per1000: 250 },
  { rarity: "rare", thai: "หายาก", per1000: 100 },
  { rarity: "epic", thai: "มหากาพย์", per1000: 40 },
  { rarity: "legendary", thai: "ตำนาน", per1000: 9 },
  { rarity: "mythic", thai: "เทพนิยาย", per1000: 1 },
];
export const MAX_TALENT_DRAWS = 3;

export interface TalentDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Permanent percent stat changes, e.g. { def: 8 } is DEF +8%. */
  stats?: Partial<Stats>;
  /** Shown text for effects that are not plain stat changes. */
  plus?: string;
  minus?: string;
}

const ALL_CORE = (n: number): Stats => ({
  maxHp: n,
  maxMp: n,
  atk: n,
  def: n,
  mag: n,
  res: n,
  spd: n,
});

export const TALENTS: TalentDef[] = [
  { id: "tough_skin", name: "Tough Skin", rarity: "common", stats: { def: 8, spd: -2 } },
  { id: "strong_body", name: "Strong Body", rarity: "common", stats: { maxHp: 10, maxMp: -3 } },
  { id: "sharp_eyes", name: "Sharp Eyes", rarity: "common", stats: { atk: 7, def: -2 } },
  { id: "calm_mind", name: "Calm Mind", rarity: "common", stats: { maxMp: 12, atk: -3 } },
  { id: "swift_feet", name: "Swift Feet", rarity: "common", stats: { spd: 8, maxHp: -3 } },
  { id: "quick_learner", name: "Quick Learner", rarity: "uncommon", stats: { maxHp: -4 }, plus: "EXP +15%" },
  { id: "iron_will", name: "Iron Will", rarity: "uncommon", stats: { res: 15, def: 5, spd: -4 } },
  { id: "battle_instinct", name: "Battle Instinct", rarity: "uncommon", stats: { atk: 12, spd: 5, def: -5 } },
  { id: "mana_blessing", name: "Mana Blessing", rarity: "uncommon", stats: { mag: 15, maxMp: 10, atk: -5 } },
  { id: "mana_flow", name: "Mana Flow", rarity: "rare", stats: { maxHp: -6 }, plus: "MP +5 เมื่อเริ่มเทิร์นปกติ" },
  { id: "hunters_mark", name: "Hunter's Mark", rarity: "rare", plus: "ดาเมจ +20% ต่อเป้าหมาย HP ต่ำกว่า 50%", minus: "ดาเมจ −4% ในกรณีอื่น" },
  { id: "guardian_spirit", name: "Guardian Spirit", rarity: "rare", plus: "รับดาเมจ ×0.85", minus: "ดาเมจที่ทำ ×0.95" },
  { id: "vital_surge", name: "Vital Surge", rarity: "rare", stats: { maxMp: -8 }, plus: "ฟื้น HP 5% เมื่อเริ่มเทิร์นปกติ" },
  { id: "blood_hunter", name: "Blood Hunter", rarity: "epic", plus: "ดูด HP 20% ของดาเมจที่ทำได้จริง", minus: "การฟื้นฟูจากผู้อื่น −15%" },
  { id: "arcane_mastery", name: "Arcane Mastery", rarity: "epic", stats: { maxMp: 20, def: -5 }, plus: "ดาเมจเวท ×1.30" },
  { id: "undying_resolve", name: "Undying Resolve", rarity: "epic", plus: "รับดาเมจ ×0.65 เมื่อ HP ต่ำกว่า 30%", minus: "รับดาเมจ ×1.05 ในกรณีอื่น" },
  { id: "phoenix_soul", name: "Phoenix Soul", rarity: "legendary", stats: { maxHp: -8 }, plus: "ฟื้นคืนชีพ 50% HP ครั้งเดียวต่อการต่อสู้" },
  { id: "dragon_blood", name: "Dragon Blood", rarity: "legendary", stats: { atk: 25, def: 20, maxHp: 15, spd: -6 } },
  { id: "time_weaver", name: "Time Weaver", rarity: "legendary", plus: "ได้ 1 แอ็กชันพิเศษเมื่อเริ่มการต่อสู้", minus: "MP ของสกิล ×1.10" },
  { id: "divine_chosen", name: "Divine Chosen", rarity: "mythic", stats: ALL_CORE(25), plus: "MP +8 เมื่อเริ่มเทิร์นปกติ", minus: "MP ของสกิล ×1.10" },
];
export const talentById = (id: string) => TALENTS.find((t) => t.id === id);

/** PLACEHOLDER: enemies beyond the Forest Wolf's moves are not specified in GDD v0.3. */
export const ENEMIES = {
  goblin: { name: "Goblin", stats: { maxHp: 60, maxMp: 0, atk: 12, def: 5, mag: 0, res: 4, spd: 9 }, exp: 12 },
  forest_wolf: { name: "Forest Wolf", stats: { maxHp: 90, maxMp: 0, atk: 15, def: 8, mag: 0, res: 6, spd: 14 }, exp: 20 },
  ancient_guardian: { name: "Ancient Guardian", stats: { maxHp: 260, maxMp: 40, atk: 20, def: 14, mag: 14, res: 12, spd: 7 }, exp: 60, boss: true },
} as const;
export type EnemyId = keyof typeof ENEMIES;

/** PLACEHOLDER: items and elemental consumables. Potion prices live in SHOP_ECONOMY_SYSTEM (later). */
export const ITEMS = {
  potion: { name: "Potion", heal: 50 },
  water_flask: { name: "Water Flask", element: "water" as Element, power: 8 },
  frost_shard: { name: "Frost Shard", element: "ice" as Element, power: 8 },
  storm_vial: { name: "Storm Vial", element: "lightning" as Element, power: 8 },
} as const;
export type ItemId = keyof typeof ITEMS;
export const STARTING_ITEMS: Record<ItemId, number> = {
  potion: 3,
  water_flask: 1,
  frost_shard: 1,
  storm_vial: 1,
}; // PLACEHOLDER

/** PLACEHOLDER: total EXP needed to reach each level (GDD: levels 1–3). */
export const LEVEL_EXP = [0, 30, 80];
export const MAX_LEVEL = LEVEL_EXP.length;
