// Side-view duel screen (BATTLE_VISUAL_DIRECTION). Captures one timing result per action,
// commits it through battle.ts, then plays the returned event log; skip and resize only
// change what is drawn.
import { CLASSES, ENEMIES, ITEMS, type Element, type ItemId } from "./data";
import {
  act,
  damage,
  foeStats,
  guard,
  heroStats,
  illegal,
  INTENTS,
  judge,
  physicalBase,
  REACTIONS,
  skillCost,
  startBattle,
  type BattleEvent,
  type BattleState,
  type Command,
  type Timing,
} from "./battle";
import { ANIMS, FRAME_H, FRAME_W } from "./looks";
import type { SaveData } from "./save";
import { button, composite, crisp, h, settings, show, still } from "./ui";
import { expFor } from "./world";

const STEP_MS = 520;
/** The shrinking ring meets the target this long after the cue appears; input closes LATE_MS after. */
const LEAD_MS = 700;
const LATE_MS = 260;
const ELEMENT: Record<Element, { thai: string; color: string }> = {
  fire: { thai: "ไฟ", color: "#ff6a3d" },
  water: { thai: "น้ำ", color: "#3d8bff" },
  ice: { thai: "น้ำแข็ง", color: "#aeeeff" },
  lightning: { thai: "สายฟ้า", color: "#ffe14d" },
};
const TIMING_TAG: Record<Timing, string> = { perfect: "Perfect!", good: "Good", normal: "" };

