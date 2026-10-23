import Phaser from "phaser";
import { CLASS_IDS, type ClassId } from "./lineage";

type Ctx = CanvasRenderingContext2D;
const illustrated = new Map<string, HTMLCanvasElement>();
const illustratedPortraits = new Map<string, string>();
const box = (
  c: Ctx,
  col: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};
function shape(c: Ctx, col: string, points: number[]) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
function surface(w: number, h: number, paint: (c: Ctx) => void) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const c = el.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  paint(c);
  return el;
}
export function fighterArt(kind: string): HTMLCanvasElement {
  if (illustrated.has(kind)) return illustrated.get(kind)!;
  if (kind.endsWith("-action")) return fighterArt(kind.replace("-action", ""));
  if (kind === "sentinel")
    return surface(96, 112, (c) => {
      shape(
        c,
        "#101e29",
        [
          20, 32, 29, 16, 35, 4, 46, 11, 62, 5, 68, 20, 78, 31, 83, 60, 77, 75,
          82, 103, 64, 108, 56, 90, 40, 92, 31, 108, 14, 104, 20, 78, 9, 63,
        ],
      );
      shape(
        c,
        "#344955",
        [
          24, 35, 34, 21, 33, 8, 43, 16, 61, 11, 62, 24, 75, 37, 74, 62, 64, 73,
          61, 88, 38, 88, 30, 73, 20, 65,
        ],
      );
      shape(
        c,
        "#536b70",
        [
          28, 32, 37, 24, 38, 17, 43, 22, 58, 18, 60, 29, 70, 39, 65, 52, 34,
          48, 24, 56,
        ],
      );
      shape(
        c,
        "#7e9390",
        [31, 30, 38, 25, 44, 27, 57, 22, 62, 30, 51, 34, 33, 39],
      );
      shape(c, "#253a48", [32, 38, 61, 35, 61, 49, 53, 56, 39, 54, 31, 46]);
      box(c, "#deba74", 35, 40, 8, 3);
      box(c, "#deba74", 51, 39, 7, 3);
      box(c, "#82dce1", 36, 40, 5, 2);
      box(c, "#82dce1", 52, 39, 5, 2);
      shape(
        c,
        "#5e756e",
        [27, 55, 35, 49, 42, 58, 57, 57, 65, 49, 71, 58, 65, 78, 37, 81],
      );
      shape(
        c,
        "#9b9a76",
        [34, 55, 39, 57, 42, 71, 58, 69, 61, 56, 66, 54, 62, 77, 38, 79],
      );
      shape(c, "#233d48", [49, 53, 58, 64, 49, 77, 40, 65]);
      shape(c, "#65ccd0", [49, 58, 54, 65, 49, 72, 44, 65]);
      shape(c, "#d7f5dc", [49, 59, 49, 68, 46, 65]);
      shape(c, "#4e6262", [23, 45, 32, 51, 27, 69, 18, 73, 12, 62, 16, 48]);
      shape(c, "#8c9a83", [19, 46, 24, 44, 27, 51, 21, 60, 16, 60]);
      shape(c, "#425964", [71, 45, 79, 49, 83, 69, 74, 76, 67, 66]);
      box(c, "#a49c6d", 74, 53, 6, 2);
      shape(c, "#364c55", [35, 80, 48, 81, 43, 96, 35, 108, 21, 105, 25, 99]);
      shape(c, "#6f847c", [37, 83, 43, 83, 38, 98, 29, 101]);
      shape(c, "#344a53", [54, 79, 66, 78, 69, 95, 78, 104, 63, 108, 55, 95]);
      shape(c, "#72857b", [59, 83, 64, 82, 65, 94, 69, 99, 63, 99]);
      box(c, "#b29a65", 4, 26, 4, 76);
      shape(c, "#506c70", [5, 22, 0, 5, 17, 9, 25, 18, 22, 33, 11, 39, 7, 34]);
      shape(c, "#93aca0", [8, 9, 17, 12, 22, 19, 19, 28, 10, 33]);
      box(c, "#edc888", 4, 42, 5, 4);
      box(c, "#799774", 28, 59, 4, 5);
      box(c, "#799774", 64, 83, 4, 7);
    });
  if (kind === "wisp")
    return surface(48, 64, (c) => {
      shape(
        c,
        "#172a48",
        [
          22, 2, 28, 9, 39, 10, 42, 25, 38, 38, 45, 49, 36, 47, 30, 62, 24, 54,
          14, 60, 16, 45, 6, 41, 11, 30, 7, 18, 17, 13,
        ],
      );
      shape(
        c,
        "#58668c",
        [
          22, 6, 28, 13, 36, 14, 39, 25, 32, 38, 35, 51, 28, 48, 23, 57, 20, 44,
          11, 40, 17, 29, 12, 21, 21, 18,
        ],
      );
      shape(
        c,
        "#92bed0",
        [
          23, 11, 27, 17, 33, 18, 34, 28, 28, 34, 30, 45, 25, 42, 23, 48, 21,
          36, 15, 36, 21, 28, 16, 23, 23, 22,
        ],
      );
      shape(
        c,
        "#d3ece2",
        [23, 16, 25, 22, 30, 23, 29, 29, 24, 32, 20, 28, 23, 25],
      );
      box(c, "#f4e4ad", 18, 25, 4, 2);
      box(c, "#f4e4ad", 28, 25, 4, 2);
      shape(
        c,
        "#d4b88a",
        [3, 13, 5, 8, 7, 13, 12, 15, 7, 17, 5, 22, 3, 17, 0, 15],
      );
      shape(
        c,
        "#8ed5d9",
        [40, 42, 43, 38, 45, 42, 48, 44, 44, 46, 42, 51, 40, 46, 37, 44],
      );
    });
  if (kind === "thorn")
    return surface(64, 64, (c) => {
      shape(
        c,
        "#183e3c",
        [
          8, 34, 1, 17, 15, 23, 13, 5, 26, 18, 37, 2, 42, 21, 62, 11, 55, 32,
          61, 43, 52, 55, 39, 61, 20, 58, 7, 48,
        ],
      );
      shape(
        c,
        "#3e6655",
        [
          11, 33, 7, 24, 21, 31, 20, 16, 29, 25, 37, 13, 38, 30, 52, 21, 48, 37,
          55, 45, 47, 54, 23, 54, 12, 46,
        ],
      );
      shape(
        c,
        "#638471",
        [20, 35, 29, 29, 40, 31, 48, 39, 43, 48, 25, 49, 17, 43],
      );
      shape(c, "#93ab81", [24, 34, 30, 32, 37, 34, 37, 37, 23, 39]);
      box(c, "#173038", 22, 39, 8, 5);
      box(c, "#173038", 36, 39, 7, 5);
      box(c, "#e6bf7d", 23, 40, 4, 2);
      box(c, "#e6bf7d", 37, 40, 4, 2);
      box(c, "#253c3a", 28, 46, 9, 3);
      shape(c, "#38554b", [18, 49, 26, 53, 20, 61, 9, 61, 12, 57]);
      shape(c, "#38554b", [41, 51, 48, 48, 54, 59, 44, 63]);
      box(c, "#b29476", 12, 19, 3, 7);
      box(c, "#b29476", 44, 20, 3, 6);
      box(c, "#9bd5ac", 31, 21, 3, 7);
    });
  if (kind === "dragon")
    return surface(176, 148, (c) => {
      shape(
        c,
        "#14202e",
        [
          75, 66, 57, 42, 27, 5, 33, 44, 8, 18, 18, 58, 0, 53, 15, 78, 49, 94,
          64, 111, 56, 132, 39, 140, 57, 146, 78, 137, 93, 145, 122, 143, 121,
          133, 108, 125, 114, 110, 147, 100, 171, 70, 164, 38, 149, 60, 143, 13,
          118, 50, 115, 64, 103, 59, 103, 34, 92, 17, 86, 34, 75, 38,
        ],
      );
      shape(
        c,
        "#334458",
        [
          67, 74, 45, 43, 32, 19, 39, 61, 22, 42, 28, 71, 15, 66, 28, 81, 59,
          94,
        ],
      );
      shape(c, "#5b6481", [58, 75, 42, 59, 44, 75, 33, 68, 35, 80, 53, 89]);
      shape(
        c,
        "#304453",
        [
          111, 70, 132, 41, 139, 27, 137, 73, 158, 51, 159, 77, 148, 91, 120,
          103,
        ],
      );
      shape(
        c,
        "#66627b",
        [121, 79, 133, 61, 135, 82, 150, 66, 148, 83, 132, 95],
      );
      shape(
        c,
        "#485c6a",
        [
          71, 60, 84, 48, 98, 49, 113, 62, 119, 94, 108, 122, 86, 134, 67, 121,
          61, 96,
        ],
      );
      shape(
        c,
        "#758f91",
        [
          74, 68, 83, 58, 94, 58, 103, 69, 104, 91, 95, 114, 82, 121, 74, 110,
          72, 88,
        ],
      );
      shape(c, "#a0b1a0", [82, 65, 91, 65, 96, 77, 92, 91, 83, 94, 78, 79]);
      shape(
        c,
        "#314650",
        [
          77, 45, 77, 29, 87, 35, 91, 20, 98, 38, 108, 42, 109, 55, 99, 68, 84,
          65, 70, 56, 62, 46,
        ],
      );
      shape(
        c,
        "#69838a",
        [77, 45, 85, 42, 91, 46, 101, 44, 104, 51, 95, 61, 83, 59, 70, 52],
      );
      shape(c, "#b7bf9c", [77, 33, 74, 15, 85, 38]);
      shape(c, "#b7bf9c", [98, 38, 106, 19, 105, 44]);
      box(c, "#f1c881", 79, 48, 8, 3);
      box(c, "#e8ffff", 79, 48, 4, 2);
      shape(c, "#1c313b", [70, 53, 85, 57, 97, 54, 95, 59, 85, 64, 74, 59]);
      box(c, "#d3dab9", 75, 57, 3, 4);
      box(c, "#d3dab9", 90, 57, 3, 4);
      shape(
        c,
        "#2c4250",
        [65, 99, 75, 112, 67, 130, 48, 140, 63, 140, 78, 130, 82, 112],
      );
      shape(
        c,
        "#344c59",
        [101, 105, 111, 112, 112, 131, 125, 138, 106, 140, 95, 128],
      );
      shape(c, "#b1b797", [47, 138, 53, 131, 55, 138, 60, 132, 63, 140]);
      shape(c, "#b1b797", [108, 138, 111, 132, 114, 138, 119, 132, 125, 139]);
      shape(
        c,
        "#2b4050",
        [112, 108, 136, 112, 159, 100, 176, 91, 168, 108, 145, 125, 120, 122],
      );
      shape(c, "#9b9a7d", [159, 101, 164, 91, 165, 101, 172, 95, 168, 108]);
      shape(c, "#72d6d8", [85, 74, 92, 79, 89, 91, 83, 87]);
      box(c, "#d6f7d8", 86, 78, 3, 5);
    });
  const cls = kind as ClassId;
  return surface(48, 64, (c) => {
    const mage = cls === "arcanist",
      ranger = cls === "ranger";
    const dark = mage ? "#20394d" : ranger ? "#302d49" : "#422f32",
      mid = mage ? "#377889" : ranger ? "#65608b" : "#a45c48",
      light = mage ? "#87bec3" : ranger ? "#ada5c9" : "#d39368";
    // Individually shaded cloth, armor, hair and equipment, with a clear left-facing silhouette.
    shape(
      c,
      "#152330",
      [18, 27, 31, 26, 39, 36, 43, 56, 32, 60, 17, 57, 13, 45],
    );
    shape(c, dark, [28, 25, 34, 27, 40, 39, 44, 54, 35, 57, 28, 46]);
    shape(c, mid, [31, 29, 34, 32, 37, 47, 42, 53, 36, 53, 30, 41]);
    box(c, light, 34, 37, 2, 10);
    shape(c, "#243540", [18, 48, 27, 48, 25, 61, 16, 62, 13, 59]);
    shape(c, "#273644", [28, 48, 35, 47, 35, 60, 29, 63, 25, 60]);
    box(c, "#7b7e7a", 16, 57, 5, 3);
    box(c, "#a2a39a", 28, 57, 5, 3);
    box(c, "#222a35", 12, 60, 11, 3);
    box(c, "#222a35", 27, 60, 11, 3);
    shape(c, mid, [18, 27, 27, 25, 33, 30, 34, 45, 29, 52, 16, 50, 13, 39]);
    shape(c, light, [18, 29, 24, 28, 25, 43, 18, 45, 16, 38]);
    shape(c, dark, [25, 28, 31, 30, 32, 46, 27, 49, 24, 43]);
    box(c, "#c6b78b", 15, 46, 18, 3);
    box(c, "#e2c18c", 25, 46, 3, 4);
    shape(c, "#23343d", [11, 30, 17, 27, 20, 33, 17, 42, 12, 42, 9, 37]);
    box(c, "#a9b5ac", 12, 30, 5, 5);
    box(c, "#d7c4a0", 11, 37, 5, 6);
    box(c, "#a67e69", 11, 41, 5, 3);
    box(c, "#d0ac86", 17, 16, 14, 13);
    shape(c, "#eac89d", [16, 17, 26, 15, 29, 20, 26, 28, 18, 27, 15, 23]);
    box(c, "#b58d76", 26, 22, 5, 6);
    box(c, "#243443", 16, 21, 4, 3);
    box(c, "#f2e6ba", 17, 21, 2, 1);
    box(c, "#a27863", 17, 26, 6, 1);
    const hair = mage ? "#ddd8eb" : ranger ? "#c5c6d5" : "#e0c999";
    shape(
      c,
      "#474858",
      [
        15, 10, 22, 7, 30, 10, 34, 16, 33, 29, 28, 31, 28, 19, 15, 18, 12, 22,
        11, 15,
      ],
    );
    shape(
      c,
      hair,
      [
        15, 10, 22, 8, 29, 11, 32, 16, 28, 18, 27, 15, 23, 17, 22, 13, 18, 18,
        13, 19, 13, 14,
      ],
    );
    box(c, "#f0e8d2", 18, 10, 7, 3);
    box(c, "#a5a3b4", 29, 16, 3, 8);
    if (mage) {
      shape(c, "#e3dded", [30, 17, 33, 22, 34, 40, 29, 44, 30, 27]);
      shape(c, "#adaecb", [33, 24, 36, 35, 33, 43, 32, 38]);
      box(c, "#c7a972", 13, 14, 19, 2);
      box(c, "#7bd4df", 23, 13, 3, 4);
      box(c, "#a9b8c5", 6, 21, 2, 37);
      shape(c, "#a4c3c9", [7, 7, 14, 15, 9, 25, 1, 20, 0, 13]);
      shape(c, "#78dce0", [7, 10, 11, 16, 7, 22, 3, 18, 3, 14]);
      box(c, "#e4f8e4", 6, 12, 2, 5);
      box(c, "#d6ba7f", 3, 25, 8, 2);
    } else if (ranger) {
      shape(c, "#c3c5d6", [28, 22, 34, 27, 35, 37, 31, 42, 29, 34]);
      shape(c, "#8388a6", [29, 22, 32, 25, 32, 35, 30, 37]);
      shape(
        c,
        "#bfc6c1",
        [5, 16, 1, 26, 0, 40, 5, 52, 8, 49, 4, 39, 4, 28, 8, 19],
      );
      box(c, "#d4b582", 6, 18, 2, 31);
      box(c, "#9c7a52", 0, 35, 19, 2);
      shape(c, "#d5ddd0", [0, 32, 6, 35, 0, 38]);
      box(c, "#9c96b0", 29, 31, 10, 4);
    } else {
      shape(c, "#adbdba", [17, 28, 24, 28, 26, 35, 18, 37, 13, 33]);
      box(c, "#dee2cb", 15, 29, 7, 2);
      shape(c, "#879d9d", [26, 30, 31, 30, 34, 34, 29, 37, 25, 35]);
      box(c, "#d5b077", 18, 38, 12, 2);
      shape(c, "#c4d3ce", [5, 14, 9, 11, 12, 19, 13, 43, 8, 44, 5, 21]);
      shape(c, "#f0f0da", [8, 14, 10, 18, 11, 40, 8, 40]);
      box(c, "#d1b278", 3, 43, 14, 3);
      box(c, "#705249", 8, 46, 4, 10);
      box(c, "#e2c289", 8, 54, 4, 3);
      shape(c, mid, [26, 25, 30, 27, 31, 32, 22, 32, 16, 29, 17, 26]);
    }
    box(c, "#e1d7b1", 26, 34, 3, 2);
  });
}
export const portraitArt = (classId: ClassId) => {
  if (illustratedPortraits.has(classId))
    return illustratedPortraits.get(classId)!;
  const source = fighterArt(classId);
  return surface(64, 64, (c) => {
    c.drawImage(source, 8, 5, 30, 33, 3, 0, 58, 64);
  }).toDataURL();
};
function unpackHeroSheet(sheet: HTMLImageElement) {
  // Sprite-sheet frames and masks isolate the three original painted figures.
  const frames = [
    {
      id: "warden",
      x: 0,
      y: 70,
      w: 580,
      h: 890,
      mask: [0, 0, 480, 0, 480, 300, 580, 400, 580, 1024, 0, 1024],
      portrait: [205, 170, 190, 210],
    },
    {
      id: "arcanist",
      x: 540,
      y: 60,
      w: 545,
      h: 900,
      mask: [540, 0, 1085, 0, 1085, 1024, 590, 1024, 590, 420, 540, 320],
      portrait: [724, 195, 185, 205],
    },
    {
      id: "ranger",
      x: 1040,
      y: 60,
      w: 496,
      h: 900,
      mask: [1040, 0, 1536, 0, 1536, 1024, 1078, 1024, 1078, 440, 1040, 390],
      portrait: [1106, 198, 188, 210],
    },
  ];
  for (const f of frames) {
    const cut = surface(f.w, f.h, (c) => {
      c.save();
      c.translate(-f.x, -f.y);
      c.beginPath();
      c.moveTo(f.mask[0], f.mask[1]);
      for (let i = 2; i < f.mask.length; i += 2)
        c.lineTo(f.mask[i], f.mask[i + 1]);
      c.closePath();
      c.clip();
      c.drawImage(sheet, 0, 0);
      c.restore();
    });
    illustrated.set(
      f.id,
      surface(384, 576, (c) => {
        c.imageSmoothingEnabled = true;
        const scale = Math.min(384 / f.w, 576 / f.h);
        c.drawImage(
          cut,
          (384 - f.w * scale) / 2,
          576 - f.h * scale,
          f.w * scale,
          f.h * scale,
        );
      }),
    );
    const [x, y, w, h] = f.portrait;
    illustratedPortraits.set(
      f.id,
      surface(192, 192, (c) => {
        c.imageSmoothingEnabled = true;
        c.drawImage(sheet, x, y, w, h, 0, 0, 192, 192);
      }).toDataURL(),
    );
  }
}
/** Keep the connected hero silhouette, removing clipped fragments from adjacent cells. */
function isolateSilhouette(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas.getContext("2d")!,
    image = c.getImageData(0, 0, canvas.width, canvas.height);
  const { width: w, height: h, data } = image,
    n = w * h,
    labels = new Uint32Array(n),
    queue = new Uint32Array(n);
  let label = 0,
    largest = 0,
    largestSize = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] || data[i * 4 + 3] < 40) continue;
    label++;
    let head = 0,
      tail = 1;
    queue[0] = i;
    labels[i] = label;
    while (head < tail) {
      const p = queue[head++],
        x = p % w,
        y = Math.floor(p / w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const k = ny * w + nx;
          if (!labels[k] && data[k * 4 + 3] >= 40) {
            labels[k] = label;
            queue[tail++] = k;
          }
        }
    }
    if (tail > largestSize) {
      largest = label;
      largestSize = tail;
    }
  }
  for (let i = 0; i < n; i++) {
    if (labels[i] === largest) continue;
    // Preserve a narrow antialiased edge around the retained silhouette.
    let edge = false;
    if (labels[i] === 0 && data[i * 4 + 3] > 0) {
      const x = i % w,
        y = Math.floor(i / w);
      for (let dy = -2; dy <= 2 && !edge; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (
            nx >= 0 &&
            nx < w &&
            ny >= 0 &&
            ny < h &&
            labels[ny * w + nx] === largest
          ) {
            edge = true;
            break;
          }
        }
    }
    if (!edge) data[i * 4 + 3] = 0;
  }
  c.putImageData(image, 0, 0);
  return canvas;
}
function unpackPoseSheet(sheet: HTMLImageElement) {
  // Explicit atlas polygons keep neighboring weapons outside each frame.
  // Idle and action share the same body pivot/scale: crouching does not inflate the hero.
  const idle = [
    {
      cx: 145,
      foot: 555,
      mask: [0, 90, 280, 90, 280, 560, 0, 560],
      face: [80, 136, 105, 110],
    },
    {
      cx: 435,
      foot: 555,
      mask: [280, 60, 530, 60, 530, 310, 580, 400, 580, 560, 280, 560],
      face: [351, 144, 110, 112],
    },
    {
      cx: 655,
      foot: 555,
      mask: [530, 110, 780, 110, 780, 560, 540, 560, 540, 390, 566, 310],
      face: [598, 139, 110, 114],
    },
    {
      cx: 900,
      foot: 555,
      mask: [780, 120, 1030, 120, 1030, 350, 995, 430, 995, 560, 780, 560],
      face: [821, 141, 116, 110],
    },
    {
      cx: 1160,
      foot: 555,
      mask: [1035, 125, 1290, 125, 1290, 560, 990, 560, 990, 420, 1035, 420],
      face: [1082, 132, 114, 120],
    },
    {
      cx: 1410,
      foot: 555,
      mask: [1289, 110, 1536, 110, 1536, 560, 1289, 560],
      face: [1350, 133, 108, 120],
    },
  ];
  const action = [
    {
      cx: 140,
      foot: 965,
      mask: [0, 585, 290, 585, 290, 855, 325, 900, 325, 975, 0, 975],
    },
    {
      cx: 430,
      foot: 965,
      mask: [
        295, 575, 580, 575, 580, 795, 584, 850, 584, 976, 325, 976, 295, 850,
      ],
    },
    {
      cx: 700,
      foot: 965,
      mask: [555, 570, 790, 570, 790, 810, 850, 900, 850, 975, 555, 975],
    },
    {
      cx: 940,
      foot: 965,
      mask: [800, 620, 1045, 620, 1045, 976, 850, 976, 850, 840, 800, 800],
    },
    { cx: 1170, foot: 965, mask: [1040, 610, 1302, 610, 1302, 976, 1040, 976] },
    { cx: 1410, foot: 965, mask: [1303, 565, 1536, 565, 1536, 976, 1303, 976] },
  ];
  CLASS_IDS.forEach((id, i) => {
    for (const [pose, f] of [
      ["idle", idle[i]],
      ["action", action[i]],
    ] as const) {
      illustrated.set(
        pose === "idle" ? id : `${id}-action`,
        isolateSilhouette(
          surface(384, 576, (c) => {
            c.imageSmoothingEnabled = true;
            c.translate(192 - f.cx * 1.1, 576 - f.foot * 1.1);
            c.scale(1.1, 1.1);
            c.beginPath();
            c.moveTo(f.mask[0], f.mask[1]);
            for (let n = 2; n < f.mask.length; n += 2)
              c.lineTo(f.mask[n], f.mask[n + 1]);
            c.closePath();
            c.clip();
            c.drawImage(sheet, 0, 0);
          }),
        ),
      );
    }
    const [x, y, w, h] = idle[i].face;
    illustratedPortraits.set(
      id,
      surface(192, 192, (c) => {
        c.imageSmoothingEnabled = true;
        c.drawImage(sheet, x, y, w, h, 0, 0, 192, 192);
      }).toDataURL(),
    );
  });
}
export function createBattleArt(scene: Phaser.Scene) {
  if (scene.textures.exists("hero-sheet"))
    unpackHeroSheet(
      scene.textures.get("hero-sheet").getSourceImage() as HTMLImageElement,
    );
  if (scene.textures.exists("pose-sheet"))
    unpackPoseSheet(
      scene.textures.get("pose-sheet").getSourceImage() as HTMLImageElement,
    );
  if (scene.textures.exists("enemy-sheet")) {
    const sheet = scene.textures
      .get("enemy-sheet")
      .getSourceImage() as HTMLImageElement;
    const frames = [
      {
        id: "sentinel",
        x: 160,
        y: 0,
        w: 730,
        h: 535,
        mask: [
          160, 0, 890, 0, 890, 300, 860, 350, 780, 430, 720, 535, 160, 535,
        ],
      },
      {
        id: "wisp",
        x: 810,
        y: 0,
        w: 726,
        h: 540,
        mask: [930, 0, 1536, 0, 1536, 540, 810, 540, 810, 410, 930, 300],
      },
      {
        id: "dragon",
        x: 0,
        y: 530,
        w: 880,
        h: 494,
        mask: [
          0, 530, 810, 530, 830, 650, 830, 850, 880, 910, 880, 1024, 0, 1024,
        ],
      },
      {
        id: "thorn",
        x: 840,
        y: 540,
        w: 696,
        h: 484,
        mask: [900, 540, 1536, 540, 1536, 1024, 900, 1024, 900, 850, 840, 750],
      },
    ];
    for (const f of frames)
      illustrated.set(
        f.id,
        surface(f.w, f.h, (c) => {
          c.save();
          c.translate(-f.x, -f.y);
          c.beginPath();
          c.moveTo(f.mask[0], f.mask[1]);
          for (let i = 2; i < f.mask.length; i += 2)
            c.lineTo(f.mask[i], f.mask[i + 1]);
          c.closePath();
          c.clip();
          c.drawImage(sheet, 0, 0);
          c.restore();
        }),
      );
  }
  for (const key of [
    ...CLASS_IDS,
    ...CLASS_IDS.map((id) => `${id}-action`),
    "sentinel",
    "wisp",
    "thorn",
    "dragon",
  ]) {
    scene.textures.addCanvas(`battle-${key}`, fighterArt(key));
    scene.textures
      .get(`battle-${key}`)
      .setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
