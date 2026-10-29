import type { ClassId } from "./data";
import { ANIM_ROWS, ANIMS, FB, fbLayers, FRAME_H, FRAME_W, layers, STRIP_W, type Look } from "./looks";
import { parseSettings, SETTINGS_KEY, type Settings } from "./save";

export const root = document.querySelector<HTMLElement>("#astra")!;

// localStorage can throw (private mode, blocked storage); the game still runs for the session.
const memory = new Map<string, string>();
export const store = {
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

export let settings: Settings = parseSettings(store.getItem(SETTINGS_KEY));
export const setSettings = (s: Settings) => void (settings = s);

export type Child = Node | string | false | null | undefined;
export function h<K extends keyof HTMLElementTagNameMap>(
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

export const button = (label: string, onclick: () => void, extra: Partial<HTMLButtonElement> & { class?: string; aria?: Record<string, string> } = {}) =>
  h("button", { type: "button", onclick, ...extra, class: `btn ${extra.class ?? ""}` }, label);

export function show(...nodes: Node[]) {
  // Re-renders keep keyboard focus on the same control (matched by its aria-label).
  const prev = document.activeElement?.getAttribute("aria-label");
  root.replaceChildren(...nodes);
  const same = prev ? root.querySelector<HTMLElement>(`[aria-label="${CSS.escape(prev)}"]`) : null;
  (same ?? root.querySelector<HTMLElement>("[autofocus], .btn:not(:disabled)"))?.focus({ preventScroll: true });
  fitSprites();
}

// ---------- hero sprite (Heroes99 layers composited in the browser) ----------
const images = new Map<string, Promise<HTMLImageElement>>();
export const loadImage = (src: string) => {
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
export function composite(look: Look, classId: ClassId) {
  const parts = layers(look, classId);
  const key = parts.join("|");
  let p = sheets.get(key);
  if (!p) {
    p = Promise.all(parts.map(([src]) => loadImage(src))).then((imgs) => {
      const h2 = FRAME_H * ANIM_ROWS;
      const c = h("canvas", { width: STRIP_W, height: h2 });
      const ctx = c.getContext("2d")!;
      imgs.forEach((img, i) => ctx.drawImage(img, 0, parts[i][1] * h2, STRIP_W, h2, 0, 0, STRIP_W, h2));
      return c;
    });
    p.catch(() => sheets.delete(key));
    sheets.set(key, p);
  }
  return p;
}

/** Front/back walk sheet: row 0 walks down, row 1 walks up. */
export function compositeFB(look: Look) {
  const parts = fbLayers(look);
  const key = "fb|" + parts.join("|");
  let p = sheets.get(key);
  if (!p) {
    p = Promise.all(parts.map(([src]) => loadImage(src))).then((imgs) => {
      const [w, h2] = [FB.w * FB.frames, FB.h * 2];
      const c = h("canvas", { width: w, height: h2 });
      const ctx = c.getContext("2d")!;
      imgs.forEach((img, i) => ctx.drawImage(img, 0, parts[i][1] * h2, w, h2, 0, 0, w, h2));
      return c;
    });
    p.catch(() => sheets.delete(key));
    sheets.set(key, p);
  }
  return p;
}

export const still = () => settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Sizes a canvas so every art pixel covers a whole number of device pixels (no browser
 * resampling, which blurs or unevenly doubles pixels on Retina/iPad). Returns that scale;
 * the context is left in art-pixel units with smoothing off.
 */
export function crisp(canvas: HTMLCanvasElement, artW: number, artH: number, cssScale: number): number {
  const dpr = devicePixelRatio || 1;
  const s = Math.max(1, Math.floor(cssScale * dpr + 1e-6));
  canvas.width = artW * s;
  canvas.height = artH * s;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return s;
}

export function heroSprite(look: Look, classId: ClassId, label: string) {
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
        if (!still()) f = (f + 1) % ANIMS.idle.frames;
        draw(); // also repaints after fitSprites() resized the canvas
      }, 130);
    },
    () => box.classList.add("missing"),
  );
  return box;
}

/** Integer pixel scale so the 100×40 frame stays crisp and fits its box. */
export function fitSprites() {
  for (const box of root.querySelectorAll<HTMLElement>(".sprite-box")) {
    const k = Math.max(1, Math.floor(Math.min(box.clientWidth / 100, box.clientHeight / 40)));
    box.style.setProperty("--k", String(k));
    const c = box.querySelector<HTMLCanvasElement>("canvas.sprite");
    if (c) crisp(c, FRAME_W, FRAME_H, k);
  }
}
addEventListener("resize", fitSprites);
