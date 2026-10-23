import Phaser from "phaser";
import { createBattleArt } from "./battleArt";
import { activeFighter, type Battle, type CombatEvent } from "./tactics";
import { CLASSES, type ClassId } from "./lineage";
import { MOTIONS, motionTiming, type MotionStyle } from "./combatMotion";

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
  reducedMotion = false;
  presentation = {
    phase: "idle",
    pose: "idle",
    style: "slash",
    effectsSpawned: 0,
  };
  private effects = new Set<Phaser.GameObjects.GameObject>();
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
      "pose-sheet",
      `${import.meta.env.BASE_URL}art/classes-poses.webp`,
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
        (a.classId === "ranger" && !this.textures.exists("pose-sheet")) ||
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
    for (const a of this.battle.actors) {
      const v = this.views.get(a.id)!;
      v.x = w * (a.side === "party" ? 0.76 : mobile ? 0.29 : 0.26);
      v.y = h * 0.82;
      const factor = Phaser.Math.Clamp(w / 1180, 0.65, 1.15);
      const maxHeight = Math.max(
        48,
        h * 0.82 - (h < 300 ? 62 : mobile ? 155 : 105),
      );
      const desired = Math.min(
        (a.side === "party"
          ? 230
          : a.classId === "dragon"
            ? 255
            : a.classId === "wisp"
              ? 210
              : 245) * factor,
        maxHeight,
      );
      // Keep the complete figure inside both the field and its allotted side.
      v.scale = Math.min(
        desired / v.image.height,
        (w * (a.side === "enemy" ? 0.48 : 0.35)) / v.image.width,
      );
      if (!this.animating)
        v.image.setPosition(v.x, v.y).setScale(v.scale).setAngle(0);
      v.image.setDepth(v.y);
      v.shadow
        .setPosition(v.x, v.y + 1)
        .setScale(
          Math.max(48, v.image.displayWidth * 0.58) / 70,
          Math.max(12, v.image.displayHeight * 0.07) / 17,
        )
        .setDepth(v.y - 1);
      const bw = Math.min((a.side === "enemy" ? 140 : 110) * factor, w * 0.3);
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
        const breathing = this.reducedMotion ? 0 : Math.sin(time / 650 + v.x);
        v.image.setScale(
          v.scale * (1 - breathing * 0.008),
          v.scale * (1 + breathing * 0.012),
        );
        v.image.y =
          v.y +
          Math.sin(time / (a.classId === "wisp" ? 550 : 850) + v.x) *
            (this.reducedMotion ? 0 : a.classId === "wisp" ? 6 : 1);
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
  /** Pose changes and visual clocks never change the authoritative battle state. */
  async play(
    events: CombatEvent[],
    battle: Battle,
    fast = false,
  ): Promise<void> {
    if (!events.length) return;
    this.animating = true;
    const event = events[0],
      source = this.views.get(event.actor),
      victim = this.views.get(event.target);
    const actor = battle.actors.find((a) => a.id === event.actor)!;
    const timing = motionTiming(fast, this.reducedMotion);
    const cls = Object.hasOwn(CLASSES, event.element)
      ? (event.element as ClassId)
      : Object.hasOwn(CLASSES, actor.classId)
        ? (actor.classId as ClassId)
        : null;
    const motion = cls
      ? MOTIONS[cls]
      : {
          style:
            actor.classId === "wisp" ? ("astral" as const) : ("claw" as const),
          ranged: actor.classId === "wisp",
          color: 0xe4bc88,
        };
    const style: MotionStyle =
      event.type === "heal"
        ? "heal"
        : event.type === "guard"
          ? "guard"
          : motion.style;
    this.presentation = {
      ...this.presentation,
      phase: "windup",
      pose: "idle",
      style,
    };
    try {
      if (source) {
        const direction = victim && victim.x < source.x ? -1 : 1;
        if (!this.reducedMotion)
          await this.tween({
            targets: source.image,
            x: source.x - direction * 9,
            angle: -direction * 5,
            scaleY: source.scale * 0.95,
            duration: timing.windup,
            ease: "Sine.easeOut",
          });
        else await this.delay(timing.windup);
        const actionKey = `battle-${actor.classId}-action`;
        if (this.textures.exists(actionKey))
          source.image.setTexture(actionKey).setFlipX(false);
        this.presentation.phase = "strike";
        this.presentation.pose = "action";
        if (event.type === "damage" && victim) {
          if (motion.ranged) {
            await this.tween({
              targets: source.image,
              angle: 0,
              y: source.y - 4,
              duration: timing.travel * 0.4,
              ease: "Back.easeOut",
            });
            await this.projectile(
              source,
              victim,
              motion.color,
              style,
              timing.travel,
            );
          } else {
            const x = this.reducedMotion
              ? source.x
              : victim.x -
                direction * Math.max(50, victim.image.displayWidth * 0.3);
            await this.tween({
              targets: source.image,
              x,
              y: source.y,
              angle: direction * 8,
              scaleX: source.scale * 1.04,
              scaleY: source.scale,
              duration: timing.travel,
              ease: "Cubic.easeIn",
            });
          }
        } else await this.delay(timing.travel * 0.45);
      }
      this.presentation.phase = "impact";
      for (const hit of events) {
        const v = this.views.get(hit.target);
        if (!v) continue;
        const color =
          hit.type === "heal"
            ? 0x92efb5
            : hit.type === "guard"
              ? 0xe7ce94
              : motion.color;
        const hitStyle =
          hit.type === "heal" ? "heal" : hit.type === "guard" ? "guard" : style;
        this.impact(v, hitStyle, color, timing.effect);
        if (hit.type === "damage") {
          v.image.setTintFill(0xfff3dd);
          this.time.delayedCall(this.reducedMotion ? 35 : 65, () =>
            v.image.clearTint(),
          );
          if (!this.reducedMotion) {
            this.cameras.main.shake(
              90,
              hit.element === "physical" ? 0.0013 : 0.0023,
            );
            if (v !== source)
              this.tweens.add({
                targets: v.image,
                x: v.x + (source && source.x > v.x ? -11 : 11),
                angle: source && source.x > v.x ? -6 : 6,
                scaleX: v.scale * 0.95,
                scaleY: v.scale * 1.04,
                duration: 90,
                yoyo: true,
                ease: "Sine.easeOut",
              });
          }
        }
        if (hit.amount > 0)
          this.damageNumber(v, hit.amount, hit.type === "heal", fast);
      }
      await this.delay(timing.impact);
      this.presentation.phase = "recover";
      if (source)
        await this.tween({
          targets: source.image,
          x: source.x,
          y: source.y,
          angle: 0,
          scaleX: source.scale,
          scaleY: source.scale,
          duration: timing.recover,
          ease: "Cubic.easeOut",
        });
      // Keep fallen enemies on-screen for a short, readable defeat dissolve.
      for (const dead of battle.actors.filter((a) => a.hp <= 0)) {
        const v = this.views.get(dead.id);
        if (v)
          await this.tween({
            targets: v.image,
            alpha: 0.12,
            y: v.y + 8,
            duration: fast ? 130 : 250,
            ease: "Sine.easeIn",
          });
      }
    } finally {
      this.animating = false;
      this.presentation.phase = "idle";
      this.presentation.pose = "idle";
      this.sync(battle);
    }
  }
  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
  private track<T extends Phaser.GameObjects.GameObject>(g: T): T {
    this.effects.add(g);
    this.presentation.effectsSpawned++;
    g.once("destroy", () => this.effects.delete(g));
    return g;
  }
  get activeEffectCount() {
    return this.effects.size;
  }
  private async projectile(
    source: ActorView,
    target: ActorView,
    color: number,
    style: MotionStyle,
    duration: number,
  ) {
    const x = source.image.x,
      y = source.y - source.image.displayHeight * 0.5;
    const endY = target.y - target.image.displayHeight * 0.45;
    const beam = this.track(
      this.add.graphics().setDepth(1400).setBlendMode(Phaser.BlendModes.ADD),
    );
    const p = { t: 0 };
    const dx = target.x - x,
      dy = endY - y;
    await this.tween({
      targets: p,
      t: 1,
      duration,
      ease: "Quad.easeIn",
      onUpdate: () => {
        const px = x + dx * p.t,
          py = y + dy * p.t;
        beam.clear();
        beam
          .lineStyle(style === "arrow" ? 8 : 16, color, 0.15)
          .lineBetween(px - dx * 0.13, py - dy * 0.13, px, py);
        beam
          .lineStyle(style === "arrow" ? 2 : 5, 0xf3fcff, 0.9)
          .lineBetween(px - dx * 0.09, py - dy * 0.09, px, py);
        beam
          .fillStyle(color, 0.45)
          .fillCircle(px, py, style === "arrow" ? 4 : 8);
        beam.fillStyle(0xffffff, 0.9).fillCircle(px, py, 2);
      },
    });
    beam.destroy();
  }
  private impact(
    v: ActorView,
    style: MotionStyle,
    color: number,
    duration: number,
  ) {
    const x = v.x,
      y = v.y - v.image.displayHeight * 0.44;
    const g = this.track(
      this.add.graphics().setDepth(1450).setBlendMode(Phaser.BlendModes.ADD),
    );
    const p = { t: 0 };
    const radius = Math.max(28, Math.min(75, v.image.displayHeight * 0.4));
    this.tweens.add({
      targets: p,
      t: 1,
      duration,
      ease: "Quad.easeOut",
      onUpdate: () => {
        g.clear();
        const fade = 1 - p.t;
        if (style === "guard") {
          g.lineStyle(3, color, fade * 0.8).strokePoints(
            [
              { x: x - radius * 0.65, y: y - radius },
              { x: x + radius * 0.65, y: y - radius },
              { x: x + radius * 0.56, y: y + radius * 0.25 },
              { x, y: y + radius },
              { x: x - radius * 0.56, y: y + radius * 0.25 },
            ],
            true,
          );
          g.lineStyle(1, 0xffffff, fade * 0.5).strokeEllipse(
            x,
            y,
            radius * 1.8,
            radius * 2.3,
          );
        } else if (style === "heal" || style === "radiant") {
          g.lineStyle(2, color, fade * 0.8).strokeEllipse(
            x,
            v.y - 6,
            radius * (1.2 + p.t),
            radius * 0.55,
          );
          g.fillStyle(color, fade * 0.07).fillEllipse(
            x,
            y,
            radius * 1.1,
            radius * 2.5,
          );
          if (style === "radiant")
            g.lineStyle(6, color, fade * 0.7).lineBetween(
              x,
              y - radius * 1.5,
              x,
              y + radius * 0.8,
            );
          for (let i = 0; i < 5; i++) {
            const a = i * 1.256 + p.t * 3;
            g.fillStyle(color, fade * 0.8).fillCircle(
              x + Math.cos(a) * radius * 0.6,
              y + radius - p.t * radius * 2 + Math.sin(a) * 12,
              2,
            );
          }
        } else if (style === "astral") {
          g.lineStyle(2, color, fade * 0.65).strokeCircle(
            x,
            y,
            radius * (0.4 + p.t),
          );
          for (let i = 0; i < 5; i++) {
            const k = (p.t + i * 0.08) % 1,
              dx = (i - 2) * radius * 0.32;
            g.lineStyle(4, color, fade * 0.6).lineBetween(
              x + dx - 12,
              y - radius * 2 + k * radius * 2.3,
              x + dx,
              y - radius * 1.4 + k * radius * 2.3,
            );
          }
        } else {
          const strikes = style === "daggers" ? 2 : 1;
          for (let i = 0; i < strikes; i++) {
            const start = -2.5 + i * 1.7,
              end = start + (0.3 + p.t * 2.5);
            g.lineStyle(style === "flame" ? 22 : 16, color, fade * 0.09)
              .beginPath()
              .arc(x, y, radius, start, end)
              .strokePath();
            g.lineStyle(6, color, fade * 0.65)
              .beginPath()
              .arc(x, y, radius, start, end)
              .strokePath();
            g.lineStyle(2, 0xffffff, fade * 0.9)
              .beginPath()
              .arc(x, y, radius - 2, start, end)
              .strokePath();
          }
          if (style === "arrow")
            g.lineStyle(3, color, fade).lineBetween(
              x - radius,
              y + radius * 0.4,
              x + radius,
              y - radius * 0.4,
            );
        }
      },
      onComplete: () => g.destroy(),
    });
    const count = this.reducedMotion ? 4 : style === "flame" ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2,
        dist = radius * (0.5 + (i % 4) * 0.3);
      const dot = this.track(
        this.add
          .circle(x, y, i % 3 === 0 ? 2.5 : 1.5, color, 0.85)
          .setDepth(1500)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - (style === "heal" ? 40 : 0),
        alpha: 0,
        scale: 0.25,
        delay: (i % 3) * 12,
        duration: duration * 0.8,
        ease: "Cubic.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }
  private damageNumber(
    v: ActorView,
    amount: number,
    heal: boolean,
    fast: boolean,
  ) {
    const text = this.track(
      this.add
        .text(
          v.x,
          Math.max(72, v.y - v.image.displayHeight - 8),
          heal ? `+${amount}` : `${amount}`,
          {
            fontFamily: "Space Grotesk Variable, sans-serif",
            fontSize:
              this.scale.width / this.pixelDensity < 700 ? "27px" : "34px",
            fontStyle: "bold",
            color: heal ? "#b0f4c6" : "#fff2d5",
            stroke: "#182a32",
            strokeThickness: 4,
            resolution: this.pixelDensity,
          },
        )
        .setOrigin(0.5)
        .setDepth(1600),
    );
    this.tweens.add({
      targets: text,
      scale: 1.2,
      duration: 90,
      yoyo: true,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: text,
      y: text.y - 35,
      alpha: 0,
      delay: 100,
      duration: fast ? 380 : 720,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
