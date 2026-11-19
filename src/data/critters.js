/**
 * Paria's eight animals. Each folder is her walk cycle, eight drawings:
 * front, three-quarter left, side left, back-three-quarter left,
 * front, three-quarter right, side right, back-three-quarter right.
 * Both sides are her drawings. The game does not mirror them.
 * They are smaller than Pibo. Pibo is the only pot.
 */
const UNIT = 0.0076;

export const CRITTER_FRAME_NAMES = [
  "front-a",
  "three-left",
  "side-left",
  "back-left",
  "front-b",
  "three-right",
  "side-right",
  "back-right",
];

function critter(id, pixelWidth, pixelHeight, x, z, roam, speed, idle) {
  const frames = CRITTER_FRAME_NAMES.map((name) => `assets/critters/${id}/${name}.png`);
  return {
    id,
    src: frames[0],
    frames,
    pixelWidth,
    pixelHeight,
    width: Math.round(pixelWidth * UNIT * 1000) / 1000,
    height: Math.round(pixelHeight * UNIT * 1000) / 1000,
    x,
    z,
    roam,
    speed,
    idle,
  };
}

export const CRITTERS = [
  critter("cat", 114, 122, -6.4, 1.65, 0.48, 0.95, 0.2),
  critter("dog", 130, 106, -6.9, 3.7, 0.42, 0.82, 0.9),
  critter("bunny", 105, 131, -0.4, 4.75, 0.4, 1.05, 0.15),
  critter("panda", 109, 120, -6.55, -0.4, 0.38, 0.78, 1.3),
  critter("frog", 108, 112, 3.45, 5.15, 0.4, 0.9, 0.55),
  critter("penguin", 129, 110, 6.3, 2.45, 0.36, 0.86, 0.4),
  critter("unicorn", 123, 122, -9.35, 1.25, 0.4, 0.92, 1.1),
  critter("fox", 135, 125, -7.7, 5.05, 0.42, 1.02, 0.25),
];
