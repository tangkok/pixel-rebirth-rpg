import Phaser from "phaser";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource/press-start-2p/latin-400.css";
import "./style.css";
import { icon } from "./icons";
import { heroArt, itemArt } from "./game/art";
import { ForestScene, WORLD } from "./game/World";
import {
  attackPower,
  freshProgress,
  maxHp,
  nextLevelXp,
  parseSave,
  SAVE_KEY,
} from "./game/model";

let storageAvailable = true;
function readSave() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    storageAvailable = false;
    return null;
  }
}
const progress = parseSave(readSave());
const portrait = heroArt().toDataURL();
const items = Object.fromEntries(
  ["sword", "potion", "crystal", "coin"].map((k) => [
    k,
    itemArt(k).toDataURL(),
  ]),
);
const item = (key: string, cls = "") =>
  `<img class="pixel-art ${cls}" src="${items[key]}" alt="" draggable="false" />`;
const nav = (key: string, label: string, extra = "") =>
  `<button class="nav-item ${key === "compass" ? "active" : ""}" data-panel="${key}" ${key === "compass" ? 'aria-current="page"' : ""}>${icon(key)}<span>${label}</span>${extra || (key === "compass" ? icon("chevron", "nav-arrow") : "")}</button>`;
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <aside class="sidebar" aria-label="Main navigation">
    <a class="brand" href="./" aria-label="Pixel Rebirth home"><div class="brand-mark"><i></i><b></b><em></em></div><div>PIXEL<span>REBIRTH<span class="brand-dot">.</span></span></div></a>
    <div class="profile"><div class="portrait"><img class="pixel-art" src="${portrait}" alt="Ash, your adventurer" /></div><div><strong>Ash <span class="online-dot"></span></strong><span>Novice adventurer</span></div><span class="level-badge" data-level>LV. 1</span></div>
    <div class="nav-label">YOUR JOURNEY</div>
    <nav>${nav("compass", "Adventure")}${nav("person", "Character")}${nav("bag", "Inventory", '<span class="nav-count" id="inventory-count">4</span>')}${nav("map", "World map")}${nav("book", "Quest journal")}</nav>
    <div class="sidebar-quest"><div class="small-label">${icon("flag")} ACTIVE QUEST</div><h3>A little less slime</h3><p>Help Rowan clear the forest trail.</p><div class="quest-task"><span class="quest-checkbox" id="quest-check"></span><span id="quest-task-label">Defeat forest slimes</span><b data-kills>0/5</b></div><div class="mini-track"><i id="quest-fill"></i></div><button class="text-link" data-panel="book">View quest ${icon("arrow")}</button></div>
    <div class="sidebar-bottom"><div class="forest-note"><span class="little-stars">✦ &nbsp; · &nbsp; ✧</span><h3>Small steps.<br>Great adventures.</h3><p>There’s a whole world<br>waiting beyond the trail.</p><div class="tiny-forest"><i></i><i></i><i></i><i></i><i></i></div></div><button class="nav-item settings" data-panel="settings">${icon("settings")}<span>Settings</span><span class="version">v0.1</span></button><div class="made-with">A new beginning, one pixel at a time.</div></div>
  </aside>
  <button class="nav-scrim" aria-label="Close navigation"></button>
  <div class="main-shell">
    <header class="topbar"><div class="breadcrumbs"><button class="mobile-menu icon-btn" aria-label="Open navigation">${icon("menu")}</button><span>Play</span>${icon("chevron")}<strong>Adventure</strong></div><div class="topbar-right"><span class="save-status">${icon("cloud")}<span id="save-status">All progress saved</span></span><span class="top-divider"></span><button class="icon-btn" data-panel="help" aria-label="Help">${icon("help")}</button><button class="mini-profile" data-panel="person" aria-label="Open character"><img class="pixel-art" src="${portrait}" alt="" /></button></div></header>
    <main>
      <section class="page-heading"><div><div class="eyebrow"><span></span> A NEW DAY. A NEW ADVENTURE.</div><h1>Your adventure starts here<span>.</span></h1><p>A little courage. A path unknown. A story that’s yours to write.</p></div><button class="button secondary how-to" data-panel="help">${icon("play")} How to play</button></section>
      <section class="game-card" aria-label="Pixel Rebirth game">
        <div class="game-topline"><div class="location-heading">${icon("leaf")}<strong>Whispering Woods</strong><span class="area-level">LV. 1–5</span></div><div class="game-top-actions"><span class="live-status"><i></i> EXPLORING</span><button class="icon-btn sound-btn" aria-label="Enable sound" title="Enable sound">${icon("mute")}</button><button class="icon-btn" id="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen">${icon("expand")}</button></div></div>
        <div id="game-viewport">
          <div id="game"></div>
          <div class="world-vignette"></div>
          <div class="hud-player"><div class="hud-avatar"><img class="pixel-art" src="${portrait}" alt="" /></div><div class="hud-player-info"><div><strong>Ash</strong><span data-level>LV. 1</span></div><div class="health-track"><i id="health-fill"></i></div><span class="health-value" id="health-value">100 / 100 HP</span></div></div>
          <button class="minimap" data-panel="map" aria-label="Open world map"><svg viewBox="0 0 124 100" aria-hidden="true"><rect width="124" height="100" fill="#344c37"/><path d="M0 29h17v9h18V12h17v17h21v-9h25v18h26v48h-21v14H0Z" fill="#4f6844"/><path d="m2 56 31 3 22-8 34 7 35-5M55 0l-2 32 4 27-4 41" fill="none" stroke="#c0ac77" stroke-width="7"/><path d="m94 0-5 26 8 29-7 24 5 21" fill="none" stroke="#6ca69a" stroke-width="12"/><path d="M86 54h21" stroke="#b09a6c" stroke-width="8"/><g fill="#2a4333"><path d="m12 6 9 15H3zm15 66 9 15H18zm44-7 9 15H62zm1-58 9 15H63z"/></g><circle id="map-dot" cx="55" cy="54" r="4" fill="#f2e6ad" stroke="#354833" stroke-width="2"/></svg><span>WHISPERING WOODS ${icon("expand")}</span><b class="north">N</b></button>
          <div class="area-toast"><span class="area-line"></span><span>THE OVERWORLD</span><strong>Whispering Woods</strong><span class="area-coords">A quiet place for a new beginning.</span></div>
          <div class="world-tip">${icon("leaf")} Follow your curiosity.</div><div id="interaction-hint" hidden><kbd>E</kbd><span>Talk to Rowan</span></div>
          <div class="quick-slots"><button class="quick-slot selected" id="slot-sword" aria-label="Attack"><kbd>1</kbd>${item("sword")}<span>Iron sword</span></button><button class="quick-slot" id="slot-potion" aria-label="Use healing potion"><kbd>Q</kbd>${item("potion")}<b id="potion-count">3</b><span>Healing potion</span></button><button class="quick-slot" data-panel="bag" aria-label="Open inventory"><kbd>I</kbd>${icon("bag")}<span>Inventory</span></button></div>
          <div class="touch-controls"><div class="dpad"><button data-hold="UP" aria-label="Move up">${icon("chevron")}</button><button data-hold="LEFT" aria-label="Move left">${icon("chevron")}</button><span></span><button data-hold="RIGHT" aria-label="Move right">${icon("chevron")}</button><button data-hold="DOWN" aria-label="Move down">${icon("chevron")}</button></div><div class="touch-actions"><button id="touch-interact" aria-label="Interact">${icon("person")}<span>Talk</span></button><button id="touch-dash" aria-label="Dash">${icon("bolt")}<span>Dash</span></button><button id="touch-attack" aria-label="Attack">${icon("sword")}<span>Attack</span></button></div></div>
          <button id="resume-game" class="resume-overlay" hidden>${icon("play")}<strong>Take a breath.</strong><span>Your adventure will be right here.</span><b>Resume adventure</b></button>
          <div id="loading"><div class="loading-leaf">${icon("leaf")}</div><strong>A world is waking up…</strong></div>
        </div>
        <div class="game-footer"><div class="experience"><span class="xp-level" data-level>LV. 1</span><div><div class="xp-text"><span>Novice adventurer</span><b id="xp-value">0 / 60 XP</b></div><div class="xp-track"><i id="xp-fill"></i></div></div></div><div class="gold-balance">${item("coin")}<strong data-gold>0</strong><span>gold</span></div><button class="icon-btn" id="pause" aria-label="Pause game" title="Pause game">${icon("pause")}</button></div>
      </section>
      <div class="controls-legend"><div><span><kbd>W</kbd><span class="wasd"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Move</span><span class="legend-divider"></span><kbd>SPACE</kbd><span>Attack</span><kbd>SHIFT</kbd><span>Dash</span><kbd>E</kbd><span>Interact</span><kbd>Q</kbd><span>Heal</span></div><span class="touch-hint">${icon("compass")} Your next adventure is a tap away.</span><button data-panel="help">All controls ${icon("arrowUp")}</button></div>
      <section class="below-game"><article class="chapter-card"><div class="card-icon">${icon("flag")}</div><div><div class="small-label">A SMALL FAVOR</div><h2>Every hero starts somewhere.</h2><p>Find Rowan by the campfire. He could use a hand.</p><button class="text-link" data-panel="book">See your first quest ${icon("arrow")}</button></div><span class="chapter-number">01</span></article><article class="field-card"><div class="small-label">${icon("book")} FIELD NOTES <span>NO. 001</span></div><p>“The forest doesn’t ask where you’ve been.<br>Only where you’re going.”</p><span>— A traveler’s journal</span></article></section>
      <footer class="page-footer"><span><i class="online-dot"></i> YOUR WORLD, YOUR PACE.</span><span>Crafted with pixels. Filled with possibility. ${icon("spark")}</span></footer>
    </main>
  </div>
  <div id="toasts" role="status" aria-live="polite"></div>
  <dialog id="panel"><div class="dialog-top"><span class="eyebrow" id="panel-eyebrow">YOUR ADVENTURE</span><button class="icon-btn" id="close-panel" aria-label="Close dialog">${icon("close")}</button></div><div id="panel-content"></div></dialog>
