import "@fontsource-variable/cinzel";
import "@fontsource-variable/dm-sans";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "./astra.css";
import {
  CLASSES,
  CLASS_IDS,
  MAX_TALENT_DRAWS,
  RARITY_ODDS,
  STAT_IDS,
  STAT_LABEL,
  talentById,
  TALENTS,
  type ClassId,
  type Gender,
  type TalentDef,
} from "./data";
import { checkName, describeTalent, effectiveStats, NAME_MAX, rollTalent } from "./hero";
import {
  loadSave,
  newSave,
  parseSettings,
  SETTINGS_KEY,
  writeSave,
  type SaveData,
  type Settings,
} from "./save";
import {
  CLASS_OUTFIT,
  defaultLook,
  FACES,
  FRAME_H,
  FRAME_W,
  HAIR_COLORS,
  HAIR_STYLES,
  IDLE_FRAMES,
  layers,
  OUTFIT_COLORS,
  OUTFITS,
  STRIP_W,
  SKINS,
  type Look,
} from "./looks";

const root = document.querySelector<HTMLElement>("#astra")!;

// localStorage can throw (private mode, blocked storage); the game still runs for the session.
const memory = new Map<string, string>();
const store = {
  getItem(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
      throw new Error("storage unavailable");
    }
  },
};

let settings: Settings = parseSettings(store.getItem(SETTINGS_KEY));

type Child = Node | string | false | null | undefined;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string; data?: Record<string, string>; aria?: Record<string, string> } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: cls, data, aria, ...rest } = props;
  if (cls) el.className = cls;
  Object.assign(el, rest);
  for (const [k, v] of Object.entries(data ?? {})) el.dataset[k] = v;
  for (const [k, v] of Object.entries(aria ?? {})) el.setAttribute(`aria-${k}`, v);
  // Children are appended as nodes/text so user strings are never parsed as HTML.
  for (const c of children) if (c) el.append(c);
  return el;
}

const button = (label: string, onclick: () => void, extra: Partial<HTMLButtonElement> & { class?: string; aria?: Record<string, string> } = {}) =>
  h("button", { type: "button", onclick, ...extra, class: `btn ${extra.class ?? ""}` }, label);

function show(...nodes: Node[]) {
  // Re-renders keep keyboard focus on the same control (matched by its aria-label).
  const prev = document.activeElement?.getAttribute("aria-label");
  root.replaceChildren(...nodes);
  const same = prev ? root.querySelector<HTMLElement>(`[aria-label="${CSS.escape(prev)}"]`) : null;
  (same ?? root.querySelector<HTMLElement>("[autofocus], .btn:not(:disabled)"))?.focus({ preventScroll: true });
  fitSprites();
}

// ---------- hero sprite (Heroes99 layers composited in the browser) ----------
const images = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (src: string) => {
  let p = images.get(src);
  if (!p) {
    p = new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error(src));
      img.src = src;
    });
    p.catch(() => images.delete(src)); // allow a retry after a failed load
    images.set(src, p);
  }
  return p;
};

const sheets = new Map<string, Promise<HTMLCanvasElement>>();
function composite(look: Look, classId: ClassId) {
  const parts = layers(look, classId);
  const key = parts.join("|");
  let p = sheets.get(key);
  if (!p) {
    p = Promise.all(parts.map(([src]) => loadImage(src))).then((imgs) => {
      const c = h("canvas", { width: STRIP_W, height: FRAME_H });
      const ctx = c.getContext("2d")!;
      imgs.forEach((img, i) => ctx.drawImage(img, 0, parts[i][1] * FRAME_H, STRIP_W, FRAME_H, 0, 0, STRIP_W, FRAME_H));
      return c;
    });
    p.catch(() => sheets.delete(key));
    sheets.set(key, p);
  }
  return p;
}

const still = () => settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

