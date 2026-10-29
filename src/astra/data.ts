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
  weapon: { name: string; thai: string };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    name: "Knight",
    thai: "อัศวิน",
    identity: "ป้องกันสูง",
    base: { maxHp: 160, maxMp: 30, atk: 14, def: 16, mag: 3, res: 12, spd: 8 },
    skill: { name: "Power Slash", mp: 8, power: 16, kind: "physical" }, // PLACEHOLDER power
    burst: "Aegis Breaker",
    weapon: { name: "Sword", thai: "ดาบ" },
  },
  ranger: {
    name: "Ranger",
    thai: "พราน",
    identity: "ว่องไว โจมตีระยะไกล",
    base: { maxHp: 110, maxMp: 40, atk: 16, def: 8, mag: 5, res: 8, spd: 18 },
    skill: { name: "Power Shot", mp: 8, power: 18, kind: "physical" },
    burst: "Celestial Arrow",
    weapon: { name: "Bow", thai: "ธนู" },
  },
  sorcerer: {
    name: "Sorcerer",
    thai: "จอมเวท",
    identity: "เวทธาตุ",
    base: { maxHp: 85, maxMp: 100, atk: 5, def: 5, mag: 20, res: 12, spd: 11 },
    skill: { name: "Firebolt", mp: 10, power: 12, kind: "magic", element: "fire" }, // PLACEHOLDER power
    burst: "Astral Nova",
    weapon: { name: "Staff", thai: "คทา" },
  },
  cleric: {
    name: "Cleric",
    thai: "นักบวช",
    identity: "ฟื้นฟูตัวเองและเวทศักดิ์สิทธิ์",
    base: { maxHp: 105, maxMp: 85, atk: 7, def: 9, mag: 15, res: 15, spd: 9 },
    skill: { name: "Holy Bolt", mp: 10, power: 10, kind: "magic" }, // PLACEHOLDER power
    burst: "Divine Judgment",
    weapon: { name: "Mace", thai: "กระบอง" },
  },
  berserk: {
    name: "Berserk",
    thai: "เบอร์เซิร์ก",
    identity: "ระยะประชิด ดาเมจสูง",
    base: { maxHp: 180, maxMp: 20, atk: 22, def: 6, mag: 2, res: 6, spd: 10 },
    skill: { name: "Crushing Blow", mp: 10, power: 20, kind: "physical" }, // PLACEHOLDER power
    burst: "Crimson Rupture",
    weapon: { name: "Axe", thai: "ขวาน" },
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** PLACEHOLDER: flat base-stat gain per level above 1 (GDD has levels 1–3 but no growth table). */
export const GROWTH: Record<ClassId, Stats> = {
  knight: { maxHp: 16, maxMp: 3, atk: 2, def: 2, mag: 0, res: 1, spd: 1 },
  ranger: { maxHp: 11, maxMp: 4, atk: 2, def: 1, mag: 0, res: 1, spd: 2 },
  sorcerer: { maxHp: 8, maxMp: 10, atk: 0, def: 0, mag: 2, res: 1, spd: 1 },
  cleric: { maxHp: 10, maxMp: 8, atk: 1, def: 1, mag: 2, res: 2, spd: 1 },
  berserk: { maxHp: 18, maxMp: 2, atk: 3, def: 0, mag: 0, res: 0, spd: 1 },
};

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
  forest_wolf: { name: "Forest Wolf", stats: { maxHp: 70, maxMp: 0, atk: 13, def: 8, mag: 0, res: 6, spd: 14 }, exp: 20 },
  ancient_guardian: { name: "Ancient Guardian", stats: { maxHp: 260, maxMp: 40, atk: 20, def: 14, mag: 14, res: 12, spd: 7 }, exp: 60, boss: true },
} as const;
export type EnemyId = keyof typeof ENEMIES;

