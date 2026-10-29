// Journey screens: set out (start area + difficulty), pick the next event from cards, a victory
// summary after each fight, and a run summary when the journey ends. Every game rule lives in
// route.ts and every committed change goes through commit() so it is saved atomically.
import { DIFFICULTIES, DIFFICULTY_IDS, ENEMIES, ITEMS, LEVEL_EXP, STAT_IDS, STAT_LABEL, type DifficultyId, type ItemId } from "./data";
import { duel } from "./duel";
import { effectiveStats } from "./hero";
import { choices, recordVictory, restartRun, rewardOf, ROUTE, ROUTE_ROWS, runSummary, startRun, visit, type NodeKind } from "./route";
import { writeSave, type SaveData } from "./save";
import { KAEL_PRICES, KAEL_TALK, merchantBuy, merchantSell, nextTradeId, TRADE_ITEMS, type Trade } from "./trade";
import { button, fitSprites, h, heroSprite, show, store } from "./ui";

const heroStatsOf = (s: SaveData) => effectiveStats(s.hero.classId, s.hero.talentId, s.hero.level);
/** "MaxHP +16 · ATK +2 …" for the stats that rose between two saves. */
const levelGains = (a: SaveData, b: SaveData) => {
  const [x, y] = [heroStatsOf(a), heroStatsOf(b)];
  return STAT_IDS.filter((k) => y[k] > x[k]).map((k) => `${STAT_LABEL[k]} +${y[k] - x[k]}`).join(" · ");
};
const pct = (n: number) => `x${(n / 100).toFixed(2).replace(/\.?0+$/, "")}`;

/** Start areas: only the forest exists so far; the rest stay hidden. */
const AREAS = ["ป่ากระซิบ", ...Array<string>(9).fill("???")];

/** Card copy per event kind (PLACEHOLDER text and star ratings, owner reference layout). */
const EVENT: Record<NodeKind, { icon: string; title: string; type: string; text: string; danger: number; reward: number; gives: string }> = {
  battle: { icon: "⚔", title: "เสียงหอนในพุ่มไม้", type: "การต่อสู้", text: "Forest Wolf ดักซุ่มอยู่ข้างทาง", danger: 2, reward: 2, gives: "Gold, Wolf Pelt, EXP" },
  chest: { icon: "◆", title: "หีบที่ถูกลืม", type: "หีบสมบัติ", text: "หีบเก่าใต้รากไม้ ไม่มีใครเฝ้า", danger: 0, reward: 3, gives: "" },
  rest: { icon: "✚", title: "กองไฟเงียบสงบ", type: "จุดพัก", text: "กองไฟเล็กๆ ที่ไม่มีอะไรกล้าตามมา", danger: 0, reward: 2, gives: "ฟื้น HP/MP เต็ม" },
  shop: { icon: "$", title: "Kael นักล่าพเนจร", type: "พ่อค้า", text: "นักล่าพเนจรตั้งแผงขายของริมทาง", danger: 0, reward: 2, gives: "ซื้อขาย Wolf Pelt" },
  boss: { icon: "☠", title: "ผู้พิทักษ์โบราณ", type: "บอส", text: "Ancient Guardian ขวางทางออกจากป่า", danger: 5, reward: 5, gives: "EXP มาก และผ่านการเดินทาง" },
};
const stars = (n: number, cls: string) =>
  h("span", { class: `stars ${cls}`, aria: { label: `${n}/5` } }, ...Array.from({ length: 5 }, (_, i) => h("i", { class: i < n ? "on" : "" }, "★")));

type Opening = { notice?: string; win?: { before: SaveData; id: string }; ended?: SaveData };

