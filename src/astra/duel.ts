// Side-view duel screen (BATTLE_VISUAL_DIRECTION). Commits each command through battle.ts
// first, then plays the returned event log; skip and resize only change what is drawn.
import { CLASSES, ENEMIES, ITEMS, type ItemId } from "./data";
import { act, foeStats, heroStats, illegal, INTENTS, startBattle, type BattleEvent, type BattleState, type Command } from "./battle";
import { ANIMS, FRAME_H, FRAME_W } from "./looks";
import type { SaveData } from "./save";
import { button, composite, h, root, show, still } from "./ui";

const STEP_MS = 520;

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

  // ---------- stage ----------
  const hero = h("canvas", { class: "sprite duel-hero", width: FRAME_W, height: FRAME_H });
  const wolf = h("canvas", { class: "foe", width: 32, height: 24 });
  const pop = h("div", { class: "pop", aria: { hidden: "true" } });
  const bar = (label: string) => {
    const fill = h("i");
    const text = h("span");
    return { el: h("div", { class: "bar" }, h("b", {}, label), h("div", { class: "track" }, fill), text), fill, text };
  };
  const heroBar = bar(save.hero.name);
  const foeBar = bar(foe.name);
  const stage = h(
    "div",
    { class: "sprite-box duel", role: "img", aria: { label: `${save.hero.name} ปะทะ ${foe.name}` } },
    h("div", { class: "bars" }, heroBar.el, foeBar.el),
    hero,
    wolf,
    pop,
  );
  const intent = h("p", { class: "intent" });
  const log = h("p", { class: "log", role: "status", aria: { live: "polite" } });
  const cmds = h("div", { class: "cmds", role: "group", aria: { label: "คำสั่ง" } });
  const roundEl = h("span");
  const main = h(
    "main",
    { class: "screen create encounter" },
    h("header", { class: "area" }, h("b", {}, foe.name), roundEl),
    stage,
    h("section", { class: "panel" }, intent, log, h("p", { class: "hint" }, "จังหวะ Perfect Strike/Guard, Astra Burst และธาตุ มาในขั้นที่ 4 ตอนนี้ทุกการโจมตีนับเป็น Normal")),
    cmds,
  );

  // Hero animation: idle loop, run frames while lunging.
  let heroAnim: keyof typeof ANIMS = "idle";
  composite(save.hero.look, save.hero.classId).then((sheet) => {
    const ctx = hero.getContext("2d")!;
    let f = 0;
    const timer = setInterval(() => {
      if (!hero.isConnected) return clearInterval(timer);
      const { row, frames } = ANIMS[heroAnim];
      if (!still()) f++;
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.drawImage(sheet, (f % frames) * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    }, 110);
  }).catch(() => stage.classList.add("missing"));
  const wolfImg = new Image();
  wolfImg.src = "world/wolf.png";
  wolfImg.onload = () => {
    const ctx = wolf.getContext("2d")!;
    let f = 0;
    const timer = setInterval(() => {
      if (!wolf.isConnected) return clearInterval(timer);
      if (!still()) f++;
      ctx.clearRect(0, 0, 32, 24);
      ctx.drawImage(wolfImg, (f % 2) * 32, 0, 32, 24, 0, 0, 32, 24);
    }, 420);
  };

  // ---------- state → screen ----------
  function bars(heroHp = b.hero.hp, foeHp = b.foe.hp) {
    const hs = heroStats(b);
    const fs = foeStats(b);
    heroBar.fill.style.width = `${(100 * heroHp) / hs.maxHp}%`;
    heroBar.text.textContent = `HP ${heroHp}/${hs.maxHp} · MP ${b.hero.mp}/${hs.maxMp}`;
    foeBar.fill.style.width = `${(100 * foeHp) / fs.maxHp}%`;
    foeBar.text.textContent = `HP ${foeHp}/${fs.maxHp}`;
  }
  function render() {
    bars();
    roundEl.textContent = `รอบ ${b.round} · ${place}`;
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
      cmd(`${skill.name} · MP ${skill.mp}`, { type: "skill" }),
      cmd("Defend ป้องกัน", { type: "defend" }),
      button(`Item ไอเทม`, items, { disabled: playing }),
    );
    if (playing) cmds.append(button("ข้าม ⏭", () => skipTo?.(), { class: "skip" }));
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
    log.textContent = win ? `ชนะ! ได้รับ ${foe.exp} EXP` : "พ่ายแพ้… กลับไปยังจุดเซฟล่าสุด";
    cmds.replaceChildren(button(win ? "กลับสู่แผนที่" : "กลับไปจุดเซฟ", () => done(b), { class: "primary", autofocus: true }));
    cmds.querySelector("button")?.focus({ preventScroll: true });
  }

  // ---------- commit, then play back ----------
  function commit(c: Command) {
    if (playing) return;
    const r = act(b, `a${++seq}`, c);
    if (!r.events.length) return; // illegal or duplicate: nothing changed
    const before = b;
    b = r.state;
    play(before, r.events);
  }

  function play(before: BattleState, events: BattleEvent[]) {
    playing = true;
    render();
    let i = 0;
    let heroHp = before.hero.hp;
    let foeHp = before.foe.hp;
    let timer = 0;
    const finish = () => {
      clearTimeout(timer);
      skipTo = null;
      playing = false;
      heroAnim = "idle";
      stage.className = "sprite-box duel";
      render();
      cmds.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    };
    skipTo = finish;
    const step = () => {
      if (!main.isConnected) return;
      if (i >= events.length) return finish();
      const e = events[i++];
      stage.className = "sprite-box duel";
      heroAnim = "idle";
      if (e.type === "hit") {
        if (e.by === "hero") (foeHp = e.hp), (heroAnim = "run");
        else heroHp = e.hp;
        stage.classList.add(e.by === "hero" ? "hero-strikes" : "foe-strikes");
        say(`${e.by === "hero" ? save.hero.name : foe.name} ใช้ ${e.name} · ${e.damage} ดาเมจ`, `-${e.damage}`, e.by === "hero" ? "at-foe" : "at-hero");
      } else if (e.type === "heal") {
        heroHp = e.hp;
        say(`ใช้ ${e.name} ฟื้นฟู ${e.amount} HP`, `+${e.amount}`, "at-hero heal");
      } else if (e.type === "defend") {
        stage.classList.add(e.by === "hero" ? "hero-guards" : "foe-guards");
        say(`${e.by === "hero" ? save.hero.name : foe.name} ตั้งท่าป้องกัน (ดาเมจที่รับ ×0.5)`, "", "");
      } else if (e.type === "intent") {
        const it = INTENTS[e.intent];
        intent.textContent = `${foe.name} จะใช้: ${it.name} (${it.thai}) · พลัง +${it.power}`;
        return step();
      } else {
        say(e.result === "win" ? `${foe.name} ล้มลงแล้ว!` : `${save.hero.name} หมดแรง…`, "", "");
        stage.classList.add(e.result === "win" ? "foe-down" : "hero-down");
      }
      bars(heroHp, foeHp);
      if (still()) return step();
      timer = window.setTimeout(step, STEP_MS);
    };
    step();
  }

  function say(text: string, num: string, where: string) {
    log.textContent = text;
    pop.textContent = num;
    pop.className = `pop ${where}`;
    void pop.offsetWidth; // restart the pop animation
    if (num) pop.classList.add("on");
  }

  const fit = () => {
    const k = Math.max(1, Math.floor(Math.min(stage.clientWidth / 110, stage.clientHeight / 50)));
    stage.style.setProperty("--k", String(k));
  };
  show(main);
  const ro = new ResizeObserver(() => (main.isConnected ? fit() : ro.disconnect()));
  ro.observe(stage);
  fit();
  render();
  log.textContent = `${foe.name} ปรากฏตัว!`;
  cmds.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
}