// PLACEHOLDER: Forest Wolf tuned to 70 HP / 13 ATK so a Lv.1 hero (no stat growth yet) can clear three.
/** PLACEHOLDER: items and elemental consumables. Potion prices live in SHOP_ECONOMY_SYSTEM (later). */
export const ITEMS = {
  potion: { name: "Potion", heal: 50 },
  water_flask: { name: "Water Flask", element: "water" as Element, power: 8 },
  frost_shard: { name: "Frost Shard", element: "ice" as Element, power: 8 },
  storm_vial: { name: "Storm Vial", element: "lightning" as Element, power: 8 },
  /** Forest Wolf drop (LOOT_DROP_SYSTEM); a trade material, never usable in battle. */
  wolf_pelt: { name: "Wolf Pelt", material: true },
  /** Hatched at the farm (owner reference); the boss leaves one. Never usable in battle. */
  pet_egg: { name: "ไข่ทั่วไป", material: true },
  egg_uncommon: { name: "ไข่ไม่ธรรมดา", material: true },
  egg_rare: { name: "ไข่หายาก", material: true },
} as const;
export type ItemId = keyof typeof ITEMS;
export const STARTING_ITEMS: Record<ItemId, number> = {
  potion: 3,
  water_flask: 1,
  frost_shard: 1,
  storm_vial: 1,
  wolf_pelt: 0,
  pet_egg: 1,
  egg_uncommon: 0,
  egg_rare: 0,
}; // PLACEHOLDER

/**
 * PLACEHOLDER journey difficulties (owner reference screenshot): percent multipliers on enemy HP
 * and ATK/MAG, the Perfect/Good guard window, and EXP/Gold rewards. Torment opens after 3 cleared journeys.
 */
export const DIFFICULTIES = {
  normal: { name: "ปกติ", crowns: 1, hp: 100, power: 100, guard: 100, reward: 100, needWins: 0 },
  hard: { name: "ยาก", crowns: 2, hp: 125, power: 118, guard: 88, reward: 180, needWins: 0 },
  nightmare: { name: "ฝันร้าย", crowns: 3, hp: 140, power: 125, guard: 78, reward: 280, needWins: 0 },
  torment: { name: "ทรมาน I", crowns: 4, hp: 300, power: 270, guard: 70, reward: 360, needWins: 3 },
} as const;
export type DifficultyId = keyof typeof DIFFICULTIES;
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];

/**
 * PLACEHOLDER: total EXP needed to reach each level. The GDD lists levels 1–3 (0, 30, 80); the owner's
 * town reference has stat points per level, so the same curve, 10 × (L² − 1), continues to level 20.
 */
export const LEVEL_EXP = Array.from({ length: 20 }, (_, i) => 10 * ((i + 1) ** 2 - 1));
export const MAX_LEVEL = LEVEL_EXP.length;

/**
 * PLACEHOLDER training hall (owner reference): one point per level above 1, each point a flat
 * bonus on its stats (Focus: a percent on the timing windows), at most TRAIN_CAP points per line.
 * Flat, not percent: early stats are small enough that a few percent would round away.
 */
export const TRAIN = {
  strength: { name: "ความแข็งแกร่ง", text: "ATK สูงขึ้น การโจมตีกายภาพแรงขึ้น", stats: { atk: 1 } },
  arcane: { name: "ความลึกลับ", text: "MAG และ MaxMP สูงขึ้น เวทแรงขึ้น", stats: { mag: 1, maxMp: 3 } },
  agility: { name: "ความคล่องแคล่ว", text: "SPD สูงขึ้น ได้ลงมือก่อนบ่อยขึ้น", stats: { spd: 1 } },
  vitality: { name: "พลังชีวิต", text: "MaxHP สูงขึ้น", stats: { maxHp: 8 } },
  guard: { name: "การป้องกัน", text: "DEF และ RES สูงขึ้น รับดาเมจน้อยลง", stats: { def: 1, res: 1 } },
  focus: { name: "โฟกัส", text: "หน้าต่างจังหวะโจมตีและป้องกันกว้างขึ้น", stats: {}, window: 3 },
} satisfies Record<string, { name: string; text: string; stats: Partial<Stats>; window?: number }>;
export type TrainId = keyof typeof TRAIN;
export const TRAIN_IDS = Object.keys(TRAIN) as TrainId[];
export const TRAIN_CAP = 10;
/** Training lines tagged "แนะนำ" per class (owner reference), the ones its skill and role lean on. */
export const TRAIN_PICKS: Record<ClassId, TrainId[]> = {
  knight: ["guard", "vitality"],
  ranger: ["agility", "strength"],
  sorcerer: ["arcane", "focus"],
  cleric: ["arcane", "vitality"],
  berserk: ["strength", "vitality"],
};

