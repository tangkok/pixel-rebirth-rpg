import Phaser from "phaser";

// All artwork is drawn here on a tiny pixel grid. No external game assets.
type Painter = (c: CanvasRenderingContext2D) => void;
function canvas(w: number, h: number, paint: Painter): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const c = el.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  paint(c);
  return el;
}
function rect(
  c: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function poly(c: CanvasRenderingContext2D, color: string, points: number[]) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
export function heroArt(): HTMLCanvasElement {
  return canvas(24, 32, (c) => {
    rect(c, "#27362e", 7, 27, 4, 5);
    rect(c, "#27362e", 14, 27, 4, 5);
    rect(c, "#8a6744", 6, 29, 6, 3);
    rect(c, "#8a6744", 14, 29, 6, 3);
    poly(c, "#243c37", [7, 15, 17, 15, 21, 27, 4, 27]);
    poly(c, "#5a7961", [7, 15, 15, 15, 18, 26, 5, 26]);
    rect(c, "#8aa075", 7, 17, 4, 8);
    rect(c, "#c4b48c", 7, 25, 12, 2);
    rect(c, "#e8bd86", 4, 19, 3, 6);
    rect(c, "#e8bd86", 18, 19, 3, 6);
    rect(c, "#e7bd87", 7, 7, 11, 10);
    rect(c, "#d39d6e", 15, 8, 4, 8);
    rect(c, "#373d35", 8, 11, 2, 2);
    rect(c, "#373d35", 15, 11, 2, 2);
    rect(c, "#e0dfc4", 6, 3, 12, 6);
    rect(c, "#e0dfc4", 4, 6, 4, 6);
    rect(c, "#f4eed5", 8, 2, 8, 3);
    rect(c, "#f4eed5", 6, 5, 6, 4);
    rect(c, "#a9b5a3", 16, 5, 4, 5);
    rect(c, "#cdd2b7", 18, 8, 2, 4);
    rect(c, "#b85540", 7, 16, 12, 3);
    rect(c, "#d4774b", 8, 16, 6, 2);
    rect(c, "#b85540", 17, 18, 5, 3);
    rect(c, "#d4774b", 20, 19, 3, 4);
    rect(c, "#c5d2c1", 21, 12, 2, 10);
    rect(c, "#f1eed5", 22, 11, 1, 9);
    rect(c, "#a98b50", 19, 21, 6, 2);
    rect(c, "#5b4635", 21, 23, 2, 4);
  });
}
export function itemArt(kind: string): HTMLCanvasElement {
  return canvas(24, 24, (c) => {
    if (kind === "potion") {
      rect(c, "#b39c6b", 9, 2, 6, 4);
      rect(c, "#d5dfc5", 8, 5, 8, 5);
      rect(c, "#d5dfc5", 5, 10, 14, 11);
      rect(c, "#da795e", 7, 11, 10, 9);
      rect(c, "#f4b39a", 8, 12, 3, 5);
      rect(c, "#f1ead1", 8, 6, 2, 4);
    } else if (kind === "crystal") {
      poly(c, "#588b8d", [12, 1, 20, 9, 17, 19, 11, 23, 4, 15, 6, 6]);
      poly(c, "#b9ead0", [12, 2, 12, 19, 6, 14, 7, 7]);
      poly(c, "#7fc8af", [12, 2, 18, 9, 15, 18, 12, 21]);
      rect(c, "#e2f5c4", 8, 7, 3, 5);
    } else if (kind === "coin") {
      rect(c, "#b3823d", 6, 4, 12, 17);
      rect(c, "#d6aa4f", 4, 7, 16, 11);
      rect(c, "#ebc76a", 6, 5, 11, 12);
      rect(c, "#f3dc92", 7, 6, 3, 9);
      rect(c, "#a97e3b", 13, 8, 2, 7);
    } else {
      poly(c, "#788982", [18, 1, 22, 5, 10, 17, 6, 13]);
      poly(c, "#e0e7cd", [18, 1, 20, 3, 8, 15, 6, 13]);
      poly(c, "#c29d57", [4, 10, 14, 20, 12, 22, 2, 12]);
      poly(c, "#81634a", [6, 16, 9, 19, 4, 24, 1, 21]);
    }
  });
}
export function createArt(scene: Phaser.Scene) {
  const add = (key: string, w: number, h: number, paint: Painter) =>
    scene.textures.addCanvas(key, canvas(w, h, paint));
  scene.textures.addCanvas("hero", heroArt());
  ["potion", "crystal", "coin", "sword"].forEach((k) =>
    scene.textures.addCanvas(k, itemArt(k)),
  );
  add("tree", 64, 84, (c) => {
    poly(
      c,
      "#263d35",
      [25, 49, 40, 49, 38, 72, 46, 78, 34, 77, 30, 81, 26, 76, 17, 78, 25, 70],
    );
    rect(c, "#655d3d", 29, 48, 7, 27);
    rect(c, "#897549", 30, 49, 3, 23);
    poly(
      c,
      "#1c3e34",
      [
        24, 2, 43, 2, 43, 8, 51, 8, 51, 16, 58, 16, 58, 28, 63, 28, 63, 47, 57,
        47, 57, 56, 47, 56, 47, 62, 19, 62, 19, 58, 8, 58, 8, 50, 2, 50, 2, 30,
        7, 30, 7, 18, 15, 18, 15, 8, 24, 8,
      ],
    );
    poly(
      c,
      "#31563c",
      [
        22, 4, 42, 4, 42, 10, 51, 10, 51, 22, 57, 22, 57, 40, 50, 40, 50, 49,
        39, 49, 39, 55, 17, 55, 17, 49, 7, 49, 7, 32, 12, 32, 12, 20, 18, 20,
        18, 11, 22, 11,
      ],
    );
    poly(
      c,
      "#466849",
      [
        23, 6, 39, 6, 39, 12, 47, 12, 47, 22, 53, 22, 53, 33, 45, 33, 45, 40,
        34, 40, 34, 47, 18, 47, 18, 40, 11, 40, 11, 29, 17, 29, 17, 18, 23, 18,
      ],
    );
    poly(
      c,
      "#55774b",
      [
        24, 9, 37, 9, 37, 15, 43, 15, 43, 23, 37, 23, 37, 29, 25, 29, 25, 36,
        16, 36, 16, 27, 21, 27, 21, 18, 24, 18,
      ],
    );
    rect(c, "#6c8a52", 25, 11, 10, 4);
    rect(c, "#63814e", 19, 23, 9, 3);
    rect(c, "#63814e", 31, 21, 9, 3);
    rect(c, "#2d4c35", 42, 44, 9, 4);
    rect(c, "#2b4a36", 21, 52, 13, 4);
    rect(c, "#779356", 30, 10, 4, 2);
    rect(c, "#3a6041", 9, 36, 5, 5);
    rect(c, "#3a6041", 49, 29, 6, 4);
  });
  add("pine", 48, 80, (c) => {
    rect(c, "#5d5639", 21, 57, 7, 21);
    rect(c, "#8b784e", 23, 57, 2, 19);
    poly(
      c,
      "#1c4036",
      [
        23, 1, 28, 1, 28, 10, 33, 10, 33, 19, 39, 19, 39, 29, 44, 29, 44, 38,
        39, 38, 46, 51, 42, 51, 48, 64, 33, 66, 22, 70, 2, 65, 8, 52, 3, 52, 12,
        37, 7, 37, 15, 21, 19, 21,
      ],
    );
    poly(
      c,
      "#355b40",
      [
        23, 4, 27, 12, 31, 12, 31, 23, 36, 23, 36, 32, 40, 32, 40, 36, 34, 36,
        42, 51, 35, 51, 41, 61, 24, 65, 8, 62, 15, 51, 10, 51, 19, 35, 13, 35,
        21, 19, 19, 19,
      ],
    );
    poly(
      c,
      "#52774a",
      [
        23, 7, 25, 15, 29, 15, 29, 23, 23, 25, 30, 33, 23, 36, 33, 49, 25, 50,
        30, 59, 14, 60, 20, 49, 17, 49, 25, 34, 19, 34, 24, 23, 21, 23,
      ],
    );
    rect(c, "#6f8b50", 22, 20, 3, 6);
    rect(c, "#60824e", 20, 43, 5, 5);
  });
  add("slime", 28, 23, (c) => {
    poly(
      c,
      "#234438",
      [
        7, 4, 19, 4, 19, 7, 24, 7, 24, 12, 27, 12, 27, 20, 23, 23, 4, 23, 1, 20,
        1, 13, 4, 13, 4, 7, 7, 7,
      ],
    );
    poly(
      c,
      "#75a65c",
      [
        8, 5, 18, 5, 18, 8, 23, 8, 23, 14, 25, 14, 25, 19, 20, 21, 6, 21, 3, 18,
        5, 12, 7, 12,
      ],
    );
    rect(c, "#a2c879", 9, 6, 8, 4);
    rect(c, "#8ab96a", 7, 10, 13, 5);
    rect(c, "#243d35", 9, 13, 3, 4);
    rect(c, "#243d35", 18, 13, 3, 4);
    rect(c, "#dfdf9a", 12, 18, 5, 1);
    rect(c, "#b8db91", 8, 8, 3, 2);
  });
  add("rock", 30, 25, (c) => {
    poly(c, "#293e36", [7, 4, 20, 2, 27, 8, 30, 21, 23, 25, 4, 24, 0, 17]);
    poly(c, "#69796a", [7, 4, 20, 2, 26, 8, 25, 19, 7, 21, 2, 16]);
    poly(c, "#8c9780", [7, 4, 19, 3, 22, 7, 15, 9, 4, 15, 4, 10]);
    poly(c, "#4f6853", [18, 10, 26, 8, 26, 19, 19, 21, 15, 18]);
    rect(c, "#6d8a51", 3, 17, 7, 4);
    rect(c, "#93a16b", 5, 17, 3, 2);
  });
  add("bush", 32, 22, (c) => {
    poly(
      c,
      "#244637",
      [
        5, 5, 12, 5, 12, 1, 22, 1, 22, 5, 28, 5, 28, 11, 32, 11, 30, 20, 4, 22,
        0, 15, 0, 10, 5, 10,
      ],
    );
    rect(c, "#527544", 5, 7, 23, 10);
    rect(c, "#6c8b4c", 9, 4, 12, 7);
    rect(c, "#769352", 6, 10, 8, 4);
    rect(c, "#d1ad63", 20, 10, 2, 2);
    rect(c, "#d1ad63", 25, 14, 2, 2);
  });
  add("flower", 13, 16, (c) => {
    rect(c, "#82a15b", 6, 7, 1, 9);
    rect(c, "#71954e", 3, 11, 3, 2);
    rect(c, "#eccea0", 3, 3, 7, 5);
    rect(c, "#eccea0", 5, 1, 3, 9);
    rect(c, "#d69558", 5, 4, 3, 3);
  });
  add("mushroom", 16, 17, (c) => {
    rect(c, "#cfbb8d", 7, 9, 4, 7);
    rect(c, "#a28863", 10, 10, 2, 6);
    poly(c, "#b75d43", [4, 3, 11, 3, 11, 5, 14, 5, 15, 10, 1, 10, 2, 6, 4, 6]);
    rect(c, "#e6bd88", 4, 5, 3, 2);
    rect(c, "#e6bd88", 10, 7, 2, 2);
  });
  add("campfire", 24, 26, (c) => {
    poly(c, "#576252", [3, 17, 20, 17, 24, 23, 18, 26, 4, 26, 0, 23]);
    rect(c, "#9c8352", 4, 20, 16, 3);
    rect(c, "#73563b", 7, 17, 3, 9);
    rect(c, "#73563b", 16, 17, 3, 9);
    poly(
      c,
      "#d27f3e",
      [11, 1, 16, 9, 19, 7, 22, 17, 18, 21, 6, 21, 3, 16, 8, 7, 9, 12],
    );
    poly(c, "#ebba62", [11, 6, 16, 15, 17, 13, 18, 19, 8, 20, 6, 16]);
    rect(c, "#f5df9b", 10, 14, 4, 5);
  });
  add("chest", 30, 26, (c) => {
    rect(c, "#403e30", 2, 6, 26, 20);
    rect(c, "#977546", 3, 5, 24, 19);
    rect(c, "#c29b5a", 5, 2, 20, 8);
    rect(c, "#dfb969", 7, 3, 16, 3);
    rect(c, "#554f35", 3, 12, 24, 3);
    rect(c, "#d5b96e", 5, 5, 3, 19);
    rect(c, "#d5b96e", 22, 5, 3, 19);
    rect(c, "#f1d488", 13, 11, 5, 6);
    rect(c, "#5c583b", 15, 13, 1, 2);
  });
}
