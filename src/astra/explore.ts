// Top-down exploration screen. Draws the map and forwards input; every game rule lives in
// world.ts and every committed change goes through commit() so it is saved atomically.
import { ENEMIES, ITEMS, type ItemId } from "./data";
import { effectiveStats } from "./hero";
import { ANIMS, FRAME_H, FRAME_W, type Look } from "./looks";
import { writeSave, type SaveData } from "./save";
import { button, composite, h, root, show, still, store } from "./ui";
import {
  acceptQuest,
  CHECKPOINTS,
  claimQuestReward,
  elaineNode,
  entityAt,
  interactTarget,
  liveEntities,
  MAPS,
  openChest,
  questLine,
  recordVictory,
  setCheckpoint,
  STEP,
  TILE,
  tileAt,
  tileIndex,
  walkable,
  type Dir,
  type Entity,
} from "./world";

const MOVE_MS = 150;
const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};
// Elaine wears a fixed Heroes99 look so she reads as a ranger scout.
const ELAINE: Look = { skin: 2, face: 3, hair: "f4", hairColor: 6, outfit: 11, outfitColor: 2 };
const HERO_FOOT = { x: 41, y: 34 }; // feet of the Heroes99 body inside its 100x40 frame

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error(src));
    i.src = src;
  });
let art: Promise<[HTMLImageElement, HTMLImageElement]> | null = null;
const loadArt = () => {
  art ??= Promise.all([img("world/tiles.png"), img("world/wolf.png")]);
  art.catch(() => (art = null));
  return art;
};