/** PLACEHOLDER blacksmith: honing the class weapon to +HONE_MAX, each level ATK and MAG +2 (flat). */
export const HONE_MAX = 10;
export const HONE_PER = 2;
export const honeCost = (level: number) => ({ gold: 20 * (level + 1), wolf_pelt: level + 1 });
/** Hone success percent for the next level (owner reference: 95% at the start, harder each level). */
export const honeChance = (level: number) => Math.max(25, 95 - 8 * level);
/**
 * PLACEHOLDER weapon tiers of the class weapon (owner reference: weapons forged from materials).
 * Each tier adds flat ATK and MAG on top of the hone; the hone level carries over.
 */
export const WEAPON_TIERS = [
  { name: "เหล็กธรรมดา", rarity: "common", bonus: 0, cost: null },
  { name: "เหล็กกล้า", rarity: "uncommon", bonus: 4, cost: { wolf_pelt: 4, gold: 80 } },
  { name: "มิธริล", rarity: "rare", bonus: 8, cost: { wolf_pelt: 8, gold: 250 } },
  { name: "อดามันไทต์", rarity: "epic", bonus: 14, cost: { wolf_pelt: 12, gold: 600 } },
] as const satisfies readonly { name: string; rarity: string; bonus: number; cost: { wolf_pelt: number; gold: number } | null }[];
/** PLACEHOLDER blacksmith crafts: Wolf Pelt and Gold into battle items. */
export const RECIPES: Partial<Record<ItemId, { wolf_pelt: number; gold: number }>> = {
  potion: { wolf_pelt: 1, gold: 5 },
  water_flask: { wolf_pelt: 2, gold: 15 },
  frost_shard: { wolf_pelt: 2, gold: 15 },
  storm_vial: { wolf_pelt: 2, gold: 15 },
};

/**
 * PLACEHOLDER pets (owner reference farm): one travels with the hero, bites after each hero action
 * (it cannot be hurt), and every PET_CHARGE bites uses its ability instead of waiting.
 */
export const PETS = {
  pup: { name: "ลูกสุนัข", type: "สัตว์บก", ability: "เห่าขู่", text: "ศัตรู ATK −15% ในการโจมตีครั้งถัดไป" },
  kitten: { name: "ลูกแมวลายส้ม", type: "สัตว์บก", ability: "ข่วนรัว", text: "ข่วนรัว ดาเมจ ×3 ของการกัด" },
  owl: { name: "นกฮูกตาโต", type: "นก", ability: "ตาเฉียบ", text: "Astra +25" },
  axolotl: { name: "แอกโซลอเติล", type: "สัตว์น้ำ", ability: "รักษา", text: "ฟื้น HP 6% ของ MaxHP ×พลังความหายาก" },
} as const;
export type PetId = keyof typeof PETS;
export const PET_IDS = Object.keys(PETS) as PetId[];
export const PET_CHARGE = 3;
/** PLACEHOLDER pet rarities (owner reference): rarer pets level higher and hit harder (percent power). */
export const PET_RARITY = {
  common: { max: 30, power: 100 },
  uncommon: { max: 35, power: 125 },
  rare: { max: 40, power: 150 },
  epic: { max: 45, power: 180 },
  legendary: { max: 50, power: 220 },
} as const;
export type PetRarity = keyof typeof PET_RARITY;
export const PET_RARITIES = Object.keys(PET_RARITY) as PetRarity[];
/**
 * PLACEHOLDER farm upgrades (owner reference), paid in Knowledge: each tier adds paddock slots and
 * lets eggs of the next rarity hatch.
 */
