/**
 * Kid's look for the flat Pibo: pot color, hair, hat, scarf, glasses.
 * The sprite is split into pot (body and feet), leaves, and eyes. A new pot
 * color keeps the painted light and shadow and the dark outline. Hair is the
 * leaf layer. A hat replaces that layer and sits on the rim.
 * Saved on this browser and drawn on the island and in the art room.
 */

const KEY = "pibo-look";

export const DEFAULT_LOOK = {
  pot: "yellow",
  hair: "tuft",
  hat: "none",
  scarf: "none",
  glasses: "none",
};

export const POTS = [
  { id: "yellow", label: "Yellow pot" },
  { id: "red", label: "Red pot", color: [226, 64, 58] },
  { id: "orange", label: "Orange pot", color: [242, 132, 36] },
  { id: "pink", label: "Pink pot", color: [236, 96, 168] },
  { id: "green", label: "Green pot", color: [64, 186, 86] },
  { id: "blue", label: "Blue pot", color: [58, 148, 226] },
  { id: "purple", label: "Purple pot", color: [168, 96, 214] },
  { id: "dots", label: "Polka dots", color: [236, 96, 168], pattern: "dots" },
  { id: "stars", label: "Stars", color: [58, 130, 220], pattern: "stars" },
];

/**
 * Extra hair and every hat are transparent PNGs.
 * anchorPx is the pixel that sits on the middle of the pot rim's top
 * (x from the left of the file, y from the top). scale 1 is one image
 * pixel per sprite pixel. offset nudges from the rim in sprite pixels
 * (x right, y down). Files can be any size.
 * The original tuft is not a file: it is the leaf layer of assets/pibo/pibo.png.
 * A hat hides whichever hair is selected.
 */
export const HAIRS = [
  { id: "tuft", label: "Big leaf tuft" },
  { id: "succulent", label: "Succulent", src: "assets/pibo/hair/succulent.png", anchorPx: { x: 290, y: 389 }, scale: 1 },
  { id: "fern", label: "Fern", src: "assets/pibo/hair/fern.png", anchorPx: { x: 336, y: 432 }, scale: 1 },
  { id: "sunflower", label: "Sunflower", src: "assets/pibo/hair/sunflower.png", anchorPx: { x: 294, y: 392 }, scale: 1 },
  { id: "clover", label: "Clover", src: "assets/pibo/hair/clover.png", anchorPx: { x: 314, y: 396 }, scale: 1 },
  { id: "palm", label: "Palm", src: "assets/pibo/hair/palm.png", anchorPx: { x: 315, y: 400 }, scale: 1 },
];

export const HATS = [
  { id: "none", label: "No hat" },
  { id: "beanie", label: "Beanie", src: "assets/pibo/hats/beanie.png", anchorPx: { x: 263, y: 372 }, scale: 1 },
  { id: "strawhat", label: "Straw hat", src: "assets/pibo/hats/strawhat.png", anchorPx: { x: 370, y: 253 }, scale: 1 },
  { id: "wizard", label: "Wizard hat", src: "assets/pibo/hats/wizard.png", anchorPx: { x: 295, y: 382 }, scale: 1 },
  { id: "crown", label: "Crown", src: "assets/pibo/hats/crown.png", anchorPx: { x: 181, y: 232 }, offset: { x: 0, y: 14 }, scale: 1 },
  { id: "cap", label: "Cap", src: "assets/pibo/hats/cap.png", anchorPx: { x: 300, y: 248 }, scale: 1 },
  { id: "pirate", label: "Pirate hat", src: "assets/pibo/hats/pirate.png", anchorPx: { x: 291, y: 255 }, scale: 1 },
];

export const SCARVES = [
  { id: "none", label: "No scarf" },
  { id: "blue", label: "Blue scarf", color: "#3d7ee8" },
  { id: "red", label: "Red scarf", color: "#e23b3b" },
];

export const GLASSES = [
  { id: "none", label: "No glasses" },
  { id: "yellow", label: "Yellow glasses", color: "#ffd24a" },
  { id: "blue", label: "Blue glasses", color: "#3d7ee8" },
];

const INK = "#3a2a24";

/**
 * Her three drawings. Eyes and blush sit in different places on each one,
 * so recolor and glasses follow the view instead of one mirrored picture.
 */
