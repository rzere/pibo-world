/**
 * The bright island. One painting holds the ground, buildings, and trees so
 * they read as a single world. The little mascots are their own sprites, not
 * cards cut from this painting. Outdoor animals are not on the plate.
 * x grows right, z grows down. The picture is 32 units wide and 18 tall.
 * It is not padded: stretching the edge rows smears the cliff and flowers.
 */
import {
  CIRCLES,
  HOUSES,
  LAYOUT,
  LIBRARY_MASCOT,
  PAINTED_SPRITES,
} from "./layers.js";

export { CIRCLES, HOUSES, LAYOUT, LIBRARY_MASCOT, PAINTED_SPRITES };

export const PLATE_SRC = "assets/painted/plate.png";
export const PLATE_PIXELS = {
  pixelWidth: 2560,
  pixelHeight: 1440,
  worldW: 32,
  worldH: 18,
  pad: 0,
};
export const WALK_MASK_SRC = "assets/painted/walk-mask.png";

export const PLACEMENTS = PAINTED_SPRITES.map((sprite) => ({
  id: sprite.id,
  asset: sprite.id,
  x: sprite.x,
  z: sprite.z,
  depthBias: sprite.depthBias || 0,
}));