export const FARM_TIERS = [
  { name: "พาดด็อก", slots: 6, hatch: "common", cost: 0 },
  { name: "ฟาร์มสเตด", slots: 10, hatch: "uncommon", cost: 300 },
  { name: "คอกสัตว์", slots: 15, hatch: "rare", cost: 1000 },
  { name: "แกรนด์แรนช์", slots: 20, hatch: "epic", cost: 3000 },
  { name: "ฟาร์มสวรรค์", slots: 30, hatch: "legendary", cost: 8000 },
] as const satisfies readonly { name: string; slots: number; hatch: PetRarity; cost: number }[];
export const PADDOCK = FARM_TIERS.at(-1)!.slots;
/** Eggs in the bag and the rarity they hatch into. */
export const EGGS = { pet_egg: "common", egg_uncommon: "uncommon", egg_rare: "rare" } as const satisfies Partial<Record<ItemId, PetRarity>>;
export type EggId = keyof typeof EGGS;
export const EGG_IDS = Object.keys(EGGS) as EggId[];
/** Bite damage ignores DEF: a small flat hit that grows with level and rarity. */
export const petBite = (level: number, rarity: PetRarity = "common") => Math.floor(((2 + Math.floor(level / 2)) * PET_RARITY[rarity].power) / 100);
/** Pet level from its XP, on the hero curve 10 × (L² − 1), up to its rarity's cap. */
export const petLevel = (xp: number, rarity: PetRarity = "common") => Math.min(PET_RARITY[rarity].max, Math.floor(Math.sqrt(xp / 10 + 1)));
/** One frame of public/astra/pets.png (scripts/draw-pets.py), in PET_IDS order. */
export const PET_W = 20;
export const PET_H = 16;

/**
 * PLACEHOLDER armour sets (owner request): every new hero starts in the plain tunic with ordinary
 * stats; the blacksmith forges the rest. Stats are flat, like training. `look` is the Heroes99 outfit worn.
 */
export const ARMORS = {
  tunic: { name: "ชุดผ้าธรรมดา", rarity: "common", stats: { def: 1 }, look: { outfit: 16, outfitColor: 1 }, cost: null },
  hunter: { name: "ชุดหนังนักล่า", rarity: "uncommon", stats: { def: 3, spd: 2 }, look: { outfit: 11, outfitColor: 3 }, cost: { wolf_pelt: 3, gold: 40 } },
  robe: { name: "เสื้อคลุมจอมเวท", rarity: "uncommon", stats: { res: 3, maxMp: 10 }, look: { outfit: 8, outfitColor: 4 }, cost: { wolf_pelt: 3, gold: 40 } },
  vestment: { name: "อาภรณ์นักบวช", rarity: "rare", stats: { res: 5, mag: 2, maxHp: 10 }, look: { outfit: 10, outfitColor: 1 }, cost: { wolf_pelt: 6, gold: 120 } },
  raider: { name: "เกราะนักรบเถื่อน", rarity: "rare", stats: { atk: 3, maxHp: 20 }, look: { outfit: 2, outfitColor: 1 }, cost: { wolf_pelt: 6, gold: 120 } },
  plate: { name: "เกราะอัศวิน", rarity: "epic", stats: { def: 8, res: 4, maxHp: 30 }, look: { outfit: 13, outfitColor: 8 }, cost: { wolf_pelt: 10, gold: 400 } },
} satisfies Record<string, { name: string; rarity: Rarity; stats: Partial<Stats>; look: { outfit: number; outfitColor: number }; cost: { wolf_pelt: number; gold: number } | null }>;
export type ArmorId = keyof typeof ARMORS;
export const ARMOR_IDS = Object.keys(ARMORS) as ArmorId[];
export const STARTER_ARMOR: ArmorId = "tunic";
