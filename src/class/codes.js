/** Class codes use the same two-word shape as island names, so a class is one world. */

const ADJ = ["sunny", "mossy", "fizzy", "sleepy", "brave", "tiny", "cozy", "lucky", "misty", "rosy", "jolly", "minty", "breezy", "silly", "golden", "velvet"];
const NOUN = ["otter", "pebble", "teapot", "comet", "mango", "lantern", "meadow", "muffin", "acorn", "puffin", "island", "cloud", "pickle", "button", "garden", "harbor"];

export function cleanCode(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function makeCode(taken = new Set()) {
  for (let i = 0; i < 24; i++) {
    const code = `${ADJ[Math.floor(Math.random() * ADJ.length)]}-${NOUN[Math.floor(Math.random() * NOUN.length)]}`;
    if (!taken.has(code)) return code;
  }
  return `class-${Math.random().toString(36).slice(2, 6)}`;
}

export function cleanUsername(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 16);
}

export function validUsername(name) {
  return /^[a-z0-9][a-z0-9-]{2,15}$/.test(name);
}

export function cleanDisplayName(raw, max = 24) {
  return String(raw || "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}