function heroSprite(look: Look, classId: ClassId, label: string) {
  const canvas = h("canvas", { class: "sprite", width: FRAME_W, height: FRAME_H });
  const box = h("div", { class: "sprite-box", role: "img", aria: { label } } as never, canvas);
  const ctx = canvas.getContext("2d")!;
  composite(look, classId).then(
    (sheet) => {
      let f = 0;
      const draw = () => {
        ctx.clearRect(0, 0, FRAME_W, FRAME_H);
        ctx.drawImage(sheet, f * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      };
      draw();
      const timer = setInterval(() => {
        if (!canvas.isConnected) return clearInterval(timer);
        if (still()) return;
        f = (f + 1) % IDLE_FRAMES;
        draw();
      }, 130);
    },
    () => box.classList.add("missing"),
  );
  return box;
}

/** Integer pixel scale so the 100×40 frame stays crisp and fits its box. */
function fitSprites() {
  for (const box of root.querySelectorAll<HTMLElement>(".sprite-box")) {
    const k = Math.max(1, Math.floor(Math.min(box.clientWidth / 100, box.clientHeight / 40)));
    box.style.setProperty("--k", String(k));
  }
}
addEventListener("resize", fitSprites);

// ---------- boot ----------
async function boot() {
  show(h("main", { class: "screen center" }, h("p", { class: "loading" }, "กำลังโหลด…")));
  try {
    await composite(defaultLook("male", "knight"), "knight");
    title();
  } catch {
    show(
      h(
        "main",
        { class: "screen center" },
        h("p", { role: "alert" }, "โหลดไฟล์เกมไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่"),
        button("ลองใหม่", boot),
      ),
    );
  }
}

// ---------- title ----------
function title(notice = "") {
  const save = loadSave(store);
  show(
    h(
      "main",
      { class: "screen title" },
      h("div", { class: "logo" }, h("span", {}, "Echoes"), h("small", {}, "of"), h("span", {}, "Astra")),
      h("p", { class: "tagline" }, "การเดินทางของเสียงสะท้อน ในดินแดนที่ดวงดาวยังไม่ดับ"),
      h(
        "nav",
        { class: "menu", aria: { label: "เมนูหลัก" } },
        button("New Game", () => (save ? confirmOverwrite(save) : creation()), { class: "primary" }),
        button("Continue", () => save && adventure(save), {
          disabled: !save,
          aria: { describedby: "continue-note" },
        }),
        button("Settings", () => settingsPanel(() => title())),
      ),
      h(
        "p",
        { class: "note", id: "continue-note", role: "status" },
        notice ||
          (save
            ? `เซฟล่าสุด: ${save.hero.name} · ${CLASSES[save.hero.classId].name} Lv.${save.hero.level}`
            : "ยังไม่มีเซฟ"),
      ),
    ),
  );
}

function confirmOverwrite(save: SaveData) {
  show(
    h(
      "main",
      { class: "screen center" },
      h(
        "section",
        { class: "dialog", role: "alertdialog", aria: { labelledby: "ow-title", describedby: "ow-text" } },
        h("h2", { id: "ow-title" }, "เริ่มเกมใหม่?"),
        h("p", { id: "ow-text" }, "เซฟของ ", h("b", {}, save.hero.name), " จะถูกเขียนทับเมื่อยืนยันตัวละครใหม่ เซฟเดิมจะเก็บไว้เป็นสำรองหนึ่งชุด"),
        h(
          "div",
          { class: "row" },
          button("ยกเลิก", () => title(), { class: "primary", autofocus: true }),
          button("เริ่มใหม่", () => creation()),
        ),
      ),
    ),
  );
}

function settingsPanel(back: () => void) {
  const toggle = (key: keyof Settings, label: string, hint: string) => {
    const input = h("input", {
      type: "checkbox",
      checked: settings[key],
      onchange: () => {
        settings = { ...settings, [key]: input.checked };
        try {
          store.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {
          /* session-only settings */
        }
        document.documentElement.classList.toggle("reduced", settings.reducedMotion);
      },
    });
    return h("label", { class: "toggle" }, input, h("span", {}, h("b", {}, label), h("small", {}, hint)));
  };
  show(
    h(
      "main",
      { class: "screen center" },
      h(
        "section",
        { class: "dialog", role: "dialog", aria: { labelledby: "set-title" } },
        h("h2", { id: "set-title" }, "Settings"),
        toggle("autoTiming", "Auto timing", "จังหวะ Perfect Strike/Guard ถือเป็น Normal โดยอัตโนมัติ"),
        toggle("reducedMotion", "ลดการเคลื่อนไหว", "ปิดแอนิเมชันตัวละครและเอฟเฟกต์"),
        button("กลับ", back, { class: "primary" }),
      ),
    ),
  );
}

// ---------- character creation ----------
interface Draft {
  step: 0 | 1 | 2 | 3 | 4;
  name: string;
  gender: Gender;
  classId: ClassId | null;
  look: Look;
  talent: TalentDef | null; // one slot: each roll replaces it
  rolls: number;
}

const STEPS = ["ตัวตน", "อาชีพ", "รูปลักษณ์", "พรสวรรค์", "ยืนยัน"];

function creation() {
  // shortcut: rolls live only in memory (GDD's "simplest MVP"); a refresh mid-creation restarts them.
  const d: Draft = {
    step: 0,
    name: "",
    gender: "male",
    classId: null,
    look: defaultLook("male", "knight"),
    talent: null,
    rolls: 0,
  };
  const nameCheck = () => checkName(d.name);
  const canNext = () =>
    [nameCheck().ok, d.classId !== null, true, d.talent !== null, true][d.step];

  const render = () => {
    const footerNext =
      d.step < 4
        ? button("ถัดไป", () => go(1), { class: "primary", disabled: !canNext() })
        : button("เริ่มการผจญภัย", start, { class: "primary" });
    show(
      h(
        "main",
        { class: "screen create" },
        h(
          "ol",
          { class: "steps", aria: { label: "ขั้นตอนสร้างตัวละคร" } },
          ...STEPS.map((s, i) =>
            h("li", { class: i === d.step ? "on" : i < d.step ? "done" : "", aria: i === d.step ? { current: "step" } : {} }, `${i + 1}. ${s}`),
          ),
        ),
        heroSprite(d.look, d.classId ?? "knight", "ตัวอย่างฮีโร่"),
        h("section", { class: "panel", aria: { label: STEPS[d.step] } }, ...stepBody()),
        h(
          "footer",
          { class: "row" },
          button(d.step === 0 ? "ยกเลิก" : "ย้อนกลับ", () => (d.step === 0 ? title() : go(-1))),
          footerNext,
        ),
      ),
    );
    if (d.step === 0) root.querySelector<HTMLInputElement>("#hero-name")?.focus({ preventScroll: true });
  };
  const go = (n: number) => {
    if (n > 0 && !canNext()) return;
    d.step = (d.step + n) as Draft["step"];
    render();
  };

  function stepBody(): Child[] {
    if (d.step === 0) {
      const check = nameCheck();
      const err = h("p", { class: "error", id: "name-err", role: "status" }, d.name && !check.ok ? check.error : "");
      const input = h("input", {
        id: "hero-name",
        value: d.name,
        autocomplete: "off",
        enterKeyHint: "next",
        spellcheck: false,
        oninput: () => {
          d.name = input.value;
          const c = nameCheck();
          err.textContent = d.name && !c.ok ? c.error : "";
          root.querySelector<HTMLButtonElement>("footer .primary")!.disabled = !c.ok;
        },
        // A handler property that returns false cancels the key, so never return the && result.
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === "Enter") go(1);
        },
      });
      input.setAttribute("aria-describedby", "name-err");
      return [
        h("label", { class: "field", htmlFor: "hero-name" }, `ชื่อฮีโร่ (ไม่เกิน ${NAME_MAX} ตัวอักษร)`),
        input,
        err,
        h("p", { class: "label" }, "รูปลักษณ์"),
        h(
          "div",
          { class: "row seg", role: "group", aria: { label: "เพศ" } },
          ...(["male", "female"] as Gender[]).map((g) =>
            button(g === "male" ? "ชาย" : "หญิง", () => {
              if (d.gender !== g) d.look = { ...d.look, hair: HAIR_STYLES[g][0] };
              d.gender = g;
              render();
            }, {
              aria: { pressed: String(d.gender === g) },
            }),
          ),
        ),
        h("p", { class: "hint" }, "เพศมีผลต่อรูปลักษณ์เท่านั้น ไม่มีผลต่อค่าสถานะ"),
      ];
    }
    if (d.step === 1) {
      return [
        h(
          "div",
          { class: "classes", role: "group", aria: { label: "อาชีพ" } },
          ...CLASS_IDS.map((c) =>
            button(CLASSES[c].name, () => {
              d.classId = c;
              d.look = { ...d.look, ...CLASS_OUTFIT[c] }; // class starting outfit; weapon follows class
              render();
            }, {
              aria: { pressed: String(d.classId === c) },
            }),
          ),
        ),
        d.classId ? classInfo(d.classId) : h("p", { class: "hint" }, "เลือกอาชีพเริ่มต้นหนึ่งอาชีพ ผจญภัยคนเดียว ไม่มีปาร์ตี้"),
      ];
    }
    if (d.step === 2) {
      const cycle = <K extends keyof Look>(label: string, key: K, list: readonly Look[K][], text = (v: Look[K], i: number) => `${i + 1} / ${list.length}`) => {
        const i = Math.max(0, list.indexOf(d.look[key]));
        const set = (n: number) => {
          d.look = { ...d.look, [key]: list[(i + n + list.length) % list.length] };
          render();
        };
        return h(
          "div",
          { class: "cycle" },
          button("‹", () => set(-1), { aria: { label: `${label} ก่อนหน้า` } }),
          h("span", { class: "mid" }, h("small", {}, label), h("output", { aria: { live: "polite" } }, text(d.look[key], i))),
          button("›", () => set(1), { aria: { label: `${label} ถัดไป` } }),
        );
      };
      return [
        h(
          "div",
          { class: "looks" },
          cycle("ผิว", "skin", SKINS),
          cycle("ใบหน้า", "face", FACES),
          cycle("ทรงผม", "hair", HAIR_STYLES[d.gender]),
          cycle("สีผม", "hairColor", HAIR_COLORS),
          cycle("ชุด", "outfit", OUTFITS),
          cycle("สีชุด", "outfitColor", OUTFIT_COLORS),
        ),
        h("p", { class: "hint" }, `อาวุธ: ${CLASSES[d.classId!].weapon.thai} (ตามอาชีพ ${CLASSES[d.classId!].name})`),
      ];
    }
    if (d.step === 3) {
      const left = MAX_TALENT_DRAWS - d.rolls;
      const slot = h(
        "div",
        { class: "slot", aria: { live: "polite" } },
        d.talent ? talentCard(d.talent) : h("p", { class: "hint" }, `สุ่มได้สูงสุด ${MAX_TALENT_DRAWS} ครั้ง ผลล่าสุดคือพรสวรรค์ของคุณ`),
      );
      const roll = button(d.rolls ? `สุ่มใหม่ (เหลือ ${left})` : "ปลุกพรสวรรค์", () => {
        if (d.rolls >= MAX_TALENT_DRAWS || slot.classList.contains("rolling")) return;
        d.rolls++;
        const result = rollTalent();
        if (still()) return ((d.talent = result), render());
        // Spin through random talents, slowing down, then land on the real roll.
        root.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
        slot.classList.add("rolling");
        let delay = 50;
        const spin = () => {
          if (!slot.isConnected) return;
          if (delay > 260) return ((d.talent = result), render(), root.querySelector(".slot")?.classList.add("landed"));
          slot.replaceChildren(talentCard(TALENTS[Math.floor(Math.random() * TALENTS.length)]));
          delay *= 1.18;
          setTimeout(spin, delay);
        };
        spin();
      }, { class: "primary", disabled: left === 0 });
      return [
        h("div", { class: "row draw" }, roll, h("small", { class: "odds" }, RARITY_ODDS.map((o) => `${o.thai} ${o.per1000 / 10}%`).join(" · "))),
        slot,
      ];
    }
    const t = d.talent!;
    return [
      h("h2", { class: "hero-name" }, d.name.trim()),
      h("p", { class: "meta" }, `${d.gender === "male" ? "ชาย" : "หญิง"} · ${CLASSES[d.classId!].name} · ${t.name}`),
      statGrid(effectiveStats(d.classId!, t.id), CLASSES[d.classId!].base),
      talentCard(t),
    ];
  }

  function start() {
    const name = nameCheck();
    if (!name.ok || !d.classId || !d.talent) return;
    const save = newSave(name.name, d.gender, d.classId, d.talent.id, d.look);
    adventure(save, writeSave(store, save) ? "บันทึกแล้ว" : "SESSION ONLY · บันทึกไม่ได้ในเบราว์เซอร์นี้");
  }

  render();
}

