// Route screen: the hero picks the next node on a branching map. Every game rule lives in
// route.ts and every committed change goes through commit() so it is saved atomically.
import { ENEMIES, ITEMS, LEVEL_EXP, STAT_IDS, STAT_LABEL, type ItemId } from "./data";
import { duel } from "./duel";
import { effectiveStats } from "./hero";
import { choices, here, lootOf, NODE_LABEL, recordVictory, restartRun, ROUTE, ROUTE_ROWS, visit, type NodeKind } from "./route";
import { writeSave, type SaveData } from "./save";
import { KAEL_PRICES, KAEL_TALK, merchantBuy, merchantSell, nextTradeId, TRADE_ITEMS, type Trade } from "./trade";
import { button, h, show, store } from "./ui";

const ICON: Record<NodeKind, string> = { battle: "⚔", chest: "◆", rest: "✚", shop: "$", boss: "☠" };
const heroStatsOf = (s: SaveData) => effectiveStats(s.hero.classId, s.hero.talentId, s.hero.level);
/** "MaxHP +16 · ATK +2 …" for the stats that rose between two saves. */
const levelGains = (a: SaveData, b: SaveData) => {
  const [x, y] = [heroStatsOf(a), heroStatsOf(b)];
  return STAT_IDS.filter((k) => y[k] > x[k]).map((k) => `${STAT_LABEL[k]} +${y[k] - x[k]}`).join(" · ");
};
const SVG = "http://www.w3.org/2000/svg";