export function explore(start: SaveData, toTitle: (notice?: string) => void, notice = "") {
  let save = start;
  const p = save.progress;
  let pos = { x: p.x, y: p.y };
  let dir: Dir = p.facing;
  let facing: "left" | "right" = p.facing === "left" ? "left" : "right";
  let move: { fx: number; fy: number; t0: number } | null = null;
  let held: Dir | null = null;
  let busy = false; // a dialog, menu or transition owns input
  const life = new AbortController();
  const on = { signal: life.signal };

  const map = () => MAPS[save.progress.map];
  const withPos = (s: SaveData): SaveData => ({
    ...s,
    progress: { ...s.progress, x: pos.x, y: pos.y, facing: dir },
  });
  /** Saves a committed state. The in-memory state advances even if storage fails. */
  const commit = (next: SaveData, msg: string) => {
    save = { ...withPos(next), savedAt: Date.now() };
    toast(writeSave(store, save) ? msg : `${msg} · บันทึกไม่ได้ในเบราว์เซอร์นี้`);
    hud();
  };

  // ---------- DOM ----------
  const canvas = h("canvas", { class: "world-canvas", aria: { hidden: "true" } });
  const ctx = canvas.getContext("2d")!;
  const status = h("div", { class: "hud-stats" });
  const quest = h("p", { class: "hud-quest" });
  const toastEl = h("p", { class: "toast", role: "status" });
  const act = button("คุย", () => interact(), { class: "act primary", aria: { keyshortcuts: "E" } });
  const pad = h(
    "div",
    { class: "pad", role: "group", aria: { label: "ปุ่มเดิน" } },
    ...(
      [
        ["up", "▲", "เดินขึ้น"],
        ["left", "◀", "เดินซ้าย"],
        ["right", "▶", "เดินขวา"],
        ["down", "▼", "เดินลง"],
      ] as [Dir, string, string][]
    ).map(([d, icon, label]) => {
      const b = button(icon, () => void 0, { class: `pad-${d}`, aria: { label } });
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId); // keep walking if the thumb slides off the button
        } catch {
          /* synthetic or already-released pointer */
        }
        held = d;
        tryMove(d);
      }, on);
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(ev, () => held === d && (held = null), on);
      b.addEventListener("click", (e) => e.detail === 0 && tryMove(d), on); // keyboard activation
      return b;
    }),
  );
  const panel = h("section", { class: "talk", hidden: true, role: "dialog", aria: { modal: "true", labelledby: "talk-who" } });
  const main = h(
    "main",
    { class: "screen world", aria: { label: map().name } },
    canvas,
    h(
      "header",
      { class: "hud" },
      h("div", {}, status, quest),
      button("☰", () => menu(), { class: "menu-btn", aria: { label: "เมนู", keyshortcuts: "Escape" } }),
    ),
    toastEl,
    pad,
    act,
    panel,
  );

  function hud() {
    const s = effectiveStats(save.hero.classId, save.hero.talentId);
    status.textContent = `${save.hero.name} Lv.${save.hero.level} · HP ${save.hero.hp}/${s.maxHp} · MP ${save.hero.mp}/${s.maxMp} · ${save.gold} G`;
    quest.textContent = `${map().name} · ${questLine(save)}`;
    main.setAttribute("aria-label", map().name);
    main.dataset.map = save.progress.map;
    main.dataset.pos = `${pos.x},${pos.y}`;
    main.dataset.quest = save.progress.quest.state;
  }
  let toastTimer = 0;
  function toast(msg: string) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("on", !!msg);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), 2600);
  }

  // ---------- movement ----------
  function tryMove(d: Dir) {
    if (busy || move) return;
    dir = d;
    if (d === "left" || d === "right") facing = d;
    const nx = pos.x + STEP[d][0];
    const ny = pos.y + STEP[d][1];
    const e = entityAt(map(), save, nx, ny);
    if (e?.kind === "enemy") return encounter(e);
    if (!walkable(map(), save, nx, ny)) return refreshTarget();
    move = { fx: pos.x, fy: pos.y, t0: performance.now() };
    pos = { x: nx, y: ny };
  }
  function arrive() {
    move = null;
    const exit = map().exits.find((x) => x.x === pos.x && x.y === pos.y);
    if (exit) {
      pos = { x: exit.ax, y: exit.ay };
      commit({ ...save, progress: { ...save.progress, map: exit.to } }, `เข้าสู่ ${MAPS[exit.to].name}`);
    }
    hud();
    refreshTarget();
  }

  // ---------- interaction ----------
  let target: Entity | null = null;
  const ACT_LABEL: Record<Entity["kind"], string> = { npc: "คุย", crystal: "บันทึก", chest: "เปิดหีบ", sign: "อ่าน", enemy: "สู้" };
  function refreshTarget() {
    target = busy ? null : interactTarget(map(), save, pos.x, pos.y, dir);
    act.hidden = !target;
    if (target) act.textContent = ACT_LABEL[target.kind];
  }

  function interact() {
    // Re-check on the game side: the button may be stale after a move or a reload.
    const t = busy || move ? null : interactTarget(map(), save, pos.x, pos.y, dir);
    if (!t) return;
    if (t.kind === "enemy") return encounter(t);
    if (t.kind === "npc") return talkElaine();
    if (t.kind === "sign") return talk("ป้าย", t.text, [["ปิด", close]]);
    if (t.kind === "crystal")
      return talk("คริสตัลแห่งการบันทึก", "บันทึกการเดินทางและตั้งจุดเริ่มใหม่ที่นี่?", [
        ["บันทึก", () => (commit(setCheckpoint(save, t.id), "บันทึกเกมแล้ว ✓"), close())],
        ["ยกเลิก", close],
      ]);
    if (save.progress.claimed.includes(t.id)) return talk("หีบสมบัติ", "หีบว่างเปล่า", [["ปิด", close]]);
    const next = openChest(save, t.id);
    if (!next) return talk("หีบสมบัติ", "กระเป๋าเต็ม ยังเปิดหีบไม่ได้", [["ปิด", close]]);
    commit(next, `ได้รับ ${ITEMS[t.item].name} ×${t.count}`);
    refreshTarget();
  }

  function talkElaine() {
    const node = elaineNode(save);
    talk(
      "Elaine · หน่วยสอดแนม",
      node.text,
      node.choices.map((c) => [
        c.label,
        () => {
          if (c.id === "accept") commit(acceptQuest(save), "รับภารกิจ Forest Troubles แล้ว");
          if (c.id === "claim") {
            const next = claimQuestReward(save);
            if (!next) return talk("Elaine · หน่วยสอดแนม", "กระเป๋าของเจ้าเต็ม จัดของก่อนแล้วค่อยมารับนะ", [["ปิด", close]]);
            commit(next, "ได้รับ 100 Gold และ Potion ×2");
          }
          close();
        },
      ]),
    );
  }

  /** Bounded dialog panel; each choice runs once (buttons disable on first press). */
  function talk(who: string, text: string, choices: [string, () => void][]) {
    busy = true;
    held = null;
    refreshTarget();
    const buttons = choices.map(([label, fn], i) =>
      button(label, () => {
        if (panel.dataset.done) return;
        panel.dataset.done = "1";
        buttons.forEach((b) => (b.disabled = true));
        fn();
      }, { class: i === 0 ? "primary" : "" }),
    );
    delete panel.dataset.done;
    panel.replaceChildren(h("h2", { id: "talk-who" }, who), h("p", {}, text), h("div", { class: "row" }, ...buttons));
    panel.hidden = false;
    pad.inert = true;
    buttons[0]?.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    pad.inert = false;
    busy = false;
    refreshTarget();
    (act.hidden ? main.querySelector<HTMLElement>(".menu-btn") : act)?.focus({ preventScroll: true });
  }

  function menu() {
    if (busy) return;
    const bag = (Object.keys(ITEMS) as ItemId[]).filter((k) => save.items[k]).map((k) => `${ITEMS[k].name} ×${save.items[k]}`);
    talk("เมนู", `${questLine(save)} · ${save.gold} Gold · ${bag.join(" · ") || "ไม่มีไอเทม"}`, [
      ["กลับเกม", close],
      ["กลับหน้าแรก", () => {
        commit(save, "บันทึกตำแหน่งแล้ว");
        leave();
        toTitle();
      }],
    ]);
  }

  // ---------- encounter (placeholder until the milestone 3 battle engine) ----------
  function encounter(e: Extract<Entity, { kind: "enemy" }>) {
    if (busy) return;
    busy = true;
    held = null;
    leave();
    const foe = ENEMIES[e.enemy];
    const wolf = h("canvas", { class: "foe", width: 32, height: 24 });
    loadArt().then(([, w]) => wolf.getContext("2d")!.drawImage(w, 0, 0, 32, 24, 0, 0, 32, 24)).catch(() => void 0);
    const hero = h("canvas", { class: "sprite duel-hero", width: FRAME_W, height: FRAME_H });
    composite(save.hero.look, save.hero.classId).then((c) => hero.getContext("2d")!.drawImage(c, 0, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H)).catch(() => void 0);
    const back = (s: SaveData, msg: string) => explore(s, toTitle, msg);
    let done = false;
    const once = (fn: () => void) => () => {
      if (done) return;
      done = true;
      fn();
    };
    show(
      h(
        "main",
        { class: "screen create encounter" },
        h("header", { class: "area" }, h("b", {}, `${foe.name} ปรากฏตัว!`), h("span", {}, map().name)),
        h("div", { class: "sprite-box duel", role: "img", aria: { label: `${save.hero.name} ปะทะ ${foe.name}` } }, hero, wolf),
        h(
          "section",
          { class: "panel" },
          h("p", { class: "meta" }, `${foe.name} · HP ${foe.stats.maxHp} · ATK ${foe.stats.atk} · SPD ${foe.stats.spd} · EXP ${foe.exp}`),
          h("p", { class: "hint" }, "PLACEHOLDER: ระบบต่อสู้แบบเทิร์น (Attack/Skill/Defend/Item) จะมาในขั้นที่ 3 ตอนนี้กด “ชนะ (ทดสอบ)” เพื่อเดินเควสต่อได้"),
        ),
        h(
          "footer",
          { class: "row" },
          button("ถอยกลับ", once(() => back(withPos(save), "ถอยกลับมาแล้ว"))),
          button("ชนะ (ทดสอบ)", once(() => {
            const next = recordVictory(withPos(save), e.id);
            const s = { ...next, savedAt: Date.now() };
            const ok = writeSave(store, s);
            back(s, `ชนะ ${foe.name} · +${foe.exp} EXP${ok ? "" : " · บันทึกไม่ได้"}`);
          }), { class: "primary" }),
        ),
      ),
    );
    fitDuel();
  }

  // ---------- input ----------
  addEventListener("keydown", (e) => {
    if (e.repeat && !KEYS[e.key]) return;
    if (e.key === "Escape") return busy && !panel.hidden ? close() : menu();
    if (busy || (e.target as HTMLElement).closest?.(".talk")) return;
    const d = KEYS[e.key];
    if (d) {
      e.preventDefault();
      held = d;
      tryMove(d);
    } else if (e.key === "e" || e.key === "E" || ((e.key === " " || e.key === "Enter") && e.target === document.body)) {
      e.preventDefault();
      interact();
    }
  }, on);
  addEventListener("keyup", (e) => KEYS[e.key] === held && (held = null), on);
  addEventListener("blur", () => (held = null), on);

  // ---------- rendering ----------
  let scale = 1;
  function resize() {
    const r = main.getBoundingClientRect();
    // Integer zoom so 16px tiles stay crisp; at least ~11x9 tiles stay visible.
    scale = Math.max(1, Math.min(4, Math.floor(Math.min(r.width / (11 * TILE), r.height / (9 * TILE)))));
    canvas.width = Math.ceil(r.width / scale);
    canvas.height = Math.ceil(r.height / scale);
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener("resize", resize, on);

  let sheets: { hero: HTMLCanvasElement; elaine: HTMLCanvasElement; tiles: HTMLImageElement; wolf: HTMLImageElement } | null = null;
  Promise.all([composite(save.hero.look, save.hero.classId), composite(ELAINE, "ranger"), loadArt()])
    .then(([hero, elaine, [tiles, wolf]]) => (sheets = { hero, elaine, tiles, wolf }))
    .catch(() => toast("โหลดภาพแผนที่ไม่สำเร็จ"));

  function frame(now: number) {
    if (life.signal.aborted) return;
    if (!main.isConnected) return leave();
    if (move && now - move.t0 >= MOVE_MS) arrive();
    if (!move && held && !busy) tryMove(held);
    draw(now);
    requestAnimationFrame(frame);
  }

  function draw(now: number) {
    if (!sheets) return;
    const m = map();
    const W = m.rows[0].length * TILE;
    const H = m.rows.length * TILE;
    const k = move ? Math.min(1, (now - move.t0) / MOVE_MS) : 1;
    const hx = ((move ? move.fx + (pos.x - move.fx) * k : pos.x) + 0.5) * TILE;
    const hy = ((move ? move.fy + (pos.y - move.fy) * k : pos.y) + 1) * TILE;
    const cam = (view: number, size: number, at: number) => (size <= view ? Math.floor((size - view) / 2) : Math.round(Math.max(0, Math.min(size - view, at - view / 2))));
    const cx = cam(canvas.width, W, hx);
    const cy = cam(canvas.height, H, hy - TILE / 2);
    ctx.fillStyle = "#0b1426";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tile = (t: number, x: number, y: number) => ctx.drawImage(sheets!.tiles, t * TILE, 0, TILE, TILE, x * TILE - cx, y * TILE - cy, TILE, TILE);
    const x0 = Math.max(0, Math.floor(cx / TILE));
    const y0 = Math.max(0, Math.floor(cy / TILE));
    for (let y = y0; y < Math.min(m.rows.length, y0 + canvas.height / TILE + 2); y++)
      for (let x = x0; x < Math.min(m.rows[0].length, x0 + canvas.width / TILE + 2); x++) tile(tileIndex(tileAt(m, x, y)!), x, y);

    const forest = m.id === "whispering_forest";
    const moving = !!move || (!!held && !busy);
    const anim = still() ? 0 : now;
    const sprites: { y: number; draw: () => void }[] = [];
    for (const e of liveEntities(m, save)) {
      if (e.kind === "crystal") tile(tileIndex("crystal"), e.x, e.y);
      if (e.kind === "sign") tile(tileIndex("sign"), e.x, e.y);
      if (e.kind === "chest") {
        const open = save.progress.claimed.includes(e.id);
        tile(tileIndex(forest ? (open ? "forest_chest_open" : "forest_chest") : open ? "chest_open" : "chest"), e.x, e.y);
      }
      if (e.kind === "npc")
        sprites.push({ y: e.y, draw: () => person(sheets!.elaine, "idle", Math.floor(anim / 160), (e.x + 0.5) * TILE - cx, (e.y + 1) * TILE - cy, hx < (e.x + 0.5) * TILE) }); // faces the hero
      if (e.kind === "enemy")
        sprites.push({
          y: e.y,
          draw: () => ctx.drawImage(sheets!.wolf, (Math.floor(anim / 420) % 2) * 32, 0, 32, 24, (e.x + 0.5) * TILE - 16 - cx, (e.y + 1) * TILE - 23 - cy, 32, 24),
        });
    }
    sprites.push({
      y: move ? Math.max(pos.y, move.fy) : pos.y,
      draw: () => person(sheets!.hero, moving ? "run" : "idle", Math.floor(anim / (moving ? 90 : 140)), hx - cx, hy - cy, facing === "left"),
    });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());

    if (target && !busy) {
      // "!" bubble above whatever the Interact button would act on.
      const bx = (target.x + 0.5) * TILE - cx;
      const by = target.y * TILE - cy - (target.kind === "npc" ? 20 : 6) + (still() ? 0 : Math.round(Math.sin(now / 200)));
      ctx.fillStyle = "#240000";
      ctx.fillRect(bx - 4, by - 9, 9, 10);
      ctx.fillStyle = "#faca58";
      ctx.fillRect(bx - 3, by - 8, 7, 8);
      ctx.fillStyle = "#240000";
      ctx.fillRect(bx, by - 7, 1, 4);
      ctx.fillRect(bx, by - 2, 1, 1);
    }
  }

  function person(sheet: HTMLCanvasElement, a: keyof typeof ANIMS, f: number, fx: number, fy: number, flip: boolean) {
    const { row, frames } = ANIMS[a];
    ctx.save();
    ctx.translate(Math.round(fx), Math.round(fy));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet, (f % frames) * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, -HERO_FOOT.x, -HERO_FOOT.y - 2, FRAME_W, FRAME_H);
    ctx.restore();
  }

  function leave() {
    life.abort();
  }

  // A saved spot that is no longer standable (e.g. map edit) falls back to the checkpoint.
  if (!walkable(map(), save, pos.x, pos.y)) {
    const c = CHECKPOINTS[save.progress.checkpoint];
    save = { ...save, progress: { ...save.progress, map: c.map } };
    pos = { x: c.x, y: c.y };
  }
  show(main);
  resize();
  hud();
  refreshTarget();
  if (notice) toast(notice);
  (act.hidden ? main.querySelector<HTMLElement>(".menu-btn") : act)?.focus({ preventScroll: true });
  requestAnimationFrame(frame);
}

/** Integer pixel scale for the duel placeholder sprites. */
function fitDuel() {
  const box = root.querySelector<HTMLElement>(".duel");
  if (!box) return;
  const k = Math.max(1, Math.floor(Math.min(box.clientWidth / 140, box.clientHeight / 40)));
  box.style.setProperty("--k", String(k));
}
