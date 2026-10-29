// Journey screens: the town between journeys (gate, training hall, blacksmith), set out (start
// area + difficulty), pick the next event from cards, a victory summary after each fight, and a
// run summary when the journey ends. Game rules live in route.ts and town.ts, and every committed
// change goes through commit() so it is saved atomically.
import { ARMOR_IDS, ARMORS, CLASSES, DIFFICULTIES, DIFFICULTY_IDS, ENEMIES, HONE_MAX, HONE_PER, honeChance, honeCost, EGG_IDS, EGGS, FARM_TIERS, ITEMS, LEVEL_EXP, RARITY_ODDS, PET_IDS, PET_RARITIES, PET_RARITY, petBite, petLevel, PETS, RECIPES, STAT_IDS, STAT_LABEL, TRAIN, TRAIN_CAP, TRAIN_IDS, TRAIN_PICKS, WEAPON_TIERS, type DifficultyId, type EggId, type ItemId, type StatId } from "./data";
import { duel } from "./duel";
import { heroMax } from "./hero";
import { choices, recordVictory, restartRun, rewardOf, ROUTE, ROUTE_ROWS, runSummary, startRun, visit, type NodeKind } from "./route";
import { writeSave, type Pet, type SaveData } from "./save";
import { bring, canHatch, craft, forgeArmor, forgeWeapon, fuse, fusePartners, hatch, hatchAll, renamePet, slotsOf, toggleLock, upgradeFarm, hone, pointsLeft, release, resetTraining, train, wear, type Change } from "./town";
import { KAEL_PRICES, KAEL_TALK, merchantBuy, merchantSell, nextTradeId, TRADE_ITEMS, type Trade } from "./trade";
import { button, fitSprites, h, heroSprite, show, store } from "./ui";

const heroStatsOf = (s: SaveData) => heroMax(s.hero);
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

type View = "town" | "setup" | "train" | "smith" | "farm";
const VIEW_LABEL: Record<View, string> = { town: "เมือง · พักก่อนออกเดินทาง", setup: "เตรียมออกเดินทาง", train: "ลานฝึก", smith: "ช่างตีเหล็ก", farm: "ฟาร์ม" };

type Opening = { notice?: string; win?: { before: SaveData; id: string }; ended?: SaveData };