export function journey(start: SaveData, toTitle: (notice?: string) => void, notice = "") {
  let save = start;
  let busy = false; // a dialog or battle owns input
  const life = new AbortController();

  /** Saves a committed state. The in-memory state advances even if storage fails. */
  const commit = (next: SaveData, msg: string) => {
    save = { ...next, savedAt: Date.now() };
    toast(writeSave(store, save) ? msg : `${msg} · บันทึกไม่ได้ในเบราว์เซอร์นี้`);
    draw();
  };

  // ---------- DOM ----------
  const status = h("div", { class: "hud-stats" });
  const where = h("p", { class: "hud-quest" });
  const toastEl = h("p", { class: "toast", role: "status" });
  const lines = document.createElementNS(SVG, "svg");
  lines.setAttribute("class", "route-lines");
  lines.setAttribute("viewBox", `0 0 300 ${ROUTE_ROWS * 100}`);
  lines.setAttribute("preserveAspectRatio", "none");
  lines.setAttribute("aria-hidden", "true");
  const grid = h("ol", { class: "route", aria: { label: "เส้นทาง" } });
  const panel = h("section", { class: "talk", hidden: true, role: "dialog", aria: { modal: "true", labelledby: "talk-who" } });
  const main = h(
    "main",
    { class: "screen journey", aria: { label: "เส้นทางผจญภัย" } },
    h(
      "header",
      { class: "hud" },
      h("div", {}, status, where),
      button("☰", () => menu(), { class: "menu-btn", aria: { label: "เมนู", keyshortcuts: "Escape" } }),
    ),
    h("div", { class: "route-wrap" }, lines, grid),
    toastEl,
    panel,
  );

  // Rows top (boss) to bottom (start) so the journey climbs the screen.
  const nodeBtn = new Map<string, HTMLButtonElement>();
  for (let row = ROUTE_ROWS; row >= 1; row--) {
    const li = h("li", { class: "route-row" });
    for (const [id, n] of Object.entries(ROUTE).filter(([, n]) => n.row === row)) {
      const b = button(`${ICON[n.kind]}`, () => pick(id), { class: `node ${n.kind}`, aria: { label: NODE_LABEL[n.kind] } });
      b.style.gridColumn = String(n.col + 1);
      b.dataset.node = id;
      b.append(h("small", {}, n.enemy ? ENEMIES[n.enemy].name : NODE_LABEL[n.kind]));
      nodeBtn.set(id, b);
      li.append(b);
    }
    grid.append(li);
  }
  const at = (id: string) => [(ROUTE[id].col + 0.5) * 100, (ROUTE_ROWS - ROUTE[id].row + 0.5) * 100] as const;
  for (const [id, n] of Object.entries(ROUTE))
    for (const to of n.next) {
      const [[x1, y1], [x2, y2]] = [at(id), at(to)];
      const l = document.createElementNS(SVG, "line");
      Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, String(v)));
      l.dataset.edge = `${id}>${to}`;
      lines.append(l);
    }

  function draw() {
    const s = heroStatsOf(save);
    status.textContent = `${save.hero.name} Lv.${save.hero.level} · HP ${save.hero.hp}/${s.maxHp} · MP ${save.hero.mp}/${s.maxMp} · ${save.gold} G`;
    const open = choices(save);
    const done = new Set(save.progress.path);
    const cur = here(save);
    where.textContent = cur === "boss" ? "ผ่านการเดินทางแล้ว!" : open.length ? "เลือกเส้นทางต่อไป" : "";
    for (const [id, b] of nodeBtn) {
      b.disabled = busy || !open.includes(id);
      b.classList.toggle("done", done.has(id));
      b.classList.toggle("here", id === cur);
      b.classList.toggle("open", open.includes(id));
    }
    for (const l of lines.children as HTMLCollectionOf<SVGLineElement>) {
      const [a, z] = l.dataset.edge!.split(">");
      l.classList.toggle("taken", done.has(a) && done.has(z));
      l.classList.toggle("open", a === cur && open.includes(z));
    }
    main.dataset.node = cur ?? "start";
    if (cur === "boss" && !busy) finale();
  }
  let toastTimer = 0;
  function toast(msg: string) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("on", !!msg);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), Math.max(2600, msg.length * 60)); // long level-up lines need time to read
  }

  function pick(id: string) {
    if (busy || !choices(save).includes(id)) return;
    const n = ROUTE[id];
    if (n.enemy) return fight(id);
    const next = visit(save, id)!;
    if (n.kind === "rest") commit(next, "พักผ่อน · ฟื้นฟู HP/MP เต็ม");
    if (n.kind === "chest")
      commit(next, `ได้รับ ${Object.entries(n.loot ?? {}).map(([k, q]) => `${ITEMS[k as ItemId].name} ×${q}`).join(" · ")}`);
    if (n.kind === "shop") {
      commit(next, "พบ Kael นักล่าพเนจร");
      kaelMenu();
    }
  }

  function finale() {
    talk("ผ่านการเดินทาง", `${save.hero.name} ปราบ Ancient Guardian ได้แล้ว! (ครั้งที่ ${save.progress.wins}) ออกเดินทางรอบใหม่ได้ เลเวล ไอเทม และ Gold ติดตัวไปด้วย`, [
      ["ออกเดินทางใหม่", () => (commit(restartRun(save), "เริ่มการเดินทางใหม่"), close())],
      ["กลับหน้าแรก", () => (leave(), toTitle())],
    ]);
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
    const rows = TRADE_ITEMS.map((it) => {
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
    talk(KAEL_WHO, `${note ? `${note} · ` : ""}${rows.join(" · ")} · Gold ${save.gold}`, [...TRADE_ITEMS.map(deal), ["กลับ", () => kaelMenu()]]);
  }

  /** Bounded dialog panel; each choice runs once (buttons disable on first press). */
  function talk(who: string, text: string, opts: [string, () => void][]) {
    busy = true;
    const buttons = opts.map(([label, fn], i) =>
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
    grid.inert = true;
    draw();
    buttons[0]?.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    grid.inert = false;
    busy = false;
    draw();
    grid.querySelector<HTMLElement>(".node.open")?.focus({ preventScroll: true });
  }

  function menu() {
    if (busy) return;
    const bag = (Object.keys(ITEMS) as ItemId[]).filter((k) => save.items[k]).map((k) => `${ITEMS[k].name} ×${save.items[k]}`);
    const st = heroStatsOf(save);
    const need = LEVEL_EXP[save.hero.level];
    const lv = `Lv.${save.hero.level} · EXP ${save.hero.exp}${need === undefined ? " (สูงสุด)" : `/${need}`} · ${STAT_IDS.map((k) => `${STAT_LABEL[k]} ${st[k]}`).join(" ")}`;
    talk("เมนู", `${lv} · ${save.gold} Gold · ${bag.join(" · ") || "ไม่มีไอเทม"}`, [
      ["กลับเกม", close],
      ["กลับหน้าแรก", () => {
        commit(save, "บันทึกแล้ว");
        leave();
        toTitle();
      }],
    ]);
  }

  // ---------- battle ----------
  function fight(id: string) {
    const enemy = ROUTE[id].enemy!;
    busy = true;
    leave();
    const before = save;
    duel(before, id, enemy, "Whispering Forest", (b) => {
      if (b.over === "win") {
        // Merge the battle's HP/MP/items first so the victory's loot lands on top of them.
        const next: SaveData = { ...recordVictory({ ...before, hero: { ...before.hero, hp: b.hero.hp, mp: b.hero.mp }, items: b.items }, id), savedAt: Date.now() };
        const ok = writeSave(store, next);
        const loot = lootOf(enemy, id);
        const got = loot ? ` · +${loot.gold} Gold · ${ITEMS[loot.item].name} ×1` : "";
        const up = next.hero.level > before.hero.level ? ` · เลเวลอัป! Lv.${next.hero.level} (${levelGains(before, next)})` : "";
        return journey(next, toTitle, `ชนะ ${ENEMIES[enemy].name} · +${next.hero.exp - before.hero.exp} EXP${got}${up}${ok ? "" : " · บันทึกไม่ได้"}`);
      }
      // Loss: the journey starts over at full strength; level, items and Gold stay.
      const next: SaveData = { ...restartRun(before), savedAt: Date.now() };
      writeSave(store, next);
      journey(next, toTitle, "พ่ายแพ้ · เริ่มการเดินทางใหม่");
    });
  }

  addEventListener("keydown", (e) => e.key === "Escape" && (busy && !panel.hidden ? close() : menu()), { signal: life.signal });
  function leave() {
    life.abort();
  }

  show(main);
  draw();
  if (notice) toast(notice);
  if (!busy) grid.querySelector<HTMLElement>(".node.open")?.focus({ preventScroll: true });
}
