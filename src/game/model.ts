export interface Progress {
  version: 1;
  level: number;
  xp: number;
  hp: number;
  gold: number;
  potions: number;
  kills: number;
  crystals: number;
  questClaimed: boolean;
  bossDefeated: boolean;
  openedChest: boolean;
  collectedCrystals: number[];
}
export const SAVE_KEY = "pixel-rebirth-save-v1";
export const freshProgress = (): Progress => ({
  version: 1,
  level: 1,
  xp: 0,
  hp: 100,
  gold: 0,
  potions: 3,
  kills: 0,
  crystals: 0,
  questClaimed: false,
  bossDefeated: false,
  openedChest: false,
  collectedCrystals: [],
});
export const maxHp = (p: Progress) => 100 + (p.level - 1) * 20;
export const nextLevelXp = (p: Progress) => p.level * 60;
export const attackPower = (p: Progress) => 18 + p.level * 6;
export function gainXp(p: Progress, amount: number): boolean {
  p.xp += Math.max(0, amount);
  let leveled = false;
  while (p.xp >= nextLevelXp(p)) {
    p.xp -= nextLevelXp(p);
    p.level++;
    p.hp = maxHp(p);
    leveled = true;
  }
  return leveled;
}
export function heal(p: Progress): boolean {
  if (p.potions <= 0 || p.hp >= maxHp(p)) return false;
  p.potions--;
  p.hp = Math.min(maxHp(p), p.hp + 65);
  return true;
}
export function claimQuest(p: Progress): boolean {
  if (p.kills < 5 || p.questClaimed) return false;
  p.questClaimed = true;
  p.gold += 75;
  p.potions += 2;
  gainXp(p, 80);
  return true;
}
export function parseSave(raw: string | null): Progress {
  try {
    const p: unknown = JSON.parse(raw ?? "null");
    if (!p || typeof p !== "object") return freshProgress();
    const s = p as Progress;
    if (
      s.version !== 1 ||
      !["level", "xp", "hp", "gold", "potions", "kills", "crystals"].every(
        (k) =>
          Number.isFinite(s[k as keyof Progress]) &&
          Number(s[k as keyof Progress]) >= 0,
      ) ||
      s.level < 1 ||
      s.level > 1000 ||
      s.hp > maxHp(s) ||
      s.xp >= nextLevelXp(s) ||
      typeof s.questClaimed !== "boolean" ||
      typeof s.bossDefeated !== "boolean"
    )
      return freshProgress();
    if (s.openedChest !== undefined && typeof s.openedChest !== "boolean")
      return freshProgress();
    if (
      s.collectedCrystals !== undefined &&
      (!Array.isArray(s.collectedCrystals) ||
        s.collectedCrystals.some(
          (id) => !Number.isInteger(id) || id < 0 || id > 4,
        ))
    )
      return freshProgress();
    return { ...freshProgress(), ...s, hp: s.hp === 0 ? maxHp(s) : s.hp };
  } catch {
    return freshProgress();
  }
}
