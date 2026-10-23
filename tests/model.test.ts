import { describe, expect, it } from "vitest";
import {
  attackPower,
  claimQuest,
  freshProgress,
  gainXp,
  heal,
  maxHp,
  parseSave,
} from "../src/game/model";

describe("adventure progression", () => {
  it("gives XP without leveling too early", () => {
    const p = freshProgress();
    expect(gainXp(p, 59)).toBe(false);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(59);
  });
  it("levels up, carries XP and restores the increased health pool", () => {
    const p = freshProgress();
    p.hp = 20;
    expect(gainXp(p, 75)).toBe(true);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(15);
    expect(p.hp).toBe(120);
    expect(attackPower(p)).toBe(30);
  });
  it("supports multiple levels from a large reward", () => {
    const p = freshProgress();
    gainXp(p, 400);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(40);
    expect(p.hp).toBe(maxHp(p));
  });
  it("uses one potion and caps healing at max HP", () => {
    const p = freshProgress();
    p.hp = 80;
    expect(heal(p)).toBe(true);
    expect(p.hp).toBe(100);
    expect(p.potions).toBe(2);
    expect(heal(p)).toBe(false);
    expect(p.potions).toBe(2);
  });
  it("does not heal without a potion", () => {
    const p = freshProgress();
    p.hp = 20;
    p.potions = 0;
    expect(heal(p)).toBe(false);
    expect(p.hp).toBe(20);
  });
  it("only rewards a completed quest once", () => {
    const p = freshProgress();
    expect(claimQuest(p)).toBe(false);
    p.kills = 5;
    expect(claimQuest(p)).toBe(true);
    expect(p.gold).toBe(75);
    expect(p.potions).toBe(5);
    expect(p.level).toBe(2);
    expect(claimQuest(p)).toBe(false);
    expect(p.gold).toBe(75);
  });
});
describe("save validation", () => {
  it("round-trips legitimate progress", () => {
    const p = freshProgress();
    p.gold = 90;
    gainXp(p, 90);
    expect(parseSave(JSON.stringify(p))).toEqual(p);
  });
  it.each([
    null,
    "oops",
    "{}",
    "null",
    '{"version":2}',
    JSON.stringify({ ...freshProgress(), level: -1 }),
    JSON.stringify({ ...freshProgress(), hp: 999 }),
    JSON.stringify({ ...freshProgress(), xp: 10000 }),
  ])("recovers safely from invalid save %s", (raw) => {
    expect(parseSave(raw)).toEqual(freshProgress());
  });
  it("restores a defeated player at full health", () => {
    expect(parseSave(JSON.stringify({ ...freshProgress(), hp: 0 })).hp).toBe(
      100,
    );
  });
});