`;

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const setText = (s: string, t: string) =>
  document.querySelectorAll(s).forEach((el) => (el.textContent = t));
let saveTimer: ReturnType<typeof setTimeout>;
function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    storageAvailable = true;
    $("#save-status").textContent = "All progress saved";
  } catch {
    storageAvailable = false;
    $("#save-status").textContent = "Session only";
  }
}
function render() {
  setText("[data-level]", `LV. ${progress.level}`);
  setText("[data-gold]", `${progress.gold}`);
  setText("[data-kills]", `${Math.min(progress.kills, 5)}/5`);
  $("#health-fill").style.width =
    `${Math.max(0, (progress.hp / maxHp(progress)) * 100)}%`;
  $("#health-value").textContent =
    `${Math.max(0, progress.hp)} / ${maxHp(progress)} HP`;
  $("#xp-fill").style.width = `${(progress.xp / nextLevelXp(progress)) * 100}%`;
  $("#xp-value").textContent = `${progress.xp} / ${nextLevelXp(progress)} XP`;
  $("#potion-count").textContent = String(progress.potions);
  $("#inventory-count").textContent = String(
    1 + progress.potions + progress.crystals,
  );
  $("#quest-fill").style.width = `${Math.min(progress.kills / 5, 1) * 100}%`;
  $("#quest-check").classList.toggle("complete", progress.kills >= 5);
  $("#quest-check").innerHTML = progress.kills >= 5 ? icon("check") : "";
  if (progress.questClaimed) {
    $(".sidebar-quest h3").textContent = "Beyond the bridge";
    $(".sidebar-quest p").textContent = progress.bossDefeated
      ? "The woods are safe. Well done, Ash."
      : "Find the Grove Guardian in the eastern ruins.";
    $("#quest-task-label").textContent = "Defeat Grove Guardian";
    setText("[data-kills]", progress.bossDefeated ? "1/1" : "0/1");
    $("#quest-fill").style.width = progress.bossDefeated ? "100%" : "0%";
    $("#quest-check").classList.toggle("complete", progress.bossDefeated);
    $("#quest-check").innerHTML = progress.bossDefeated ? icon("check") : "";
  }
  $("#save-status").textContent = storageAvailable ? "Saving…" : "Session only";
  saveTimer = setTimeout(save, 300);
}
function toast(text: string, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = icon(kind === "success" ? "spark" : "leaf");
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 6500);
  while ($("#toasts").children.length > 3)
    $("#toasts").firstElementChild?.remove();
}
let soundEnabled = false;
let audio: AudioContext | undefined;
function sound(kind: string) {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const freqs: Record<string, number[]> = {
      attack: [190, 100],
      hurt: [130, 70],
      pickup: [540, 810],
      level: [392, 494, 587, 784],
      dash: [300, 150],
    };
    (freqs[kind] ?? [440]).forEach((f, i) => {
      const o = audio!.createOscillator(),
        g = audio!.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.045, audio!.currentTime + i * 0.075);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        audio!.currentTime + i * 0.075 + 0.14,
      );
      o.connect(g).connect(audio!.destination);
      o.start(audio!.currentTime + i * 0.075);
      o.stop(audio!.currentTime + i * 0.075 + 0.15);
    });
  } catch {
    soundEnabled = false;
    toast("Audio is unavailable in this browser.");
  }
}
const scene = new ForestScene(progress, {
  change: render,
  message: toast,
  sound,
  ready: () => {
    $("#loading").remove();
    $("#game canvas").setAttribute(
      "aria-label",
      "Whispering Woods adventure. Use WASD to move, Space to attack, E to interact.",
    );
    render();
  },
});
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#3d5d42",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [scene],
  audio: { noAudio: true },
  input: { activePointers: 4 },
  render: { antialias: false, powerPreference: "low-power" },
});
game.events.on("position", ({ x, y }: { x: number; y: number }) => {
  const d = $("#map-dot");
  d.setAttribute("cx", String((x / WORLD.width) * 124));
  d.setAttribute("cy", String((y / WORLD.height) * 100));
  const nearRowan = Math.hypot(x - 535, y - 516) < 100,
    nearChest = Math.hypot(x - 887, y - 474) < 90;
  $("#interaction-hint").hidden = !(nearRowan || nearChest);
  $("#interaction-hint span").textContent = nearRowan
    ? "Talk to Rowan"
    : progress.openedChest
      ? "Empty chest"
      : "Open treasure chest";
});
render();

const dialog = $("#panel") as HTMLDialogElement;
let manuallyPaused = false;
function pause(value: boolean) {
  manuallyPaused = value;
  scene.setPaused(value || dialog.open);
  $("#resume-game").hidden = !value;
  $("#pause").innerHTML = icon(value ? "play" : "pause");
  $("#pause").setAttribute("aria-label", value ? "Resume game" : "Pause game");
  $(".live-status").innerHTML = `<i></i> ${value ? "PAUSED" : "EXPLORING"}`;
}
const controls = `<div class="help-intro">A quiet forest. A rusty sword. A whole lot of possibility.<br>Your story begins at the crossroads.</div><div class="help-controls"><div><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / arrow keys</span><strong>Explore the world</strong></div><div><kbd>SPACE</kbd><strong>Swing your sword</strong></div><div><kbd>SHIFT</kbd><strong>Dash & dodge · 1.5s cooldown</strong></div><div><kbd>E</kbd><strong>Talk to Rowan / open a chest</strong></div><div><kbd>Q</kbd><strong>Drink a healing potion</strong></div><div><kbd>I</kbd><strong>Open your inventory</strong></div></div><p class="dialog-note">On mobile, use the direction pad and action buttons. Collect glowing crystals by walking over them. Defeat slimes to earn XP and level up. Progress saves automatically on this browser.</p>`;
function showPanel(key: string) {
  $(".sidebar").classList.remove("mobile-open");
  $(".mobile-menu").setAttribute("aria-expanded", "false");
  if (key === "compass") {
    if (dialog.open) dialog.close();
    scene.setPaused(manuallyPaused);
    return;
  }
  scene.setPaused(true);
  let content = "";
  if (key === "help")
    content = `<h2>A little guide to your adventure.</h2>${controls}<button class="button primary dialog-play" id="begin-adventure">${icon("compass")} Let’s explore</button>`;
  if (key === "person")
    content = `<h2>Meet Ash.</h2><p class="dialog-subtitle">Every legend has a first chapter. This one is yours.</p><div class="character-sheet"><div class="character-preview"><img class="pixel-art" src="${portrait}" alt="Ash" /><span>ASH · LEVEL ${progress.level}</span></div><div><span class="tag">NOVICE ADVENTURER</span><h3>A heart for the unknown.</h3><p>A wanderer with a well-worn scarf, an iron sword, and a knack for finding trouble.</p><div class="stat-grid"><div>${icon("heart")}<span>Health</span><b>${progress.hp} / ${maxHp(progress)}</b></div><div>${icon("sword")}<span>Attack</span><b>${attackPower(progress)}</b></div><div>${icon("bolt")}<span>Speed</span><b>155</b></div><div>${icon("spark")}<span>Experience</span><b>${progress.xp} / ${nextLevelXp(progress)}</b></div></div></div></div><p class="dialog-note">Level up by defeating enemies, collecting forest crystals and completing quests. Each level restores your health and increases your strength.</p>`;
  if (key === "bag")
    content = `<h2>Room for a little wonder.</h2><p class="dialog-subtitle">Your inventory · ${progress.gold} gold in your pocket</p><div class="inventory-grid"><div class="inventory-item">${item("sword")}<span class="tag">EQUIPPED</span><h3>Iron sword</h3><p>A reliable beginning.</p><strong>${attackPower(progress)} attack</strong></div><div class="inventory-item">${item("potion")}<span class="tag">× ${progress.potions}</span><h3>Healing potion</h3><p>Restores 65 health.</p><button class="button secondary" id="inventory-heal" ${progress.potions === 0 || progress.hp >= maxHp(progress) ? "disabled" : ""}>Use potion</button></div><div class="inventory-item">${item("crystal")}<span class="tag">× ${progress.crystals}</span><h3>Forest crystal</h3><p>A little piece of the woods.</p><strong>Collected treasure</strong></div></div><p class="dialog-note">Visit Rowan at the campfire after your first quest to buy potions for 15 gold. Open the chest north-east of the crossroads for extra supplies.</p>`;
  if (key === "map")
    content = `<h2>Somewhere worth getting lost.</h2><p class="dialog-subtitle">Whispering Woods · The first of many adventures</p><div class="full-map"><svg viewBox="0 0 600 340" role="img" aria-label="World map: campsite in the west, crossroads in the center, Grove Guardian in the northeast, bridge in the east"><defs><pattern id="trees" width="38" height="40" patternUnits="userSpaceOnUse"><path d="m19 5 13 23H6Z" fill="#496548"/><path d="m19 10 8 14H11Z" fill="#607d50"/></pattern></defs><rect width="600" height="340" rx="8" fill="#38523d"/><rect x="5" y="5" width="590" height="330" fill="url(#trees)"/><path d="m0 185 125 5 145-15 145 15 185-10M265 0l-8 85 14 90-8 165" stroke="#a99e70" stroke-width="22" fill="none"/><path d="m430-10-12 90 18 70-8 100 12 100" stroke="#69a091" stroke-width="39" fill="none"/><path d="M402 175h56v28h-56" fill="#b7a06c"/><rect x="494" y="62" width="65" height="57" fill="#8a9170" stroke="#b2b694" stroke-width="5"/><g fill="#ede6bd" font-size="13" font-family="monospace"><text x="115" y="130">CAMP</text><text x="215" y="226">CROSSROADS</text><text x="466" y="49">OLD RUINS</text><text x="451" y="237">BRIDGE</text></g><circle cx="185" cy="153" r="6" fill="#daa366"/><circle cx="${((scene.player?.x ?? 710) / 1600) * 600}" cy="${((scene.player?.y ?? 600) / 1120) * 340}" r="7" fill="#f8eac0" stroke="#273d31" stroke-width="3"/><path d="m522 78 6 10-6 10-6-10Z" fill="#dfaa69"/></svg></div><div class="map-legend"><span><i></i> You are here</span><span><i></i> Rowan’s campsite</span><span><i></i> Grove Guardian</span></div><p class="dialog-note">Head west from the crossroads to find Rowan. Follow the trail east, cross the wooden bridge, then go north to discover the old ruins.</p>`;
  if (key === "book")
    content = `<h2>Little quests. Lasting stories.</h2><p class="dialog-subtitle">The Whispering Woods journal</p><article class="quest-detail"><div class="small-label">CHAPTER 01 <span class="tag">${progress.questClaimed ? "COMPLETED" : progress.kills >= 5 ? "RETURN TO ROWAN" : "IN PROGRESS"}</span></div><h3>A little less slime</h3><p>“The slimes have gotten a little too comfortable on our trails. Could you lend an old ranger a hand?”</p><span class="quest-giver">— Rowan, the forest ranger</span><div class="quest-objective">${icon(progress.kills >= 5 ? "check" : "sword")}<strong>Defeat 5 forest slimes</strong><b>${Math.min(progress.kills, 5)} / 5</b></div><div class="quest-objective">${icon(progress.questClaimed ? "check" : "person")}<strong>Return to Rowan at the campsite</strong></div><div class="quest-rewards"><span>YOUR REWARD</span><b>${item("coin")}75 gold</b><b>${icon("spark")}80 XP</b><b>${item("potion")}2 potions</b></div></article><article class="quest-next"><div>${icon("flag")}</div><div><h3>Beyond the bridge</h3><p>${progress.bossDefeated ? "Completed — the Grove Guardian has fallen." : progress.questClaimed ? "The Grove Guardian lurks in the eastern ruins. Defeat it to restore peace." : "Complete your first quest. There’s more to this forest than meets the eye."}</p></div></article>`;
  if (key === "settings")
    content = `<h2>Make yourself at home.</h2><p class="dialog-subtitle">A few things to make the journey yours.</p><div class="settings-row"><div><h3>Game sounds</h3><p>Little sounds for your little adventures.</p></div><button class="toggle ${soundEnabled ? "on" : ""}" id="settings-sound" aria-label="Toggle game sounds" aria-pressed="${soundEnabled}"><i></i></button></div><div class="settings-row"><div><h3>Automatic saving</h3><p>${storageAvailable ? "Your progress is saved in this browser." : "Browser storage unavailable. Progress lasts this session."}</p></div><span class="tag">${storageAvailable ? "ACTIVE" : "SESSION ONLY"}</span></div><div class="settings-row"><div><h3>A fresh start</h3><p>Reset your character, inventory and quests.</p></div><button class="button danger" id="reset-progress">Reset progress</button></div><p class="dialog-note">Pixel Rebirth v0.1 · An original adventure built with Phaser and TypeScript. All character and world artwork is created for this game.</p>`;
  $("#panel-content").innerHTML = content;
  if (!dialog.open) dialog.showModal();
  $("#begin-adventure")?.addEventListener("click", () => dialog.close());
  $("#inventory-heal")?.addEventListener("click", () => {
    dialog.close();
    scene.usePotion();
    showPanel("bag");
  });
  $("#settings-sound")?.addEventListener("click", () => {
    toggleSound();
    showPanel("settings");
  });
  $("#reset-progress")?.addEventListener("click", () => {
    $("#panel-content").innerHTML =
      `<h2>A new beginning?</h2><p class="dialog-subtitle">This will reset Ash’s level, items and quest progress in this browser.</p><div class="reset-actions"><button class="button secondary" id="cancel-reset">Keep adventuring</button><button class="button danger" id="confirm-reset">Yes, start fresh</button></div>`;
    $("#cancel-reset").onclick = () => showPanel("settings");
    $("#confirm-reset").onclick = () => {
      Object.assign(progress, freshProgress());
      save();
      location.reload();
    };
  });
}
document
  .querySelectorAll<HTMLElement>("[data-panel]")
  .forEach((el) =>
    el.addEventListener("click", () => showPanel(el.dataset.panel!)),
  );
$("#close-panel").onclick = () => dialog.close();
dialog.addEventListener("close", () => scene.setPaused(manuallyPaused));
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
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
$("#pause").onclick = () => pause(!manuallyPaused);
$("#resume-game").onclick = () => pause(false);
$("#slot-sword").onclick = () => scene.attack();
$("#slot-potion").onclick = () => scene.usePotion();
$("#touch-attack").onclick = () => scene.attack();
$("#touch-dash").onclick = () => scene.dash();
$("#touch-interact").onclick = () => scene.interact();
document.querySelectorAll<HTMLElement>("[data-hold]").forEach((el) => {
  const release = () => {
    scene.held.delete(el.dataset.hold!);
    el.classList.remove("pressed");
  };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    scene.held.add(el.dataset.hold!);
    el.classList.add("pressed");
  });
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("lostpointercapture", release);
});
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.querySelectorAll(".sound-btn").forEach((el) => {
    el.innerHTML = icon(soundEnabled ? "sound" : "mute");
    el.setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");
  });
  if (soundEnabled) sound("pickup");
}
$(".sound-btn").onclick = toggleSound;
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $(".game-card").requestFullscreen();
  } catch {
    toast("Fullscreen isn’t available here. You can still keep exploring.");
  }
};
function closeNavigation() {
  $(".sidebar").classList.remove("mobile-open");
  $(".mobile-menu").setAttribute("aria-expanded", "false");
  scene.setPaused(manuallyPaused || dialog.open);
}
$(".mobile-menu").onclick = () => {
  const open = $(".sidebar").classList.toggle("mobile-open");
  $(".mobile-menu").setAttribute("aria-expanded", String(open));
  scene.setPaused(open || manuallyPaused || dialog.open);
};
$(".nav-scrim").onclick = closeNavigation;
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyI" && !dialog.open) {
    e.preventDefault();
    showPanel("bag");
  }
  if (e.code === "Escape" && !dialog.open) pause(!manuallyPaused);
  if (e.code === "Digit1" && !dialog.open) scene.attack();
});
window.addEventListener("blur", () => {
  scene.clearInput();
  if (scene.player && !dialog.open) pause(true);
  save();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    scene.clearInput();
    save();
  }
});
window.addEventListener("pagehide", save);
// Exposed only in Vite development for functional browser tests and debugging.
if (import.meta.env.DEV)
  Object.assign(window, { __pixelRebirth: { scene, progress, game } });