const FACES = {
  left: {
    eyes: [
      [0.27, 0.734, 0.05, 0.042],
      [0.468, 0.746, 0.055, 0.044],
    ],
    blush: [
      [0.251, 0.797, 0.04, 0.036],
      [0.46, 0.823, 0.065, 0.05],
    ],
    lenses: [
      [0.27, 0.734],
      [0.468, 0.746],
    ],
  },
  right: {
    eyes: [
      [0.53, 0.746, 0.055, 0.044],
      [0.728, 0.734, 0.05, 0.042],
    ],
    blush: [
      [0.538, 0.823, 0.065, 0.05],
      [0.747, 0.795, 0.04, 0.036],
    ],
    lenses: [
      [0.53, 0.746],
      [0.728, 0.734],
    ],
  },
  front: {
    eyes: [
      [0.391, 0.751, 0.052, 0.042],
      [0.597, 0.754, 0.052, 0.042],
    ],
    blush: [
      [0.357, 0.815, 0.055, 0.042],
      [0.629, 0.824, 0.052, 0.046],
    ],
    lenses: [
      [0.391, 0.751],
      [0.597, 0.754],
    ],
  },
};

export const FACE_SRC = {
  left: "assets/pibo/pibo.png",
  right: "assets/pibo/pibo-face-right.png",
  front: "assets/pibo/pibo-face-front.png",
};

function faceProfile(view) {
  return FACES[view] || FACES.left;
}
const layersOf = new WeakMap();
const spriteImages = new Map();
const hairListeners = new Set();

if (typeof Image !== "undefined") {
  for (const item of [...HAIRS, ...HATS]) {
    if (!item.src) continue;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth) spriteImages.set(item.id, img);
      for (const fn of hairListeners) fn(item.id);
    };
    img.onerror = () => {
      spriteImages.delete(item.id);
    };
    img.src = item.src;
  }
}

/** Fires when a hair PNG finishes loading, so the island and art room can repaint. */
export function onHairSprite(fn) {
  hairListeners.add(fn);
  return () => hairListeners.delete(fn);
}

export function loadLook() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_LOOK };
    return {
      pot: POTS.some((item) => item.id === raw.pot) ? raw.pot : DEFAULT_LOOK.pot,
      hair: HAIRS.some((item) => item.id === raw.hair) ? raw.hair : DEFAULT_LOOK.hair,
      hat: HATS.some((item) => item.id === raw.hat) ? raw.hat : DEFAULT_LOOK.hat,
      scarf: SCARVES.some((item) => item.id === raw.scarf) ? raw.scarf : DEFAULT_LOOK.scarf,
      glasses: GLASSES.some((item) => item.id === raw.glasses) ? raw.glasses : DEFAULT_LOOK.glasses,
    };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(look) {
  localStorage.setItem(KEY, JSON.stringify(look));
}

export function paintLook(source, look, target, view = "left") {
  const canvas = target || document.createElement("canvas");
  const layers = splitLayers(source, view);
  const { w, h } = layers;
  const pot = POTS.find((item) => item.id === look.pot) || POTS[0];
  const hat = HATS.find((item) => item.id === look.hat);
  const hairId = HAIRS.some((item) => item.id === look.hair) ? look.hair : "tuft";
  const hair = HAIRS.find((item) => item.id === hairId);
  const wearHat = Boolean(hat && hat.id !== "none");
  const pieces = [];
  if (wearHat && hat.src) pieces.push(hat);
  else if (hair?.src) pieces.push(hair);
  let minX = 0;
  let minY = 0;
  let maxX = w;
  let maxY = h;
  for (const piece of pieces) {
    const box = accessoryBounds(layers, piece);
    if (!box) continue;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.dw);
    maxY = Math.max(maxY, box.y + box.dh);
  }
  // Extra width is split on both sides so the pot stays centered.
  // Extra height is only above the leaves, so the feet stay on the ground.
  const padX = Math.max(0, Math.ceil(-minX), Math.ceil(maxX - w));
  const padY = Math.max(0, Math.ceil(-minY));
  canvas.width = w + padX * 2;
  canvas.height = h + padY;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(padX, padY);
  const colored = potCanvas(layers, pot);
  ctx.drawImage(colored, 0, 0);
  if (pot.pattern) drawPattern(ctx, layers, pot.pattern);
  ctx.drawImage(layers.eyes, 0, 0);
  let worn = null;
  if (!wearHat) {
    if (!hair?.src) ctx.drawImage(layers.leaves, 0, 0);
    else {
      drawAccessory(ctx, layers, hair);
      worn = hair;
    }
  }
  const scarf = SCARVES.find((item) => item.id === look.scarf);
  if (scarf?.color) drawScarf(ctx, layers, scarf.color);
  const glasses = GLASSES.find((item) => item.id === look.glasses);
  if (glasses?.color) drawGlasses(ctx, layers, glasses.color);
  if (wearHat) {
    drawAccessory(ctx, layers, hat);
    worn = hat;
  }
  // Hair sits on the pot, then the rim ink is painted back so a soft
  // leaf edge cannot break the black outline.
  reinforcePot(ctx, layers, worn, colored);
  ctx.restore();
  return canvas;
}

