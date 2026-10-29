// Side-view duel screen (BATTLE_VISUAL_DIRECTION). Captures one timing result per action,
// commits it through battle.ts, then plays the returned event log; skip and resize only
// change what is drawn.
import { CLASSES, ENEMIES, ITEMS, type Element, type ItemId } from "./data";
import {
  act,
  BURSTS,
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
import { ANIMS, FRAME_H, FRAME_W, type Anim } from "./looks";
import { heroFrame, heroMove, impactAt, keyAt, MOVES, moveLength, releaseAt, WOLF_POSES, type Key, type MoveKind, type WolfPose } from "./moves";
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
          : "แตะจอหรือกด Space ตอนวงแหวนหดตรงกัน · โจมตี Perfect ×1.2 · ป้องกัน Perfect ไม่เสีย HP · Astra เต็ม 100 ใช้ Burst",
      ),
      cmds,
    ),
  );

  // Animation state is presentation only; battle math already happened in act()/guard().
  type Side = "hero" | "foe";
  let move: { who: Side; kind: MoveKind; keys: Key[]; t0: number; burst: boolean; color: string } | null = null;
  let reaction: { who: Side; kind: "hurt" | "block"; t0: number } | null = null;
  let fallen: { who: Side; t0: number } | null = null;
  let sparks: { who: Side; t0: number; big: boolean } | null = null;
  let shake = { t0: -1e9, amp: 0 };
  let flashT0 = -1e9; // whole-stage white flash (Astra Burst)
  let heroSheet: HTMLCanvasElement | null = null;
  const bg = new Image();
  bg.src = "world/battle_forest.png";
  const wolfImg = new Image();
  wolfImg.src = "world/wolf.png";
  composite(save.hero.look, save.hero.classId).then((c) => (heroSheet = c)).catch(() => frame.classList.add("missing"));
  // Scratch canvas for tinting one sprite frame (hit flash, freeze) without ctx.filter,
  // which older Safari ignores.
  const tint = h("canvas", { width: FRAME_W, height: FRAME_H });
  const tctx = tint.getContext("2d")!;

  const FOOT = 112; // platform standing line
  const HERO_X = 64;
  const FOE_X = 176;
  const draw = (now: number) => {
    if (!main.isConnected) return;
    const calm = still();
    const quake = now - shake.t0 < 220 ? Math.round(shake.amp * Math.sin(now * 0.09)) : 0;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(quake, 0);
    if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0);

    const pose = (who: Side): { pose: Anim | WolfPose; f: number; x: number; y: number; alpha: number } => {
      if (fallen?.who === who) {
        const t = now - fallen.t0;
        return who === "hero"
          ? { pose: "dying", f: Math.min(4, Math.floor(t / 120)), x: 0, y: 0, alpha: 1 }
          : { pose: "down", f: 0, x: 0, y: 0, alpha: Math.max(0.35, 1 - t / 900) };
      }
      if (move?.who === who && now - move.t0 < moveLength(move.keys)) {
        const key = keyAt(move.keys, now - move.t0);
        return { pose: key.pose, f: who === "hero" ? heroFrame(key) : 0, x: key.x, y: key.y, alpha: 1 };
      }
      if (reaction?.who === who && now - reaction.t0 < 340) {
        const t = now - reaction.t0;
        const back = reaction.kind === "hurt" ? -Math.round(5 * (1 - t / 340)) : 0;
        if (who === "foe") return { pose: reaction.kind === "hurt" ? "hurt" : "idle", f: 0, x: back, y: 0, alpha: 1 };
        return { pose: reaction.kind, f: Math.min(ANIMS[reaction.kind].frames - 1, Math.floor(t / 80)), x: back, y: 0, alpha: 1 };
      }
      if (who === "hero" && b.hero.defending) return { pose: "block", f: 2, x: 0, y: 0, alpha: 1 };
      if (who === "hero") return { pose: "idle", f: calm ? 0 : Math.floor(now / 120) % ANIMS.idle.frames, x: 0, y: 0, alpha: 1 };
      return { pose: calm || b.foe.frozen ? "idle" : Math.floor(now / 420) % 2 ? "breathe" : "idle", f: 0, x: 0, y: 0, alpha: 1 };
    };
    const flashing = (who: Side) => reaction?.who === who && reaction.kind === "hurt" && now - reaction.t0 < 180 && Math.floor((now - reaction.t0) / 45) % 2 === 0;

    // Draws one frame, optionally washed with a colour through the scratch canvas.
    const blit = (img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, wash?: string) => {
      if (!wash) return ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
      tctx.globalCompositeOperation = "source-over";
      tctx.clearRect(0, 0, FRAME_W, FRAME_H);
      tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      tctx.globalCompositeOperation = "source-atop";
      tctx.fillStyle = wash;
      tctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(tint, 0, 0, sw, sh, dx, dy, sw, sh);
    };

    const aura = (x: number, color: string, r = 1) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, FOOT - 12, 14 * r, 18 * r, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const hp = pose("hero");
    const fp = pose("foe");
    const heroX = HERO_X + hp.x;
    const foeX = FOE_X - fp.x;
    if (b.hero.defending && !move) aura(heroX, "#8fd3ff55");
    if (b.foe.defending) aura(foeX, "#8fd3ff55");

    // Spell circle under the caster, and the Burst glow while it gathers power.
    const t = move ? now - move.t0 : 0;
    if (move && !calm) {
      const rel = releaseAt(move.keys);
      const cx = move.who === "hero" ? heroX : foeX;
      if (move.kind === "spell" && t < impactAt(move.keys)) {
        ctx.strokeStyle = move.color;
        ctx.globalAlpha = 0.8;
        ctx.setLineDash([3, 2]);
        ctx.lineDashOffset = -t / 30;
        ctx.beginPath();
        ctx.ellipse(cx, FOOT - 1, 15, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (move.burst && t < (rel >= 0 ? rel : impactAt(move.keys))) aura(cx, `rgba(250,202,88,${0.25 + 0.2 * Math.sin(t / 40)})`, 1.2);
    }

    if (heroSheet) {
      const a = ANIMS[hp.pose as Anim];
      // Heroes99 body feet sit at (41, 34) in the 100x40 frame; drawn 1:1 like a GBA battle sprite.
      ctx.globalAlpha = hp.alpha;
      blit(heroSheet, hp.f * FRAME_W, a.row * FRAME_H, FRAME_W, FRAME_H, heroX - 41, FOOT - 34 - hp.y, flashing("hero") ? "#ffffffd0" : undefined);
      ctx.globalAlpha = 1;
    }
    if (wolfImg.complete && wolfImg.naturalWidth) {
      ctx.globalAlpha = fp.alpha;
      const wash = flashing("foe") ? "#ffffffd0" : b.foe.frozen && !b.over ? "#9fe8ff80" : undefined;
      blit(wolfImg, WOLF_POSES.indexOf(fp.pose as WolfPose) * 32, 0, 32, 24, foeX - 16, FOOT - 23 - fp.y, wash);
      ctx.globalAlpha = 1;
    }

    // Projectile from release to impact: an arrow, or a glowing bolt with a short trail.
    if (move && !calm) {
      const rel = releaseAt(move.keys);
      const hit = impactAt(move.keys);
      if (rel >= 0 && t >= rel && t < hit) {
        const p = (t - rel) / (hit - rel);
        const x0 = move.who === "hero" ? heroX + 10 : foeX - 10;
        const x1 = move.who === "hero" ? foeX - 6 : heroX + 6;
        const x = x0 + (x1 - x0) * p;
        const y = FOOT - 18 - Math.round(6 * Math.sin(Math.PI * p));
        if (move.kind === "shot") {
          ctx.fillStyle = "#240000";
          ctx.fillRect(Math.round(x) - 7, Math.round(y) - 1, 10, 3);
          ctx.fillStyle = "#e8e0c8";
          ctx.fillRect(Math.round(x) - 6, Math.round(y), 8, 1);
          ctx.fillStyle = move.color;
          ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 2, 3);
        } else {
          for (let i = 3; i >= 0; i--) {
            ctx.globalAlpha = 1 - i * 0.22;
            ctx.fillStyle = i ? move.color : "#ffffff";
            const r = i ? 4 - i : 2;
            ctx.fillRect(Math.round(x - i * 5 * Math.sign(x1 - x0)) - r, Math.round(y) - r, r * 2, r * 2);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    // Impact: a slash crescent for melee, then sparks bursting out of the target.
    if (sparks && !calm) {
      const st = now - sparks.t0;
      const cx = sparks.who === "foe" ? foeX : heroX;
      const cy = FOOT - (sparks.who === "foe" ? 12 : 18);
      if (st < 300) {
        const n = sparks.big ? 14 : 9;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + i;
          const d = (sparks.big ? 34 : 22) * Math.min(1, st / 260);
          ctx.globalAlpha = 1 - st / 300;
          ctx.fillStyle = i % 3 ? "#ffffff" : "#faca58";
          ctx.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d * 0.7), 2, 2);
        }
        if (move?.kind === "melee" && st < 150) {
          ctx.globalAlpha = 1 - st / 150;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx - 4, cy - 2, 13, -1.9, 0.9);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.globalAlpha = 1;
      }
    }

    if (b.foe.aura && !b.over) {
      // Applied element: a small gem over the enemy.
      const bob = calm ? 0 : Math.round(Math.sin(now / 300));
      ctx.fillStyle = "#240000";
      ctx.fillRect(foeX - 3, FOOT - 36 + bob, 7, 7);
      ctx.fillStyle = ELEMENT[b.foe.aura].color;
      ctx.fillRect(foeX - 2, FOOT - 35 + bob, 5, 5);
    }
    ctx.restore();
    if (now - flashT0 < 200) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - (now - flashT0) / 200)})`;
      ctx.fillRect(0, 0, W, H);
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
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const who = (by: "hero" | "foe") => (by === "hero" ? save.hero.name : foe.name);
    const skill = CLASSES[b.classId].skill;
    const burstName = CLASSES[b.classId].burst;
    return new Promise((resolve) => {
      const finish = () => {
        timers.forEach(clearTimeout);
        skipTo = null;
        move = null;
        reaction = null;
        sparks = null;
        fallen = b.over ? { who: b.over === "win" ? "foe" : "hero", t0: -1e9 } : null;
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
          const target: Side = e.by === "hero" ? "foe" : "hero";
          const burst = e.by === "hero" && e.name === burstName;
          const blocked = e.by === "foe" && (e.damage === 0 || before.hero.defending);
          const impact = () => {
            if (e.by === "hero") foeHp = e.hp;
            else heroHp = e.hp;
            astra = e.astra;
            const tag = [e.timing && TIMING_TAG[e.timing] && `${TIMING_TAG[e.timing]}${e.by === "foe" ? " Guard" : ""}`, e.reaction && REACTIONS[e.reaction]].filter(Boolean).join(" · ");
            const freeze = e.reaction === "freeze" ? ` · ${foe.name} ถูกแช่แข็ง!` : "";
            say(`${who(e.by)} ใช้ ${e.name}${tag ? ` · ${tag}` : ""} · ${e.damage} ดาเมจ${freeze}`, e.damage ? `${tag ? `${tag} ` : ""}-${e.damage}` : `${tag} Block!`, e.by === "hero" ? "at-foe" : "at-hero");
            bars(heroHp, foeHp, astra);
            const t1 = performance.now();
            reaction = { who: target, kind: blocked ? "block" : "hurt", t0: t1 };
            const big = burst || e.timing === "perfect";
            sparks = { who: target, t0: t1, big };
            shake = { t0: t1, amp: burst ? 4 : big ? 3 : e.damage ? 1 : 0 };
            if (burst) flashT0 = t1;
          };
          if (still()) {
            impact();
            return step();
          }
          const magic = e.by === "foe" ? false : e.name === skill.name ? skill.kind === "magic" : burst ? BURSTS[b.classId].kind === "magic" : e.name !== "Attack";
          const kind: MoveKind = e.by === "foe" ? "bite" : heroMove(b.classId, magic);
          const element = e.name === skill.name ? skill.element : (Object.values(ITEMS).find((it) => it.name === e.name) as { element?: Element } | undefined)?.element;
          const color = element ? ELEMENT[element].color : burst ? "#faca58" : b.classId === "cleric" ? "#ffe9a8" : kind === "shot" ? "#c67b02" : "#c9a5ff";
          move = { who: e.by, kind, keys: MOVES[kind], t0: now, burst, color };
          later(impactAt(move.keys), impact);
          later(moveLength(move.keys) + 120, () => {
            move = null;
            step();
          });
          return;
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
          fallen = null;
          say(`Phoenix Soul! ${save.hero.name} ฟื้นคืนชีพด้วย ${e.hp} HP`, `+${e.hp}`, "at-hero heal");
        } else if (e.type === "defend") {
          say(`${who(e.by)} ตั้งท่าป้องกัน (ดาเมจที่รับ ×0.5)`, "", "");
        } else if (e.type === "intent") {
          const it = INTENTS[e.intent];
          intent.textContent = `${foe.name} จะใช้: ${it.name} (${it.thai}) · พลัง +${it.power}`;
          return step();
        } else {
          say(e.result === "win" ? `${foe.name} ล้มลงแล้ว!` : `${save.hero.name} หมดแรง…`, "", "");
          fallen = { who: e.result === "win" ? "foe" : "hero", t0: now };
        }
        if (e.type === "defend" && e.by === "hero") reaction = { who: "hero", kind: "block", t0: now };
        bars(heroHp, foeHp, astra);
        if (still()) return step();
        later(e.type === "end" ? 900 : STEP_MS, step);
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