export function duel(
  save: SaveData,
  encounterId: string,
  enemy: keyof typeof ENEMIES,
  place: string,
  done: (b: BattleState) => void,
) {
  let b = startBattle(save.hero, save.items, encounterId, enemy);
  let seq = 0;
  let playing = false;
  let skipTo: (() => void) | null = null;
  const foe = ENEMIES[enemy];

  // ---------- stage: GBA-style 240x136 canvas + name banners + info strip ----------
  const W = 240;
  const H = 136;
  const canvas = h("canvas", { class: "fe-stage", width: W, height: H });
  const ctx = canvas.getContext("2d")!;
  const pop = h("div", { class: "pop", aria: { hidden: "true" } });
  const side = (who: "hero" | "foe", name: string) => {
    const stats = h("dl", { class: "fe-stats" });
    const weapon = h("p", { class: "fe-weapon" });
    const hpNum = h("b", { class: "fe-hp-num" });
    const fill = h("i");
    const astra = h("i");
    const el = h(
      "div",
      { class: `fe-side ${who}` },
      stats,
      weapon,
      h(
        "div",
        { class: "fe-hp" },
        hpNum,
        h(
          "div",
          { class: "fe-bars" },
          h("div", { class: "fe-track", role: "meter", aria: { label: `HP ${name}` } }, fill),
          who === "hero" ? h("div", { class: "fe-astra", role: "meter", aria: { label: "Astra" } }, astra) : "",
        ),
      ),
    );
    return { el, stats, weapon, hpNum, fill, astra };
  };
  const heroSide = side("hero", save.hero.name);
  const foeSide = side("foe", foe.name);
  const frame = h(
    "div",
    { class: "fe-frame", role: "img", aria: { label: `${save.hero.name} ปะทะ ${foe.name}` } },
    canvas,
    h("p", { class: "fe-banner hero" }, save.hero.name),
    h("p", { class: "fe-banner foe" }, foe.name),
    pop,
    h("div", { class: "fe-info" }, heroSide.el, foeSide.el),
  );
  const intent = h("p", { class: "intent" });
  const log = h("p", { class: "log", role: "status", aria: { live: "polite" } });
  const cmds = h("div", { class: "cmds", role: "group", aria: { label: "คำสั่ง" } });
  const roundEl = h("span");
  const wrap = h("div", { class: "fe-wrap" }, frame);
  const main = h(
    "main",
    { class: "screen encounter fe" },
    wrap,
    h(
      "section",
      { class: "panel fe-panel" },
      h("p", { class: "area" }, h("b", {}, place), roundEl),
      intent,
      log,
      h(
        "p",
        { class: "hint" },
        settings.autoTiming || still()
          ? "Auto Timing: ทุกจังหวะนับเป็น Normal (เปลี่ยนได้ใน Settings)"
          : "แตะจอหรือกด Space ตอนวงแหวนหดตรงกัน · โจมตี Perfect ×1.2 · ป้องกัน Perfect ×0.4 · Astra เต็ม 100 ใช้ Burst",
      ),
      cmds,
    ),
  );

  // Animation state is presentation only; battle math already happened in act().
  type Fx = { who: "hero" | "foe"; kind: "strike" | "hurt"; t0: number };
  let fx: Fx[] = [];
  let down: "hero" | "foe" | null = null;
  let heroSheet: HTMLCanvasElement | null = null;
  const bg = new Image();
  bg.src = "world/battle_forest.png";
  const wolfImg = new Image();
  wolfImg.src = "world/wolf.png";
  composite(save.hero.look, save.hero.classId).then((c) => (heroSheet = c)).catch(() => frame.classList.add("missing"));

  const FOOT = 112; // platform standing line
  const draw = (now: number) => {
    if (!main.isConnected) return;
    const calm = still();
    const live = fx.filter((f) => now - f.t0 < 450);
    fx = live;
    const off = (who: "hero" | "foe") => {
      let x = 0;
      for (const f of live) {
        if (f.who !== who || calm) continue;
        const t = (now - f.t0) / 450;
        if (f.kind === "strike") x += (who === "hero" ? 1 : -1) * Math.round(34 * Math.sin(Math.PI * t));
        if (f.kind === "hurt") x += t < 0.6 ? (Math.floor(now / 40) % 2 ? 2 : -2) : 0;
      }
      return x;
    };
    const flash = (who: "hero" | "foe") => live.some((f) => f.who === who && f.kind === "hurt" && (now - f.t0) % 120 < 60);
    ctx.clearRect(0, 0, W, H);
    if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0);
    const aura = (x: number) => {
      ctx.fillStyle = "#8fd3ff55";
      ctx.beginPath();
      ctx.ellipse(x, FOOT - 12, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    if (b.hero.defending) aura(64);
    if (b.foe.defending) aura(176);
    const sprite = (who: "hero" | "foe", paint: () => void) => {
      ctx.save();
      ctx.globalAlpha = down === who ? 0.35 : 1;
      if (flash(who)) ctx.filter = "brightness(2.6) saturate(0.2)";
      paint();
      ctx.restore();
    };
    const striking = live.some((f) => f.who === "hero" && f.kind === "strike");
    const frameNo = calm ? 0 : Math.floor(now / (striking ? 80 : 120));
    if (heroSheet) {
      const anim = ANIMS[striking ? "run" : "idle"];
      // Heroes99 body feet sit at (41, 34) in the 100x40 frame; drawn 1:1 like a GBA battle sprite.
      sprite("hero", () =>
        ctx.drawImage(heroSheet!, (frameNo % anim.frames) * FRAME_W, anim.row * FRAME_H, FRAME_W, FRAME_H, 64 - 41 + off("hero"), FOOT - 34, FRAME_W, FRAME_H),
      );
    }
    if (wolfImg.complete && wolfImg.naturalWidth)
      sprite("foe", () => {
        if (b.foe.frozen) ctx.filter = "hue-rotate(180deg) saturate(0.6) brightness(1.4)";
        ctx.drawImage(wolfImg, (calm || b.foe.frozen ? 0 : Math.floor(now / 420) % 2) * 32, 0, 32, 24, 176 - 16 + off("foe"), FOOT - 23, 32, 24);
      });
    if (b.foe.aura && !b.over) {
      // Applied element: a small gem over the enemy.
      const bob = calm ? 0 : Math.round(Math.sin(now / 300));
      ctx.fillStyle = "#240000";
      ctx.fillRect(173, FOOT - 36 + bob, 7, 7);
      ctx.fillStyle = ELEMENT[b.foe.aura].color;
      ctx.fillRect(174, FOOT - 35 + bob, 5, 5);
    }
    requestAnimationFrame(draw);
  };

  // Scale the 240-wide frame to the space available: integer when it can, smooth otherwise.
  const fit = () => {
    const info = frame.querySelector<HTMLElement>(".fe-info")!.offsetHeight;
    const k0 = Math.min(wrap.clientWidth / W, (wrap.clientHeight - info) / H);
    crisp(canvas, W, H, k0 >= 2 ? Math.floor(k0) : Math.max(0.5, k0));
    frame.style.width = canvas.style.width;
  };

  // ---------- state → screen ----------
  function bars(heroHp = b.hero.hp, foeHp = b.foe.hp, astra = b.hero.astra) {
    const hs = heroStats(b);
    const fs = foeStats(b);
    const i = INTENTS[b.intent];
    const heroDmg = damage(physicalBase(hs.atk, 0, fs.def), b.foe.defending ? 0.5 : 1);
    const foeDmg = damage(physicalBase(fs.atk, i.power, hs.def), b.hero.defending ? 0.5 : 1);
    const rows = (el: HTMLElement, pairs: [string, string | number][]) =>
      el.replaceChildren(...pairs.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))]));
    rows(heroSide.stats, [["DMG", heroDmg], ["SPD", hs.spd], ["MP", b.hero.mp]]);
    rows(foeSide.stats, [["DMG", b.over ? "-" : foeDmg], ["SPD", fs.spd], ["DEF", fs.def]]);
    heroSide.weapon.textContent = `${CLASSES[b.classId].weapon.name} · ${CLASSES[b.classId].weapon.thai}`;
    foeSide.weapon.textContent = b.over ? foe.name : `${i.name} · ${i.thai}${b.foe.aura ? ` · ธาตุ${ELEMENT[b.foe.aura].thai}` : ""}`;
    heroSide.hpNum.textContent = String(heroHp);
    foeSide.hpNum.textContent = String(foeHp);
    heroSide.fill.style.width = `${(100 * heroHp) / hs.maxHp}%`;
    heroSide.astra.style.width = `${astra}%`;
    heroSide.astra.parentElement!.setAttribute("aria-valuetext", `${astra}/100`);
    heroSide.astra.parentElement!.classList.toggle("full", astra >= 100);
    foeSide.fill.style.width = `${(100 * foeHp) / fs.maxHp}%`;
    heroSide.el.querySelector(".fe-track")!.setAttribute("aria-valuetext", `${heroHp}/${hs.maxHp}`);
    foeSide.el.querySelector(".fe-track")!.setAttribute("aria-valuetext", `${foeHp}/${fs.maxHp}`);
  }
  function render() {
    bars();
    roundEl.textContent = ` · รอบ ${b.round}`;
    const i = INTENTS[b.intent];
    intent.textContent = b.over ? "" : `${foe.name} จะใช้: ${i.name} (${i.thai}) · พลัง +${i.power}`;
    if (b.over) return result();
    const skill = CLASSES[b.classId].skill;
    const cmd = (label: string, c: Command, extra: { class?: string } = {}) => {
      const why = illegal(b, c);
      return button(label, () => commit(c), { disabled: playing || !!why, title: why ?? "", ...extra });
    };
    cmds.replaceChildren(
      cmd("Attack โจมตี", { type: "attack" }, { class: "primary" }),
      cmd(`${skill.name} · MP ${skillCost(b)}`, { type: "skill" }),
      cmd("Defend ป้องกัน", { type: "defend" }),
      button(`Item ไอเทม`, items, { disabled: playing }),
    );
    // Over the stage, so neither ever pushes the commands off a short screen.
    frame.querySelector(".skip")?.remove();
    frame.querySelector(".burst")?.remove();
    if (playing && !cueing) frame.append(button("ข้าม ⏭", () => skipTo?.(), { class: "skip" }));
    if (!playing && !illegal(b, { type: "burst" }))
      frame.append(button(`✦ ${CLASSES[b.classId].burst}`, () => commit({ type: "burst" }), { class: "burst", title: "Astra Burst" }));
  }
  function items() {
    const usable = (Object.keys(ITEMS) as ItemId[]).filter((k) => b.items[k] > 0);
    cmds.replaceChildren(
      ...usable.map((k) => {
        const why = illegal(b, { type: "item", item: k });
        return button(`${ITEMS[k].name} ×${b.items[k]}`, () => commit({ type: "item", item: k }), { disabled: !!why, title: why ?? "" });
      }),
      button("กลับ", render, { class: "primary" }),
    );
    cmds.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }
  function result() {
    const win = b.over === "win";
    log.textContent = win ? `ชนะ! ได้รับ ${expFor(enemy, b.talentId)} EXP` : "พ่ายแพ้… กลับไปยังจุดเซฟล่าสุด";
    cmds.replaceChildren(button(win ? "กลับสู่แผนที่" : "กลับไปจุดเซฟ", () => done(b), { class: "primary", autofocus: true }));
    cmds.querySelector("button")?.focus({ preventScroll: true });
  }

  // ---------- timing cue → commit → play back ----------
  let cueing = false;
  /** One Perfect Strike/Guard result: tap or Space when the ring meets its target. */
  function cue(kind: "strike" | "guard"): Promise<Timing> {
    if (settings.autoTiming || still()) return Promise.resolve("normal");
    cueing = true;
    render();
    const el = h(
      "div",
      { class: `cue ${kind}`, aria: { hidden: "true" } },
      h("i", { class: "ring" }),
      h("b", {}, kind === "strike" ? "โจมตี!" : "ป้องกัน!"),
    );
    el.style.setProperty("--lead", `${LEAD_MS}ms`);
    frame.append(el);
    log.textContent = kind === "strike" ? "แตะจอหรือกด Space ตอนวงแหวนตรงกัน!" : `${foe.name} กำลังจะ ${INTENTS[b.intent].name}! แตะเพื่อป้องกัน`;
    const target = performance.now() + LEAD_MS;
    return new Promise((resolve) => {
      const end = (t: Timing) => {
        clearTimeout(timer);
        main.removeEventListener("pointerdown", tap);
        removeEventListener("keydown", key, true);
        document.removeEventListener("visibilitychange", away);
        el.remove();
        cueing = false;
        resolve(t);
      };
      const tap = (e: Event) => {
        e.preventDefault();
        end(judge(performance.now() - target));
      };
      const key = (e: KeyboardEvent) => {
        if (e.repeat || (e.key !== " " && e.key !== "Enter")) return;
        tap(e);
      };
      const away = () => document.hidden && end("normal"); // backgrounding never helps
      const timer = window.setTimeout(() => end("normal"), LEAD_MS + LATE_MS);
      main.addEventListener("pointerdown", tap);
      addEventListener("keydown", key, true);
      document.addEventListener("visibilitychange", away);
    });
  }

  async function commit(c: Command) {
    if (playing || illegal(b, c)) return;
    playing = true;
    const timing = c.type === "attack" || c.type === "skill" ? await cue("strike") : "normal";
    let r = act(b, `a${++seq}`, c, timing);
    while (r.events.length && main.isConnected) {
      const before = b;
      b = r.state;
      await play(before, r.events);
      if (b.over || b.queue[0] !== "foe") break;
      r = guard(b, `a${++seq}`, await cue("guard"));
    }
    playing = false;
    render();
    cmds.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }

  function play(before: BattleState, events: BattleEvent[]): Promise<void> {
    render();
    let i = 0;
    let heroHp = before.hero.hp;
    let foeHp = before.foe.hp;
    let astra = before.hero.astra;
    let timer = 0;
    const who = (by: "hero" | "foe") => (by === "hero" ? save.hero.name : foe.name);
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        skipTo = null;
        fx = [];
        down = b.over === "win" ? "foe" : b.over === "lose" ? "hero" : null;
        bars();
        resolve();
      };
      skipTo = finish;
      const step = () => {
        if (!main.isConnected) return resolve();
        if (skipTo !== finish) return;
        if (i >= events.length) return finish();
        const e = events[i++];
        const now = performance.now();
        if (e.type === "hit") {
          if (e.by === "hero") foeHp = e.hp;
          else heroHp = e.hp;
          astra = e.astra;
          fx.push({ who: e.by, kind: "strike", t0: now }, { who: e.by === "hero" ? "foe" : "hero", kind: "hurt", t0: now + 160 });
          const tag = [e.timing && TIMING_TAG[e.timing] && `${TIMING_TAG[e.timing]}${e.by === "foe" ? " Guard" : ""}`, e.reaction && REACTIONS[e.reaction]].filter(Boolean).join(" · ");
          const freeze = e.reaction === "freeze" ? ` · ${foe.name} ถูกแช่แข็ง!` : "";
          say(`${who(e.by)} ใช้ ${e.name}${tag ? ` · ${tag}` : ""} · ${e.damage} ดาเมจ${freeze}`, `${tag ? `${tag} ` : ""}-${e.damage}`, e.by === "hero" ? "at-foe" : "at-hero");
        } else if (e.type === "heal") {
          heroHp = e.hp;
          say(`${e.name} ฟื้นฟู ${e.amount} HP`, `+${e.amount}`, "at-hero heal");
        } else if (e.type === "mp") {
          say(`${e.name} ฟื้นฟู ${e.amount} MP`, `+${e.amount} MP`, "at-hero heal");
        } else if (e.type === "recoil") {
          heroHp = e.hp;
          say(`${e.name} กิน HP ตัวเอง ${e.damage}`, `-${e.damage}`, "at-hero");
        } else if (e.type === "frozen") {
          say(`${foe.name} ถูกแช่แข็ง ข้ามเทิร์นนี้!`, "Freeze", "at-foe");
        } else if (e.type === "revive") {
          heroHp = e.hp;
          down = null;
          say(`Phoenix Soul! ${save.hero.name} ฟื้นคืนชีพด้วย ${e.hp} HP`, `+${e.hp}`, "at-hero heal");
        } else if (e.type === "defend") {
          say(`${who(e.by)} ตั้งท่าป้องกัน (ดาเมจที่รับ ×0.5)`, "", "");
        } else if (e.type === "intent") {
          const it = INTENTS[e.intent];
          intent.textContent = `${foe.name} จะใช้: ${it.name} (${it.thai}) · พลัง +${it.power}`;
          return step();
        } else {
          say(e.result === "win" ? `${foe.name} ล้มลงแล้ว!` : `${save.hero.name} หมดแรง…`, "", "");
          down = e.result === "win" ? "foe" : "hero";
        }
        bars(heroHp, foeHp, astra);
        if (still()) return step();
        timer = window.setTimeout(step, STEP_MS);
      };
      step();
    });
  }

  function say(text: string, num: string, where: string) {
    log.textContent = text;
    pop.textContent = num;
    pop.className = `pop ${where}`;
    void pop.offsetWidth; // restart the pop animation
    if (num) pop.classList.add("on");
  }

  show(main);
  const ro = new ResizeObserver(() => (main.isConnected ? fit() : ro.disconnect()));
  ro.observe(wrap);
  requestAnimationFrame(draw);
  fit();
  render();
  log.textContent = `${foe.name} ปรากฏตัว!`;
  cmds.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
}
