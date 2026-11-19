/**
 * Built-in 2D stickers for the arcade. Emoji only — no network, no image API.
 * The system supplies the art. The child decides where each thing hides.
 */
export const STICKERS = {
  ghost: { id: "ghost", emoji: "👻", label: "Ghost" },
  cat: { id: "cat", emoji: "🐱", label: "Cat" },
  door: { id: "door", emoji: "🚪", label: "Door" },
  bed: { id: "bed", emoji: "🛏️", label: "Bed" },
  tree: { id: "tree", emoji: "🌳", label: "Tree" },
  chest: { id: "chest", emoji: "🧰", label: "Chest" },
  painting: { id: "painting", emoji: "🖼️", label: "Painting" },
  key: { id: "key", emoji: "🔑", label: "Key" },
  treasure: { id: "treasure", emoji: "💎", label: "Treasure" },
};

export const BACKGROUNDS = {
  castle: { id: "castle", label: "Haunted castle", emoji: "🏰" },
  garden: { id: "garden", label: "Garden", emoji: "🌿" },
};

/** Hide spots the child can pick. `phrase` is the English place in a clue. */
export const HIDE_SPOTS = [
  { id: "door", name: "door", phrase: "behind the door", asset: "door", x: 22, y: 62 },
  { id: "bed", name: "bed", phrase: "under the bed", asset: "bed", x: 74, y: 64 },
  { id: "tree", name: "tree", phrase: "next to the tree", asset: "tree", x: 48, y: 34 },
  { id: "chest", name: "chest", phrase: "inside the chest", asset: "chest", x: 30, y: 78 },
  { id: "painting", name: "painting", phrase: "behind the painting", asset: "painting", x: 78, y: 30 },
];

export function hideSpot(id) {
  return HIDE_SPOTS.find((spot) => spot.id === id) || HIDE_SPOTS[0];
}
