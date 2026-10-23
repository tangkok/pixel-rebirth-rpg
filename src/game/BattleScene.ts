import Phaser from "phaser";
import { createBattleArt } from "./battleArt";
import { activeFighter, type Battle, type CombatEvent } from "./tactics";

interface ActorView {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
  scale: number;
}
export class BattleScene extends Phaser.Scene {
  battle?: Battle;
  selected = "sentinel";
  private views = new Map<string, ActorView>();
  private background!: Phaser.GameObjects.Image;
  private ambient!: Phaser.GameObjects.Graphics;
  private rings!: Phaser.GameObjects.Graphics;
  private loading?: Phaser.GameObjects.Text;
  private animating = false;
  private backdropFailed = false;
  constructor(
    private hooks: { ready: () => void; select: (id: string) => void },
    private pixelDensity = 1,
  ) {
    super("tactics");
  }
  preload() {
    this.loading = this.add.text(20, 20, "Awakening the sanctuary…", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#b2c8c7",
    });
    this.load.image(
      "sanctuary",
      `${import.meta.env.BASE_URL}art/hollow-sanctuary.webp`,
    );
    this.load.image(
      "hero-sheet",
      `${import.meta.env.BASE_URL}art/party-sprites.webp`,
    );
    this.load.image(
      "enemy-sheet",
      `${import.meta.env.BASE_URL}art/enemies-hd.webp`,
    );
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file.key === "sanctuary") this.backdropFailed = true;
    });
  }
  create() {
    createBattleArt(this);
    this.loading?.destroy();
    if (!this.backdropFailed)
      this.background = this.add
        .image(0, 0, "sanctuary")
        .setOrigin(0.5)
        .setDepth(-100);
    else {
      const g = this.add.graphics();
      g.fillGradientStyle(0x102c36, 0x102c36, 0x294145, 0x162b33).fillRect(
        0,
        0,
        2048,
        2048,
      );
    }
    this.rings = this.add.graphics().setDepth(1);
    this.ambient = this.add.graphics().setDepth(2000);
    this.scale.on("resize", () => this.layout());
    this.layout();
    this.hooks.ready();
  }
  sync(battle: Battle) {
    this.battle = battle;
    for (const a of battle.actors) {
      let v = this.views.get(a.id);
      if (v && v.image.texture.key !== `battle-${a.classId}`) {
        v.image.setTexture(`battle-${a.classId}`);
      }
      if (!v) {
        const shadow = this.add
          .ellipse(0, 0, 70, 17, 0x020d15, 0.55)
          .setDepth(2);
        const image = this.add
          .image(0, 0, `battle-${a.classId}`)
          .setOrigin(0.5, 1)
          .setDepth(10)
          .setInteractive({ useHandCursor: a.side === "enemy" });
        image.on("pointerdown", () => {
          const fighter = this.battle?.actors.find((f) => f.id === a.id);
          if (fighter?.side === "enemy" && fighter.hp > 0) {
            this.selected = a.id;
            this.hooks.select(a.id);
          }
        });
        const bar = this.add.graphics().setDepth(600);
        const label = this.add
          .text(0, 0, a.name, {
            fontFamily: "DM Sans Variable, sans-serif",
            fontSize: "10px",
            color: a.side === "enemy" ? "#e4d3a6" : "#d5e9e5",
            align: "center",
            stroke: "#0b1523",
            strokeThickness: 3,
            resolution: this.pixelDensity,
          })
          .setOrigin(0.5, 0)
          .setDepth(601);
        v = { image, shadow, bar, label, x: 0, y: 0, scale: 1 };
        this.views.set(a.id, v);
      }
      v.image.setAlpha(a.hp > 0 ? 1 : 0.16);
      v.shadow.setAlpha(a.hp > 0 ? 0.6 : 0.15);
      v.label.setText(a.name).setAlpha(a.hp > 0 ? 1 : 0.25);
      v.image.flipX =
        a.classId === "ranger" ||
        (a.side === "enemy" && !this.textures.exists("enemy-sheet"));
    }
    for (const [id, v] of this.views)
      if (!battle.actors.some((a) => a.id === id)) {
        v.image.destroy();
        v.shadow.destroy();
        v.bar.destroy();
        v.label.destroy();
        this.views.delete(id);
      }
    if (this.background)
      this.background.setTint(
        battle.stage === 2
          ? 0xc1b9e3
          : battle.stage === 1
            ? 0xc4d8ed
            : 0xffffff,
      );
    this.layout();
  }
  setRenderDensity(density: number) {
    this.pixelDensity = density;
  }
  private layout() {
    if (!this.rings) return;
    this.cameras.main.setOrigin(0, 0).setZoom(this.pixelDensity);
    const w = this.scale.width / this.pixelDensity,
      h = this.scale.height / this.pixelDensity,
      mobile = w < 700;
    if (this.background) {
      const scale = Math.max(
        w / this.background.width,
        h / this.background.height,
      );
      this.background.setPosition(w * 0.5, h * 0.5).setScale(scale);
    }
    if (!this.battle) return;
    const party = this.battle.actors.filter((a) => a.side === "party"),
      enemies = this.battle.actors.filter((a) => a.side === "enemy");
    for (const a of this.battle.actors) {
      const v = this.views.get(a.id)!;
      const i = (a.side === "party" ? party : enemies).indexOf(a);
      v.x = w * (a.side === "party" ? 0.76 : 0.26);
      v.y = h * (mobile ? 0.79 : 0.66);
      const factor = Phaser.Math.Clamp(w / 1180, 0.7, 1.2);
      const wantedHeight =
        (a.side === "party"
          ? 230
          : a.classId === "dragon"
            ? 255
            : a.classId === "wisp"
              ? 210
              : 245) * factor;
      v.scale = wantedHeight / v.image.height;
      v.image.setScale(v.scale);
      if (!this.animating) v.image.setPosition(v.x, v.y);
      v.image.setDepth(v.y);
      v.shadow
        .setPosition(v.x, v.y + 1)
        .setScale(
          Math.max(48, v.image.displayWidth * 0.58) / 70,
          Math.max(12, v.image.displayHeight * 0.07) / 17,
        )
        .setDepth(v.y - 1);
      const bw = (a.side === "enemy" ? 140 : 110) * factor;
      v.label
        .setResolution(this.pixelDensity)
        .setPosition(v.x, v.y + 10)
        .setFontSize(mobile ? 11 : 12);
      v.bar.clear();
      if (a.hp > 0) {
        v.bar
          .fillStyle(0x071721, 0.9)
          .fillRect(v.x - bw / 2 - 1, v.y + 25, bw + 2, 5);
        v.bar
          .fillStyle(a.side === "enemy" ? 0xc7ad79 : 0x7acdc6)
          .fillRect(v.x - bw / 2, v.y + 26, (bw * a.hp) / a.maxHp, 3);
      }
    }
  }
  update(time: number) {
    if (!this.ambient || !this.rings) return;
    const w = this.scale.width / this.pixelDensity,
      h = this.scale.height / this.pixelDensity;
    this.rings.clear();
    const current = this.battle && activeFighter(this.battle);
    for (const [id, v] of this.views) {
      const a = this.battle?.actors.find((a) => a.id === id);
      if (!a || a.hp <= 0) continue;
      if (!this.animating) {
        v.image.y =
          v.y +
          Math.sin(time / (a.classId === "wisp" ? 550 : 850) + v.x) *
            (a.classId === "wisp" ? 8 : 2);
        v.image.x = v.x;
      }
      if (current?.id === id && this.battle?.phase === "ready") {
        this.rings.lineStyle(2, 0xe4c18a, 0.6 + 0.2 * Math.sin(time / 450));
        this.rings.strokeEllipse(
          v.x,
          v.y + 2,
          Math.max(55, v.image.displayWidth * 0.56),
          Math.max(14, v.image.displayHeight * 0.07),
        );
        this.rings
          .fillStyle(0xe4c18a, 0.08)
          .fillEllipse(
            v.x,
            v.y + 2,
            Math.max(60, v.image.displayWidth * 0.62),
            Math.max(16, v.image.displayHeight * 0.08),
          );
      }
      if (this.selected === id && a.side === "enemy") {
        this.rings
          .lineStyle(1, 0xffd692, 0.45)
          .strokeEllipse(
            v.x,
            v.y + 4,
            Math.max(60, v.image.displayWidth * 0.6),
            Math.max(16, v.image.displayHeight * 0.07),
          );
        this.rings
          .fillStyle(0xf0cf91, 0.9)
          .fillTriangle(
            v.x - 5,
            v.y - v.image.displayHeight - 21,
            v.x + 5,
            v.y - v.image.displayHeight - 21,
            v.x,
            v.y - v.image.displayHeight - 14,
          );
      }
    }
    this.ambient.clear();
    for (let i = 0; i < 36; i++) {
      const x = (i * 139.7 + time * 0.008) % (w + 30),
        y = ((i * 93.3) % h) + Math.sin(time / 1800 + i) * 16;
      const a = 0.14 + (Math.sin(time / 1200 + i) + 1) * 0.16;
      this.ambient
        .fillStyle(i % 3 ? 0xa9e5df : 0xf0cf91, a * 0.09)
        .fillCircle(x, y, 9);
      this.ambient
        .fillStyle(i % 3 ? 0xb6eee6 : 0xffe3ad, a)
        .fillCircle(x, y, i % 3 ? 1 : 1.5);
    }
    // Slow foreground mist supplies a separate moving depth layer.
    for (let i = 0; i < 3; i++) {
      const x = ((time * 0.012 + i * w * 0.45) % (w * 1.7)) - w * 0.35;
      this.ambient
        .fillStyle(0xa1d3d0, 0.012)
        .fillEllipse(x, h * 0.83 + i * 8, w * 0.8, 56);
    }
  }
  async play(
    events: CombatEvent[],
    battle: Battle,
    fast = false,
  ): Promise<void> {
    if (!events.length) return;
    this.animating = true;
    const source = this.views.get(events[0].actor),
      victim = this.views.get(events[0].target),
      duration = fast ? 150 : 260;
    if (
      source &&
      victim &&
      events[0].type === "damage" &&
      ["physical", "boost"].includes(events[0].element)
    )
      await this.tween({
        targets: source.image,
        x: victim.x + (source.x > victim.x ? 55 : -55),
        duration,
        ease: "Cubic.easeIn",
      });
    for (const event of events) {
      const v = this.views.get(event.target);
      if (!v) continue;
      const color =
        event.type === "heal"
          ? 0x93f0b1
          : event.element === "arcanist"
            ? 0x87dfff
            : event.element === "ranger"
              ? 0xc5b0ff
              : event.element === "guard"
                ? 0xe7ce94
                : 0xffd89a;
      const g = this.add
        .graphics()
        .setDepth(1500)
        .setBlendMode(Phaser.BlendModes.ADD);
      if (event.type === "guard") {
        g.lineStyle(3, color, 0.8).strokeEllipse(v.x, v.y - 35, 70, 90);
      } else if (event.type === "damage") {
        g.lineStyle(18, color, 0.1).lineBetween(
          v.x - 45,
          v.y + 4,
          v.x + 34,
          v.y - 84,
        );
        g.lineStyle(6, color, 0.55).lineBetween(
          v.x - 45,
          v.y + 4,
          v.x + 34,
          v.y - 84,
        );
        g.lineStyle(2, 0xffffff, 0.95).lineBetween(
          v.x - 45,
          v.y + 4,
          v.x + 34,
          v.y - 84,
        );
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI) / 6;
          g.lineStyle(2, color, 0.7).lineBetween(
            v.x + Math.cos(angle) * 16,
            v.y - 30 + Math.sin(angle) * 16,
            v.x + Math.cos(angle) * 48,
            v.y - 30 + Math.sin(angle) * 48,
          );
        }
        if (event.element === "arcanist") {
          for (let i = 0; i < 5; i++)
            g.lineStyle(2, color, 0.65).lineBetween(
              v.x - 50 + i * 24,
              v.y - 160 - (i % 2) * 30,
              v.x - 25 + i * 15,
              v.y - 15,
            );
        }
        v.image.setTintFill(0xffffff);
        this.time.delayedCall(90, () => v.image.clearTint());
        this.cameras.main.shake(
          fast ? 80 : 150,
          event.element === "physical" ? 0.0015 : 0.003,
        );
      } else {
        g.lineStyle(2, color, 0.8).strokeCircle(v.x, v.y - 35, 36);
        g.fillStyle(color, 0.16).fillCircle(v.x, v.y - 35, 42);
      }
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: fast ? 280 : 600,
        onComplete: () => g.destroy(),
      });
      if (event.amount > 0) {
        const t = this.add
          .text(
            v.x,
            v.y - v.image.displayHeight - 15,
            event.type === "heal" ? `+${event.amount}` : `${event.amount}`,
            {
              fontFamily: "Space Grotesk Variable, sans-serif",
              fontSize:
                this.scale.width / this.pixelDensity < 700 ? "26px" : "36px",
              fontStyle: "bold",
              color: event.type === "heal" ? "#b0f4c6" : "#fff2d5",
              stroke: "#182a32",
              strokeThickness: 4,
              resolution: this.pixelDensity,
            },
          )
          .setOrigin(0.5)
          .setDepth(1600);
        this.tweens.add({
          targets: t,
          y: t.y - 40,
          alpha: 0,
          duration: fast ? 500 : 950,
          ease: "Cubic.easeOut",
          onComplete: () => t.destroy(),
        });
      }
    }
    if (source)
      await this.tween({
        targets: source.image,
        x: source.x,
        y: source.y,
        duration: fast ? 160 : 300,
        ease: "Cubic.easeOut",
      });
    else
      await new Promise<void>((resolve) => this.time.delayedCall(250, resolve));
    this.animating = false;
    this.sync(battle);
  }
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
