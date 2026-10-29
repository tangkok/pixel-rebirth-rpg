// Top-down exploration screen. Draws the map and forwards input; every game rule lives in
// world.ts and every committed change goes through commit() so it is saved atomically.
import { ENEMIES, ITEMS, LEVEL_EXP, STAT_IDS, STAT_LABEL, type ClassId, type ItemId } from "./data";
import { duel } from "./duel";
import { effectiveStats } from "./hero";
import { ANIMS, FB, FRAME_H, FRAME_W, type Look } from "./looks";
import { writeSave, type SaveData } from "./save";
import { KAEL_PRICES, KAEL_TALK, merchantBuy, merchantSell, nextTradeId, TRADE_ITEMS, type Trade } from "./trade";
import { button, composite, compositeFB, crisp, h, settings, show, still, store } from "./ui";
import {
  acceptQuest,
  BUILDING_PX,
  CHECKPOINTS,
  claimQuestReward,
  elaineNode,
  entityAt,
  interactTarget,
  liveEntities,
  lootOf,
  MAPS,
  openChest,
  PROP_ART,
  questLine,
  recordVictory,
  routeTiles,
  setCheckpoint,
  STEP,
  TILE,
  tileAt,
  tileIndex,
  walkable,
  type Dir,
  type Entity,
  type Walkers,
} from "./world";

const MOVE_MS = 150;
const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};
// Elaine wears a fixed Heroes99 look so she reads as a ranger scout.
const ELAINE: Look = { skin: 2, face: 3, hair: "f4", hairColor: 6, outfit: 11, outfitColor: 2 };
const KAEL_LOOK: Look = { skin: 1, face: 2, hair: "m6", hairColor: 3, outfit: 4, outfitColor: 5 };
const KAEL_STEP_MS = 420;
const KAEL_PAUSE_MS = 1400; // stops at each corner of his loop to look around
/** "MaxHP +16 · ATK +2 …" for the stats that rose between two saves. */
const levelGains = (a: SaveData, b: SaveData) => {
  const [x, y] = [heroStatsOf(a), heroStatsOf(b)];
  return STAT_IDS.filter((k) => y[k] > x[k]).map((k) => `${STAT_LABEL[k]} +${y[k] - x[k]}`).join(" · ");
};
const heroStatsOf = (s: SaveData) => effectiveStats(s.hero.classId, s.hero.talentId, s.hero.level);
const HERO_FOOT = { x: 41, y: 34 }; // feet of the Heroes99 body inside its 100x40 frame

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error(src));
    i.src = src;
  });
type Art = { tiles: HTMLImageElement; wolf: HTMLImageElement; buildings: HTMLImageElement; fountain: HTMLImageElement; shade: HTMLCanvasElement };
let art: Promise<Art> | null = null;
const loadArt = () => {
  art ??= Promise.all(["tiles", "wolf", "buildings", "fountain"].map((n) => img(`world/${n}.png`))).then(([tiles, wolf, buildings, fountain]) => ({
    tiles,
    wolf,
    buildings,
    fountain,
    shade: silhouette(buildings, fountain),
  }));
  art.catch(() => (art = null));
  return art;
};

