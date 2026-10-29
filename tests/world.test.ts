import { describe, expect, it } from "vitest";
import { defaultLook } from "../src/astra/looks";
import { newSave, parseSave, type SaveData } from "../src/astra/save";
import {
  acceptQuest,
  CHECKPOINTS,
  claimQuestReward,
  elaineNode,
  entityAt,
  interactTarget,
  MAPS,
  openChest,
  QUEST_REWARD_ID,
  recordVictory,
  tileAt,
  walkable,
} from "../src/astra/world";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const inForest = (s: SaveData): SaveData => ({ ...s, progress: { ...s.progress, map: "whispering_forest", x: 1, y: 8 } });
const roundTrip = (s: SaveData) => parseSave(JSON.stringify(s));

describe("maps", () => {
  it("are rectangular and every placed thing is reachable ground", () => {
    for (const m of Object.values(MAPS)) {
      expect(new Set(m.rows.map((r) => r.length)).size, m.id).toBe(1);
      const s = fresh();
      for (const e of m.entities) {
        expect(tileAt(m, e.x, e.y), `${m.id}/${e.id}`).not.toBeNull();
        expect(walkable(m, { ...s, progress: { ...s.progress, defeated: [] } }, e.x, e.y), e.id).toBe(false); // entity blocks
      }
      for (const x of m.exits) {
        expect(tileAt(m, x.x, x.y)).not.toBeNull();
        expect(walkable(MAPS[x.to], s, x.ax, x.ay), `${m.id} -> ${x.to}`).toBe(true);
      }
    }
    for (const c of Object.values(CHECKPOINTS)) expect(walkable(MAPS[c.map], fresh(), c.x, c.y)).toBe(true);
  });
  it("blocks trees and water, and defeated enemies stop blocking", () => {
    const v = MAPS.oakheart_village;
    expect(walkable(v, fresh(), 0, 0)).toBe(false); // tree
    expect(walkable(v, fresh(), 37, 22)).toBe(false); // pond
    expect(walkable(v, fresh(), 19, 4)).toBe(false); // town hall walls
    expect(walkable(v, fresh(), 19, 2)).toBe(true); // behind its roof
    expect(walkable(v, fresh(), 19, 13)).toBe(false); // fountain
    const f = MAPS.whispering_forest;
    const s = inForest(fresh());
    expect(entityAt(f, s, 8, 7)?.id).toBe("forest_wolf_1");
    const won = recordVictory(s, "forest_wolf_1");
    expect(entityAt(f, won, 8, 7)).toBeNull();
    expect(walkable(f, won, 8, 7)).toBe(true);
  });
  it("interacts with the faced neighbour first", () => {
    const v = MAPS.oakheart_village;
    expect(interactTarget(v, fresh(), 23, 11, "left")?.id).toBe("npc_scout_elaine");
    expect(interactTarget(v, fresh(), 15, 16, "right")?.id).toBe("oakheart_square"); // crystal at 16,16
    expect(interactTarget(v, fresh(), 5, 5, "up")).toBeNull();
  });
});

describe("forest_troubles quest", () => {
  it("only counts wolves defeated after accepting, each id once", () => {
    let s = inForest(fresh());
    s = recordVictory(s, "forest_wolf_1"); // before accepting: no credit
    expect(s.progress.quest).toEqual({ state: "AVAILABLE", kills: [] });
    s = acceptQuest(s);
    expect(acceptQuest(s)).toBe(s); // second accept is a no-op
    s = recordVictory(s, "forest_wolf_1"); // already defeated: no-op
    expect(s.progress.quest.kills).toEqual([]);
    s = recordVictory(s, "forest_wolf_2");
    s = recordVictory(s, "forest_wolf_2");
    expect(s.progress.quest).toEqual({ state: "ACTIVE", kills: ["forest_wolf_2"] });
    expect(s.hero.exp).toBe(40);
    expect(s.hero.level).toBe(2);
  });
  it("turns in exactly once after three distinct wolves", () => {
    let s = acceptQuest(inForest(fresh()));
    for (const id of ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"]) s = recordVictory(s, id);
    expect(s.progress.quest.state).toBe("READY_TO_TURN_IN");
    expect(elaineNode(s).choices[0].id).toBe("claim");
    const done = claimQuestReward(s)!;
    expect(done.gold).toBe(s.gold + 100);
    expect(done.items.potion).toBe(s.items.potion + 2);
    expect(done.progress.quest.state).toBe("COMPLETED");
    expect(done.progress.claimed).toContain(QUEST_REWARD_ID);
    expect(claimQuestReward(done)).toBe(done); // repeat claim grants nothing
    expect(roundTrip(done)).toEqual(done);
  });
  it("consumes nothing when the bag cannot hold the reward", () => {
    let s = acceptQuest(inForest(fresh()));
    for (const id of ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"]) s = recordVictory(s, id);
    s = { ...s, items: { ...s.items, potion: 98 } };
    expect(claimQuestReward(s)).toBeNull();
    expect(s.progress.quest.state).toBe("READY_TO_TURN_IN");
  });
});

describe("chests and saves", () => {
  it("opens a chest once", () => {
    const s = fresh();
    const a = openChest(s, "oakheart_chest")!;
    expect(a.items.potion).toBe(s.items.potion + 1);
    expect(openChest(a, "oakheart_chest")).toBe(a);
    expect(openChest({ ...s, items: { ...s.items, potion: 99 } }, "oakheart_chest")).toBeNull();
  });
  it("migrates a v1 save to the village start", () => {
    const v1 = {
      version: 1,
      hero: fresh().hero,
      items: fresh().items,
      progress: { map: "oakheart_village", x: 4, y: 10, checkpoint: "oakheart_square", defeated: [] },
      savedAt: 1,
    };
    const s = parseSave(JSON.stringify(v1))!;
    expect(s.version).toBe(4);
    expect(s.progress).toMatchObject({ map: "oakheart_village", x: 16, y: 17, quest: { state: "AVAILABLE", kills: [] } });
  });
  const bad = (f: (s: SaveData) => unknown) => JSON.stringify(f(fresh()));
  it.each([
    ["unknown map", bad((s) => ({ ...s, progress: { ...s.progress, map: "moon" } }))],
    ["position off map", bad((s) => ({ ...s, progress: { ...s.progress, x: 99 } }))],
    ["unknown encounter id", bad((s) => ({ ...s, progress: { ...s.progress, defeated: ["dragon"] } }))],
    ["duplicate defeated id", bad((s) => ({ ...s, progress: { ...s.progress, defeated: ["forest_wolf_1", "forest_wolf_1"] } }))],
    ["kill not in defeated", bad((s) => ({ ...s, progress: { ...s.progress, quest: { state: "ACTIVE", kills: ["forest_wolf_1"] } } }))],
    ["completed without reward receipt", bad((s) => ({ ...s, progress: { ...s.progress, defeated: ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"], quest: { state: "COMPLETED", kills: ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"] } } }))],
    ["reward claimed but quest open", bad((s) => ({ ...s, progress: { ...s.progress, claimed: [QUEST_REWARD_ID] } }))],
    ["negative gold", bad((s) => ({ ...s, gold: -5 }))],
  ])("rejects %s", (_, raw) => expect(parseSave(raw)).toBeNull());
});

describe("Quick Learner", () => {
  it("adds 15% EXP, floored", async () => {
    const { expFor } = await import("../src/astra/world");
    expect(expFor("forest_wolf", "quick_learner")).toBe(23);
    expect(expFor("forest_wolf", "tough_skin")).toBe(20);
  });
});
