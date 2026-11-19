/**
 * Swappable art for the painted island.
 *
 * The ground is one picture (the concept plate). Tall objects are separate
 * images cut from that same picture so Pibo can walk behind them. Replace a
 * PNG, or point `src` at a new one, and refresh. Width and height are world
 * units on the plate (the painting is 32 units wide). Anchor y 0 is the
 * bottom edge, which sits on the feet line used for depth sorting.
 *
 * Pibo's frames live under `states`. See ASSETS.md.
 */
import { PAINTED_SPRITES, PLATE_PIXELS, PLATE_SRC, WALK_MASK_SRC } from "./painted.js";
import { CRITTERS } from "./critters.js";

const px = (w, h) => ({ pixelWidth: w, pixelHeight: h });

export const ASSETS = {
  plate: {
    id: "plate",
    src: PLATE_SRC,
    kind: "ground",
    pixelWidth: PLATE_PIXELS.pixelWidth,
    pixelHeight: PLATE_PIXELS.pixelHeight,
    width: PLATE_PIXELS.worldW,
    height: PLATE_PIXELS.worldH,
    note: "The whole outdoor island, unpadded. Buildings and trees are in this picture. Swap assets/painted/plate.png.",
  },
  walkMask: {
    id: "walk-mask",
    src: WALK_MASK_SRC,
    kind: "mask",
    ...px(640, 360),
    note: "Red = grass and path, blue = sea, green = cliff. Not drawn.",
  },
  pibo: {
    id: "pibo",
    kind: "character",
    // About a doorway tall once the game scales him to two thirds.
    // The bottom edge is the feet. Swap assets/pibo/pibo.png.
    width: 3.44,
    height: 4.5,
    swimWidth: 4.2,
    swimHeight: 2.4,
    radius: 0.7,
    waterReach: 0.5,
    anchor: { x: 0.5, y: 0 },
    ...px(645, 838),
    // Breaststroke frames in assets/pibo/pibo-swim-*.png are unused.
    // Crossing the sea plays an upright flight on the idle pot instead.
    // Left, right, and front are her three drawings. The walker swaps them.
    fps: { idle: 2, walk: 7 },
    faces: {
      left: "assets/pibo/pibo.png",
      right: "assets/pibo/pibo-face-right.png",
      front: "assets/pibo/pibo-face-front.png",
    },
    states: {
      idle: ["assets/pibo/pibo.png"],
      walk: ["assets/pibo/pibo.png"],
    },
  },
};

for (const critter of CRITTERS) {
  ASSETS[critter.id] = {
    id: critter.id,
    src: critter.src,
    kind: "character",
    pixelWidth: critter.pixelWidth,
    pixelHeight: critter.pixelHeight,
    width: critter.width,
    height: critter.height,
    anchor: { x: 0.5, y: 0 },
    states: { walk: critter.frames },
    note: "Paria's little animal. Eight walk drawings, not painted into the plate.",
  };
}

for (const sprite of PAINTED_SPRITES) {
  ASSETS[sprite.id] = {
    id: sprite.id,
    src: sprite.src,
    pixelWidth: sprite.pixelWidth,
    pixelHeight: sprite.pixelHeight,
    width: sprite.width,
    height: sprite.height,
    anchor: sprite.anchor,
    footprint: sprite.footprint,
  };
}

export function collectSources(assets = ASSETS) {
  const urls = new Set();
  for (const entry of Object.values(assets)) {
    if (entry.kind === "mask") continue;
    if (entry.src) urls.add(entry.src);
    if (entry.faces) {
      for (const url of Object.values(entry.faces)) urls.add(url);
    }
    if (entry.states) {
      for (const frames of Object.values(entry.states)) {
        for (const url of frames) urls.add(url);
      }
    }
  }
  return [...urls];
}