function classInfo(c: ClassId) {
  const def = CLASSES[c];
  return h(
    "div",
    { class: "class-info" },
    h("p", { class: "meta" }, `${def.thai} · ${def.identity}`),
    statGrid(def.base),
    h("p", { class: "hint" }, `อาวุธ: ${def.weapon.name} (${def.weapon.thai}) · Skill: ${def.skill.name} · Burst: ${def.burst}`),
  );
}

function statGrid(s: Record<string, number>, base?: Record<string, number>) {
  return h(
    "dl",
    { class: "stats" },
    ...STAT_IDS.map((k) => {
      const diff = base ? s[k] - base[k] : 0;
      return h(
        "div",
        { class: diff > 0 ? "up" : diff < 0 ? "down" : "" },
        h("dt", {}, STAT_LABEL[k]),
        h("dd", {}, String(s[k])),
      );
    }),
  );
}

function talentCard(t: TalentDef) {
  const { plus, minus } = describeTalent(t);
  const rarity = RARITY_ODDS.find((o) => o.rarity === t.rarity)!;
  const body = [
    h("span", { class: `rarity ${t.rarity}` }, rarity.thai),
    h("b", {}, t.name),
    h("span", { class: "plus" }, plus.join(" · ")),
    h("span", { class: "minus" }, minus.join(" · ")),
  ];
  return h("div", { class: `talent ${t.rarity}` }, ...body);
}

// ---------- after creation (milestone 2 starts here) ----------
function adventure(save: SaveData, notice = "") {
  const hero = save.hero;
  const t = talentById(hero.talentId)!;
  const s = effectiveStats(hero.classId, hero.talentId);
  show(
    h(
      "main",
      { class: "screen create" },
      h("header", { class: "area" }, h("b", {}, "Oakheart Village"), h("span", { role: "status" }, notice)),
      heroSprite(hero.look, hero.classId, `${hero.name} ${CLASSES[hero.classId].name}`),
      h(
        "section",
        { class: "panel" },
        h("h2", { class: "hero-name" }, hero.name),
        h("p", { class: "meta" }, `Lv.${hero.level} ${CLASSES[hero.classId].name} · ${t.name} · HP ${hero.hp}/${s.maxHp} · MP ${hero.mp}/${s.maxMp}`),
        h("p", { class: "hint" }, "การสำรวจแบบ top-down และการดวลแบบ side-view จะมาในขั้นถัดไป"),
      ),
      h("footer", { class: "row" }, button("กลับหน้าแรก", () => title(), { class: "primary" })),
    ),
  );
}

document.documentElement.classList.toggle("reduced", settings.reducedMotion);
boot();
