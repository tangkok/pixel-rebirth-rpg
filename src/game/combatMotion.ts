import type { ClassId } from "./lineage";
export type MotionStyle =
  | "slash"
  | "astral"
  | "arrow"
  | "daggers"
  | "radiant"
  | "flame"
  | "claw"
  | "heal"
  | "guard";
export const MOTIONS: Record<
  ClassId,
  { style: MotionStyle; ranged: boolean; color: number }
> = {
  warden: { style: "slash", ranged: false, color: 0xffd99a },
  arcanist: { style: "astral", ranged: true, color: 0x83e2ff },
  ranger: { style: "arrow", ranged: true, color: 0xc9b0ff },
  assassin: { style: "daggers", ranged: false, color: 0x80f2ce },
  paladin: { style: "radiant", ranged: false, color: 0xffe9aa },
  berserker: { style: "flame", ranged: false, color: 0xff9a69 },
};
/** Scaled by 2x speed without tying the simulation to the presentation clock. */
export function motionTiming(fast: boolean, reduced: boolean) {
  const factor = fast ? 0.55 : 1;
  return {
    windup: Math.round((reduced ? 70 : 140) * factor),
    travel: Math.round((reduced ? 110 : 230) * factor),
    impact: Math.round((reduced ? 45 : 70) * factor),
    recover: Math.round((reduced ? 130 : 260) * factor),
    effect: Math.round((reduced ? 300 : 580) * factor),
  };
}