function splitLayers(source, view = "left") {
  const cached = layersOf.get(source);
  if (cached) return cached;
  const profile = faceProfile(view);
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(source, 0, 0, w, h);
  const src = sctx.getImageData(0, 0, w, h).data;
  const potTop = new Int32Array(w);
  potTop.fill(h);
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = Math.floor(h * 0.3); y < h; y++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 20 && isWarm(src[i], src[i + 1], src[i + 2]) && !isGreen(src[i], src[i + 1], src[i + 2])) {
        run += 1;
        if (run >= 4) {
          potTop[x] = y - 3;
          break;
        }
      } else run = 0;
    }
  }
  const smooth = new Int32Array(potTop);
  for (let x = 4; x < w - 4; x++) {
    const window = Array.from(potTop.slice(x - 4, x + 5)).sort((a, b) => a - b);
    smooth[x] = window[4];
  }

  const mask = new Uint8Array(w * h);
  const pot = sctx.createImageData(w, h);
  const leafC = document.createElement("canvas");
  leafC.width = w;
  leafC.height = h;
  const eyeC = document.createElement("canvas");
  eyeC.width = w;
  eyeC.height = h;
  const leafImg = leafC.getContext("2d").createImageData(w, h);
  const eyeImg = eyeC.getContext("2d").createImageData(w, h);
  const pd = pot.data;
  const ld = leafImg.data;
  const ed = eyeImg.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = src[p + 3];
      if (a < 16) continue;
      const r = src[p];
      const g = src[p + 1];
      const b = src[p + 2];
      let into = ld;
      let kind = 0;
      if (isGreen(r, g, b)) {
        into = ld;
      } else if (inSpot(x, y, w, h, profile.eyes) && isEyePixel(r, g, b)) {
        into = ed;
      } else if (inSpot(x, y, w, h, profile.blush) && isBlushPixel(r, g, b)) {
        // Orange cheek circles stay. Body shading outside these spots recolors.
        into = ed;
      } else if (Math.max(r, g, b) < 120) {
        // The rim stroke sits above the yellow lip. It is pot ink, not hair,
        // or choosing a flower would throw the outline away.
        into = pd;
        kind = 2;
      } else if (y < smooth[x] && !isWarm(r, g, b)) {
        into = ld;
      } else {
        into = pd;
        kind = 1;
      }
      into[p] = r;
      into[p + 1] = g;
      into[p + 2] = b;
      into[p + 3] = a;
      mask[y * w + x] = kind;
    }
  }
  leafC.getContext("2d").putImageData(leafImg, 0, 0);
  eyeC.getContext("2d").putImageData(eyeImg, 0, 0);

  const layers = {
    w,
    h,
    mask,
    pot,
    leaves: leafC,
    eyes: eyeC,
    rim: measureRim(mask, w, h),
    pots: new Map(),
    view,
    lenses: profile.lenses,
    outline: buildOutline(src, mask, w, h),
  };
  layersOf.set(source, layers);
  return layers;
}

function measureRim(mask, w, h) {
  const tops = [];
  for (let x = Math.floor(w * 0.35); x < Math.floor(w * 0.65); x++) {
    for (let y = 0; y < h; y++) {
      if (mask[y * w + x] === 1) {
        tops.push(y);
        break;
      }
    }
  }
  tops.sort((a, b) => a - b);
  const yTop = tops.length ? tops[tops.length >> 1] : Math.floor(h * 0.44);
  const y = Math.min(h - 1, yTop + Math.round(h * 0.015));
  let left = w;
  let right = 0;
  for (let x = 0; x < w; x++) {
    if (mask[y * w + x]) {
      left = x;
      break;
    }
  }
  for (let x = w - 1; x >= 0; x--) {
    if (mask[y * w + x]) {
      right = x;
      break;
    }
  }
  if (right <= left) {
    left = Math.floor(w * 0.12);
    right = Math.floor(w * 0.88);
  }
  return { x: (left + right) / 2, y: yTop, width: right - left, left, right };
}

