import { ASSETS } from "./assets.js";
import { CRITTERS } from "./critters.js";

/**
 * Everyone you can play as. Pibo uses his three face drawings; the animals
 * use Paria's eight walk drawings. Remote players render through the same
 * Critter frame order: front, three-left, side-left, back-left, front,
 * three-right, side-right, back-right.
 */
const PIBO_SCALE = 2 / 3;
const faces = ASSETS.pibo.faces;

const PIBO = {
  id: "pibo",
  label: "Pibo",
  thumb: faces.front,
  def: {
    id: "pibo",
    src: faces.front,
    frames: [faces.front, faces.left, faces.left, faces.left, faces.front, faces.right, faces.right, faces.right],
    width: ASSETS.pibo.width * PIBO_SCALE,
    height: ASSETS.pibo.height * PIBO_SCALE,
  },
};

const NAMES = {
  cat: "Cat",
  dog: "Dog",
  bunny: "Bunny",
  panda: "Panda",
  frog: "Frog",
  penguin: "Penguin",
  unicorn: "Unicorn",
  fox: "Fox",
};

export const CHARACTERS = [
  PIBO,
  ...CRITTERS.map((def) => ({
    id: def.id,
    label: NAMES[def.id] || def.id,
    thumb: def.frames[0],
    def,
  })),
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
