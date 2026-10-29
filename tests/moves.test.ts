import { describe, expect, it } from "vitest";
import { ANIMS } from "../src/astra/looks";
import { heroMove, impactAt, keyAt, MOVE_FRAMES, MOVES, moveLength, releaseAt, WOLF_POSES } from "../src/astra/moves";

describe("duel choreography", () => {
  for (const [kind, keys] of Object.entries(MOVES)) {
    it(`${kind}: 24 frames, one impact, valid poses`, () => {
      expect(keys).toHaveLength(MOVE_FRAMES);
      expect(keys.filter((k) => k.impact)).toHaveLength(1);
      expect(keys.filter((k) => k.release).length).toBeLessThanOrEqual(1);
      if (releaseAt(keys) >= 0) expect(releaseAt(keys)).toBeLessThan(impactAt(keys));
      for (const k of keys) {
        if (kind === "bite") expect(WOLF_POSES).toContain(k.pose);
        else expect(k.f).toBeLessThan(ANIMS[k.pose as keyof typeof ANIMS].frames);
      }
      expect(keys.at(-1)).toMatchObject({ x: 0, y: 0 }); // ends back on the start line
      expect(moveLength(keys)).toBeGreaterThan(900);
      expect(moveLength(keys)).toBeLessThan(2000);
      expect(keyAt(keys, impactAt(keys)).impact).toBe(true);
      expect(keyAt(keys, 1e9)).toBe(keys.at(-1));
    });
  }
  it("picks the move by class and magic", () => {
    expect(heroMove("knight", false)).toBe("melee");
    expect(heroMove("ranger", false)).toBe("shot");
    expect(heroMove("sorcerer", false)).toBe("spell");
    expect(heroMove("cleric", true)).toBe("spell");
    expect(heroMove("cleric", false)).toBe("melee");
  });
});
