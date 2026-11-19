/**
 * Island layout. The outdoor picture is one painting (assets/painted/plate.png).
 * Buildings and trees stay in that painting so they cannot clip through each other.
 * The old painted animals and butterflies are not drawn. Paria's little mascots
 * wander as their own sprites. The library room still has its own files.
 * The anchor of a future outdoor sprite is the bottom center.
 */
export const PAINTED_SPRITES = [];

export const LAYOUT = {
  start: { x: -0.5, z: 1.75 },
  home: { x: 3.9, z: -1.525 },
  tealHouse: { x: -3.675, z: 3.075 },
  lighthouse: { x: 13.288, z: -5.475 },
  lighthousePad: { x: 13.275, z: -3.7 },
  arcade: { x: -12.625, z: -4.3 },
  arcadeDoor: { x: -12.625, z: -1.8 },
  library: { x: -2.713, z: -2.612 },
  libraryDoor: { x: -2.725, z: 0.4 },
  cottageDoor: { x: 3.9, z: 1.85 },
  // Grass just in front of the mushroom door. The footprint ends at z 4.1.
  mushroomDoor: { x: -3.85, z: 4.85 },
  // Path in front of the striped stall. The footprint ends at z 1.3.
  market: { x: 9.85, z: -0.5 },
  marketDoor: { x: 9.2, z: 3.9 },
  companion: { x: -11.5, z: 1.5 },
  pino: { x: -10.5, z: 2.5 },
};

export const HOUSES = {
  "arcade": [[-14.425, -7.2], [-10.825, -7.2], [-10.825, -3.5], [-14.425, -3.5]],
  "lighthouse": [[12.525, -6.9], [14.05, -6.9], [14.05, -4.85], [12.525, -4.85]],
  "mushroom-house": [[-5.35, 0.9], [-2, 0.9], [-2, 4.1], [-5.35, 4.1]],
  "library": [[-5.55, -5.375], [0.125, -5.375], [0.125, -1.075], [-5.55, -1.075]],
  "cottage": [[0.625, -4.65], [7.175, -4.65], [7.175, 0.225], [0.625, 0.225]],
  "market": [[7.875, -2.375], [11.825, -2.375], [11.825, 1.3], [7.875, 1.3]],
};

export const CIRCLES = [
  { id: "tree-green", x: -3.75, z: -2.6, radius: 0.46, role: "trunk" },
  { id: "tree-pink", x: 8.012, z: -4.3, radius: 0.46, role: "trunk" },
];

export const LIBRARY_MASCOT = {
  src: "assets/painted/layers/raccoon.png",
  background: "assets/painted/layers/library-hangout.png",
  left: "43.2%",
  top: "36.11%",
  width: "20.08%",
};