export function journey(start: SaveData, toTitle: (notice?: string) => void, open: Opening = {}) {
  let save = start;
  let busy = false; // a dialog or battle owns input
  let pickDiff: DifficultyId = save.progress.diff;
  /** Setting out shows until the hero departs; a journey in progress opens on its route cards. */
  let departed = save.progress.path.length > 0;
  let esc: () => void = () => void 0;
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
  const body = h("div", { class: "journey-body" });
  const panel = h("section", { class: "talk", hidden: true, role: "dialog", aria: { modal: "true", labelledby: "talk-who" } });
  const main = h(
    "main",
    { class: "screen journey", aria: { label: "การเดินทาง" } },
    h(
      "header",
      { class: "hud" },
      h("div", {}, status, where),
      button("☰", () => menu(), { class: "menu-btn", aria: { label: "เมนู", keyshortcuts: "Escape" } }),
    ),
    body,
    toastEl,
    panel,
  );

  function draw() {
    const s = heroStatsOf(save);
    status.textContent = `${save.hero.name} Lv.${save.hero.level} · HP ${save.hero.hp}/${s.maxHp} · MP ${save.hero.mp}/${s.maxMp} · ${save.gold} G`;
    const step = save.progress.path.length;
    where.textContent = departed ? `${DIFFICULTIES[save.progress.diff].name} · ก้าวที่ ${step}/${ROUTE_ROWS}` : "เตรียมออกเดินทาง";
    main.dataset.node = save.progress.path.at(-1) ?? "start";
    body.inert = busy;
    body.replaceChildren(departed ? choose() : setup());
    fitSprites();
  }
  let toastTimer = 0;
  function toast(msg: string) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("on", !!msg);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), Math.max(2600, msg.length * 60)); // long lines need time to read
  }

  // ---------- set out: start area + difficulty ----------
  function setup() {
    const areas = h(
      "div",
      { class: "areas", role: "group", aria: { label: "เริ่มต้นที่" } },
      ...AREAS.map((a, i) => button(a, () => void 0, { class: i === 0 ? "on" : "", disabled: i > 0, aria: { pressed: i === 0 ? "true" : "false" } })),
    );
    const cards = DIFFICULTY_IDS.map((id) => {
      const d = DIFFICULTIES[id];
      const locked = save.progress.wins < d.needWins;
      const rows: [string, string][] = [
        ["HP ศัตรู", pct(d.hp)],
        ["พลังของศัตรู", pct(d.power)],
        ["ช่วงป้องกัน", `${d.guard}%`],
        ["รางวัล", pct(d.reward)],
      ];
      const b = button("", () => ((pickDiff = id), draw()), {
        class: `diff ${id}${id === pickDiff ? " on" : ""}`,
        disabled: locked,
        aria: { pressed: id === pickDiff ? "true" : "false" },
      });
      b.append(
        h("span", { class: "crowns", aria: { hidden: "true" } }, "♛".repeat(d.crowns)),
        h("b", {}, d.name),
        h("dl", {}, ...rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
        h("small", {}, locked ? `ปลดล็อกเมื่อผ่าน ${d.needWins} ครั้ง` : id === pickDiff ? "เลือกแล้ว" : "แตะเพื่อเลือก"),
      );
      return b;
    });
    return h(
      "section",
      { class: "setup" },
      h("h2", {}, "การเดินทาง"),
      h("p", { class: "label" }, "เริ่มต้นที่"),
      areas,
      h("p", { class: "label" }, "เลือกความยาก"),
      h("div", { class: "diffs" }, ...cards),
      h(
        "div",
        { class: "row setup-foot" },
        button("กลับ", () => (leave(), toTitle())),
        h("span", { class: "meta" }, `${DIFFICULTIES[pickDiff].name} · ${AREAS[0]}`),
        button("ออกเดินทาง!", depart, { class: "primary" }),
      ),
    );
  }
  function depart() {
    const next = startRun(save, pickDiff);
    if (!next) return toast("ยังเลือกความยากนี้ไม่ได้");
    departed = true;
    commit(next, `ออกเดินทาง · ${DIFFICULTIES[pickDiff].name}`);
  }

  // ---------- route: pick one of the next events ----------
  function choose() {
    const opts = choices(save);
    const step = save.progress.path.length;
    const bar = h(
      "div",
      { class: "progress", role: "img", aria: { label: `ก้าวที่ ${step}/${ROUTE_ROWS}` } },
      h("b", {}, "การเดินทาง"),
      h("span", {}, `${step}/${ROUTE_ROWS}`),
      h("span", { class: "pips" }, ...Array.from({ length: ROUTE_ROWS }, (_, i) => h("i", { class: i < step ? "on" : "" }))),
      h("small", {}, "เป้าหมาย: ปราบบอสท้ายป่า"),
    );
    const cards = opts.map((id) => {
      const n = ROUTE[id];
      const e = EVENT[n.kind];
      const gives = n.kind === "chest" ? Object.entries(n.loot ?? {}).map(([k, q]) => `${ITEMS[k as ItemId].name} ×${q}`).join(", ") : e.gives;
      const danger = n.enemy ? Math.min(5, e.danger + DIFFICULTIES[save.progress.diff].crowns - 1) : e.danger;
      const b = button("", () => pick(id), { class: `event ${n.kind}`, aria: { label: `${e.title} · ${e.type}` } });
      b.dataset.node = id;
      b.append(
        h("span", { class: "scene", aria: { hidden: "true" } }, heroSprite(save.hero.look, save.hero.classId, ""), h("span", { class: "glyph" }, e.icon)),
        h("span", { class: "what" }, h("b", {}, e.title), h("small", {}, n.enemy ? `${e.type} · ${ENEMIES[n.enemy].name}` : e.type), h("span", {}, e.text)),
        h("span", { class: "rate" }, h("span", {}, "อันตราย"), stars(danger, "danger"), h("span", {}, "รางวัล"), stars(e.reward, "reward"), h("small", {}, gives)),
      );
      return b;
    });
    return h("section", { class: "choose" }, bar, h("div", { class: "events" }, ...cards));
  }

  let pickedAt = -Infinity;
  function pick(id: string) {
    if (busy || !choices(save).includes(id) || performance.now() - pickedAt < 400) return; // a double tap must not also pick the card drawn under it
    pickedAt = performance.now();
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

  // ---------- summaries ----------
  function victory(before: SaveData, id: string) {
    const r = rewardOf(before, id);
    const lines = [`+${r.gold} Gold`, `+${r.exp} EXP`, ...(r.item ? [`${ITEMS[r.item].name} ×1`] : [])];
    if (save.hero.level > before.hero.level) lines.push(`เลเวลอัป! Lv.${save.hero.level} (${levelGains(before, save)})`);
    talk("ชัยชนะ!", "", [["ดำเนินต่อ", () => (save.progress.path.at(-1) === "boss" ? ended(save) : close())]], lines);
  }
  /** End of a journey (boss beaten or a lost fight): what it earned, then back to setting out. */
  function ended(run: SaveData) {
    const r = runSummary(run);
    const found = Object.entries(r.found).map(([k, q]) => `${ITEMS[k as ItemId].name} ×${q}`);
    talk(r.cleared ? "ผ่านการเดินทาง!" : "กลับสู่จุดเริ่ม", r.cleared ? `${run.hero.name} ปราบผู้พิทักษ์โบราณได้แล้ว` : `${run.hero.name} ถอยกลับมาตั้งหลัก`, [
      ["กลับไปเตรียมตัว", () => {
        if (save.progress.path.length) commit(restartRun(save), "เริ่มการเดินทางใหม่");
        departed = false;
        close();
      }],
    ], [
      `ระดับความยาก: ${DIFFICULTIES[run.progress.diff].name}`,
      `ด่านที่ผ่าน: ${r.cleared ? 1 : 0} / 1`,
      `การต่อสู้: ${r.fights}`,
      `Gold: +${r.gold}`,
      `EXP: +${r.exp}`,
      `ของที่พบ: ${found.join(", ") || "ไม่มี"}`,
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
  function talk(who: string, text: string, opts: [string, () => void][], list: string[] = []) {
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
    panel.replaceChildren(
      h("h2", { id: "talk-who" }, who),
      ...(text ? [h("p", {}, text)] : []),
      ...(list.length ? [h("ul", { class: "tally" }, ...list.map((l) => h("li", {}, l)))] : []),
      h("div", { class: "row" }, ...buttons),
    );
    panel.hidden = false;
    body.inert = true;
    esc = () => buttons.at(-1)?.click();
    buttons[0]?.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    busy = false;
    draw();
    body.querySelector<HTMLElement>(".event, .diff.on")?.focus({ preventScroll: true });
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
        if (save.progress.path.length) commit(save, "บันทึกแล้ว");
        leave();
        toTitle();
      }],
    ]);
    esc = close;
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
        return journey(next, toTitle, { win: { before, id }, notice: ok ? "" : "บันทึกไม่ได้" });
      }
      // Loss: the journey starts over at full strength; level, items and Gold stay.
      const next: SaveData = { ...restartRun({ ...before, items: b.items }), savedAt: Date.now() };
      writeSave(store, next);
      journey(next, toTitle, { ended: before });
    });
  }

  addEventListener("keydown", (e) => e.key === "Escape" && (busy && !panel.hidden ? esc() : menu()), { signal: life.signal });
  function leave() {
    life.abort();
  }

  show(main);
  draw();
  if (open.notice) toast(open.notice);
  if (open.win) victory(open.win.before, open.win.id);
  else if (open.ended) ended(open.ended);
  else body.querySelector<HTMLElement>(".event, .diff.on")?.focus({ preventScroll: true });
}