export function journey(start: SaveData, toTitle: (notice?: string) => void, open: Opening = {}) {
  let save = start;
  let busy = false; // a dialog or battle owns input
  let pickDiff: DifficultyId = save.progress.diff;
  /** The town shows until the hero departs; a journey in progress opens on its route cards. */
  let departed = save.progress.path.length > 0;
  let view: View = "town";
  let smithTab: "hone" | "armor" | "craft" = "hone";
  let farmTab: "yard" | "pets" | "eggs" | "upgrade" = "yard";
  let pickedPet = 0;
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
    where.textContent = departed ? `${DIFFICULTIES[save.progress.diff].name} · ก้าวที่ ${step}/${ROUTE_ROWS}` : VIEW_LABEL[view];
    main.dataset.node = save.progress.path.at(-1) ?? "start";
    body.inert = busy;
    main.dataset.view = departed ? "route" : view;
    body.replaceChildren(departed ? choose() : { town, setup, train: trainHall, smith: smithy, farm }[view]());
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
        button("กลับ", () => go("town")),
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

  // ---------- town: tap a building ----------
  function go(v: View) {
    view = v;
    draw();
    body.querySelector<HTMLElement>(".btn:not(:disabled)")?.focus({ preventScroll: true });
  }
  function town() {
    const left = pointsLeft(save);
    const spot = (img: string, name: string, sub: string, v: View) => {
      const b = button("", () => go(v), { class: `bldg ${img}`, aria: { label: name } });
      b.append(h("img", { src: `town/${img}.png`, alt: "" }), h("span", { class: "plaque" }, h("b", {}, name), h("small", {}, sub)));
      return b;
    };
    const el = h(
      "section",
      { class: "town" },
      h(
        "div",
        { class: "street" },
        spot("hall", "ลานฝึก", left ? `แต้มเหลือ ${left}` : "ฝึกค่าสถานะ", "train"),
        spot("gate", "ประตูเมือง", "ออกเดินทาง", "setup"),
        spot("smithy", "ช่างตีเหล็ก", `${CLASSES[save.hero.classId].weapon.thai} +${save.hero.hone}`, "smith"),
        spot("farm", "ฟาร์ม", `สัตว์เลี้ยง ${save.pets.list.length}/${slotsOf(save)}`, "farm"),
      ),
    );
    el.style.backgroundImage = 'url("town/backdrop.png")';
    return el;
  }
  /** Applies a town change, or says why it was refused. */
  function act(what: string, r: Change, msg: string) {
    if (doubled(what)) return;
    if (!r.ok) return toast(r.why);
    commit(r.save, msg);
  }
  /** Shared frame of the hall and the smithy: art and blurb on the side, tabs and rows beside. */
  function building(title: string, art: Node, blurb: string, ...content: Node[]) {
    return h(
      "section",
      { class: "building" },
      h("header", { class: "row" }, h("h2", {}, title), button("✕", () => go("town"), { class: "close", aria: { label: "กลับเมือง" } })),
      h("aside", {}, art, h("p", {}, blurb)),
      h("div", { class: "rows" }, ...content),
    );
  }
  function trainHall() {
    const left = pointsLeft(save);
    const rows = TRAIN_IDS.map((id) => {
      const t = TRAIN[id];
      const n = save.hero.train[id];
      const gain = (k: number) =>
        id === "focus" ? `หน้าต่างจังหวะ +${k * TRAIN.focus.window}%` : (Object.entries(t.stats) as [StatId, number][]).map(([st, per]) => `${STAT_LABEL[st]} +${per * k}`).join(" · ");
      return h(
        "div",
        { class: "trow" },
        h(
          "div",
          {},
          h("b", {}, t.name, TRAIN_PICKS[save.hero.classId].includes(id) ? h("span", { class: "tag rec" }, "แนะนำ") : ""),
          h("small", {}, t.text),
          h("span", { class: "meter" }, h("progress", { max: TRAIN_CAP, value: n }), `${n} / ${TRAIN_CAP}`),
          h("small", { class: n ? "gain" : "" }, n ? gain(n) : "ยังไม่มีแต้ม"),
          h("small", { class: "next" }, n >= TRAIN_CAP ? "ถึงขีดสูงสุดแล้ว" : `แต้มถัดไป: ${gain(1)}`),
        ),
        button("+", () => act(`train:${id}`, train(save, id), `${t.name} ${n + 1}/${TRAIN_CAP}`), {
          class: "plus",
          disabled: left < 1 || n >= TRAIN_CAP,
          aria: { label: `เพิ่ม ${t.name}` },
        }),
      );
    });
    const spent = save.hero.level - 1 - left;
    return building(
      "ลานฝึก",
      heroSprite(save.hero.look, save.hero.classId, save.hero.name),
      `${save.hero.name} · ${CLASSES[save.hero.classId].thai} Lv.${save.hero.level} ได้ 1 แต้มทุกครั้งที่เลเวลอัป ใช้แต้มเพื่อเพิ่มค่าสถานะ`,
      h(
        "div",
        { class: "points row" },
        h("b", {}, left ? `เหลือ ${left} แต้ม` : "ไม่มีแต้มเหลือ"),
        button("คืนแต้มทั้งหมด", () => act("reset", resetTraining(save), "คืนแต้มแล้ว"), { disabled: !spent }),
      ),
      ...rows,
    );
  }
  function smithy() {
    const weapon = CLASSES[save.hero.classId].weapon;
    const tabs = h(
      "div",
      { class: "tabs row", role: "group" },
      ...(["hone", "armor", "craft"] as const).map((t) =>
        button({ hone: "ตีบวก", armor: "ชุดเกราะ", craft: "หัตถกรรม" }[t], () => ((smithTab = t), draw()), { class: smithTab === t ? "on" : "", aria: { pressed: String(smithTab === t) } }),
      ),
    );
    const have = `มี ${save.gold} Gold · Wolf Pelt ×${save.items.wolf_pelt}`;
    let content: Node[];
    if (smithTab === "hone") {
      const lv = save.hero.hone;
      const c = honeCost(lv);
      const maxed = lv >= HONE_MAX;
      const tier = WEAPON_TIERS[save.hero.weapon];
      const next = WEAPON_TIERS[save.hero.weapon + 1];
      const chance = honeChance(lv);
      content = [
        h(
          "div",
          { class: `trow armor ${tier.rarity}` },
          h(
            "div",
            {},
            h("b", {}, `${weapon.name} ${weapon.thai}${tier.name} +${lv}`),
            h("small", { class: "gain" }, `ATK และ MAG +${lv * HONE_PER + tier.bonus} (ตีบวก +${lv * HONE_PER} · ขั้นอาวุธ +${tier.bonus})`),
            h("span", { class: "meter" }, h("progress", { max: HONE_MAX, value: lv }), `+${lv} / +${HONE_MAX}`),
            h("small", { class: "next" }, maxed ? "ตีบวกสูงสุดแล้ว" : `ตีบวก +${lv + 1}: ใช้ ${c.gold} Gold · Wolf Pelt ×${c.wolf_pelt} · โอกาสสำเร็จ ${chance}% (พลาดแล้วเสียวัตถุดิบ แต่ระดับไม่ลด)`),
          ),
          button(maxed ? "สูงสุด" : `ตีบวก +${lv + 1} · ${chance}%`, () => {
            if (doubled("hone")) return;
            const r = hone(save);
            if (!r.ok) return toast(r.why);
            commit(r.save, r.hit ? `${weapon.name} +${lv + 1}!` : `ตีบวกพลาด! ${weapon.name} ยังคง +${lv}`);
          }, {
            class: "primary",
            disabled: maxed || save.gold < c.gold || save.items.wolf_pelt < c.wolf_pelt,
          }),
        ),
        h("p", { class: "label" }, "หลอมอาวุธขั้นถัดไป"),
        ...WEAPON_TIERS.map((t, i) => {
          const owned = i <= save.hero.weapon;
          const isNext = t === next;
          return h(
            "div",
            { class: `trow armor ${t.rarity}${i === save.hero.weapon ? " with" : ""}` },
            h(
              "div",
              {},
              h("b", {}, `${weapon.thai}${t.name}`),
              h("small", { class: "rarity" }, `${RARITY_THAI(t.rarity)} · ATK และ MAG +${t.bonus}`),
              t.cost && !owned ? h("small", { class: "next" }, `ใช้ Wolf Pelt ×${t.cost.wolf_pelt} · ${t.cost.gold} Gold · ระดับตีบวกติดไปด้วย`) : "",
            ),
            owned
              ? h("small", { class: "gain" }, i === save.hero.weapon ? "ใช้อยู่" : "✓")
              : isNext && t.cost
                ? button("หลอม", () => act("weapon", forgeWeapon(save), `หลอม${weapon.thai}${t.name}แล้ว!`), {
                    class: "primary",
                    disabled: save.gold < t.cost.gold || save.items.wolf_pelt < t.cost.wolf_pelt,
                    aria: { label: `หลอม${weapon.thai}${t.name}` },
                  })
                : h("small", {}, "หลอมขั้นก่อนหน้าก่อน"),
          );
        }),
      ];
    } else if (smithTab === "armor")
      content = ARMOR_IDS.map((id) => {
        const a = ARMORS[id];
        const owned = save.hero.armors.includes(id);
        const worn = save.hero.armor === id;
        const stats = (Object.entries(a.stats) as [StatId, number][]).map(([st, n]) => `${STAT_LABEL[st]} +${n}`).join(" · ");
        const c = a.cost;
        return h(
          "div",
          { class: `trow armor ${a.rarity}${worn ? " with" : ""}` },
          h(
            "div",
            {},
            h("b", {}, a.name),
            h("small", { class: "rarity" }, `${RARITY_ODDS.find((r) => r.rarity === a.rarity)!.thai}${worn ? " · สวมใส่อยู่" : owned ? " · มีแล้ว" : ""}`),
            h("small", { class: "gain" }, stats),
            !owned && c && h("small", { class: "next" }, `หลอม: ${c.gold} Gold · Wolf Pelt ×${c.wolf_pelt}`),
          ),
          worn
            ? button("สวมอยู่", () => void 0, { disabled: true, aria: { label: `${a.name} สวมอยู่` } })
            : owned
              ? button("สวมใส่", () => act(`armor:${id}`, wear(save, id), `สวม ${a.name}`), { class: "primary", aria: { label: `สวม ${a.name}` } })
              : button("หลอม", () => act(`armor:${id}`, forgeArmor(save, id), `หลอม ${a.name} แล้ว`), {
                  disabled: !c || save.gold < c.gold || save.items.wolf_pelt < c.wolf_pelt,
                  aria: { label: `หลอม ${a.name}` },
                }),
        );
      });
    else
      content = (Object.entries(RECIPES) as [ItemId, { wolf_pelt: number; gold: number }][]).map(([it, r]) =>
        h(
          "div",
          { class: "trow" },
          h("div", {}, h("b", {}, ITEMS[it].name), h("small", {}, `ใช้ ${r.gold} Gold · Wolf Pelt ×${r.wolf_pelt}`), h("small", { class: "next" }, `มีอยู่ ${save.items[it]}`)),
          button("สร้าง", () => act(`craft:${it}`, craft(save, it), `สร้าง ${ITEMS[it].name} ×1`), {
            disabled: save.gold < r.gold || save.items.wolf_pelt < r.wolf_pelt,
            aria: { label: `สร้าง ${ITEMS[it].name}` },
          }),
        ),
      );
    return building(
      "ช่างตีเหล็ก",
      h("img", { src: "town/smithy.png", alt: "" }),
      "เตาหลอมยังร้อนอยู่เสมอ เอา Wolf Pelt กับ Gold มา แล้วจะตีอาวุธให้คมขึ้น หรือทำไอเทมไว้ใช้ในการต่อสู้",
      tabs,
      h("p", { class: "meta" }, have),
      ...content,
    );
  }

  function confirmRelease(id: number, who: string, name: string) {
    talk("ปล่อยสัตว์เลี้ยง", `ปล่อย ${who} กลับสู่ธรรมชาติ? ปล่อยแล้วเรียกคืนไม่ได้`, [
      ["ไม่ปล่อย", close],
      ["ปล่อย", () => {
        const r = release(save, id);
        if (r.ok) commit(r.save, `ปล่อย ${name} แล้ว`);
        else toast(r.why);
        close();
      }],
    ]);
    esc = close; // Escape must cancel, never release
  }
  const petLabel = (p: Pet) => p.name || PETS[p.species].name;
  const RARITY_THAI = (r: string) => RARITY_ODDS.find((o) => o.rarity === r)!.thai;
  /** A pet sprite cell from pets.png; `big` for the detail portrait. */
  function petIcon(p: Pet, cls = "") {
    const el = h("span", { class: `pet-icon ${cls}`, aria: { hidden: "true" } });
    el.style.backgroundImage = 'url("pets.png")';
    el.style.backgroundPositionX = `${(PET_IDS.indexOf(p.species) * 100) / (PET_IDS.length - 1)}%`;
    return el;
  }
  function eggIcon(egg: EggId) {
    const el = h("span", { class: "pet-icon egg", aria: { hidden: "true" } });
    el.style.backgroundImage = 'url("eggs.png")';
    el.style.backgroundSize = "300% 100%";
    el.style.backgroundPositionX = `${(EGG_IDS.indexOf(egg) * 100) / (EGG_IDS.length - 1)}%`;
    return el;
  }
  /** Farm frame (owner reference): tab bar, Knowledge box and close, then the tab's content. */
  function farm() {
    const slots = slotsOf(save);
    const eggs = EGG_IDS.reduce((a, e) => a + save.items[e], 0);
    const tab = (t: typeof farmTab, label: string) =>
      button(label, () => ((farmTab = t), draw()), { class: farmTab === t ? "on" : "", aria: { pressed: String(farmTab === t) } });
    const head = h(
      "header",
      { class: "farm-head row" },
      h("h2", {}, "ฟาร์ม"),
      h("div", { class: "tabs row", role: "group" }, tab("yard", "คอก"), tab("pets", `สัตว์เลี้ยง ${save.pets.list.length}/${slots}`), tab("eggs", `ไข่ ${eggs}`), tab("upgrade", "อัปเกรด")),
      h("span", { class: "kn" }, h("small", {}, "ความรู้"), h("b", {}, String(save.knowledge))),
      button("✕", () => go("town"), { class: "close", aria: { label: "กลับเมือง" } }),
    );
    const body = { yard: farmYard, pets: farmPets, eggs: farmEggs, upgrade: farmUpgrade }[farmTab]();
    return h("section", { class: `farm on-${farmTab}` }, head, body);
  }
  function farmYard() {
    const tier = FARM_TIERS[save.pets.farm];
    const next = FARM_TIERS[save.pets.farm + 1];
    const eggs = EGG_IDS.reduce((a, e) => a + save.items[e], 0);
    const spot = (img: string, name: string, sub: string, t: typeof farmTab, cls: string) => {
      const b = button("", () => ((farmTab = t), draw()), { class: `bldg ${cls}`, aria: { label: name } });
      b.append(h("img", { src: `town/${img}.png`, alt: "" }), h("span", { class: "plaque" }, h("b", {}, name), h("small", {}, sub)));
      return b;
    };
    const pen = h(
      "div",
      { class: "pen" },
      ...save.pets.list.map((p, i) => {
        const b = button("", () => ((farmTab = "pets"), (pickedPet = p.id), draw()), { class: "roam", aria: { label: `${petLabel(p)} Lv.${petLevel(p.xp, p.rarity)}` } });
        // Spread pets over the pen and give each its own wander pace.
        b.style.left = `${8 + ((i * 37) % 80)}%`;
        b.style.top = `${10 + ((i * 53) % 70)}%`;
        b.style.animationDuration = `${5 + (i % 4)}s`;
        b.append(...(save.pets.with === p.id ? [h("span", { class: "tag" }, "กับคุณ")] : []), petIcon(p));
        return b;
      }),
    );
    const el = h(
      "div",
      { class: "yard" },
      h("p", { class: "yard-title" }, `${tier.name} · ${save.pets.list.length} / ${tier.slots} สัตว์เลี้ยง · ฟักไข่${RARITY_THAI(tier.hatch)}`),
      spot("farm", "ศูนย์ฟักไข่", `${eggs} ฟองรอฟัก`, "eggs", "hatchery"),
      pen,
      spot("barn", "โรงนา", next ? `อัปเกรด: ${next.name}` : "ขั้นสูงสุด", "upgrade", "barn"),
    );
    el.style.backgroundImage = 'url("town/yard.png")';
    return el;
  }
  function farmPets() {
    if (!save.pets.list.length) return h("p", { class: "meta" }, "ยังไม่มีสัตว์เลี้ยง ไปที่แท็บไข่เพื่อฟักไข่");
    const sel = save.pets.list.find((p) => p.id === pickedPet) ?? save.pets.list[0];
    const list = h(
      "div",
      { class: "pet-list rows" },
      h("p", { class: "label row" }, h("span", {}, "สัตว์เลี้ยงของคุณ"), h("span", {}, `${save.pets.list.length} / ${slotsOf(save)}`)),
      ...save.pets.list.map((p) => {
        const lv = petLevel(p.xp, p.rarity);
        const max = PET_RARITY[p.rarity].max;
        const b = button("", () => ((pickedPet = p.id), draw()), {
          class: `pet-row ${p.rarity}${p.id === sel.id ? " on" : ""}`,
          aria: { pressed: String(p.id === sel.id), label: `${petLabel(p)} ${RARITY_THAI(p.rarity)} Lv.${lv}` },
        });
        b.append(
          petIcon(p),
          h("span", {}, h("b", {}, petLabel(p)), h("small", {}, `${RARITY_THAI(p.rarity)} · เลเวล ${lv}`), h("progress", { max, value: lv })),
          save.pets.with === p.id ? h("span", { class: "tag" }, "กับคุณ") : lv >= max ? h("span", { class: "tag max" }, "สูงสุด") : "",
        );
        return b;
      }),
    );
    const d = PETS[sel.species];
    const lv = petLevel(sel.xp, sel.rarity);
    const max = PET_RARITY[sel.rarity].max;
    const withMe = save.pets.with === sel.id;
    const nameIn = h("input", { id: "pet-name", value: sel.name, maxLength: 32, placeholder: d.name, aria: { label: "ชื่อสัตว์เลี้ยง" } });
    const partners = fusePartners(save, sel.id);
    const nextRarity = PET_RARITIES[PET_RARITIES.indexOf(sel.rarity) + 1];
    const detail = h(
      "div",
      { class: "pet-detail rows" },
      h(
        "div",
        { class: "pet-top" },
        h("div", { class: "pet-stage" }, petIcon(sel, "big"), button(sel.locked ? "ปลดล็อค" : "ล็อคสัตว์เลี้ยง", () => act(`lock:${sel.id}`, toggleLock(save, sel.id), sel.locked ? "ปลดล็อคแล้ว" : "ล็อคแล้ว"), { class: "lock" })),
        h(
          "div",
          {},
          h("h3", {}, petLabel(sel)),
          h("p", { class: "tags row" }, h("span", { class: `tag ${sel.rarity}` }, RARITY_THAI(sel.rarity)), h("span", { class: "tag type" }, d.type), withMe ? h("span", { class: "tag" }, "กับคุณ") : ""),
          h("span", { class: "meter" }, h("b", {}, `เลเวล ${lv} / ${max}`), h("progress", { max, value: lv })),
          h("small", { class: "gain" }, lv >= max ? "อยู่ในระดับสูงสุดแล้ว ผสานเพื่อเพิ่มความหายากและขีดจำกัด" : `XP ${sel.xp} / ${10 * ((lv + 1) ** 2 - 1)}`),
          h(
            "div",
            { class: "row" },
            withMe
              ? button("พักที่ฟาร์ม", () => act(`bring:${sel.id}`, bring(save, null), `${petLabel(sel)} อยู่ที่ฟาร์ม`))
              : button("พาไปด้วย", () => act(`bring:${sel.id}`, bring(save, sel.id), `${petLabel(sel)} ร่วมเดินทาง`), { class: "primary" }),
            button("ปล่อย", () => confirmRelease(sel.id, `${petLabel(sel)} Lv.${lv}`, petLabel(sel)), { disabled: sel.locked, aria: { label: `ปล่อย ${petLabel(sel)}` } }),
          ),
          h(
            "form",
            { class: "row rename", onsubmit: (e: Event) => (e.preventDefault(), act(`name:${sel.id}`, renamePet(save, sel.id, nameIn.value), "เปลี่ยนชื่อแล้ว")) },
            nameIn,
            h("button", { type: "submit", class: "btn" }, "เปลี่ยนชื่อ"),
          ),
        ),
      ),
      h("p", { class: "label" }, "ความสามารถ"),
      h("div", { class: "trow ability" }, h("div", {}, h("b", {}, "กัด · ทุกรอบ"), h("small", {}, `หลังฮีโร่ลงมือทุกครั้ง กัด ${petBite(lv, sel.rarity)} ดาเมจ (ไม่สนใจ DEF) และได้ 1 ชาร์จ ครบ 3 ชาร์จใช้ความสามารถแทน`)), h("small", { class: "gain" }, `พลัง ${PET_RARITY[sel.rarity].power}%`)),
      h("div", { class: "trow ability on" }, h("div", {}, h("b", {}, d.ability), h("small", {}, d.text)), h("small", { class: "gain" }, "ทุก 3 รอบ")),
      h(
        "div",
        { class: "trow ability" },
        h("div", {}, h("b", {}, "ผสาน"), h("small", {}, nextRarity ? `ผสานกับ${d.name}ระดับ${RARITY_THAI(sel.rarity)}อีกตัว: ตัวนี้เลื่อนเป็น${RARITY_THAI(nextRarity)} อีกตัวจะหายไป` : "ความหายากสูงสุดแล้ว")),
        h(
          "div",
          { class: "row" },
          ...(partners.length
            ? partners.map((o) => button(`ผสานกับ ${petLabel(o)} Lv.${petLevel(o.xp, o.rarity)}`, () => confirmFuse(sel, o), { aria: { label: `ผสาน ${petLabel(sel)} กับ ${petLabel(o)} #${o.id}` } }))
            : [h("small", {}, nextRarity ? "ยังไม่มีคู่ผสาน" : "")]),
        ),
      ),
    );
    return h("div", { class: "farm-pets" }, list, detail);
  }
  function confirmFuse(keep: Pet, other: Pet) {
    talk("ผสานสัตว์เลี้ยง", `${petLabel(keep)} จะเลื่อนขั้น และ ${petLabel(other)} Lv.${petLevel(other.xp, other.rarity)} จะหายไป ทำต่อไหม?`, [
      ["ไม่ผสาน", close],
      ["ผสาน", () => {
        const r = fuse(save, keep.id, other.id);
        if (r.ok) commit(r.save, `${petLabel(keep)} เลื่อนขั้นแล้ว!`);
        else toast(r.why);
        close();
      }],
    ]);
    esc = close;
  }
  function farmEggs() {
    const tier = FARM_TIERS[save.pets.farm];
    const cards = EGG_IDS.filter((e) => save.items[e]).map((e) => {
      const ok = canHatch(save, e);
      const n = save.items[e];
      return h(
        "div",
        { class: `egg-card ${EGGS[e]}` },
        eggIcon(e),
        h(
          "div",
          {},
          h("p", { class: "row" }, h("b", {}, ITEMS[e].name), h("span", { class: "gain" }, `x${n}`)),
          h("small", {}, `ฟักแล้วได้สัตว์ระดับ${RARITY_THAI(EGGS[e])}: ลูกสุนัข ลูกแมว นกฮูก หรือแอกโซลอเติล`),
          ok
            ? button("ฟัก 1 ฟอง", () => act(`hatch:${e}`, hatch(save, e), "ไข่ฟักแล้ว!"), { class: "primary", aria: { label: `ฟัก ${ITEMS[e].name}` } })
            : button("อัปเกรดก่อน", () => ((farmTab = "upgrade"), draw())),
          button(`ฟักทั้งหมด (${n})`, () => {
            if (doubled(`hatchall:${e}`)) return;
            const r = hatchAll(save, e);
            if (!r.count) return toast(r.why);
            commit(r.save, `ฟักได้ ${r.count} ตัว${r.save.items[e] ? ` · ${r.why}` : ""}`);
          }, { disabled: !ok, aria: { label: `ฟักทั้งหมด ${ITEMS[e].name}` } }),
        ),
      );
    });
    return h(
      "div",
      { class: "eggs rows" },
      h(
        "div",
        { class: "trow" },
        h("div", {}, h("b", {}, "ฟักไข่"), h("small", {}, "ฟักทั้งหมดจะหยุดเมื่อคอกเต็ม")),
        h("small", { class: "gain" }, `ฟักไข่ได้ถึงระดับ${RARITY_THAI(tier.hatch)} · ${save.pets.list.length} / ${tier.slots} ตัว`),
      ),
      ...(cards.length ? cards : [h("p", { class: "meta" }, "ยังไม่มีไข่ บอสท้ายป่าทิ้งไข่ไว้ทุกครั้งที่ปราบได้ และหีบบางใบมีไข่หายาก")]),
    );
  }
  function farmUpgrade() {
    const tiers = FARM_TIERS.map((t, i) => {
      const cur = i === save.pets.farm;
      const nxt = i === save.pets.farm + 1;
      return h(
        "div",
        { class: `trow tier${cur ? " with" : ""}${i < save.pets.farm ? " done" : ""}` },
        h("b", { class: "num" }, String(i + 1)),
        h("div", {}, h("b", {}, `${t.name}${cur ? " (ของคุณ)" : ""}`), h("small", {}, `${t.slots} ช่องสัตว์เลี้ยง · ฟักไข่${RARITY_THAI(t.hatch)} · ผสานเป็นระดับ${RARITY_THAI(t.hatch)}ขึ้นไปได้`)),
        cur || i < save.pets.farm
          ? h("span", { class: "gain" }, "✓")
          : nxt
            ? h(
                "div",
                {},
                button(`อัปเกรด ${t.cost}`, () => act("farm-up", upgradeFarm(save), `ฟาร์มเป็น ${t.name} แล้ว!`), { class: "primary", disabled: save.knowledge < t.cost }),
                save.knowledge < t.cost ? h("small", { class: "need" }, `ต้องการอีก ${t.cost - save.knowledge}`) : "",
              )
            : h("small", {}, `${t.cost.toLocaleString()} KN`),
      );
    });
    const how = [
      "พาสัตว์เลี้ยงไปด้วยได้ 1 ตัว มันกัดทุกรอบ และใช้ความสามารถทุก 3 รอบ ศัตรูทำร้ายมันไม่ได้",
      "สัตว์ที่อยู่กับคุณได้ XP ครึ่งหนึ่งของฮีโร่จากทุกชัยชนะ",
      "ความหายากกำหนดเลเวลสูงสุดและพลังของการกัดและความสามารถ",
      "ผสานสัตว์ชนิดเดียวกันที่ความหายากเท่ากัน: ตัวหนึ่งเลื่อนขั้น อีกตัวหายไป",
      "ความรู้ได้มาพร้อม EXP จากทุกการต่อสู้ที่ชนะ ใช้อัปเกรดฟาร์ม",
    ];
    return h(
      "div",
      { class: "farm-upgrade" },
      h("div", { class: "rows" }, h("p", { class: "label row" }, h("span", {}, "อัปเกรดฟาร์ม"), h("span", {}, "จ่ายด้วยความรู้")), ...tiers),
      h("div", { class: "how" }, h("b", {}, "วิธีการทำงานของสัตว์เลี้ยง"), h("ul", {}, ...how.map((t) => h("li", {}, t)))),
    );
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

  let tap = { at: -Infinity, what: "" };
  /** True for the second tap of a double tap on `what`, which must not also press what was redrawn under it. */
  const doubled = (what: string) => {
    const now = performance.now();
    if (now - tap.at < 400 && tap.what === what) return true;
    tap = { at: now, what };
    return false;
  };
  function pick(id: string) {
    if (busy || !choices(save).includes(id) || doubled("pick")) return;
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
    const lines = [`+${r.gold} Gold`, `+${r.exp} EXP · ความรู้ +${r.exp}`, ...(r.item ? [`${ITEMS[r.item].name} ×1`] : [])];
    if (save.hero.level > before.hero.level) lines.push(`เลเวลอัป! Lv.${save.hero.level} (${levelGains(before, save)})`);
    const pet = save.pets.list.find((p) => p.id === save.pets.with);
    if (pet && r.petXp) {
      const was = petLevel(pet.xp - r.petXp, pet.rarity);
      const now = petLevel(pet.xp, pet.rarity);
      lines.push(`${pet.name || PETS[pet.species].name} +${r.petXp} XP สัตว์เลี้ยง${now > was ? ` · เลเวลอัป Lv.${now}` : ""}`);
    }
    if (save.hero.level > before.hero.level) lines.push(`แต้มฝึก +${save.hero.level - before.hero.level} · ใช้ได้ที่ลานฝึกในเมือง`);
    talk("ชัยชนะ!", "", [["ดำเนินต่อ", () => (save.progress.path.at(-1) === "boss" ? ended(save) : close())]], lines);
  }
  /** End of a journey (boss beaten or a lost fight): what it earned, then back to setting out. */
  function ended(run: SaveData) {
    const r = runSummary(run);
    const found = Object.entries(r.found).map(([k, q]) => `${ITEMS[k as ItemId].name} ×${q}`);
    talk(r.cleared ? "ผ่านการเดินทาง!" : "กลับสู่จุดเริ่ม", r.cleared ? `${run.hero.name} ปราบผู้พิทักษ์โบราณได้แล้ว` : `${run.hero.name} ถอยกลับมาตั้งหลัก`, [
      ["กลับเมือง", () => {
        if (save.progress.path.length) commit(restartRun(save), "เริ่มการเดินทางใหม่");
        departed = false;
        view = "town";
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
    body.querySelector<HTMLElement>(".event, .diff.on, .bldg")?.focus({ preventScroll: true });
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
  else body.querySelector<HTMLElement>(".event, .diff.on, .bldg")?.focus({ preventScroll: true });
}