/** Soft black copies of the buildings (and the fountain after them) for cast shadows. */
function silhouette(buildings: HTMLImageElement, fountain: HTMLImageElement): HTMLCanvasElement {
  const c = h("canvas", { width: buildings.width + BUILDING_PX, height: buildings.height });
  const g = c.getContext("2d")!;
  g.filter = "blur(1px)"; // ignored where unsupported: hard-edged shadows are fine too
  g.drawImage(buildings, 0, 0);
  g.drawImage(fountain, buildings.width, 0);
  g.filter = "none";
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#1a0f1f";
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

const LAMPS = Object.fromEntries(
  Object.values(MAPS).map((m) => [m.id, m.rows.flatMap((r, y) => [...r].flatMap((_, x) => (tileAt(m, x, y) === "lamp" ? [[x, y] as [number, number]] : [])))]),
) as Record<keyof typeof MAPS, [number, number][]>;

/** Per-map sun-shaft colour; the matching colour grade is .world-shade in astra.css. */
const MOOD = {
  oakheart_village: { rays: "255,210,140" },
  whispering_forest: { rays: "220,255,200" },
} as const;

export function explore(start: SaveData, toTitle: (notice?: string) => void, notice = "") {
  let save = start;
  const p = save.progress;
  let pos = { x: p.x, y: p.y };
  let dir: Dir = p.facing;
  let facing: "left" | "right" = p.facing === "left" ? "left" : "right";
  let move: { fx: number; fy: number; t0: number } | null = null;
  let held: Dir | null = null;
  let busy = false; // a dialog, menu or transition owns input
  let walkers: Walkers = {};
  let walk: { id: string; tiles: [number, number][]; corners: Set<number>; i: number; from: [number, number]; t0: number; next: number } | null = null;
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
  const glowLayer = h("canvas", { class: "world-glow", aria: { hidden: "true" } });
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
    glowLayer,
    h("div", { class: "world-shade", aria: { hidden: "true" } }),
    h("div", { class: "dof top", aria: { hidden: "true" } }),
    h("div", { class: "dof bottom", aria: { hidden: "true" } }),
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
    const s = heroStatsOf(save);
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
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), Math.max(2600, msg.length * 60)); // long level-up lines need time to read
  }

  // ---------- movement ----------
  function tryMove(d: Dir) {
    if (busy || move) return;
    dir = d;
    if (d === "left" || d === "right") facing = d;
    const nx = pos.x + STEP[d][0];
    const ny = pos.y + STEP[d][1];
    const e = entityAt(map(), save, nx, ny, walkers);
    if (e?.kind === "enemy") return encounter(e);
    if (!walkable(map(), save, nx, ny, walkers)) return refreshTarget();
    move = { fx: pos.x, fy: pos.y, t0: performance.now() };
    pos = { x: nx, y: ny };
  }
  function arrive() {
    move = null;
    const exit = map().exits.find((x) => x.x === pos.x && x.y === pos.y);
    if (exit) {
      pos = { x: exit.ax, y: exit.ay };
      commit({ ...save, progress: { ...save.progress, map: exit.to } }, `เข้าสู่ ${MAPS[exit.to].name}`);
      startWalk(performance.now());
    }
    hud();
    refreshTarget();
  }

  // ---------- interaction ----------
  let target: Entity | null = null;
  const ACT_LABEL: Record<Entity["kind"], string> = { npc: "คุย", merchant: "คุย", crystal: "บันทึก", chest: "เปิดหีบ", sign: "อ่าน", enemy: "สู้" };
  function refreshTarget() {
    target = busy ? null : interactTarget(map(), save, pos.x, pos.y, dir, walkers);
    act.hidden = !target;
    if (target) act.textContent = ACT_LABEL[target.kind];
  }

  function interact() {
    // Re-check on the game side: the button may be stale after a move or a reload.
    const t = busy || move ? null : interactTarget(map(), save, pos.x, pos.y, dir, walkers);
    if (!t) return;
    if (t.kind === "enemy") return encounter(t);
    if (t.kind === "npc") return talkElaine();
    if (t.kind === "merchant") return kaelMenu();
    if (t.kind === "sign") return talk("ป้าย", t.text, [["ปิด", close]]);
    if (t.kind === "crystal")
      return talk("คริสตัลแห่งการบันทึก", "บันทึกการเดินทาง ฟื้นฟู HP/MP และตั้งจุดเริ่มใหม่ที่นี่?", [
        ["บันทึก", () => (commit(setCheckpoint(save, t.id), "บันทึกเกมแล้ว ✓ ฟื้นฟูเต็ม"), close())],
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

  // ---------- Kael: Talk / Buy / Sell / Leave (trade rules in trade.ts) ----------
  const KAEL_WHO = "Kael · นักล่าพเนจร";
  function kaelMenu(note = "มีอะไรให้ช่วยไหม นักผจญภัย?") {
    talk(KAEL_WHO, note, [
      ["Talk คุย", () => kaelTalk(0)],
      ["Buy ซื้อ", () => kaelShop("buy")],
      ["Sell ขาย", () => kaelShop("sell")],
      ["Leave ไปก่อน", close],
    ]);
  }
  function kaelTalk(page: number) {
    const last = page + 1 >= KAEL_TALK.length;
    talk(KAEL_WHO, `${KAEL_TALK[page]} (${page + 1}/${KAEL_TALK.length})`, [
      [last ? "กลับ" : "ต่อไป", () => (last ? kaelMenu() : kaelTalk(page + 1))],
      ["ไปก่อน", close],
    ]);
  }
  function kaelShop(side: "buy" | "sell", note = "") {
    const id = nextTradeId(save); // fixed when the page is drawn, so a repeated confirm is refused
    const lines = TRADE_ITEMS.map((it) => {
      const p = KAEL_PRICES[it]!;
      return side === "buy"
        ? `${ITEMS[it].name} ${p.heroBuys} G · Kael มี ${save.trade.kael[it] ?? 0}`
        : `${ITEMS[it].name} ${p.heroSells} G · คุณมี ${save.items[it]}`;
    });
    const deal = (it: ItemId): [string, () => void] => [
      `${side === "buy" ? "ซื้อ" : "ขาย"} ${ITEMS[it].name} ×1`,
      () => {
        const r: Trade = side === "buy" ? merchantBuy(save, it, 1, id) : merchantSell(save, it, 1, id);
        if (!r.ok) return kaelShop(side, r.why);
        const price = KAEL_PRICES[it]!;
        commit(r.save, side === "buy" ? `ซื้อ ${ITEMS[it].name} ×1 · −${price.heroBuys} G` : `ขาย ${ITEMS[it].name} ×1 · +${price.heroSells} G`);
        kaelShop(side, "ขอบใจ!");
        // The fresh page's trade buttons wait a moment, so a double tap on "buy" is still one trade.
        const deals = [...panel.querySelectorAll<HTMLButtonElement>(".row button")].slice(0, -1);
        deals.forEach((b) => (b.disabled = true));
        setTimeout(() => !panel.dataset.done && deals.forEach((b) => (b.disabled = false)), 400);
      },
    ];
    talk(KAEL_WHO, `${note ? `${note} · ` : ""}${lines.join(" · ")} · Gold ${save.gold}`, [...TRADE_ITEMS.map(deal), ["กลับ", () => kaelMenu()]]);
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
    const st = heroStatsOf(save);
    const need = LEVEL_EXP[save.hero.level];
    const lv = `Lv.${save.hero.level} · EXP ${save.hero.exp}${need === undefined ? " (สูงสุด)" : `/${need}`} · ${STAT_IDS.map((k) => `${STAT_LABEL[k]} ${st[k]}`).join(" ")}`;
    talk("เมนู", `${lv} · ${questLine(save)} · ${save.gold} Gold · ${bag.join(" · ") || "ไม่มีไอเทม"}`, [
      ["กลับเกม", close],
      ["กลับหน้าแรก", () => {
        commit(save, "บันทึกตำแหน่งแล้ว");
        leave();
        toTitle();
      }],
    ]);
  }

  // ---------- encounter ----------
  function encounter(e: Extract<Entity, { kind: "enemy" }>) {
    if (busy) return;
    busy = true;
    held = null;
    leave();
    const here = withPos(save);
    duel(here, e.id, e.enemy, map().name, (b) => {
      if (b.over === "win") {
        // Merge the battle's HP/MP/items first so the victory's loot lands on top of them.
        const next: SaveData = { ...recordVictory({ ...here, hero: { ...here.hero, hp: b.hero.hp, mp: b.hero.mp }, items: b.items }, e.id), savedAt: Date.now() };
        const ok = writeSave(store, next);
        const loot = lootOf(e.enemy, e.id);
        const got = loot ? ` · +${loot.gold} Gold · ${ITEMS[loot.item].name} ×1` : "";
        const up = next.hero.level > here.hero.level ? ` · เลเวลอัป! Lv.${next.hero.level} (${levelGains(here, next)})` : "";
        return explore(next, toTitle, `ชนะ ${ENEMIES[e.enemy].name} · +${next.hero.exp - here.hero.exp} EXP${got}${up}${ok ? "" : " · บันทึกไม่ได้"}`);
      }
      // Loss: back to the last checkpoint at full strength; the pre-battle save is otherwise kept.
      const c = CHECKPOINTS[here.progress.checkpoint];
      const s = heroStatsOf(here);
      const next: SaveData = {
        ...here,
        hero: { ...here.hero, hp: s.maxHp, mp: s.maxMp },
        progress: { ...here.progress, map: c.map, x: c.x, y: c.y },
        savedAt: Date.now(),
      };
      writeSave(store, next);
      explore(next, toTitle, "พ่ายแพ้ · ฟื้นคืนที่จุดเซฟล่าสุด");
    });
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
  let vw = 1; // view size in art pixels
  let vh = 1;
  function resize() {
    const r = main.getBoundingClientRect();
    // Whole device pixels per art pixel, capped at 6 so the art stays fine-grained on big screens.
    const dpr = devicePixelRatio || 1;
    scale = Math.max(1, Math.min(6, Math.floor(Math.min((r.width * dpr) / (14 * TILE), (r.height * dpr) / (10 * TILE))))) / dpr;
    vw = Math.ceil(r.width / scale);
    vh = Math.ceil(r.height / scale);
    crisp(canvas, vw, vh, scale);
  }
  addEventListener("resize", resize, on);

  type Sheet = { side: HTMLCanvasElement; fb: HTMLCanvasElement };
  let sheets: (Art & { hero: Sheet; elaine: Sheet; kael: Sheet }) | null = null;
  const sheet = (look: Look, classId: ClassId) => Promise.all([composite(look, classId), compositeFB(look)]).then(([side, fb]) => ({ side, fb }));
  Promise.all([sheet(save.hero.look, save.hero.classId), sheet(ELAINE, "ranger"), sheet(KAEL_LOOK, "ranger"), loadArt()])
    .then(([hero, elaine, kael, a]) => (sheets = { ...a, hero, elaine, kael }))
    .catch(() => toast("โหลดภาพแผนที่ไม่สำเร็จ"));

  function frame(now: number) {
    if (life.signal.aborted) return;
    if (!main.isConnected) return leave();
    if (move && now - move.t0 >= MOVE_MS) arrive();
    if (!move && held && !busy) tryMove(held);
    stepKael(now);
    draw(now);
    requestAnimationFrame(frame);
  }

  // Tiles and cast shadows never change, so each map's ground is painted once.
  const grounds = new Map<string, HTMLCanvasElement>();
  function groundOf(id: keyof typeof MAPS): HTMLCanvasElement {
    const cached = grounds.get(id);
    if (cached) return cached;
    const m = MAPS[id];
    const c = h("canvas", { width: m.rows[0].length * TILE, height: m.rows.length * TILE });
    const g = c.getContext("2d")!;
    for (let y = 0; y < m.rows.length; y++)
      for (let x = 0; x < m.rows[0].length; x++) g.drawImage(sheets!.tiles, tileIndex(tileAt(m, x, y)!) * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
    // Cast shadows fall to the lower right (sun from the upper left).
    g.globalAlpha = 0.3;
    g.fillStyle = "#1a0f1f";
    for (let y = 0; y < m.rows.length; y++)
      for (let x = 0; x < m.rows[0].length; x++)
        if (["tree", "forest_tree", "bush", "planter"].includes(tileAt(m, x, y)!)) {
          g.beginPath();
          g.ellipse(x * TILE + 11, y * TILE + 14, 7, 3, 0, 0, Math.PI * 2);
          g.fill();
        }
    for (const p of m.props ?? []) {
      const { cell } = PROP_ART[p.art];
      const [sx, sy, sw, sh] = cell < 0 ? [sheets!.buildings.width, 0, 48, 48] : [(cell % 10) * BUILDING_PX, Math.floor(cell / 10) * BUILDING_PX, BUILDING_PX, BUILDING_PX];
      g.drawImage(sheets!.shade, sx, sy, sw, sh, p.x * TILE + 6, p.y * TILE + 4, sw, sh);
    }
    grounds.set(id, c);
    return c;
  }

  // ---------- Kael's walk: one tile at a time along his loop, paused while anyone talks ----------
  function startWalk(now: number) {
    const e = map().entities.find((x) => x.kind === "merchant");
    walk = null;
    walkers = {};
    delete main.dataset.kael;
    if (e?.kind !== "merchant") return;
    const tiles = routeTiles(e.route);
    let i = Math.max(0, tiles.findIndex(([x, y]) => x === e.x && y === e.y));
    if (tiles[i][0] === pos.x && tiles[i][1] === pos.y) i = (i + 1) % tiles.length; // never spawn on the hero
    const corners = new Set(e.route.map(([x, y]) => tiles.findIndex(([tx, ty]) => tx === x && ty === y)));
    walk = { id: e.id, tiles, corners, i, from: tiles[i], t0: 0, next: now + KAEL_PAUSE_MS };
    walkers = { [e.id]: { x: tiles[i][0], y: tiles[i][1] } };
    main.dataset.kael = `${tiles[i][0]},${tiles[i][1]}`;
  }
  function stepKael(now: number) {
    if (!walk) return;
    if (busy) walk.next = Math.max(walk.next, now + KAEL_STEP_MS); // stops when spoken to, resumes after
    if (now < walk.next) return;
    const j = (walk.i + 1) % walk.tiles.length;
    const [x, y] = walk.tiles[j];
    // Never step into the hero (where it stands or is still leaving): wait a moment instead.
    if ((x === pos.x && y === pos.y) || (move && x === move.fx && y === move.fy)) return void (walk.next = now + 300);
    walk.from = walk.tiles[walk.i];
    walk.t0 = now;
    walk.i = j;
    walk.next = now + KAEL_STEP_MS + (walk.corners.has(j) ? KAEL_PAUSE_MS : 0);
    walkers = { [walk.id]: { x, y } };
    main.dataset.kael = `${x},${y}`;
    refreshTarget();
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
    const cx = cam(vw, W, hx);
    const cy = cam(vh, H, hy - TILE / 2);
    ctx.fillStyle = "#0b1426";
    ctx.fillRect(0, 0, vw, vh);
    const tile = (t: number, x: number, y: number) => ctx.drawImage(sheets!.tiles, t * TILE, 0, TILE, TILE, x * TILE - cx, y * TILE - cy, TILE, TILE);
    ctx.drawImage(groundOf(m.id), -cx, -cy);
    const lamps = LAMPS[m.id].filter(([x, y]) => (x + 3) * TILE > cx && (x - 2) * TILE < cx + vw && (y + 3) * TILE > cy && (y - 2) * TILE < cy + vh);

    const forest = m.id === "whispering_forest";
    const moving = !!move || (!!held && !busy);
    const anim = still() ? 0 : now;
    const sprites: { y: number; draw: () => void }[] = [];
    for (const p of m.props ?? []) {
      const { cell, foot } = PROP_ART[p.art];
      sprites.push({
        y: p.y + foot[3] + 0.5, // drawn after anyone standing on its roof rows, before anyone in front
        draw: () =>
          cell < 0
            ? ctx.drawImage(sheets!.fountain, p.x * TILE - cx, p.y * TILE - cy)
            : ctx.drawImage(sheets!.buildings, (cell % 10) * BUILDING_PX, Math.floor(cell / 10) * BUILDING_PX, BUILDING_PX, BUILDING_PX, p.x * TILE - cx, p.y * TILE - cy, BUILDING_PX, BUILDING_PX),
      });
    }
    for (const e of liveEntities(m, save, walkers)) {
      if (e.kind === "crystal") tile(tileIndex(tileAt(m, e.x, e.y)?.startsWith("plaza") ? "plaza_crystal" : "crystal"), e.x, e.y);
      if (e.kind === "sign") tile(tileIndex("sign"), e.x, e.y);
      if (e.kind === "chest") {
        const open = save.progress.claimed.includes(e.id);
        tile(tileIndex(forest ? (open ? "forest_chest_open" : "forest_chest") : open ? "chest_open" : "chest"), e.x, e.y);
      }
      if (e.kind === "npc")
        sprites.push({ y: e.y, draw: () => person(sheets!.elaine, "idle", Math.floor(anim / 160), (e.x + 0.5) * TILE - cx, (e.y + 1) * TILE - cy, hx < (e.x + 0.5) * TILE) }); // faces the hero
      if (e.kind === "merchant" && walk) {
        const k = Math.min(1, (now - walk.t0) / KAEL_STEP_MS);
        const [fx, fy] = walk.from;
        const kx = (fx + (e.x - fx) * k + 0.5) * TILE;
        const ky = (fy + (e.y - fy) * k + 1) * TILE;
        const walking = k < 1 && !busy;
        sprites.push({
          y: k < 1 ? Math.max(fy, e.y) : e.y,
          draw: () => {
            const view = walking && fx === e.x ? (e.y < fy ? "up" : "down") : "side";
            person(sheets!.kael, walking ? "run" : "idle", Math.floor(anim / (walking ? 110 : 160)), kx - cx, ky - cy, walking ? e.x < fx : hx < kx, view);
          },
        });
      }
      if (e.kind === "enemy")
        sprites.push({
          y: e.y,
          draw: () => ctx.drawImage(sheets!.wolf, (Math.floor(anim / 420) % 2) * 32, 0, 32, 24, (e.x + 0.5) * TILE - 16 - cx, (e.y + 1) * TILE - 23 - cy, 32, 24),
        });
    }
    sprites.push({
      y: move ? Math.max(pos.y, move.fy) : pos.y,
      draw: () => person(sheets!.hero, moving ? "run" : "idle", Math.floor(anim / (moving ? 90 : 140)), hx - cx, hy - cy, facing === "left", dir === "up" || dir === "down" ? dir : "side"),
    });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());

    if (settings.lighting) light(now, m.id, cx, cy, lamps, hx - cx, hy - cy);

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

  // HD-2D style light over the finished pixel art, composited by the browser rather than in
  // the canvas so phones stay fast: a CSS multiply layer (.world-shade: sky-to-ground grade and
  // vignette) and this art-resolution screen layer stretched smoothly over the map (lamp,
  // crystal and fountain glow, drifting sun shafts, dust). Purely cosmetic; reduced motion freezes it.
  function light(now: number, id: keyof typeof MOOD, cx: number, cy: number, lamps: [number, number][], hx: number, hy: number) {
    const mood = MOOD[id];
    const t = still() ? 0 : now / 1000;
    if (glowLayer.width !== vw || glowLayer.height !== vh) {
      glowLayer.width = vw;
      glowLayer.height = vh;
    }
    glowLayer.style.width = canvas.style.width;
    glowLayer.style.height = canvas.style.height;
    const g = glowLayer.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, vw, vh);
    g.globalCompositeOperation = "lighter";
    const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const [x, y] of lamps) {
      const flicker = 0.85 + 0.15 * Math.sin(t * 9 + x * 3.1 + y) * Math.sin(t * 5.3 + y);
      glow((x + 0.5) * TILE - cx, y * TILE - cy + 3, 34, "255,170,80", 0.55 * flicker);
      glow((x + 0.5) * TILE - cx, y * TILE - cy + 3, 9, "255,240,190", 0.8 * flicker);
    }
    for (const e of liveEntities(map(), save))
      if (e.kind === "crystal") glow((e.x + 0.5) * TILE - cx, e.y * TILE - cy + 6, 26, "120,200,255", 0.45 + 0.1 * Math.sin(t * 2));
    for (const p of map().props ?? [])
      if (p.art === "fountain") glow(p.x * TILE - cx + 24, p.y * TILE - cy + 26, 30, "170,230,255", 0.3 + 0.06 * Math.sin(t * 3));
    glow(hx, hy - 12, 40, "255,230,190", 0.12); // soft key light on the hero

    // Sun shafts: wide diagonal bands sliding slowly across the view.
    g.translate(vw / 2, vh / 2);
    g.rotate(-0.6);
    const span = Math.hypot(vw, vh);
    for (let i = 0; i < 4; i++) {
      const x = (((i * 0.31 + t * 0.006) % 1.2) - 0.6) * span;
      const w = span * (0.05 + 0.03 * (i % 2));
      const band = g.createLinearGradient(x - w, 0, x + w, 0);
      band.addColorStop(0, `rgba(${mood.rays},0)`);
      band.addColorStop(0.5, `rgba(${mood.rays},${0.17 + 0.05 * Math.sin(t * 0.7 + i)})`);
      band.addColorStop(1, `rgba(${mood.rays},0)`);
      g.fillStyle = band;
      g.fillRect(x - w, -span, w * 2, span * 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    // Dust motes drifting on the breeze; they wrap around the view.
    g.fillStyle = `rgb(${mood.rays})`;
    for (let i = 0; i < 28; i++) {
      const a = 0.25 + 0.3 * Math.sin(t * 1.3 + i);
      if (a <= 0.05) continue;
      const x = (i * 53.7 + t * (3 + (i % 5)) - cx * 0.2) % vw;
      const y = (i * 31.3 + Math.sin(t * 0.8 + i) * 6 - cy * 0.2) % vh;
      g.globalAlpha = a;
      g.fillRect(Math.round(x < 0 ? x + vw : x), Math.round(y < 0 ? y + vh : y), 1, 1);
    }
    g.globalAlpha = 1;

  }

  function person(sheet: Sheet, a: keyof typeof ANIMS, f: number, fx: number, fy: number, flip: boolean, view: "side" | "up" | "down" = "side") {
    const { row, frames } = ANIMS[a];
    ctx.save();
    ctx.translate(Math.round(fx), Math.round(fy));
    ctx.fillStyle = "rgba(26,15,31,0.35)";
    ctx.beginPath();
    ctx.ellipse(2, -2, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (view !== "side") {
      // 4-frame walk at a steadier pace than the 8-frame side run; idle stands on frame 1.
      const ff = a === "run" ? Math.floor(performance.now() / 130) % FB.frames : 1;
      ctx.drawImage(sheet.fb, ff * FB.w, (view === "up" ? 1 : 0) * FB.h, FB.w, FB.h, -FB.foot.x, -FB.foot.y - 3, FB.w, FB.h);
      return ctx.restore();
    }
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet.side, (f % frames) * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, -HERO_FOOT.x, -HERO_FOOT.y - 2, FRAME_W, FRAME_H);
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
  startWalk(performance.now());
  show(main);
  resize();
  hud();
  refreshTarget();
  if (notice) toast(notice);
  (act.hidden ? main.querySelector<HTMLElement>(".menu-btn") : act)?.focus({ preventScroll: true });
  requestAnimationFrame(frame);
}
