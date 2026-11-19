import * as THREE from "three";

/**
 * The concept painting is already the isometric view, so the camera looks
 * straight at that picture. An angled camera would squash it.
 * x grows right, z grows down the picture. W moves up the painting.
 */
export const PLATE_W = 32;
export const PLATE_H = 18;
export const ISO_YAW_DEG = 0;
export const ISO_PITCH_DEG = 0;

export function isoBasis() {
  return {
    quaternion: new THREE.Quaternion(),
    screenRight: new THREE.Vector3(1, 0, 0),
    screenUp: new THREE.Vector3(0, 0, -1),
    offsetDir: new THREE.Vector3(0, 0, 1),
    offset: new THREE.Vector3(0, 0, 40),
  };
}

/** Put a card on the painting. Larger z (lower on the picture) is closer. */
export function placeOnPlate(object, x, z, bias = 0) {
  object.position.set(x, -z, z * 0.08 + bias);
}

/**
 * Frame the painting itself.
 * A margin used to be filled by stretching the picture's edge rows, which
 * drew a hard seam and streaks under the cliffs and flowers. The view stays
 * inside the real pixels. A taller window crops the sides a little. A wider
 * window crops a little sky and foreground instead of stretching the edges.
 */
const VIEW_INSET = 0.04;

export function orthoSize(width, height) {
  const aspect = width / Math.max(1, height);
  const artAspect = PLATE_W / PLATE_H;
  if (aspect >= artAspect) {
    const viewW = PLATE_W - VIEW_INSET;
    return { viewW, viewH: viewW / aspect };
  }
  const viewH = PLATE_H - VIEW_INSET;
  return { viewW: viewH * aspect, viewH };
}

/** Short landscape windows are phones held sideways, not a desktop monitor. */
export function isPhoneLandscape(width, height) {
  return width > height && height > 0 && height <= 520;
}
