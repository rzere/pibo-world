/**
 * Structured game spec. The 2D runtime plays this data. Nothing here is code.
 *
 * Every decision the child, a template, a teacher, or a later AI makes is
 * wrapped as { value, author }. Authors are only: child, ai, template, teacher.
 * A future model may fill art fields with author "ai". It must not add
 * executable source — the runtime ignores anything that is not this shape.
 */
import { HIDE_SPOTS, hideSpot } from "../data/arcadeStickers.js";

export const AUTHORS = ["child", "ai", "template", "teacher"];

export function authored(value, author = "template") {
  const who = AUTHORS.includes(author) ? author : "template";
  return { value, author: who };
}

export function read(field) {
  if (field && typeof field === "object" && "value" in field) return field.value;
  return field;
}

export function authorOf(field) {
  return field && typeof field === "object" && AUTHORS.includes(field.author) ? field.author : "template";
}

let seq = 1;
function nextId(prefix) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/**
 * One treasure-hunt spec. Art, positions, and the lock object come from the
 * sticker library (template or ai). Goal, hide spots, step order, and clue
 * sentences keep the author that was passed in.
 */
export function buildTreasureSpec({
  title = "The ghost's lost treasure",
  titleAuthor = "template",
  lessonId = "food-likes",
  background = "castle",
  backgroundAuthor = "template",
  hero = "ghost",
  heroAuthor = "template",
  keyId = "door",
  keyAuthor = "template",
  treasureId = "bed",
  treasureAuthor = "template",
  lockId = "chest",
  lockAuthor = "template",
  clueText = "I like apples. Look behind the door.",
  clueAuthor = "template",
  clue2 = "I don't like spicy food. The treasure is under the bed.",
  clue2Author = "template",
  goal = "Find the hidden treasure",
  goalAuthor = "template",
  steps = ["key", "lock", "treasure"],
  stepsAuthor = "template",
  id = null,
} = {}) {
  const safeKey = hideSpot(keyId).id;
  let safeTreasure = hideSpot(treasureId).id;
  if (safeTreasure === safeKey) {
    safeTreasure = HIDE_SPOTS.find((spot) => spot.id !== safeKey)?.id || "bed";
  }
  const safeLock = hideSpot(lockId).id;
  return {
    id: id || nextId("game"),
    type: "treasure-hunt",
    lessonId,
    title: authored(String(title || "Treasure hunt"), titleAuthor),
    scene: { background: authored(background, backgroundAuthor) },
    hero: authored(hero, heroAuthor),
    objects: HIDE_SPOTS.map((spot) => ({
      id: spot.id,
      asset: spot.asset,
      name: spot.name,
      x: spot.x,
      y: spot.y,
      author: "template",
    })),
    goal: authored(String(goal), goalAuthor),
    rules: [
      authored("Tap things in the room and follow the English clues.", "template"),
      authored("The key opens the lock. The lock guards the treasure.", "template"),
    ],
    obstacles: [
      {
        id: "key-lock",
        kind: "key-lock",
        keyHidesIn: authored(safeKey, keyAuthor),
        lockId: authored(safeLock, lockAuthor),
        treasureHidesIn: authored(safeTreasure, treasureAuthor),
      },
    ],
    clues: [
      { id: "clue-key", about: "key", text: String(clueText || ""), author: AUTHORS.includes(clueAuthor) ? clueAuthor : "template" },
      { id: "clue-treasure", about: "treasure", text: String(clue2 || ""), author: AUTHORS.includes(clue2Author) ? clue2Author : "template" },
    ],
    steps: authored(normalizeSteps(steps), stepsAuthor),
  };
}

export function ghostCastleTemplate(lesson) {
  const like = lesson?.pools?.stance?.find((item) => item.polarity === "like");
  const dislike = lesson?.pools?.stance?.find((item) => item.polarity === "dislike");
  const apple = lesson?.pools?.object?.find((item) => item.id === "apples");
  const spicy = lesson?.pools?.object?.find((item) => item.id === "spicy-food");
  const likeLine = like && apple ? `${like.grammar} ${apple.label}.` : "I like apples.";
  const dislikeLine = dislike && spicy ? `${dislike.grammar} ${spicy.label}.` : "I don't like spicy food.";
  return buildTreasureSpec({
    title: "The ghost's lost treasure",
    titleAuthor: "template",
    lessonId: lesson?.id || "food-likes",
    goal: "Help the ghost find the treasure",
    goalAuthor: "template",
    keyId: "door",
    treasureId: "bed",
    clueText: `${likeLine} Look behind the door.`,
    clue2: `${dislikeLine} The treasure is under the bed.`,
    hero: "ghost",
    background: "castle",
  });
}

export function normalizeSteps(steps) {
  const allowed = ["key", "lock", "treasure"];
  const list = Array.isArray(steps) ? steps.filter((step) => allowed.includes(step)) : [];
  for (const step of allowed) {
    if (!list.includes(step)) list.push(step);
  }
  return list;
}

/** Keep a loaded or stitched spec inside the treasure-hunt shape. */
export function normalizeSpec(raw, lesson) {
  if (!raw || raw.type !== "treasure-hunt" || !raw.obstacles?.[0]) {
    return ghostCastleTemplate(lesson);
  }
  const obstacle = raw.obstacles[0];
  const clues = Array.isArray(raw.clues) ? raw.clues : [];
  const keyClue = clues.find((clue) => clue.about === "key") || clues[0] || {};
  const treasureClue = clues.find((clue) => clue.about === "treasure") || clues[1] || {};
  const spec = buildTreasureSpec({
    id: raw.id,
    title: read(raw.title),
    titleAuthor: authorOf(raw.title),
    lessonId: raw.lessonId || lesson?.id,
    background: read(raw.scene?.background) || "castle",
    backgroundAuthor: authorOf(raw.scene?.background),
    hero: read(raw.hero) || "ghost",
    heroAuthor: authorOf(raw.hero),
    keyId: read(obstacle.keyHidesIn),
    keyAuthor: authorOf(obstacle.keyHidesIn),
    treasureId: read(obstacle.treasureHidesIn),
    treasureAuthor: authorOf(obstacle.treasureHidesIn),
    lockId: read(obstacle.lockId) || "chest",
    lockAuthor: authorOf(obstacle.lockId),
    clueText: keyClue.text || "",
    clueAuthor: authorOf(keyClue.author ? { value: keyClue.text, author: keyClue.author } : null),
    clue2: treasureClue.text || "",
    clue2Author: authorOf(treasureClue.author ? { value: treasureClue.text, author: treasureClue.author } : null),
    goal: read(raw.goal),
    goalAuthor: authorOf(raw.goal),
    steps: read(raw.steps),
    stepsAuthor: authorOf(raw.steps),
  });
  if (Array.isArray(raw.objects)) {
    for (const object of spec.objects) {
      const saved = raw.objects.find((item) => item.id === object.id);
      if (!saved) continue;
      object.x = clampPercent(saved.x, object.x);
      object.y = clampPercent(saved.y, object.y);
      object.author = AUTHORS.includes(saved.author) ? saved.author : object.author;
      if (saved.asset) object.asset = saved.asset;
    }
  }
  return spec;
}

function clampPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(92, Math.max(8, n));
}
