import Phaser from "phaser";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/cinzel";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "./style.css";
import "./expansion.css";
import {
  creationPanel,
  racePanel,
  subclassPanel,
  abilityPanel,
} from "./characterPanel";
import { raceById, RARITIES } from "./game/lineage";
import { icon } from "./icons";
import { fighterArt, portraitArt } from "./game/battleArt";
import { BattleScene } from "./game/BattleScene";
import { renderSize } from "./game/display";
import {
  activeFighter,
  allocate,
  awardVictory,
  beginBattle,
  buyPotions,
  canAct,
  CLASSES,
  enemyAction,
  freshTactics,
  living,
  performAction,
  pointsLeft,
  readTactics,
  requiredXp,
  respec,
  stats,
  STAGES,
  switchClass,
  TACTICS_KEY,
  PARTY_KEY,
  SOLO_KEY,
  rollRace,
  createCharacter,
  switchSubclass,
  upgradeSkill,
  renameHero,
  upgradeWeapon,
  type ActionId,
  type Battle,
  type ClassId,
  type CombatEvent,
  type Talent,
} from "./game/tactics";

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
let storageAvailable = true;
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageAvailable = false;
    return null;
  }
}
const save = readTactics(
  read(TACTICS_KEY) ?? read(SOLO_KEY) ?? read(PARTY_KEY),
  read("pixel-rebirth-save-v1"),
);
const portraits = Object.fromEntries(
  Object.keys(CLASSES).map((k) => [k, portraitArt(k as ClassId)]),
);
const enemies = Object.fromEntries(
  ["sentinel", "wisp", "thorn", "dragon"].map((k) => [
    k,
    fighterArt(k).toDataURL(),
  ]),
);
const portrait = (kind: string) => portraits[kind] ?? enemies[kind];
let battle: Battle = beginBattle(save),
  selected = "sentinel",
  busy = false,
  paused = false,
  automatic = false,
  fast = false,
  boost = false,
  ready = false,
  skillOpen = false;
let nextTimer: ReturnType<typeof setTimeout> | undefined;
let selectedBuild = "ash";
let activePanel = "";
let creationName =
  save.builds[0].name === "ผู้เดินทาง" ? "" : save.builds[0].name;
let audio: AudioContext | undefined;
let reward: { gold: number; xp: number; leveled: boolean } | null = null;

