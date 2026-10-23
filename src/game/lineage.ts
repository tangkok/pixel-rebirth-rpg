/** Data-driven character choices; all bonuses are used by the combat simulation. */
export type ClassId =
  "warden" | "arcanist" | "ranger" | "assassin" | "paladin" | "berserker";
export type Attributes = {
  hp: number;
  mp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
};
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
    base: Attributes;
    skillHint: string;
    magic: boolean;
    factor: number;
    effect: "break" | "pierce" | "drain" | "smite" | "fury" | "astral";
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
    base: { hp: 240, mp: 66, attack: 40, magic: 25, defense: 17, speed: 22 },
    skillHint: "โจมตีหนักและทลายเกราะ 3 เทิร์น",
    magic: false,
    factor: 1.8,
    effect: "break",
  },
  arcanist: {
    name: "Starweaver",
    thai: "จอมเวทดวงดาว",
    role: "ARCANIST",
    skill: "Astral Rain",
    description: "เวทดวงดาวพลังสูง เหมาะกับการเพิ่ม Spirit",
    color: "#83d9de",
    weapon: "Lunar staff",
    upgrade: "Celestial scepter",
    cost: 18,
    base: { hp: 190, mp: 90, attack: 25, magic: 48, defense: 12, speed: 24 },
    skillHint: "เวทโจมตีดวงดาว ใช้ค่า MAG",
    magic: true,
    factor: 1.8,
    effect: "astral",
  },
  ranger: {
    name: "Veil Ranger",
    thai: "พรานแห่งม่านหมอก",
    role: "STRIKER",
    skill: "Piercing Gale",
    description: "ความเร็วสูง ลูกศรเวททะลุเกราะ",
    color: "#b3a1ed",
    weapon: "Whisperwood bow",
    upgrade: "Eclipse longbow",
    cost: 12,
    base: { hp: 210, mp: 72, attack: 39, magic: 30, defense: 13, speed: 31 },
    skillHint: "ลูกศรทะลุเกราะ ใช้ค่า ATK",
    magic: false,
    factor: 1.8,
    effect: "pierce",
  },
  assassin: {
    name: "Duskblade",
    thai: "นักฆ่าเงาสนธยา",
    role: "ASSASSIN",
    skill: "Shadow Fang",
    description: "มีดเงาว่องไว ดูดพลังชีวิตจากความเสียหาย",
    color: "#72dec3",
    weapon: "Nightfall daggers",
    upgrade: "Twin eclipse fangs",
    cost: 14,
    base: { hp: 195, mp: 70, attack: 43, magic: 24, defense: 10, speed: 35 },
    skillHint: "แทงทะลุเกราะและดูดเลือด 25%",
    magic: false,
    factor: 1.65,
    effect: "drain",
  },
  paladin: {
    name: "Dawnkeeper",
    thai: "พาลาดินแห่งแสง",
    role: "PALADIN",
    skill: "Radiant Oath",
    description: "โล่ศักดิ์สิทธิ์ เกราะสูง โจมตีพร้อมฟื้น HP",
    color: "#f4dfa2",
    weapon: "Oathkeeper mace",
    upgrade: "Aureate covenant",
    cost: 16,
    base: { hp: 270, mp: 76, attack: 32, magic: 36, defense: 23, speed: 17 },
    skillHint: "เวทศักดิ์สิทธิ์ พร้อมฟื้น HP 35",
    magic: true,
    factor: 1.7,
    effect: "smite",
  },
  berserker: {
    name: "Ember Reaver",
    thai: "เบอร์เซิร์กเพลิง",
    role: "BERSERKER",
    skill: "Crimson Cleave",
    description: "ขวานหนักโจมตีรุนแรงขึ้นเมื่อ HP ลดลง",
    color: "#ef8f70",
    weapon: "Emberiron axe",
    upgrade: "Ruinborn executioner",
    cost: 14,
    base: { hp: 255, mp: 58, attack: 47, magic: 18, defense: 12, speed: 20 },
    skillHint: "ฟันหนัก ยิ่งบาดเจ็บยิ่งรุนแรง",
    magic: false,
    factor: 1.85,
    effect: "fury",
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const RARITIES = {
  common: { name: "ทั่วไป", english: "COMMON", color: "#b1bdb0" },
  uncommon: { name: "ไม่ธรรมดา", english: "UNCOMMON", color: "#82c9a9" },
  rare: { name: "หายาก", english: "RARE", color: "#81bdec" },
  epic: { name: "มหากาพย์", english: "EPIC", color: "#c59df4" },
  legendary: { name: "ตำนาน", english: "LEGENDARY", color: "#f0ca7a" },
  mythic: { name: "เทพนิยาย", english: "MYTHIC", color: "#f39eb8" },
} as const;
export type Rarity = keyof typeof RARITIES;
export interface Race {
  id: string;
  name: string;
  english: string;
  rarity: Rarity;
  weight: number;
  sigil: string;
  lore: string;
  trait: string;
  bonus: Partial<Attributes>;
}
export const RACES = [
  {
    id: "human",
    name: "มนุษย์",
    english: "Human",
    rarity: "common",
    weight: 18,
    sigil: "◇",
    lore: "ผู้เขียนโชคชะตาด้วยมือตัวเอง",
    trait: "ใจมุ่งมั่น · HP +12, ATK +2",
    bonus: { hp: 12, attack: 2 },
  },
  {
    id: "woodkin",
    name: "พฤกษาชน",
    english: "Woodkin",
    rarity: "common",
    weight: 14,
    sigil: "❧",
    lore: "ผู้เฝ้าป่าแห่งรุ่งอรุณ",
    trait: "ชีพจรพงไพร · HP +18, MAG +2",
    bonus: { hp: 18, magic: 2 },
  },
  {
    id: "stoneborn",
    name: "ศิลาชน",
    english: "Stoneborn",
    rarity: "common",
    weight: 12,
    sigil: "⬡",
    lore: "สายเลือดแห่งภูผาอันมั่นคง",
    trait: "ผิวศิลา · HP +20, DEF +2",
    bonus: { hp: 20, defense: 2 },
  },
  {
    id: "wildling",
    name: "พงไพรชน",
    english: "Wildling",
    rarity: "common",
    weight: 11,
    sigil: "⋀",
    lore: "นักเดินทางที่รวดเร็วดั่งสายลม",
    trait: "ก้าวว่องไว · ATK +2, SPD +3",
    bonus: { attack: 2, speed: 3 },
  },
  {
    id: "moonelf",
    name: "เอลฟ์จันทรา",
    english: "Moon Elf",
    rarity: "uncommon",
    weight: 10,
    sigil: "☾",
    lore: "ผู้ฟังเสียงแผ่วของดวงดาว",
    trait: "พรจันทรา · MP +12, MAG +4",
    bonus: { mp: 12, magic: 4 },
  },
  {
    id: "beastkin",
    name: "อสูรพงไพร",
    english: "Beastkin",
    rarity: "uncommon",
    weight: 8,
    sigil: "♧",
    lore: "หัวใจนักล่าใต้ร่างมนุษย์",
    trait: "สัญชาตญาณ · ATK +5, SPD +2",
    bonus: { attack: 5, speed: 2 },
  },
  {
    id: "tideborn",
    name: "สมุทรชน",
    english: "Tideborn",
    rarity: "uncommon",
    weight: 7,
    sigil: "≈",
    lore: "ทายาทแห่งทะเลไร้ขอบเขต",
    trait: "พรสมุทร · HP +24, MP +10",
    bonus: { hp: 24, mp: 10 },
  },
  {
    id: "dragonkin",
    name: "มังกรชน",
    english: "Dragonkin",
    rarity: "rare",
    weight: 5,
    sigil: "♜",
    lore: "เปลวไฟเก่าแก่ไหลเวียนในสายเลือด",
    trait: "เกล็ดมังกร · ATK +6, DEF +4",
    bonus: { attack: 6, defense: 4 },
  },
  {
    id: "fae",
    name: "ภูตดารา",
    english: "Star Fae",
    rarity: "rare",
    weight: 4,
    sigil: "✧",
    lore: "ละอองแสงซึ่งเลือกจะมีชีวิต",
    trait: "ประกายภูต · MP +20, MAG +6",
    bonus: { mp: 20, magic: 6 },
  },
  {
    id: "shade",
    name: "เงาราตรี",
    english: "Nightshade",
    rarity: "rare",
    weight: 3,
    sigil: "◈",
    lore: "ผู้ก้าวผ่านม่านเงาของโลก",
    trait: "รอยเงา · ATK +4, SPD +6",
    bonus: { attack: 4, speed: 6 },
  },
  {
    id: "phoenix",
    name: "วิหคเพลิง",
    english: "Phoenixborn",
    rarity: "epic",
    weight: 3,
    sigil: "♨",
    lore: "แสงรุ่งอรุณที่ไม่ยอมดับสูญ",
    trait: "หัวใจเพลิง · HP +45, MAG +8",
    bonus: { hp: 45, magic: 8 },
  },
  {
    id: "frostgiant",
    name: "ยักษ์เหมันต์",
    english: "Frost Giant",
    rarity: "epic",
    weight: 2,
    sigil: "❄",
    lore: "จิตวิญญาณแห่งธารน้ำแข็งพันปี",
    trait: "เกราะเหมันต์ · HP +60, DEF +6",
    bonus: { hp: 60, defense: 6 },
  },
  {
    id: "seraph",
    name: "เซราฟิม",
    english: "Seraph",
    rarity: "legendary",
    weight: 1.5,
    sigil: "✥",
    lore: "เสียงสะท้อนจากบัลลังก์แห่งแสง",
    trait: "พรสวรรค์ · HP +40, MAG +10, DEF +4",
    bonus: { hp: 40, magic: 10, defense: 4 },
  },
  {
    id: "voidborn",
    name: "สุญญตาชน",
    english: "Voidborn",
    rarity: "legendary",
    weight: 1,
    sigil: "⟡",
    lore: "ผู้ลืมตาในช่องว่างระหว่างดวงดาว",
    trait: "พลังสุญญตา · ATK +10, MAG +10, SPD +5",
    bonus: { attack: 10, magic: 10, speed: 5 },
  },
  {
    id: "primordial",
    name: "ปฐมเทพ",
    english: "Primordial",
    rarity: "mythic",
    weight: 0.5,
    sigil: "✺",
    lore: "เศษเสี้ยวของแสงแรกก่อนกำเนิดโลก",
    trait: "ปฐมแสง · HP +80, MP +20, ATK/MAG +12, DEF/SPD +6",
    bonus: { hp: 80, mp: 20, attack: 12, magic: 12, defense: 6, speed: 6 },
  },
] as const satisfies readonly Race[];
export type RaceId = (typeof RACES)[number]["id"];
export const RACE_TOTAL_WEIGHT = RACES.reduce((s, r) => s + r.weight, 0);
export function raceById(id: string | null | undefined): Race | undefined {
  return RACES.find((r) => r.id === id);
}
/** Cumulative weighted sampling; an injected RNG makes boundaries testable. */
export function sampleRace(
  random: () => number = Math.random,
): (typeof RACES)[number] {
  const value = random();
  let n =
    Math.max(
      0,
      Math.min(1 - Number.EPSILON, Number.isFinite(value) ? value : 0),
    ) * RACE_TOTAL_WEIGHT;
  for (const race of RACES) {
    n -= race.weight;
    if (n < 0) return race;
  }
  return RACES[RACES.length - 1];
}
export const RACE_REROLL_COST = 150;
export const SUBCLASS_LEVEL = 2;
export const MAX_SKILL_RANK = 5;
export function subclassBonus(id: ClassId | null): Attributes {
  if (!id) return { hp: 0, mp: 0, attack: 0, magic: 0, defense: 0, speed: 0 };
  const base = CLASSES[id].base;
  return {
    hp: Math.round(base.hp * 0.12),
    mp: Math.round(base.mp * 0.12),
    attack: Math.round(base.attack * 0.12),
    magic: Math.round(base.magic * 0.12),
    defense: Math.round(base.defense * 0.2),
    speed: Math.round(base.speed * 0.15),
  };
}
