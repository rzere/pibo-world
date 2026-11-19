/**
 * Bright-island layout. x grows to the right of the picture, z grows down.
 * Building footprints and trunk circles come from the layer manifest so a
 * replaced painting keeps the same door and the same keep-out.
 */
import { CIRCLES, HOUSES, LAYOUT, PLACEMENTS } from "../data/painted.js";

export { LAYOUT, PLACEMENTS };

export const GROUND_Y = 0;
export const WATER_Y = 0;

export function collidersFromPlacements() {
  const out = [];
  for (const [id, ring] of Object.entries(HOUSES)) {
    out.push({
      id,
      type: "poly",
      points: ring.map(([x, z]) => ({ x, z })),
    });
  }
  for (const circle of CIRCLES) {
    out.push({
      id: circle.id,
      type: "circle",
      x: circle.x,
      z: circle.z,
      radius: circle.radius,
    });
  }
  return out;
}