document.querySelector("#app")!.innerHTML = `
<header class="topbar">
  <a class="brand" href="./" aria-label="Pixel Rebirth"><span class="brand-rune">✦</span><span>PIXEL <b>REBIRTH</b><small>A NEW LEGACY</small></span><em>HD·2D</em></a>
  <nav aria-label="Main navigation"><button class="nav-link active" data-panel="adventure">${icon("compass")}<span>Adventure</span></button><button class="nav-link" data-panel="party">${icon("person")}<span>ตัวละครของฉัน</span></button><button class="nav-link" data-panel="codex">${icon("book")}<span>Codex</span></button></nav>
  <div class="topbar-tools"><span class="gold-counter"><i>◆</i><b id="gold-value">150</b><small>G</small></span><span class="account-level">LV. <b id="level-value">1</b></span><button class="icon-btn" data-panel="settings" aria-label="Settings / ตั้งค่า">${icon("settings")}</button></div>
</header>
<main class="battle-shell">
  <section class="battlefield" aria-label="2.5D turn-based battlefield">
    <div id="game"></div><div class="cinematic-shade"></div>
    <div class="location-heading"><span class="eyebrow"><i></i> CHAPTER I <b> / </b> THE CRYSTAL WAKE</span><h1 id="stage-name">The Hollow Sanctuary</h1><p id="stage-thai">วิหารแห่งแสงที่ถูกลืม</p><button class="location-link" data-panel="adventure">${icon("pin")} EXPEDITION <span id="stage-number">01</span> / 03 ${icon("chevron")}</button></div>
    <div class="turn-order"><span class="micro-label">TURN ORDER</span><div id="timeline"></div><span class="round-indicator">ROUND <b id="round-value">01</b></span></div>
    <div class="battle-tools"><button id="speed" aria-label="Toggle battle speed">1× <span>SPEED</span></button><button id="auto" aria-label="Toggle auto battle" aria-pressed="false">${icon("play")}<span>AUTO</span></button><button class="icon-btn" id="fullscreen" aria-label="Fullscreen">${icon("expand")}</button><button class="icon-btn" data-panel="help" aria-label="How to play / วิธีเล่น">${icon("help")}</button></div>
    <div class="scene-caption"><span class="caption-diamond">◇</span><span>Where the forgotten light awakens.</span><i></i></div>
    <div class="battle-announcement" id="announcement" hidden></div>
    <div id="result" class="result-overlay" hidden></div>
    <div id="loading"><div class="loading-rune">✧</div><h2>The sanctuary awakens.</h2><p>กำลังเตรียมการผจญภัยของคุณ…</p></div>
  </section>
  <section class="battle-hud" aria-label="Battle controls">
    <div class="party-panel"><div class="panel-heading"><span class="micro-label"><i></i> YOUR CHARACTER <b id="party-alive">SOLO</b></span><button class="text-button" data-panel="party">ปั้นตัวละครของฉัน ${icon("arrowUp")}</button></div><div class="party-cards" id="party-cards"></div><div class="battle-log"><span class="log-icon">✧</span><p id="combat-log">แสงผลึกส่องนำทาง — การต่อสู้เริ่มขึ้น</p><button data-panel="log" aria-label="Battle log">${icon("book")}</button></div></div>
    <div class="command-panel"><div class="command-top"><div><span class="micro-label" id="turn-label">YOUR TURN</span><strong id="actor-name">ผู้เดินทาง<span> / DAWN WARDEN</span></strong></div><button id="boost" class="boost-button" aria-pressed="false">${icon("bolt")} BOOST <small>2 BP</small></button></div><div class="target-row"><span>TARGET</span><button id="target-prev" aria-label="Previous target">${icon("chevron")}</button><b id="target-name">Hollow Sentinel</b><button id="target-next" aria-label="Next target">${icon("chevron")}</button></div><div id="skill-menu" class="skill-menu" hidden></div><div class="command-grid"><button data-action="attack" class="command attack" aria-label="Attack / โจมตี"><span class="command-icon">${icon("sword")}</span><span><b>โจมตี</b><small>Attack</small></span><kbd>1</kbd></button><button id="skill-toggle" class="command" aria-label="Skills / ทักษะ" aria-expanded="false"><span class="command-icon">${icon("spark")}</span><span><b>ทักษะ</b><small>Skills</small></span><kbd>2</kbd></button><button data-action="guard" class="command" aria-label="Guard / ป้องกัน"><span class="command-icon">${icon("heart")}</span><span><b>ป้องกัน</b><small>Guard · +BP</small></span><kbd>3</kbd></button><button data-action="item" class="command" aria-label="Potion / ใช้ยา"><span class="command-icon">${icon("potion")}</span><span><b>ใช้ไอเทม</b><small>Healing potion <em id="potion-count">×5</em></small></span><kbd>4</kbd></button></div><div class="command-footer"><i></i><span id="command-hint">เลือกคำสั่งเมื่อพร้อม</span><span class="turn-based-tag">TURN-BASED</span></div></div>
  </section>
</main>
<footer class="bottom-bar"><span><i></i> <b id="save-status">PROGRESS SAVED</b><span class="footer-divider">/</span> ORIGINAL WORLD. YOUR LEGACY.</span><span>เลือกเส้นทางของคุณ แล้วสร้างตำนานบทใหม่ <em>✧</em></span><button class="sound-btn" aria-label="Toggle sound">${icon(save.sound ? "sound" : "mute")}<span>SOUND ${save.sound ? "ON" : "OFF"}</span></button></footer>
<dialog id="panel"><div class="dialog-top"><span class="eyebrow">PIXEL REBIRTH <b> / </b> YOUR LEGACY</span><button class="icon-btn" id="close-panel" aria-label="Close dialog / ปิด">${icon("close")}</button></div><div id="panel-content"></div></dialog><div id="toasts" role="status" aria-live="polite"></div>
`;
const dialog = $("#panel") as HTMLDialogElement;
function persist() {
  try {
    localStorage.setItem(TACTICS_KEY, JSON.stringify(save));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  $("#save-status").textContent = storageAvailable
    ? "PROGRESS SAVED"
    : "SESSION ONLY";
}
function toast(text: string) {
  const e = document.createElement("div");
  e.className = "toast";
  e.innerHTML = icon("spark");
  const span = document.createElement("span");
  span.textContent = text;
  e.append(span);
  $("#toasts").append(e);
  setTimeout(() => e.remove(), 4200);
  while ($("#toasts").children.length > 3)
    $("#toasts").firstElementChild?.remove();
}
function sound(kind: string) {
  if (!save.sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const tones =
      kind === "heal"
        ? [440, 660, 880]
        : kind === "victory"
          ? [392, 494, 587, 784]
          : kind === "magic"
            ? [330, 660, 990]
            : [180, 110];
    tones.forEach((hz, i) => {
      const o = audio!.createOscillator(),
        g = audio!.createGain();
      o.type = "triangle";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.035, audio!.currentTime + i * 0.065);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        audio!.currentTime + i * 0.065 + 0.17,
      );
      o.connect(g).connect(audio!.destination);
      o.start(audio!.currentTime + i * 0.065);
      o.stop(audio!.currentTime + i * 0.065 + 0.18);
    });
  } catch {
    save.sound = false;
  }
}
const initialRender = renderSize(
  $("#game").clientWidth,
  $("#game").clientHeight,
  window.devicePixelRatio,
);
const scene = new BattleScene(
  {
    ready: () => {
      ready = true;
      for (const k of Object.keys(CLASSES))
        portraits[k] = portraitArt(k as ClassId);
      for (const k of ["sentinel", "wisp", "thorn", "dragon"])
        enemies[k] = fighterArt(k).toDataURL();
      $("#loading").remove();
      scene.sync(battle);
      $("#game canvas").setAttribute(
        "aria-label",
        "2.5D fantasy turn-based battle arena",
      );
      render();
      if (!save.created) showPanel("create");
      schedule();
    },
    select: (id) => {
      selected = id;
      render();
    },
  },
  initialRender.density,
);
scene.reducedMotion =
  save.reducedMotion ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b1822",
  transparent: false,
  scale: {
    mode: Phaser.Scale.NONE,
    width: initialRender.bufferWidth,
    height: initialRender.bufferHeight,
    zoom: 1 / initialRender.density,
  },
  scene: [scene],
  audio: { noAudio: true },
  render: { antialias: true, powerPreference: "low-power" },
  input: { activePointers: 3 },
});
const resizeCanvas = () => {
  const size = renderSize(
    $("#game").clientWidth,
    $("#game").clientHeight,
    window.devicePixelRatio,
  );
  scene.setRenderDensity(size.density);
  game.scale.setZoom(1 / size.density);
  game.scale.resize(size.bufferWidth, size.bufferHeight);
  game.canvas.style.width = `${size.width}px`;
  game.canvas.style.height = `${size.height}px`;
};
const resizeObserver = new ResizeObserver(() => {
  if (ready) resizeCanvas();
});
resizeObserver.observe($("#game"));
window.addEventListener("resize", () => {
  if (ready) resizeCanvas();
});
function isPlayerTurn() {
  return (
    ready &&
    save.created &&
    !busy &&
    !paused &&
    !dialog.open &&
    battle.phase === "ready" &&
    activeFighter(battle)?.side === "party"
  );
}
function ensureTarget() {
  if (!living(battle, "enemy").some((a) => a.id === selected))
    selected = living(battle, "enemy")[0]?.id ?? "";
  scene.selected = selected;
}
function render() {
  ensureTarget();
  const actor = activeFighter(battle),
    player = isPlayerTurn();
  $("#gold-value").textContent = String(save.gold);
  $("#level-value").textContent = String(save.level);
  $("#stage-name").textContent = STAGES[battle.stage].name;
  $("#stage-thai").textContent = STAGES[battle.stage].thai;
  $("#stage-number").textContent = String(battle.stage + 1).padStart(2, "0");
  $(".location-heading .eyebrow").innerHTML =
    `<i></i> CHAPTER ${["I", "II", "III"][battle.stage]} <b> / </b> ${STAGES[battle.stage].chapter}`;
  $("#round-value").textContent = String(battle.round).padStart(2, "0");
  $("#timeline").innerHTML = battle.queue
    .map((_, offset) => {
      const id = battle.queue[(battle.cursor + offset) % battle.queue.length],
        a = battle.actors.find((a) => a.id === id)!;
      return a.hp > 0
        ? `<span class="turn-slot ${offset === 0 ? "current" : ""} ${a.side === "enemy" ? "enemy" : ""}" title="${a.name}"><img src="${portrait(a.classId)}" class="pixel-art" alt="${a.name}"/>${offset === 0 ? "<i></i>" : ""}</span>`
        : "";
    })
    .join("");
  $("#party-alive").textContent = living(battle, "party").length
    ? "SOLO HERO"
    : "FALLEN";
  $("#party-cards").innerHTML = battle.actors
    .filter((a) => a.side === "party")
    .map(
      (a) =>
        `<button class="party-card ${actor?.id === a.id ? "active" : ""} ${a.hp <= 0 ? "fallen" : ""}" data-build="${a.id}" aria-label="Build ${a.name}"><div class="hero-portrait"><img class="pixel-art" src="${portraits[a.classId]}" alt=""/><span>${CLASSES[a.classId as ClassId].role[0]}</span></div><div class="hero-card-main"><div class="hero-card-name"><strong>${a.name}</strong><span>LV ${save.level}</span></div><span class="hero-class">${CLASSES[a.classId as ClassId].name}<span class="hud-race"> · ${raceById(save.builds[0].raceId)?.name ?? ""}</span></span><div class="hero-meter"><span>HP</span><div><i style="width:${(a.hp / a.maxHp) * 100}%"></i></div><b>${a.hp}<small>/${a.maxHp}</small></b></div><div class="hero-meter mp"><span>MP</span><div><i style="width:${(a.mp / a.maxMp) * 100}%"></i></div><b>${a.mp}<small>/${a.maxMp}</small></b></div><div class="hero-xp"><span>XP</span><div><i style="width:${(save.xp / requiredXp(save)) * 100}%"></i></div><b>${save.xp} / ${requiredXp(save)}</b></div><div class="bp-row"><span>BP</span>${[1, 2, 3].map((n) => `<i class="${a.bp >= n ? "filled" : ""}"></i>`).join("")}${a.guarding ? "<em>GUARD</em>" : a.hp <= 0 ? "<em>DOWN</em>" : ""}</div></div></button>`,
    )
    .join("");
  document.querySelectorAll<HTMLElement>("[data-build]").forEach(
    (el) =>
      (el.onclick = () => {
        selectedBuild = el.dataset.build!;
        showPanel("party");
      }),
  );
  $("#actor-name").innerHTML = actor
    ? `${actor.name}<span> / ${actor.side === "party" ? CLASSES[actor.classId as ClassId].role : "HOSTILE"}</span>`
    : "The adventure continues";
  $("#turn-label").textContent =
    battle.phase === "victory"
      ? "VICTORY"
      : battle.phase === "defeat"
        ? "A SECOND CHANCE"
        : paused
          ? "PAUSED"
          : busy
            ? "RESOLVING ACTION"
            : actor?.side === "enemy"
              ? "ENEMY TURN"
              : "YOUR TURN";
  $("#target-name").textContent =
    battle.actors.find((a) => a.id === selected)?.name ?? "—";
  $("#potion-count").textContent = `×${battle.potions}`;
  document
    .querySelectorAll<HTMLButtonElement>(".command-grid button")
    .forEach((b) => (b.disabled = !player));
  const boostButton = $("#boost") as HTMLButtonElement;
  boostButton.disabled = !player || (actor?.bp ?? 0) < 2;
  boostButton.classList.toggle("enabled", boost);
  boostButton.setAttribute("aria-pressed", String(boost));
  $("#command-hint").textContent = paused
    ? "หยุดพัก — กดเล่นต่อได้เลย"
    : battle.phase !== "ready"
      ? "การเดินทางบทใหม่กำลังรออยู่"
      : busy
        ? "กำลังแสดงผลการต่อสู้…"
        : actor?.side === "enemy"
          ? "ศัตรูกำลังเลือกการโจมตี…"
          : boost
            ? "บูสต์พร้อม! คำสั่งถัดไปรุนแรงขึ้น 65%"
            : "เลือกคำสั่งเมื่อพร้อม ไม่มีเวลาจำกัด";
  $("#combat-log").textContent =
    battle.log.filter((l) => l !== "REWARDS_CLAIMED").at(-1) ?? "";
  $("#skill-menu").hidden = !skillOpen || !player;
  $("#skill-toggle").setAttribute("aria-expanded", String(skillOpen && player));
  if (actor?.side === "party") {
    const cls = CLASSES[actor.classId as ClassId];
    const sub = actor.subClassId ? CLASSES[actor.subClassId] : null;
    $("#skill-menu").innerHTML =
      `<button data-skill="skill" ${actor.mp < cls.cost ? "disabled" : ""}><span>${icon("spark")}<b>${cls.skill} <small>R${(actor.skillRank ?? 0) + 1}</small></b><small>${cls.skillHint}</small></span><em>${cls.cost} MP</em></button>${sub ? `<button data-skill="secondary" ${actor.mp < sub.cost ? "disabled" : ""}><span>${icon("book")}<b>${sub.skill}</b><small>อาชีพเสริม · ${sub.skillHint}</small></span><em>${sub.cost} MP</em></button>` : ""}<button data-skill="restore" ${actor.mp < 16 ? "disabled" : ""}><span>${icon("heart")}<b>Starlight Mend</b><small>ฟื้นฟู HP ให้ตัวคุณเอง</small></span><em>16 MP</em></button>`;
  }
  document
    .querySelectorAll<HTMLElement>("[data-skill]")
    .forEach(
      (el) => (el.onclick = () => void act(el.dataset.skill as ActionId)),
    );
  $("#auto").classList.toggle("enabled", automatic);
  $("#auto").setAttribute("aria-pressed", String(automatic));
  $("#speed").innerHTML = `${fast ? "2" : "1"}× <span>SPEED</span>`;
}
function schedule() {
  clearTimeout(nextTimer);
  if (
    !ready ||
    !save.created ||
    busy ||
    paused ||
    dialog.open ||
    battle.phase !== "ready"
  )
    return;
  const actor = activeFighter(battle);
  if (actor?.side === "enemy")
    nextTimer = setTimeout(() => void act("attack", true), fast ? 180 : 650);
  else if (automatic)
    nextTimer = setTimeout(() => void act("attack"), fast ? 180 : 650);
}
async function act(action: ActionId, enemy = false) {
  if (
    !ready ||
    !save.created ||
    busy ||
    paused ||
    dialog.open ||
    battle.phase !== "ready"
  )
    return;
  const actor = activeFighter(battle);
  if (!actor || enemy !== (actor.side === "enemy")) return;
  const problem = canAct(battle, action, !enemy && boost);
  if (problem) {
    toast(problem);
    return;
  }
  busy = true;
  skillOpen = false;
  clearTimeout(nextTimer);
  const actionName = enemy
    ? `${actor.name} · Attack`
    : action === "skill"
      ? CLASSES[actor.classId as ClassId].skill
      : action === "secondary"
        ? CLASSES[actor.subClassId!].skill
        : action === "restore"
          ? "Starlight Mend"
          : action === "guard"
            ? "Defensive Stance"
            : action === "item"
              ? "Healing Potion"
              : boost
                ? "Boosted Strike"
                : "Attack";
  const events: CombatEvent[] = enemy
    ? enemyAction(battle)
    : performAction(
        battle,
        action,
        action === "item" || action === "restore" ? undefined : selected,
        boost,
      );
  boost = false;
  save.potions = battle.potions;
  persist();
  $("#announcement").textContent = actionName;
  $("#announcement").hidden = false;
  render();
  sound(
    action === "item" || action === "restore"
      ? "heal"
      : action === "skill" || action === "secondary"
        ? "magic"
        : "attack",
  );
  await scene.play(events, battle, fast);
  $("#announcement").hidden = true;
  busy = false;
  save.potions = battle.potions;
  settleAction();
}
function settleAction() {
  if (battle.phase === "victory") {
    reward = awardVictory(save, battle);
    persist();
    showResult();
    sound("victory");
  } else if (battle.phase === "defeat") {
    persist();
    showResult();
  } else persist();
  render();
  schedule();
}
function startBattle(stage: number) {
  if (busy) return;
  clearTimeout(nextTimer);
  battle = beginBattle(save, stage);
  reward = null;
  boost = false;
  skillOpen = false;
  paused = false;
  selected = living(battle, "enemy")[0].id;
  $("#result").hidden = true;
  if (dialog.open) dialog.close();
  scene.sync(battle);
  render();
  schedule();
}
function showResult() {
  const victory = battle.phase === "victory";
  $("#result").hidden = false;
  $("#result").innerHTML =
    `<div class="result-card"><span class="result-sigil">${victory ? "✦" : "◇"}</span><span class="eyebrow">${victory ? "THE LIGHT REMAINS" : "YOUR LEGACY CONTINUES"}</span><h2>${victory ? "Victory" : "Rise again"}</h2><p>${victory ? "อีกหนึ่งบทของตำนานที่คุณเป็นผู้เขียน" : "ความพ่ายแพ้คือจุดเริ่มต้นของบิลด์ที่แข็งแกร่งกว่า"}</p>${victory ? `<div class="rewards"><span><b>+${reward?.gold ?? 0}</b> GOLD</span><span><b>+${reward?.xp ?? 0}</b> XP</span>${reward?.leveled ? `<span><b>LEVEL ${save.level}</b> +2 TALENT POINTS</span>` : ""}</div>` : ""}<div class="result-actions"><button class="button primary" id="next-battle">${victory && battle.stage < 2 ? "ด่านถัดไป" : "เริ่มการต่อสู้อีกครั้ง"} ${icon("arrow")}</button><button class="button secondary" id="result-build">ปั้นตัวละครของฉัน</button></div><button class="text-button" id="result-expeditions">เลือกด่านการเดินทาง ${icon("compass")}</button></div>`;
  $("#next-battle").onclick = () =>
    startBattle(victory ? Math.min(2, battle.stage + 1) : battle.stage);
  $("#result-build").onclick = () => showPanel("party");
  $("#result-expeditions").onclick = () => showPanel("adventure");
}
function cycleTarget(dir: number) {
  const targets = living(battle, "enemy");
  if (!targets.length) return;
  const index = targets.findIndex((t) => t.id === selected);
  selected = targets[(index + dir + targets.length) % targets.length].id;
  render();
}
function showPanel(key: string) {
  if (!save.created) key = "create";
  activePanel = key;
  $("#close-panel").hidden = key === "create";
  dialog.classList.toggle("character-creation", key === "create");
  clearTimeout(nextTimer);
  skillOpen = false;
  let html =
    key === "create" ? creationPanel(save, creationName, portraits) : "";
  if (key === "party") {
    const b = save.builds.find((b) => b.id === selectedBuild) ?? save.builds[0],
      a = stats(b, save.level),
      cls = CLASSES[b.classId];
    html = `<div class="dialog-title"><span class="eyebrow">YOUR CHARACTER. YOUR LEGACY.</span><h2>Forge your legacy<span>.</span></h2><p>ตัวละครของคุณคนเดียว เลือกอาชีพ ลงแต้ม และเติบโตในแบบของคุณ</p></div><form class="hero-name-form" id="hero-name-form"><label for="hero-name-input">ชื่อตัวละครของคุณ</label><input id="hero-name-input" name="heroName" maxlength="20" value="${b.name}" autocomplete="off" required/><button class="button secondary" type="submit">บันทึกชื่อ</button></form><div class="build-sheet"><div class="build-preview"><div class="character-aura"></div><img class="pixel-art" src="${fighterArt(b.classId).toDataURL()}" alt="${b.name} ${cls.name}"/><span>${b.name}</span><small>LEVEL ${save.level}</small></div><div class="build-info"><div class="build-class-name"><span class="eyebrow">${cls.role}</span><h3>${cls.name}</h3><p>${cls.description}</p></div><div class="class-selector">${Object.entries(
      CLASSES,
    )
      .map(
        ([id, c]) =>
          `<button data-class="${id}" class="${id === b.classId ? "selected" : ""}" aria-label="Class ${c.name}">${icon(id === "warden" ? "sword" : id === "arcanist" ? "spark" : "compass")}<span>${c.thai}</span></button>`,
      )
      .join(
        "",
      )}</div><div class="build-stats"><span>HP <b>${a.maxHp}</b></span><span>MP <b>${a.maxMp}</b></span><span>ATK <b>${a.attack}</b></span><span>MAG <b>${a.magic}</b></span><span>DEF <b>${a.defense}</b></span><span>SPD <b>${a.speed}</b></span></div><div class="talent-heading"><span class="micro-label">TALENT POINTS <b id="talent-points">${pointsLeft(save, b)} AVAILABLE</b></span><button id="respec" class="text-button">คืนแต้มทั้งหมด</button></div><div class="talents">${(
      [
        ["might", "พลังโจมตี", "ATK +4"],
        ["vitality", "ความทนทาน", "HP +18 / DEF +2"],
        ["spirit", "พลังเวท", "MAG +4 / MP +6"],
        ["haste", "ความเร็ว", "SPD +3"],
      ] as const
    )
      .map(
        ([id, label, bonus]) =>
          `<div><span><strong>${label}</strong><small>${bonus}</small></span><b>${b.talents[id]}</b><button data-talent="${id}" aria-label="Allocate ${id}" ${pointsLeft(save, b) <= 0 ? "disabled" : ""}>+</button></div>`,
      )
      .join(
        "",
      )}</div></div></div><div class="equipment-row"><span class="equipment-icon">${icon(b.classId === "arcanist" ? "spark" : "sword")}</span><div><span class="eyebrow">EQUIPPED WEAPON</span><strong>${b.upgraded ? cls.upgrade : cls.weapon}</strong><small>${b.upgraded ? "อัปเกรดแล้ว · ATK +12 / MAG +10" : "อัปเกรดเพื่อเพิ่ม ATK +12 / MAG +10"}</small></div><button class="button secondary" id="upgrade-weapon" ${b.upgraded || save.gold < 100 ? "disabled" : ""}>${b.upgraded ? "อัปเกรดแล้ว" : "อัปเกรด · 100 G"}</button></div>${abilityPanel(save)}${racePanel(save)}${subclassPanel(save)}<div class="build-bottom"><p>การปรับบิลด์จะมีผลเมื่อเริ่มการต่อสู้ใหม่ คืนแต้มได้ฟรี</p><button class="button primary" id="apply-build">นำบิลด์ลงสนาม ${icon("arrow")}</button></div>`;
  }
  if (key === "adventure")
    html = `<div class="dialog-title"><span class="eyebrow">A WORLD WAITING TO BE REMEMBERED</span><h2>Choose your chapter<span>.</span></h2><p>ฟื้นแสงแห่งผลึก เดินทางผ่าน 3 บท และเผชิญราชันแห่งคราส</p></div><div class="expedition-grid">${STAGES.map((s, i) => `<button class="expedition-card stage-${i} ${i > save.unlocked ? "locked" : ""}" data-stage="${i}" ${i > save.unlocked ? "disabled" : ""}><span class="expedition-number">0${i + 1}</span><div><span class="eyebrow">${save.cleared.includes(i) ? "COMPLETED" : i > save.unlocked ? "LOCKED" : "READY TO EXPLORE"}</span><h3>${s.name}</h3><p>${s.thai}</p><small>${s.description}</small><strong>${s.reward} G <i>·</i> ${s.xp} XP ${icon(i > save.unlocked ? "settings" : "arrow")}</strong></div></button>`).join("")}</div><p class="dialog-note">เลือกด่านที่ปลดล็อกเพื่อเริ่มการต่อสู้ใหม่ เล่นซ้ำเพื่อเก็บเลเวลและเงินได้</p>`;
  if (key === "codex" || key === "help")
    html = `<div class="dialog-title"><span class="eyebrow">THE TRAVELER'S CODEX</span><h2>A little strategy. A lasting legend<span>.</span></h2><p>ทุกคำสั่งสร้างความแตกต่าง — ค่อย ๆ เลือกได้ ไม่มีเวลาจำกัด</p></div><div class="codex-grid"><article>${icon("compass")}<h3>ลำดับเทิร์น</h3><p>ตัวละครที่มี SPD สูงจะได้ลงมือก่อน ดูลำดับจากแถบด้านบน ศัตรูจะโจมตีเมื่อถึงเทิร์นของมัน</p></article><article>${icon("bolt")}<h3>Boost · 2 BP</h3><p>แตะ BOOST ก่อนเลือกคำสั่งเพื่อเพิ่มพลัง 65% ทุกคำสั่งเพิ่ม BP 1 แต้ม การป้องกันเพิ่มได้อีก 1 แต้ม สูงสุด 3</p></article><article>${icon("sword")}<h3>บิลด์และอาชีพ</h3><p>เลือก 6 อาชีพหลัก ผสมอาชีพเสริมเมื่อ LV 2 เผ่า 15 แบบให้โบนัสต่างกัน เพิ่มค่าสถานะด้วยแต้ม และใช้ AP เพิ่มพลังทักษะในตัวละครของฉัน</p></article><article>${icon("heart")}<h3>ป้องกันและฟื้นฟู</h3><p>Guard ลดความเสียหาย 55% จนถึงเทิร์นถัดไปพร้อมคืน 8 MP ยาฟื้น 90 HP และ Starlight Mend ฟื้นฟู HP ให้ตัวคุณเอง ใช้ได้กับตัวคุณเอง</p></article></div><div class="help-keys"><span><kbd>1</kbd> โจมตี</span><span><kbd>2</kbd> ทักษะ</span><span><kbd>3</kbd> ป้องกัน</span><span><kbd>4</kbd> ยา</span><span><kbd>B</kbd> บูสต์</span></div><p class="dialog-note">บนโทรศัพท์แตะคำสั่งได้โดยตรง แตะศัตรูหรือใช้ลูกศร TARGET เพื่อเลือกเป้าหมาย แตะการ์ดตัวละครของคุณเพื่อจัดบิลด์ เกมเซฟอัตโนมัติในเบราว์เซอร์นี้</p>`;
  if (key === "log")
    html = `<div class="dialog-title"><span class="eyebrow">EVERY MOVE TELLS A STORY</span><h2>Battle chronicle<span>.</span></h2></div><div class="chronicle">${battle.log
      .filter((l) => l !== "REWARDS_CLAIMED")
      .map((l) => `<p>${icon("spark")}${l}</p>`)
      .join("")}</div>`;
  if (key === "settings")
    html = `<div class="dialog-title"><span class="eyebrow">MAKE THE JOURNEY YOURS</span><h2>A moment of quiet<span>.</span></h2></div><div class="setting-row"><div><h3>เสียงเกม</h3><p>เสียงการโจมตี เวทมนตร์ และชัยชนะ</p></div><button class="toggle ${save.sound ? "on" : ""}" id="settings-sound" aria-label="Toggle game sound" aria-pressed="${save.sound}"><i></i></button></div><div class="setting-row"><div><h3>ลดการเคลื่อนไหวและแสง</h3><p>ลดการสั่นกล้อง แสงวาบ และอนุภาค</p></div><button class="toggle ${scene.reducedMotion ? "on" : ""}" id="settings-motion" aria-label="Reduce motion" aria-pressed="${scene.reducedMotion}"><i></i></button></div><div class="setting-row"><div><h3>การบันทึก</h3><p>${storageAvailable ? "เซฟอัตโนมัติในเบราว์เซอร์นี้" : "เบราว์เซอร์ไม่อนุญาตให้เซฟ เล่นได้ในเซสชันนี้"}</p></div><span class="tag">${storageAvailable ? "AUTO SAVE" : "SESSION ONLY"}</span></div><div class="setting-row"><div><h3>เสบียงการเดินทาง</h3><p>ยาฟื้นฟู 90 HP · มี ${save.potions} ขวด</p></div><button class="button secondary" id="buy-potion" ${save.gold < 25 ? "disabled" : ""}>ซื้อยา · 25 G</button></div><div class="setting-row"><div><h3>เริ่มตำนานใหม่</h3><p>ล้างเลเวล เงิน บิลด์ และความคืบหน้าตัวละครคนเดียว</p></div><button class="button danger" id="reset-save">ล้างเซฟ</button></div><p class="dialog-note">Pixel Rebirth v0.4 · Original HD·2D turn-based RPG prototype. ตัวละครและศัตรูใช้ภาพ HD ต้นฉบับ ฉากจัดองค์ประกอบแบบหลายชั้นและเรนเดอร์ตามความละเอียดจอ เซฟเวอร์ชันปาร์ตี้เดิมยังอยู่แยกต่างหาก</p>`;
  $("#panel-content").innerHTML = html;
  if (!dialog.open) dialog.showModal();
  render();
  document.querySelectorAll<HTMLElement>("[data-build-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        selectedBuild = el.dataset.buildTab!;
        showPanel("party");
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-class]").forEach(
    (el) =>
      (el.onclick = () => {
        switchClass(save, selectedBuild, el.dataset.class as ClassId);
        persist();
        showPanel("party");
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-talent]").forEach(
    (el) =>
      (el.onclick = () => {
        allocate(save, selectedBuild, el.dataset.talent as Talent);
        persist();
        showPanel("party");
      }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-stage]")
    .forEach(
      (el) => (el.onclick = () => startBattle(Number(el.dataset.stage))),
    );
  $("#create-name")?.addEventListener("input", (e) => {
    creationName = (e.target as HTMLInputElement).value;
  });
  document.querySelectorAll<HTMLElement>("[data-create-class]").forEach(
    (el) =>
      (el.onclick = () => {
        switchClass(save, "ash", el.dataset.createClass as ClassId);
        persist();
        showPanel("create");
      }),
  );
  $("#character-create-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = ($("#create-name") as HTMLInputElement).value;
    if (!createCharacter(save, name, save.builds[0].classId)) return;
    persist();
    startBattle(0);
    toast("ตำนานของคุณเริ่มต้นแล้ว");
  });
  $("#roll-race")?.addEventListener("click", () => {
    const race = rollRace(save);
    if (race) {
      persist();
      showPanel(activePanel);
      sound("magic");
      toast(`${race.name} · ${RARITIES[race.rarity].name}`);
    }
  });
  $("#upgrade-skill")?.addEventListener("click", () => {
    if (upgradeSkill(save)) {
      persist();
      showPanel("party");
      toast("พลังทักษะเพิ่มขึ้น 12%");
    }
  });
  document.querySelectorAll<HTMLElement>("[data-subclass]").forEach(
    (el) =>
      (el.onclick = () => {
        if (
          switchSubclass(
            save,
            el.dataset.subclass === "none"
              ? null
              : (el.dataset.subclass as ClassId),
          )
        ) {
          persist();
          showPanel("party");
        }
      }),
  );
  $("#hero-name-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#hero-name-input") as HTMLInputElement;
    renameHero(save, input.value);
    const actor = battle.actors.find((a) => a.side === "party");
    if (actor) actor.name = save.builds[0].name;
    persist();
    scene.sync(battle);
    showPanel("party");
    toast("บันทึกชื่อตัวละครแล้ว");
  });
  $("#respec")?.addEventListener("click", () => {
    respec(save, selectedBuild);
    persist();
    showPanel("party");
  });
  $("#upgrade-weapon")?.addEventListener("click", () => {
    if (upgradeWeapon(save, selectedBuild)) {
      persist();
      showPanel("party");
      toast("อัปเกรดอาวุธสำเร็จ");
    }
  });
  $("#apply-build")?.addEventListener("click", () => startBattle(battle.stage));
  $("#settings-sound")?.addEventListener("click", () => {
    toggleSound();
    showPanel("settings");
  });
  $("#settings-motion")?.addEventListener("click", () => {
    save.reducedMotion = !scene.reducedMotion;
    scene.reducedMotion = save.reducedMotion;
    persist();
    showPanel("settings");
  });
  $("#buy-potion")?.addEventListener("click", () => {
    if (buyPotions(save)) {
      battle.potions++;
      persist();
      showPanel("settings");
      toast("ได้รับยาฟื้นฟู 1 ขวด");
    }
  });
  $("#reset-save")?.addEventListener("click", () => {
    $("#panel-content").innerHTML =
      '<div class="dialog-title"><h2>Begin again?</h2><p>ล้างความคืบหน้าเวอร์ชันเทิร์นเบสทั้งหมดหรือไม่?</p></div><div class="result-actions"><button class="button secondary" id="cancel-reset">เก็บตำนานเดิมไว้</button><button class="button danger" id="confirm-reset">ยืนยันเริ่มใหม่</button></div>';
    $("#cancel-reset").onclick = () => showPanel("settings");
    $("#confirm-reset").onclick = () => {
      Object.assign(save, freshTactics());
      persist();
      startBattle(0);
      creationName = "";
      showPanel("create");
    };
  });
}
function toggleSound() {
  save.sound = !save.sound;
  $(".sound-btn").innerHTML =
    `${icon(save.sound ? "sound" : "mute")}<span>SOUND ${save.sound ? "ON" : "OFF"}</span>`;
  persist();
  if (save.sound) sound("heal");
}
$("#close-panel").onclick = () => {
  if (save.created) dialog.close();
};
dialog.addEventListener("cancel", (e) => {
  if (!save.created) e.preventDefault();
});
dialog.addEventListener("close", () => {
  render();
  schedule();
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog && save.created) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
document
  .querySelectorAll<HTMLElement>("[data-panel]")
  .forEach((el) => (el.onclick = () => showPanel(el.dataset.panel!)));
document
  .querySelectorAll<HTMLElement>("[data-action]")
  .forEach(
    (el) => (el.onclick = () => void act(el.dataset.action as ActionId)),
  );
$("#skill-toggle").onclick = () => {
  if (isPlayerTurn()) {
    skillOpen = !skillOpen;
    render();
  }
};
$("#boost").onclick = () => {
  if (isPlayerTurn() && (activeFighter(battle)?.bp ?? 0) >= 2) {
    boost = !boost;
    render();
  }
};
$("#target-prev").onclick = () => cycleTarget(-1);
$("#target-next").onclick = () => cycleTarget(1);
$("#auto").onclick = () => {
  automatic = !automatic;
  render();
  schedule();
};
$("#speed").onclick = () => {
  fast = !fast;
  render();
  schedule();
};
$(".sound-btn").onclick = toggleSound;
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#app").requestFullscreen();
  } catch {
    toast("เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ แต่เล่นต่อได้ตามปกติ");
  }
};
document.addEventListener("keydown", (e) => {
  if (dialog.open || e.repeat) return;
  if (e.code === "Digit1") void act("attack");
  if (e.code === "Digit2") $("#skill-toggle").click();
  if (e.code === "Digit3") void act("guard");
  if (e.code === "Digit4") void act("item");
  if (e.code === "KeyB") $("#boost").click();
  if (e.code === "ArrowLeft") cycleTarget(-1);
  if (e.code === "ArrowRight") cycleTarget(1);
});
window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
  if (paused) clearTimeout(nextTimer);
  else {
    render();
    schedule();
  }
  persist();
});
persist();
render();
if (import.meta.env.DEV)
  Object.assign(window, {
    __pixelRebirth: {
      scene,
      game,
      save,
      get battle() {
        return battle;
      },
      startBattle,
    },
  });
