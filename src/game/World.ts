import Phaser from "phaser";
import { createArt } from "./art";
import {
  attackPower,
  claimQuest,
  gainXp,
  heal,
  maxHp,
  type Progress,
} from "./model";

export const WORLD = { width: 1600, height: 1120, spawn: { x: 710, y: 600 } };
type Enemy = {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hp: number;
  max: number;
  homeX: number;
  homeY: number;
  hitAt: number;
  boss: boolean;
  bar: Phaser.GameObjects.Graphics;
};
type Obstacle = { x: number; y: number; r: number };
export type WorldCallbacks = {
  change: () => void;
  message: (text: string, kind?: string) => void;
  ready: () => void;
  sound: (kind: string) => void;
};
export class ForestScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  held = new Set<string>();
  paused = false;
  facing = new Phaser.Math.Vector2(1, 0);
  enemies: Enemy[] = [];
  obstacles: Obstacle[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private swingAt = -1000;
  private dashAt = -2000;
  private hurtAt = -2000;
  private dashUntil = 0;
  private playerLabel!: Phaser.GameObjects.Text;
  private shadow!: Phaser.GameObjects.Ellipse;
  private sparks!: Phaser.GameObjects.Graphics;
  private npc!: Phaser.GameObjects.Image;
  private chest!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;
  private tick = 0;
  private lastUi = 0;
  private crystalSprites: Phaser.GameObjects.Image[] = [];
  constructor(
    public progress: Progress,
    private hooks: WorldCallbacks,
  ) {
    super("forest");
  }
  create() {
    createArt(this);
    this.drawTerrain();
    this.decorate();
    this.shadow = this.add
      .ellipse(WORLD.spawn.x, WORLD.spawn.y + 5, 34, 13, 0x172f29, 0.32)
      .setDepth(599);
    this.player = this.add
      .image(WORLD.spawn.x, WORLD.spawn.y, "hero")
      .setScale(2)
      .setOrigin(0.5, 0.88)
      .setDepth(600);
    this.playerLabel = this.add
      .text(0, 0, "YOU", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f1ebc9",
        backgroundColor: "#293f32",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 1);
    this.sparks = this.add.graphics().setDepth(2000);
    this.glow = this.add.graphics().setDepth(2100);
    this.cameras.main
      .setBounds(0, 0, WORLD.width, WORLD.height)
      .startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setRoundPixels(true);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,E,Q",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.attack());
    this.input.keyboard!.on("keydown-SHIFT", () => this.dash());
    this.input.keyboard!.on("keydown-E", () => this.interact());
    this.input.keyboard!.on("keydown-Q", () => this.usePotion());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.attack();
    });
    this.scale.on("resize", () => this.fitCamera());
    this.fitCamera();
    this.game.events.on("blur", this.clearInput, this);
    this.events.once("shutdown", () =>
      this.game.events.off("blur", this.clearInput, this),
    );
    this.hooks.ready();
  }
  clearInput() {
    this.held.clear();
    this.input.keyboard?.resetKeys();
  }
  setPaused(value: boolean) {
    this.paused = value;
    this.clearInput();
    if (this.input.keyboard) this.input.keyboard.enabled = !value;
  }
  private fitCamera() {
    this.cameras.main.setZoom(this.scale.width < 600 ? 0.9 : 1);
  }
  private drawTerrain() {
    const c = document.createElement("canvas");
    c.width = WORLD.width;
    c.height = WORLD.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3d5d42";
    ctx.fillRect(0, 0, c.width, c.height);
    let seed = 149;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const greens = [
      "#426347",
      "#466649",
      "#37573e",
      "#3a5940",
      "#4c6b47",
      "#526e47",
    ];
    for (let i = 0; i < 21000; i++) {
      ctx.fillStyle = greens[Math.floor(random() * greens.length)];
      ctx.fillRect(
        Math.floor(random() * 400) * 4,
        Math.floor(random() * 280) * 4,
        random() < 0.7 ? 4 : 8,
        4,
      );
    }
    for (const [extra, color] of [
      [8, "#707b4c"],
      [4, "#96905d"],
      [0, "#b0a174"],
    ] as const) {
      ctx.fillStyle = color;
      for (let x = 0; x < WORLD.width; x += 16)
        ctx.fillRect(
          x,
          580 + Math.round((Math.sin(x / 190) * 28) / 8) * 8 - extra,
          16,
          76 + extra * 2,
        );
      for (let y = 0; y < WORLD.height; y += 16)
        ctx.fillRect(
          690 + Math.round((Math.sin(y / 150) * 35) / 8) * 8 - extra,
          y,
          64 + extra * 2,
          16,
        );
    }
    for (let i = 0; i < 1700; i++) {
      const x = random() * 1600,
        y = random() * 1120;
      if (
        Math.abs(y - (618 + Math.sin(x / 190) * 28)) < 34 ||
        Math.abs(x - (722 + Math.sin(y / 150) * 35)) < 27
      ) {
        ctx.fillStyle = random() > 0.5 ? "#bbad7e" : "#a19768";
        ctx.fillRect(
          Math.floor(x / 4) * 4,
          Math.floor(y / 4) * 4,
          random() > 0.5 ? 8 : 4,
          4,
        );
      }
    }
    // Irregular, pixel-stepped river and little islands of reflected light.
    for (let y = 0; y < 1120; y += 8) {
      const x = 1120 + Math.round((Math.sin(y / 130) * 28) / 8) * 8;
      ctx.fillStyle = "#8a9563";
      ctx.fillRect(x - 16, y, 160, 8);
      ctx.fillStyle = "#426b5b";
      ctx.fillRect(x - 8, y, 144, 8);
      ctx.fillStyle = "#3b7e79";
      ctx.fillRect(x, y, 128, 8);
      ctx.fillStyle = "#4b9385";
      ctx.fillRect(x + 8, y, 104, 8);
    }
    for (let i = 0; i < 430; i++) {
      const y = Math.floor(random() * 280) * 4,
        x =
          1130 +
          Math.round((Math.sin(y / 130) * 28) / 4) * 4 +
          Math.floor(random() * 24) * 4;
      ctx.fillStyle = random() > 0.5 ? "#65a28b" : "#438b80";
      ctx.fillRect(x, y, 8 + Math.floor(random() * 4) * 4, 4);
    }
    // Wooden footbridge, built plank by plank.
    ctx.fillStyle = "#394d39";
    ctx.fillRect(1078, 565, 206, 113);
    ctx.fillStyle = "#6f5d40";
    ctx.fillRect(1080, 568, 200, 103);
    for (let x = 1084; x < 1280; x += 12) {
      ctx.fillStyle = x % 24 ? "#a38958" : "#b19864";
      ctx.fillRect(x, 574, 10, 88);
      ctx.fillStyle = "#c1a36c";
      ctx.fillRect(x, 574, 3, 88);
    }
    for (const y of [565, 664]) {
      ctx.fillStyle = "#66533b";
      ctx.fillRect(1074, y, 212, 7);
      for (let x = 1074; x < 1290; x += 48) {
        ctx.fillStyle = "#b29a65";
        ctx.fillRect(x, y - 7, 7, 17);
      }
    }
    // Forgotten stone sanctuary in the east.
    ctx.fillStyle = "#526348";
    ctx.fillRect(1320, 220, 180, 160);
    for (let x = 1320; x < 1500; x += 24)
      for (let y = 220; y < 380; y += 20) {
        ctx.fillStyle = (x + y) % 48 ? "#7e8664" : "#8b9270";
        ctx.fillRect(x + 1, y + 1, 21, 17);
      }
    ctx.strokeStyle = "#acb088";
    ctx.lineWidth = 3;
    ctx.strokeRect(1363, 259, 87, 77);
    this.textures.addCanvas("terrain", c);
    this.add.image(0, 0, "terrain").setOrigin(0).setDepth(-20);
  }
  private prop(key: string, x: number, y: number, scale = 2, solid = false) {
    this.add
      .ellipse(
        x + 4,
        y + 4,
        key === "tree" ? 84 : 35,
        key === "tree" ? 27 : 13,
        0x1b352b,
        0.26,
      )
      .setDepth(y - 1);
    const sprite = this.add
      .image(x, y, key)
      .setOrigin(0.5, 0.92)
      .setScale(scale)
      .setDepth(y);
    if (solid)
      this.obstacles.push({
        x,
        y: y - 5,
        r: key === "tree" || key === "pine" ? 17 : 15,
      });
    return sprite;
  }
  private decorate() {
    // Deterministic placement keeps paths open and the world reproducible.
    let seed = 44;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 165; i++) {
      const x = 40 + rnd() * 1510,
        y = 70 + rnd() * 1020;
      if (
        Math.abs(y - (618 + Math.sin(x / 190) * 28)) < 112 ||
        Math.abs(x - (722 + Math.sin(y / 150) * 35)) < 105 ||
        (x > 1060 && x < 1300) ||
        (x > 1290 && y < 430) ||
        Math.hypot(x - 470, y - 510) < 120
      )
        continue;
      this.prop(rnd() > 0.24 ? "tree" : "pine", x, y, 1.7 + rnd() * 0.5, true);
    }
    // Framing trees close to the trail.
    [
      [390, 390],
      [470, 340],
      [590, 350],
      [850, 360],
      [980, 430],
      [340, 740],
      [460, 820],
      [870, 840],
      [960, 750],
      [230, 500],
      [1380, 790],
      [1430, 440],
    ].forEach(([x, y], i) => this.prop(i % 3 ? "tree" : "pine", x, y, 2, true));
    for (let i = 0; i < 260; i++) {
      const x = 60 + rnd() * 1470,
        y = 90 + rnd() * 970;
      if (
        (x > 1070 && x < 1300) ||
        Math.abs(y - (618 + Math.sin(x / 190) * 28)) < 50 ||
        Math.abs(x - (722 + Math.sin(y / 150) * 35)) < 45
      )
        continue;
      this.prop(
        i % 9 === 0
          ? "rock"
          : i % 4 === 0
            ? "mushroom"
            : i % 3 === 0
              ? "bush"
              : "flower",
        x,
        y,
        i % 9 === 0 ? 1.5 : 1.3,
        i % 9 === 0,
      );
    }
    this.prop("campfire", 475, 515, 2);
    this.prop("rock", 421, 510, 1.5, true);
    this.prop("rock", 456, 548, 1.3, true);
    const tent = this.add.graphics().setDepth(490);
    tent.fillStyle(0x283d30);
    tent.fillTriangle(370, 490, 420, 403, 480, 490);
    tent.fillStyle(0xb6a47a);
    tent.fillTriangle(370, 484, 420, 403, 451, 484);
    tent.fillStyle(0xd1bf8d);
    tent.fillTriangle(381, 478, 420, 412, 432, 478);
    tent.fillStyle(0x4d5740);
    tent.fillTriangle(400, 484, 420, 438, 435, 484);
    this.npc = this.prop("hero", 535, 516, 1.8);
    this.npc.setTint(0xcbd4a5);
    this.add
      .text(535, 449, "ROWAN", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e4dba5",
        backgroundColor: "#304b35",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(520);
    this.add
      .text(535, 427, "!", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f0cf7b",
      })
      .setOrigin(0.5)
      .setDepth(520);
    this.chest = this.prop("chest", 887, 474, 1.7);
    if (this.progress.openedChest) this.chest.setTint(0x92917a);
    [
      [840, 740],
      [970, 360],
      [340, 420],
      [1390, 740],
      [1440, 300],
    ].forEach(([x, y], id) => {
      if (this.progress.collectedCrystals.includes(id)) return;
      const s = this.prop("crystal", x, y, 1.65).setData("id", id);
      this.crystalSprites.push(s);
      this.tweens.add({
        targets: s,
        y: y - 5,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    });
    [
      [870, 610],
      [935, 700],
      [830, 820],
      [610, 795],
      [565, 670],
      [950, 510],
      [1350, 580],
      [1450, 690],
    ].forEach(([x, y]) => this.spawnEnemy(x, y));
    if (!this.progress.bossDefeated) this.spawnEnemy(1410, 300, true);
    // Small signpost at the crossroads.
    const sign = this.add.graphics().setDepth(550);
    sign.fillStyle(0x6d593f);
    sign.fillRect(780, 518, 5, 31);
    sign.fillStyle(0xb29a65);
    sign.fillRect(766, 513, 35, 13);
    sign.fillTriangle(801, 513, 809, 519, 801, 526);
    sign.fillStyle(0x675b3d);
    sign.fillRect(773, 518, 21, 2);
  }
  private spawnEnemy(x: number, y: number, boss = false) {
    const shadow = this.add
      .ellipse(x, y + 3, boss ? 72 : 36, boss ? 20 : 12, 0x19342b, 0.28)
      .setDepth(y - 1);
    const sprite = this.add
      .image(x, y, "slime")
      .setOrigin(0.5, 0.92)
      .setScale(boss ? 3.4 : 1.65)
      .setDepth(y);
    if (boss) sprite.setTint(0xe8b274);
    const hp = boss ? 220 : 48;
    this.enemies.push({
      sprite,
      shadow,
      hp,
      max: hp,
      homeX: x,
      homeY: y,
      hitAt: -1000,
      boss,
      bar: this.add.graphics(),
    });
  }
  private canMove(x: number, y: number) {
    if (x < 28 || y < 45 || x > 1570 || y > 1090) return false;
    const rx = 1120 + Math.round((Math.sin(y / 130) * 28) / 8) * 8;
    if (x > rx - 10 && x < rx + 138 && (y < 576 || y > 652)) return false;
    return !this.obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 10);
  }
  private moveTo(dx: number, dy: number) {
    if (this.canMove(this.player.x + dx, this.player.y)) this.player.x += dx;
    if (this.canMove(this.player.x, this.player.y + dy)) this.player.y += dy;
  }
  update(time: number, delta: number) {
    if (!this.player || this.paused) return;
    this.tick = time;
    const dt = Math.min(delta, 40) / 1000;
    const down = (...k: string[]) =>
      k.some((key) => this.keys[key]?.isDown || this.held.has(key));
    const vx = Number(down("D", "RIGHT")) - Number(down("A", "LEFT")),
      vy = Number(down("S", "DOWN")) - Number(down("W", "UP"));
    if (vx || vy) {
      const v = new Phaser.Math.Vector2(vx, vy).normalize();
      this.facing.copy(v);
      this.moveTo(
        v.x * dt * (time < this.dashUntil ? 490 : 155),
        v.y * dt * (time < this.dashUntil ? 490 : 155),
      );
      this.player.flipX = v.x < 0;
      this.player.setAngle(Math.sin(time / 85) * 3);
    } else {
      this.player.setAngle(0);
      if (time < this.dashUntil)
        this.moveTo(this.facing.x * dt * 490, this.facing.y * dt * 490);
    }
    this.player.setDepth(this.player.y);
    this.shadow
      .setPosition(this.player.x, this.player.y + 3)
      .setDepth(this.player.y - 0.5);
    this.playerLabel
      .setPosition(this.player.x, this.player.y - 70)
      .setDepth(this.player.y + 1);
    this.player.alpha =
      time - this.hurtAt < 650 ? (Math.sin(time / 45) > 0.1 ? 0.4 : 1) : 1;
    this.enemies.forEach((e) => {
      if (!e.sprite.active) return;
      const dist = Phaser.Math.Distance.Between(
        e.sprite.x,
        e.sprite.y,
        this.player.x,
        this.player.y,
      );
      const target =
        dist < 240
          ? this.player
          : {
              x: e.homeX + Math.sin(time / 1800 + e.homeX) * 22,
              y: e.homeY + Math.cos(time / 2000 + e.homeY) * 18,
            };
      const angle = Phaser.Math.Angle.Between(
        e.sprite.x,
        e.sprite.y,
        target.x,
        target.y,
      );
      if (dist > 26 && time - e.hitAt > 220) {
        const speed = (e.boss ? 48 : 38) * dt;
        const x = e.sprite.x + Math.cos(angle) * speed,
          y = e.sprite.y + Math.sin(angle) * speed;
        if (this.canMove(x, y)) {
          e.sprite.x = x;
          e.sprite.y = y;
        }
      }
      const base = e.boss ? 3.4 : 1.65;
      e.sprite
        .setScale(
          base * (1 + Math.sin(time / 240 + e.homeX) * 0.035),
          base * (1 - Math.sin(time / 240 + e.homeX) * 0.045),
        )
        .setDepth(e.sprite.y);
      e.shadow.setPosition(e.sprite.x, e.sprite.y + 3).setDepth(e.sprite.y - 1);
      if (
        dist < (e.boss ? 44 : 31) &&
        time - this.hurtAt > 1000 &&
        time > this.dashUntil
      ) {
        this.hurtAt = time;
        this.progress.hp -= e.boss ? 22 : 9;
        this.hooks.sound("hurt");
        this.float(
          this.player.x,
          this.player.y - 50,
          `−${e.boss ? 22 : 9}`,
          "#efaf92",
        );
        this.cameras.main.shake(120, 0.003);
        if (this.progress.hp <= 0) this.respawn();
        this.hooks.change();
      }
      e.bar.clear();
      if (e.hp < e.max || e.boss) {
        const w = e.boss ? 68 : 36,
          x = e.sprite.x - w / 2,
          y = e.sprite.y - (e.boss ? 85 : 44);
        e.bar.fillStyle(0x263c31, 0.8).fillRect(x - 1, y - 1, w + 2, 6);
        e.bar
          .fillStyle(e.boss ? 0xd5a267 : 0xa7bc79)
          .fillRect(x, y, (w * e.hp) / e.max, 4)
          .setDepth(e.sprite.y + 1);
      }
    });
    this.crystalSprites = this.crystalSprites.filter((s) => {
      if (
        Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y) <
        35
      ) {
        this.progress.crystals++;
        this.progress.collectedCrystals.push(s.getData("id"));
        this.progress.gold += 5;
        const leveled = gainXp(this.progress, 15);
        this.float(s.x, s.y - 20, "+1 forest crystal", "#bce9c2");
        if (leveled)
          this.hooks.message(
            `Level ${this.progress.level}! Your legend grows.`,
            "success",
          );
        s.destroy();
        this.hooks.sound("pickup");
        this.hooks.change();
        return false;
      }
      return true;
    });
    this.drawAtmosphere(time);
    if (time - this.lastUi > 250) {
      this.lastUi = time;
      this.game.events.emit("position", { x: this.player.x, y: this.player.y });
    }
  }
  private drawAtmosphere(time: number) {
    this.glow.clear();
    const cam = this.cameras.main;
    // Quiet drifting fireflies, drawn in world space.
    for (let i = 0; i < 24; i++) {
      const x = cam.scrollX + ((i * 127 + time * 0.006) % (cam.width + 80)),
        y =
          cam.scrollY +
          ((i * 79) % cam.height) +
          Math.sin(time / 2100 + i) * 12;
      const a = 0.2 + (Math.sin(time / 1300 + i) + 1) * 0.17;
      this.glow.fillStyle(0xe3dda0, a * 0.18).fillCircle(x, y, 7);
      this.glow.fillStyle(0xe3dda0, a).fillRect(x, y, 2, 2);
    }
  }
  attack() {
    if (this.paused || !this.player || this.tick - this.swingAt < 420) return;
    this.swingAt = this.tick;
    this.hooks.sound("attack");
    const a = this.facing.angle();
    this.sparks.clear().lineStyle(5, 0xe9e4b3, 0.85);
    this.sparks.beginPath();
    this.sparks.arc(this.player.x, this.player.y - 17, 49, a - 1.2, a + 1.2);
    this.sparks.strokePath();
    this.time.delayedCall(140, () => this.sparks.clear());
    this.enemies.forEach((e) => {
      if (!e.sprite.active) return;
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        e.sprite.x,
        e.sprite.y,
      );
      if (d > (e.boss ? 100 : 87)) return;
      e.hp -= attackPower(this.progress);
      e.hitAt = this.tick;
      this.float(
        e.sprite.x,
        e.sprite.y - 45,
        `${attackPower(this.progress)}`,
        "#f1e4ad",
      );
      e.sprite.setTintFill(0xe2e3bc);
      this.time.delayedCall(110, () => {
        if (e.sprite.active) {
          e.sprite.clearTint();
          if (e.boss) e.sprite.setTint(0xe8b274);
        }
      });
      const knock = new Phaser.Math.Vector2(
        e.sprite.x - this.player.x,
        e.sprite.y - this.player.y,
      )
        .normalize()
        .scale(18);
      if (this.canMove(e.sprite.x + knock.x, e.sprite.y + knock.y)) {
        e.sprite.x += knock.x;
        e.sprite.y += knock.y;
      }
      if (e.hp <= 0) this.defeat(e);
    });
  }
  private defeat(e: Enemy) {
    const x = e.sprite.x,
      y = e.sprite.y;
    e.sprite.destroy();
    e.shadow.destroy();
    e.bar.destroy();
    this.progress.kills++;
    this.progress.gold += e.boss ? 100 : 8;
    const leveled = gainXp(this.progress, e.boss ? 150 : 25);
    this.float(
      x,
      y - 15,
      `+${e.boss ? 150 : 25} XP  ·  +${e.boss ? 100 : 8} gold`,
      "#d7dca6",
    );
    if (e.boss) {
      this.progress.bossDefeated = true;
      this.hooks.message(
        "The Grove Guardian is defeated. The woods are safe!",
        "success",
      );
      this.hooks.sound("level");
    } else {
      this.time.delayedCall(14000, () => {
        if (this.scene.isActive()) this.spawnEnemy(e.homeX, e.homeY);
      });
    }
    if (leveled) {
      this.hooks.message(
        `Level ${this.progress.level}! Health restored. Your legend grows.`,
        "success",
      );
      this.hooks.sound("level");
    }
    if (this.progress.kills === 5)
      this.hooks.message(
        "Quest complete! Return to Rowan at the campsite.",
        "success",
      );
    this.enemies = this.enemies.filter((enemy) => enemy !== e);
    this.hooks.change();
  }
  dash() {
    if (this.paused || !this.player) return;
    if (this.tick - this.dashAt < 1500) {
      this.hooks.message("Catch your breath — dash is recharging.");
      return;
    }
    this.dashAt = this.tick;
    this.dashUntil = this.tick + 190;
    this.hooks.sound("dash");
  }
  usePotion() {
    if (this.paused) return;
    if (heal(this.progress)) {
      this.float(this.player.x, this.player.y - 50, "+65 HP", "#bddea5");
      this.hooks.sound("pickup");
      this.hooks.change();
    } else
      this.hooks.message(
        this.progress.potions
          ? "Your health is already full."
          : "No potions left. Rowan sells them for 15 gold.",
      );
  }
  interact() {
    if (this.paused || !this.player) return;
    if (
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.npc.x,
        this.npc.y,
      ) < 100
    ) {
      if (claimQuest(this.progress)) {
        this.hooks.message(
          "Rowan: Beautiful work! Here’s 75 gold, 80 XP and 2 potions.",
          "success",
        );
        this.hooks.sound("level");
      } else if (
        this.progress.questClaimed &&
        this.progress.gold >= 15 &&
        this.progress.potions < 9
      ) {
        this.progress.gold -= 15;
        this.progress.potions++;
        this.hooks.message(
          "Rowan: One healing potion. That’ll be 15 gold.",
          "success",
        );
      } else if (this.progress.questClaimed)
        this.hooks.message(
          "Rowan: Cross the eastern bridge. The Grove Guardian awaits!",
        );
      else
        this.hooks.message(
          `Rowan: Slimes are overrunning the trail. Defeat 5 and come back! (${Math.min(this.progress.kills, 5)}/5)`,
        );
      this.hooks.change();
      return;
    }
    if (
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.chest.x,
        this.chest.y,
      ) < 90
    ) {
      if (this.progress.openedChest) {
        this.hooks.message(
          "The chest is empty. Adventure always has more to offer.",
        );
        return;
      }
      this.progress.openedChest = true;
      this.chest.setTint(0x92917a);
      this.progress.gold += 30;
      this.progress.potions++;
      gainXp(this.progress, 20);
      this.hooks.message(
        "A lucky find! +30 gold, +20 XP and a healing potion.",
        "success",
      );
      this.hooks.sound("pickup");
      this.hooks.change();
      return;
    }
    this.hooks.message(
      "Get closer to Rowan or a treasure chest, then interact.",
    );
  }
  private respawn() {
    this.progress.hp = maxHp(this.progress);
    this.player.setPosition(WORLD.spawn.x, WORLD.spawn.y);
    this.hurtAt = this.tick + 1000;
    this.hooks.message(
      "A second chance. You’ve awakened safely at the crossroads.",
    );
  }
  private float(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color,
        stroke: "#283f30",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(3000);
    this.tweens.add({
      targets: t,
      y: y - 45,
      alpha: 0,
      duration: 1200,
      onComplete: () => t.destroy(),
    });
  }
}
