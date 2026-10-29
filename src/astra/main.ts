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
  root.replaceChildren(...nodes);
  root.querySelector<HTMLElement>("[autofocus], .btn:not(:disabled)")?.focus({ preventScroll: true });
  fitSprites();
}

// ---------- hero sprite ----------
const sheet = (c: ClassId, g: Gender) => `heroes/${c}_${g}.png`;

function heroSprite(c: ClassId | null, g: Gender, label: string) {
  const el = h("div", { class: "sprite-box", aria: { label }, role: "img" } as never);
  if (c) el.append(h("div", { class: "sprite" }));
  el.style.setProperty("--sheet", c ? `url("${sheet(c, g)}")` : "none");
  return el;
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
  const load = (src: string) =>
    new Promise<void>((ok, fail) => {
      const img = new Image();
      img.onload = () => ok();
      img.onerror = () => fail(new Error(src));
      img.src = src;
    });
  try {
    await Promise.all(CLASS_IDS.flatMap((c) => [load(sheet(c, "male")), load(sheet(c, "female"))]));
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
  step: 0 | 1 | 2 | 3;
  name: string;
  gender: Gender;
  classId: ClassId | null;
  draws: TalentDef[];
  pick: number | null;
}

const STEPS = ["ตัวตน", "อาชีพ", "พรสวรรค์", "ยืนยัน"];

function creation() {
  // shortcut: draws live only in memory (GDD's "simplest MVP"); a refresh mid-creation restarts the rolls.
  const d: Draft = { step: 0, name: "", gender: "male", classId: null, draws: [], pick: null };
  const nameCheck = () => checkName(d.name);
  const canNext = () =>
    [nameCheck().ok, d.classId !== null, d.pick !== null, true][d.step];

  const render = () => {
    const footerNext =
      d.step < 3
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
        heroSprite(d.classId ?? "knight", d.gender, "ตัวอย่างฮีโร่"),
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
        onkeydown: (e: KeyboardEvent) => e.key === "Enter" && go(1),
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
            button(g === "male" ? "ชาย" : "หญิง", () => ((d.gender = g), render()), {
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
            button(CLASSES[c].name, () => ((d.classId = c), render()), {
              aria: { pressed: String(d.classId === c) },
            }),
          ),
        ),
        d.classId ? classInfo(d.classId) : h("p", { class: "hint" }, "เลือกอาชีพเริ่มต้นหนึ่งอาชีพ ผจญภัยคนเดียว ไม่มีปาร์ตี้"),
      ];
    }
    if (d.step === 2) {
      const left = MAX_TALENT_DRAWS - d.draws.length;
      return [
        h(
          "div",
          { class: "row draw" },
          button(d.draws.length ? `สุ่มอีกครั้ง (เหลือ ${left})` : "ปลุกพรสวรรค์", () => {
            if (d.draws.length >= MAX_TALENT_DRAWS) return;
            d.draws.push(rollTalent());
            d.pick ??= 0; // first result selected; later rolls never replace it without a tap
            render();
          }, { class: "primary", disabled: left === 0 }),
          h("small", { class: "odds" }, RARITY_ODDS.map((o) => `${o.thai} ${o.per1000 / 10}%`).join(" · ")),
        ),
        h(
          "div",
          { class: "talents", role: "radiogroup", aria: { label: "ผลการสุ่ม เลือกหนึ่ง" } },
          ...(d.draws.length
            ? d.draws.map((t, i) => talentCard(t, d.pick === i, () => ((d.pick = i), render())))
            : [h("p", { class: "hint" }, `สุ่มได้สูงสุด ${MAX_TALENT_DRAWS} ครั้ง ผลทุกครั้งยังเลือกได้ เลือกหนึ่งพรสวรรค์`)]),
        ),
      ];
    }
    const t = d.draws[d.pick!];
    return [
      h("h2", { class: "hero-name" }, d.name.trim()),
      h("p", { class: "meta" }, `${d.gender === "male" ? "ชาย" : "หญิง"} · ${CLASSES[d.classId!].name} · ${t.name}`),
      statGrid(effectiveStats(d.classId!, t.id), CLASSES[d.classId!].base),
      talentCard(t, true),
    ];
  }

  function start() {
    const name = nameCheck();
    if (!name.ok || !d.classId || d.pick === null) return;
    const save = newSave(name.name, d.gender, d.classId, d.draws[d.pick].id);
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
    h("p", { class: "hint" }, `อาวุธ: ${def.weapon.name} (${def.weapon.thai})${def.weapon.art ? "" : " · ยังไม่มีภาพอาวุธ"} · Skill: ${def.skill.name} · Burst: ${def.burst}`),
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

function talentCard(t: TalentDef, selected: boolean, onpick?: () => void) {
  const { plus, minus } = describeTalent(t);
  const rarity = RARITY_ODDS.find((o) => o.rarity === t.rarity)!;
  const body = [
    h("span", { class: `rarity ${t.rarity}` }, rarity.thai),
    h("b", {}, t.name),
    h("span", { class: "plus" }, plus.join(" · ")),
    h("span", { class: "minus" }, minus.join(" · ")),
  ];
  return onpick
    ? h("button", { type: "button", class: "talent", role: "radio", onclick: onpick, aria: { checked: String(selected) } }, ...body)
    : h("div", { class: "talent" }, ...body);
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
      heroSprite(hero.classId, hero.gender, `${hero.name} ${CLASSES[hero.classId].name}`),
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
