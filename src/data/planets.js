/**
 * Islands a player can visit from the map.
 *
 * The file name stays `planets.js` so older imports keep working. `PLANETS`
 * and `ISLANDS` are the same list. `locked` is what the map reads today.
 * `unlock` is a placeholder for a later points system — `points` stays null
 * until the rules are chosen. Rename `name` freely. Keep `id` stable.
 */
export const ISLANDS = [
  {
    id: "pibo-world",
    name: "Pibo Island",
    home: true,
    locked: false,
    unlock: null,
    blurb: "Your home island",
    color: "#8fce74",
  },
  {
    id: "cookie-cove",
    name: "Cookie Cove",
    home: false,
    locked: true,
    unlock: { kind: "points", points: null, label: "Earn points to unlock" },
    blurb: "A sweet little island",
    color: "#f2c14e",
  },
  {
    id: "moon-muffin",
    name: "Moon Muffin",
    home: false,
    locked: true,
    unlock: { kind: "points", points: null, label: "Earn points to unlock" },
    blurb: "Soft hills on a night island",
    color: "#c7b6f5",
  },
  {
    id: "bubble-bay",
    name: "Bubble Bay",
    home: false,
    locked: true,
    unlock: { kind: "points", points: null, label: "Earn points to unlock" },
    blurb: "Round islets and quiet water",
    color: "#8fd4ea",
  },
  {
    id: "star-sprinkle",
    name: "Star Sprinkle",
    home: false,
    locked: true,
    unlock: { kind: "points", points: null, label: "Earn points to unlock" },
    blurb: "A sparkly sky island",
    color: "#f5a8c8",
  },
];

/** Same data as ISLANDS. Kept so existing imports do not break. */
export const PLANETS = ISLANDS;

/** What the map should say when an island cannot be visited yet. */
export function lockedLabel(island) {
  return island?.unlock?.label || "Earn points to unlock";
}