function potCanvas(layers, pot) {
  const key = pot.color ? pot.color.join(",") : "yellow";
  const cached = layers.pots.get(key);
  if (cached) return cached;
  const { w, h, mask } = layers;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const img = new ImageData(new Uint8ClampedArray(layers.pot.data), w, h);
  if (pot.color) {
    const [th, , ts] = rgbToHsl(pot.color[0], pot.color[1], pot.color[2]);
    const sat = Math.max(0.78, ts);
    const data = img.data;
    for (let n = 0; n < mask.length; n++) {
      if (mask[n] !== 1) continue;
      const p = n * 4;
      const [, , l] = rgbToHsl(data[p], data[p + 1], data[p + 2]);
      const [r, g, b] = hslToRgb(th, sat, Math.max(0.16, Math.min(0.86, l)));
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
    }
  }
  canvas.getContext("2d").putImageData(img, 0, 0);
  layers.pots.set(key, canvas);
  return canvas;
}

function drawPattern(ctx, layers, pattern) {
  const { w, h, mask } = layers;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const g = scratch.getContext("2d");
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.lineWidth = Math.max(4, w * 0.012);
  if (pattern === "dots") {
    g.fillStyle = "#fff6ee";
    for (let y = Math.floor(h * 0.48); y < h * 0.88; y += Math.floor(h * 0.075)) {
      for (let x = Math.floor(w * 0.22); x < w * 0.82; x += Math.floor(w * 0.12)) {
        const jx = ((y / h) * 3) % 2 > 1 ? w * 0.06 : 0;
        ellipse(g, x + jx, y, w * 0.055, h * 0.04);
        g.fill();
        g.stroke();
      }
    }
  } else {
    g.fillStyle = "#ffe56a";
    for (const [fx, fy] of [[0.32, 0.52], [0.68, 0.52], [0.42, 0.84], [0.64, 0.82]]) {
      star(g, fx * w, fy * h, w * 0.045);
      g.fill();
      g.stroke();
    }
  }
  const img = g.getImageData(0, 0, w, h);
  const data = img.data;
  for (let n = 0; n < mask.length; n++) {
    if (mask[n] !== 1) data[n * 4 + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  ctx.drawImage(scratch, 0, 0);
}

function accessoryBounds(layers, item) {
  const img = spriteImages.get(item?.id);
  if (!item?.src || !img?.naturalWidth) return null;
  const scale = item.scale ?? 1;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ax = item.anchorPx ? item.anchorPx.x * scale : dw * (item.anchor?.x ?? 0.5);
  const ay = item.anchorPx ? item.anchorPx.y * scale : dh * (item.anchor?.y ?? 1);
  const x = layers.rim.x - ax + (item.offset?.x ?? 0);
  const y = layers.rim.y - ay + (item.offset?.y ?? 0);
  return { x, y, dw, dh };
}

function drawAccessory(ctx, layers, item) {
  const box = accessoryBounds(layers, item);
  if (!box) return;
  ctx.drawImage(spriteImages.get(item.id), box.x, box.y, box.dw, box.dh);
}

/**
 * The outer black stroke, about 30px thick. The dark mouth inside the rim
 * is farther from the transparent outside, so it stays behind the flower.
 */
function buildOutline(src, mask, w, h) {
  const count = w * h;
  const reach = 32;
  const dist = new Int16Array(count);
  dist.fill(32767);
  const queue = new Int32Array(count);
  let tail = 0;
  for (let n = 0; n < count; n++) {
    if (src[n * 4 + 3] >= 16) continue;
    dist[n] = 0;
    queue[tail++] = n;
  }
  let head = 0;
  while (head < tail) {
    const n = queue[head++];
    const d = dist[n];
    if (d >= reach) continue;
    const x = n % w;
    const y = (n / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        const next = ny * w + nx;
        if (dist[next] <= d + 1) continue;
        dist[next] = d + 1;
        queue[tail++] = next;
      }
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let n = 0; n < count; n++) {
    if (mask[n] !== 2 || dist[n] > reach) continue;
    const p = n * 4;
    data[p] = src[p];
    data[p + 1] = src[p + 1];
    data[p + 2] = src[p + 2];
    data[p + 3] = src[p + 3];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function reinforcePot(ctx, layers, item, colored) {
  const { w, h, mask } = layers;
  const box = item ? accessoryBounds(layers, item) : null;
  const img = item ? spriteImages.get(item.id) : null;
  if (box && img) {
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, box.x, box.y, box.dw, box.dh);
    const hair = sctx.getImageData(0, 0, w, h).data;
    const pot = colored.getContext("2d").getImageData(0, 0, w, h).data;
    const restored = sctx.createImageData(w, h);
    const out = restored.data;
    for (let n = 0; n < mask.length; n++) {
      if (!mask[n]) continue;
      const alpha = hair[n * 4 + 3];
      // A half-transparent leaf edge blends into the pot and breaks the ink.
      if (alpha === 0 || alpha === 255) continue;
      const p = n * 4;
      out[p] = pot[p];
      out[p + 1] = pot[p + 1];
      out[p + 2] = pot[p + 2];
      out[p + 3] = pot[p + 3];
    }
    sctx.putImageData(restored, 0, 0);
    ctx.drawImage(scratch, 0, 0);
  }
  ctx.drawImage(layers.outline, 0, 0);
}

function drawScarf(ctx, layers, color) {
  const { w, h, mask } = layers;
  const y = h * 0.86;
  const span = spanAt(mask, w, y);
  const inset = (span.right - span.left) * 0.03;
  const x = span.left + inset;
  const bw = Math.max(w * 0.4, span.right - span.left - inset * 2);
  const bh = h * 0.068;
  const tailW = w * 0.09;
  const tailX = x + bw - tailW * 1.55;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(10, w * 0.028);
  ctx.lineJoin = "round";
  roundRect(ctx, tailX, y + bh * 0.55, tailW, h * 0.085, w * 0.028);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, tailX + tailW * 0.7, y + bh * 0.62, tailW * 0.85, h * 0.06, w * 0.024);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, x, y, bw, bh, bh * 0.45);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = lighten(color, 0.45);
  roundRect(ctx, x + w * 0.025, y + bh * 0.34, bw - w * 0.05, bh * 0.28, bh * 0.18);
  ctx.fill();
  ctx.restore();
}

function spanAt(mask, w, y) {
  const row = Math.max(0, Math.min(mask.length / w - 1, Math.round(y)));
  let left = 0;
  let right = w - 1;
  for (let x = 0; x < w; x++) {
    if (mask[row * w + x]) {
      left = x;
      break;
    }
  }
  for (let x = w - 1; x >= 0; x--) {
    if (mask[row * w + x]) {
      right = x;
      break;
    }
  }
  return { left, right };
}

function drawGlasses(ctx, layers, color) {
  const { w, h, lenses } = layers;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(6, w * 0.016);
  ctx.lineJoin = "round";
  const rw = w * 0.1;
  const rh = h * 0.072;
  const boxes = lenses.map(([cx, cy]) => ({
    x: cx * w - rw / 2,
    y: cy * h - rh / 2,
  }));
  for (const box of boxes) {
    roundRect(ctx, box.x, box.y, rw, rh, rh * 0.45);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(boxes[0].x + rw, boxes[0].y + rh * 0.5);
  ctx.lineTo(boxes[1].x, boxes[1].y + rh * 0.48);
  ctx.stroke();
  ctx.restore();
}

function isGreen(r, g, b) {
  return g > r + 8 && g > b && g > 45;
}

function isWarm(r, g, b) {
  return r > 140 && r > g + 5 && r > b + 35 && b < 120 && g < r + 10;
}

function isEyePixel(r, g, b) {
  const max = Math.max(r, g, b);
  if (max < 95) return true;
  return r < 130 && g < 90 && b < 70 && max < 150;
}

function isBlushPixel(r, g, b) {
  return r > 180 && g > 70 && g < 200 && b < 110 && r > g + 30;
}

function inSpot(x, y, w, h, spots) {
  const fx = x / w;
  const fy = y / h;
  for (const [cx, cy, rx, ry] of spots) {
    const dx = (fx - cx) / rx;
    const dy = (fy - cy) / ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s <= 0) {
    const v = clamp(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [clamp(hue(h + 1 / 3) * 255), clamp(hue(h) * 255), clamp(hue(h - 1 / 3) * 255)];
}

function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function ellipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(rx) / 2, Math.abs(ry) / 2, 0, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, rw, rh, r) {
  const rad = Math.min(r, Math.abs(rw) / 2, Math.abs(rh) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
  ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
  ctx.arcTo(x, y + rh, x, y, rad);
  ctx.arcTo(x, y, x + rw, y, rad);
  ctx.closePath();
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
