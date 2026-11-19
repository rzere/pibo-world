import { CRITTERS } from "../data/critters.js";
import { GLASSES, HATS, accessoryImage } from "./piboLook.js";

/**
 * Accessories for the animals: the same hat PNGs Pibo wears, plus glasses.
 * Pot colors and hair belong to Pibo, so an animal only dresses up.
 * Each animal keeps its own look on this browser.
 *
 * Her drawings have no hand-placed anchors, so every frame is measured once:
 * the outline is the dark ink reachable from the transparent outside, and
 * dark blobs it cannot reach are the eyes (or the panda's eye patches).
 * Back views have none, so they get a hat and no glasses.
 */

const KEY = "pibo-look";

export const DEFAULT_CRITTER_LOOK = { hat: "none", glasses: "none" };

/** Pibo's hat anchors are measured on a pot rim about this wide (in hat pixels). */
const HAT_FIT = 560;
/** How far the brim sinks below the top of the head, as a share of body height. */
const HAT_SINK = 0.16;
const INK = "#3a2a24";

const measured = new WeakMap();

export function cleanCritterLook(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CRITTER_LOOK };
  return {
    hat: HATS.some((item) => item.id === raw.hat) ? raw.hat : DEFAULT_CRITTER_LOOK.hat,
    glasses: GLASSES.some((item) => item.id === raw.glasses) ? raw.glasses : DEFAULT_CRITTER_LOOK.glasses,
  };
}

export function loadCritterLook(id) {
  try {
    return cleanCritterLook(JSON.parse(localStorage.getItem(`${KEY}:${id}`) || "null"));
  } catch {
    return { ...DEFAULT_CRITTER_LOOK };
  }
}

export function saveCritterLook(id, look) {
  try {
    localStorage.setItem(`${KEY}:${id}`, JSON.stringify(cleanCritterLook(look)));
  } catch {
    /* private mode */
  }
}

export function isDressed(look) {
  return !!look && (look.hat !== "none" || look.glasses !== "none");
}

export function anyCritterDressed() {
  return CRITTERS.some((def) => isDressed(loadCritterLook(def.id)));
}

/** Extra room a look needs around one frame, in source pixels. */
export function critterLookPad(source, look) {
  const m = measure(source);
  const box = hatBox(m, look);
  if (!box) return { x: 0, y: 0 };
  return {
    x: Math.ceil(Math.max(0, -box.x, box.x + box.dw - m.w)),
    y: Math.ceil(Math.max(0, -box.y)),
  };
}

/**
 * Draw the animal with its hat and glasses. Extra width is split on both
 * sides and extra height only goes on top, so the feet stay put.
 * `pad` lets every frame of one avatar share a canvas size; `scale` paints
 * larger than the source for the art room.
 */
export function paintCritterLook(source, look, target, { pad, scale = 1 } = {}) {
  const canvas = target || document.createElement("canvas");
  const m = measure(source);
  const p = pad || critterLookPad(source, look);
  canvas.width = Math.round((m.w + p.x * 2) * scale);
  canvas.height = Math.round((m.h + p.y) * scale);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(scale, 0, 0, scale, p.x * scale, p.y * scale);
  ctx.drawImage(source, 0, 0, m.w, m.h);
  const glasses = GLASSES.find((item) => item.id === look?.glasses);
  if (glasses?.color) drawGlasses(ctx, m, glasses.color);
  const box = hatBox(m, look);
  if (box) ctx.drawImage(box.img, box.x, box.y, box.dw, box.dh);
  ctx.restore();
  return canvas;
}

