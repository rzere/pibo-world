import { PLATE_W, PLATE_H } from "./iso.js";
import { PLATE_PIXELS } from "../data/painted.js";

/**
 * Walk and air samples painted from the concept image.
 * Red = grass and path, blue = open air over the sea (Pibo flies there).
 * Green in the mask is everything else. Only the sky that touches the top of
 * the picture blocks a step. Rocks, flowers, and the coast stay walkable.
 * Past the bottom of the picture is out of frame, so a step stops there.
 */

const IMG_W = 1280;
const IMG_H = 720;
const SEA_PAD = (PLATE_PIXELS.worldH - PLATE_H) / 2;
let mask = null;

export function setWalkMask(data, w, h) {
  mask = { data, w, h, sky: skyFromTop(data, w, h) };
}

export function loadWalkMask(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      setWalkMask(data, img.width, img.height);
      resolve();
    };
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Green pixels connected to the top edge are sky. Interior green is land. */
function skyFromTop(data, w, h) {
  const sky = new Uint8Array(w * h);
  const stack = [];
  const isGreen = (p) => {
    const i = p * 4;
    return data[i] <= 200 && data[i + 2] <= 200;
  };
  for (let x = 0; x < w; x++) {
    if (!isGreen(x)) continue;
    sky[x] = 1;
    stack.push(x);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) consider(p - 1);
    if (x + 1 < w) consider(p + 1);
    if (y > 0) consider(p - w);
    if (y + 1 < h) consider(p + w);
  }
  return sky;

  function consider(n) {
    if (sky[n] || !isGreen(n)) return;
    sky[n] = 1;
    stack.push(n);
  }
}

function sample(x, z) {
  if (!mask) return "walk";
  if (x < -PLATE_W / 2 || x > PLATE_W / 2 || z < -PLATE_H / 2) return "block";
  if (z > PLATE_H / 2 + SEA_PAD) return "block";
  if (z > PLATE_H / 2) return "water";
  const px = (x / PLATE_W + 0.5) * IMG_W;
  const py = (z / PLATE_H + 0.5) * IMG_H;
  const mx = Math.max(0, Math.min(mask.w - 1, Math.floor((px * mask.w) / IMG_W)));
  const my = Math.max(0, Math.min(mask.h - 1, Math.floor((py * mask.h) / IMG_H)));
  const p = my * mask.w + mx;
  const i = p * 4;
  if (mask.data[i] > 200) return "walk";
  if (mask.data[i + 2] > 200) return "water";
  if (mask.sky[p]) return "block";
  return "walk";
}

export function onLand(x, z) {
  return sample(x, z) === "walk";
}

export function isBlocked(x, z) {
  return sample(x, z) === "block";
}

/** True when any sample on the pot is over open sea, which is flight air. */
export function isFlightAir(x, z, fx = 0, fz = 0, reach = 0.5) {
  const points = [
    [x, z],
    [x + fx * reach, z + fz * reach],
    [x + reach, z],
    [x - reach, z],
    [x, z + reach],
    [x, z - reach],
  ];
  return points.some(([px, pz]) => sample(px, pz) === "water");
}

/** @deprecated Swimming is retired. The sea is flight air. */
export function isBlueWater(x, z, fx = 0, fz = 0, reach = 0.5) {
  return isFlightAir(x, z, fx, fz, reach);
}

export const OCEAN_LAT = 64;
export function oceanAmount() {
  return 0;
}
