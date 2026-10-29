// Fire Emblem (GBA)-style duel choreography: every attack is 24 key frames of a sprite pose,
// an offset toward the target and a hold time, with exactly one impact frame where the engine's
// already-computed damage is shown. Presentation only; battle.ts decides every number.
import type { ClassId } from "./data";
import { ANIMS, type Anim } from "./looks";

/** Frames of public/astra/world/wolf.png, in scripts/draw-world.py WOLF_POSES order. */
export const WOLF_POSES = ["idle", "breathe", "crouch", "leap", "bite", "hurt", "down"] as const;
export type WolfPose = (typeof WOLF_POSES)[number];

export interface Key {
  pose: Anim | WolfPose;
  f: number;
  /** Pixels toward the opponent (hero: right, wolf: left) and up. */
  x: number;
  y: number;
  ms: number;
  impact?: true;
  /** Projectile leaves here and lands on the impact frame. */
  release?: true;
}
export type MoveKind = "melee" | "shot" | "spell" | "bite";
export const MOVE_FRAMES = 24;

const k = (pose: Key["pose"], f: number, x: number, ms: number, y = 0, extra: Partial<Key> = {}): Key => ({ pose, f, x, y, ms, ...extra });
const hold = (n: number, key: Key): Key[] => Array.from({ length: n }, () => ({ ...key, impact: undefined, release: undefined }));
// Hop back to the start line after a strike.
const hopBack = (pose: Key["pose"], from: number, n: number): Key[] =>
  Array.from({ length: n }, (_, i) => k(pose, 0, Math.round(from * (1 - (i + 1) / n)), 40, -Math.round(6 * Math.sin((Math.PI * (i + 1)) / (n + 1)))));

export const MOVES: Record<MoveKind, Key[]> = {
  // Dash in, raise, slash with a hit-stop, follow through, hop home.
  melee: [
    k("idle", 0, 0, 80),
    k("slash", 0, 0, 70),
    ...[12, 28, 44, 60, 72, 80].map((x, i) => k("run", i, x, 40)),
    k("slash", 0, 82, 60),
    k("slash", 1, 82, 100),
    k("slash", 2, 84, 40),
    k("slash", 3, 86, 50, 0, { impact: true }),
    ...hold(3, k("slash", 3, 86, 55)),
    k("slash", 4, 86, 70),
    k("slash", 5, 84, 80),
    ...hopBack("idle", 84, 5),
    k("idle", 0, 0, 60),
    k("idle", 0, 0, 60),
  ],
  // Plant, draw, loose; the arrow flies while the archer holds the pose.
  shot: [
    k("idle", 0, 0, 80),
    k("idle", 1, 0, 60),
    k("thrust", 0, -2, 80),
    k("thrust", 1, -3, 140),
    k("thrust", 2, 0, 50, 0, { release: true }),
    ...hold(5, k("thrust", 3, 0, 40)),
    k("thrust", 3, 0, 40, 0, { impact: true }),
    ...hold(3, k("thrust", 3, 0, 55)),
    k("thrust", 3, -1, 80),
    k("idle", 0, -1, 70),
    ...hold(6, k("idle", 0, 0, 50)),
    k("idle", 0, 0, 60),
    k("idle", 0, 0, 60),
  ],
  // Step forward, channel (magic circle), cast a bolt across the stage.
  spell: [
    k("idle", 0, 0, 80),
    k("cast", 0, 4, 60),
    k("cast", 1, 8, 90),
    ...[2, 3, 4, 2, 3, 4].map((f) => k("cast", f, 10, 60)),
    k("cast", 4, 12, 50, 0, { release: true }),
    ...hold(3, k("cast", 4, 12, 45)),
    k("cast", 4, 12, 40, 0, { impact: true }),
    ...hold(3, k("cast", 4, 12, 55)),
    k("cast", 1, 8, 70),
    k("idle", 0, 6, 60),
    k("idle", 0, 3, 60),
    ...hold(4, k("idle", 0, 0, 60)),
  ],
  // Crouch, pounce in an arc, bite with a hit-stop, bound back.
  bite: [
    k("idle", 0, 0, 80),
    k("breathe", 0, 0, 60),
    k("crouch", 0, -2, 70),
    k("crouch", 0, -3, 70),
    k("crouch", 0, -3, 120),
    ...[10, 28, 46, 64, 80, 90].map((x, i) => k("leap", 0, x, 40, [4, 8, 10, 8, 4, 1][i])),
    k("bite", 0, 92, 50, 0, { impact: true }),
    ...hold(3, k("bite", 0, 92, 55)),
    k("bite", 0, 90, 70),
    ...hopBack("leap", 88, 5),
    k("idle", 0, 0, 60),
    k("idle", 0, 0, 60),
    k("idle", 0, 0, 60),
  ],
};

/** Which move a hero action plays: ranged for the Ranger, spells for magic, else a melee swing. */
export function heroMove(classId: ClassId, magic: boolean): MoveKind {
  if (classId === "ranger") return "shot";
  return magic || classId === "sorcerer" ? "spell" : "melee";
}

export const moveLength = (keys: Key[]) => keys.reduce((t, key) => t + key.ms, 0);
const until = (keys: Key[], pick: (key: Key) => boolean | undefined) => {
  let t = 0;
  for (const key of keys) {
    if (pick(key)) return t;
    t += key.ms;
  }
  return -1;
};
export const impactAt = (keys: Key[]) => until(keys, (key) => key.impact);
export const releaseAt = (keys: Key[]) => until(keys, (key) => key.release);

/** The key frame showing at `ms` into the move (the last one once it has finished). */
export function keyAt(keys: Key[], ms: number): Key {
  let t = 0;
  for (const key of keys) {
    t += key.ms;
    if (ms < t) return key;
  }
  return keys[keys.length - 1];
}

/** Hero frame index within its animation strip, clamped so a table typo can never read past it. */
export const heroFrame = (key: Key) => Math.min(key.f, ANIMS[key.pose as Anim].frames - 1);