function hatBox(m, look) {
  const hat = HATS.find((item) => item.id === look?.hat);
  if (!hat?.src) return null;
  const img = accessoryImage(hat.id);
  if (!img?.naturalWidth) return null;
  const scale = ((m.right - m.left) / HAT_FIT) * (hat.scale ?? 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ax = hat.anchorPx ? hat.anchorPx.x * scale : dw / 2;
  const ay = hat.anchorPx ? hat.anchorPx.y * scale : dh;
  const sink = (m.bottom - m.top) * HAT_SINK;
  return {
    img,
    x: m.cx - ax + (hat.offset?.x ?? 0) * scale,
    y: m.crown + sink - ay + (hat.offset?.y ?? 0) * scale,
    dw,
    dh,
  };
}

function drawGlasses(ctx, m, color) {
  const { eyes } = m;
  if (!eyes.length) return;
  const bodyW = m.right - m.left;
  const pair = eyes.length === 2;
  const rw = pair
    ? Math.max(eyes[0].r, eyes[1].r) * 1.5 + Math.abs(eyes[1].x - eyes[0].x) * 0.32
    : Math.max(eyes[0].r * 3, bodyW * 0.2);
  const rh = rw * 0.76;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.4, rw * 0.13);
  for (const eye of eyes) {
    roundRect(ctx, eye.x - rw / 2, eye.y - rh / 2, rw, rh, rh * 0.45);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  if (pair) {
    const [a, b] = eyes[0].x < eyes[1].x ? eyes : [eyes[1], eyes[0]];
    ctx.moveTo(a.x + rw / 2, a.y);
    ctx.lineTo(b.x - rw / 2, b.y);
  } else {
    // Side view: one lens, and the arm runs back toward the ear.
    const eye = eyes[0];
    const back = eye.x < m.cx ? 1 : -1;
    ctx.moveTo(eye.x + (back * rw) / 2, eye.y);
    ctx.lineTo(eye.x + back * rw * 1.25, eye.y - rh * 0.1);
  }
  ctx.stroke();
  ctx.restore();
}

function measure(source) {
  const cached = measured.get(source);
  if (cached) return cached;
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(source, 0, 0, w, h);
  const d = sctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const solid = (i) => d[i * 4 + 3] >= 100;
  const dark = (i) => solid(i) && d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114 < 85;

  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(y * w + x)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) {
    left = 0;
    right = w - 1;
    top = 0;
    bottom = h - 1;
  }

  // Flood from the outside through transparent pixels and outline ink.
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let tail = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!outside[i] && (!solid(i) || dark(i))) {
        outside[i] = 1;
        queue[tail++] = i;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!outside[i] && (!solid(i) || dark(i))) {
        outside[i] = 1;
        queue[tail++] = i;
      }
    }
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % w;
    const y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (outside[j] || (solid(j) && !dark(j))) continue;
        outside[j] = 1;
        queue[tail++] = j;
      }
    }
  }

  // Dark blobs the outline never reached: eyes, mouths, noses.
  const seen = new Uint8Array(n);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || outside[i] || !dark(i)) continue;
    let size = 0;
    let sx = 0;
    let sy = 0;
    tail = 0;
    queue[tail++] = i;
    seen[i] = 1;
    for (let head = 0; head < tail; head++) {
      const k = queue[head];
      const x = k % w;
      const y = (k / w) | 0;
      size += 1;
      sx += x;
      sy += y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (seen[j] || outside[j] || !dark(j)) continue;
          seen[j] = 1;
          queue[tail++] = j;
        }
      }
    }
    blobs.push({ size, x: sx / size, y: sy / size, r: Math.sqrt(size / Math.PI) });
  }
  const bodyW = right - left;
  const bodyH = bottom - top;
  const minSize = Math.max(6, n * 0.001);
  // The frog has dark spots on its head bumps; real eyes sit lower.
  const candidates = blobs
    .filter((b) => b.size >= minSize && b.y > top + bodyH * 0.28 && b.y < top + bodyH * 0.8)
    .sort((a, b) => b.size - a.size);
  const eyes = [];
  if (candidates.length) {
    const first = candidates[0];
    eyes.push(first);
    const second = candidates.find((b) => b !== first
      && b.size >= first.size * 0.45
      && Math.abs(b.y - first.y) < bodyH * 0.12
      && Math.abs(b.x - first.x) > bodyW * 0.12);
    if (second) eyes.push(second);
  }

  const cx = eyes.length === 2 ? (eyes[0].x + eyes[1].x) / 2 : (left + right) / 2;
  const tops = [];
  const half = Math.max(1, Math.round(bodyW * 0.15));
  for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++) {
    if (x < 0 || x >= w) continue;
    for (let y = 0; y < h; y++) {
      if (solid(y * w + x)) {
        tops.push(y);
        break;
      }
    }
  }
  tops.sort((a, b) => a - b);
  const crown = tops.length ? tops[tops.length >> 1] : top;

  const result = { w, h, left, right, top, bottom, cx, crown, eyes };
  measured.set(source, result);
  return result;
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
