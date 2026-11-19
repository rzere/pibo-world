/**
 * Constraint checks for the arcade spec, assistant, and 2D runtime.
 * No browser, no network. The runtime never executes spec text.
 * Run: node --experimental-detect-module scripts/check-arcade.mjs
 */
import assert from "node:assert/strict";
import { FOOD_LIKES_LESSON } from "../src/data/lessons/foodLikes.js";
import { AUTHORS, authorOf, buildTreasureSpec, ghostCastleTemplate, normalizeSpec, read } from "../src/systems/gameSpec.js";
import { assistantQuestions, createArcadeAssistant, templateArcadeStitch } from "../src/systems/arcadeAssistant.js";
import { createTreasurePlay } from "../src/systems/treasureRuntime.js";

const lesson = FOOD_LIKES_LESSON;

function walk(node, seen = new Set()) {
  if (!node || typeof node !== "object") {
    assert.notEqual(typeof node, "function");
    return;
  }
  if (seen.has(node)) return;
  seen.add(node);
  for (const value of Object.values(node)) walk(value, seen);
}

function authorsOnly(spec) {
  assert.ok(AUTHORS.includes(authorOf(spec.title)));
  assert.ok(AUTHORS.includes(authorOf(spec.goal)));
  assert.ok(AUTHORS.includes(authorOf(spec.scene.background)));
  assert.ok(AUTHORS.includes(authorOf(spec.hero)));
  assert.ok(AUTHORS.includes(authorOf(spec.steps)));
  for (const rule of spec.rules) assert.ok(AUTHORS.includes(authorOf(rule)));
  for (const object of spec.objects) assert.ok(AUTHORS.includes(object.author));
  for (const clue of spec.clues) assert.ok(AUTHORS.includes(clue.author));
  const obstacle = spec.obstacles[0];
  assert.equal(obstacle.kind, "key-lock");
  assert.ok(AUTHORS.includes(authorOf(obstacle.keyHidesIn)));
  assert.ok(AUTHORS.includes(authorOf(obstacle.lockId)));
  assert.ok(AUTHORS.includes(authorOf(obstacle.treasureHidesIn)));
}

const template = ghostCastleTemplate(lesson);
assert.equal(template.type, "treasure-hunt");
assert.equal(template.lessonId, "food-likes");
assert.equal(read(template.hero), "ghost");
assert.equal(read(template.scene.background), "castle");
assert.equal(read(template.obstacles[0].keyHidesIn), "door");
assert.equal(read(template.obstacles[0].lockId), "chest");
assert.equal(read(template.obstacles[0].treasureHidesIn), "bed");
assert.deepEqual(read(template.steps), ["key", "lock", "treasure"]);
assert.equal(authorOf(template.title), "template");
assert.equal(authorOf(template.obstacles[0].keyHidesIn), "template");
assert.match(template.clues[0].text, /I like apples/i);
assert.match(template.clues[1].text, /I don't like spicy food/i);
assert.match(template.clues[0].text, /behind the door/i);
assert.match(template.clues[1].text, /under the bed/i);
authorsOnly(template);
walk(template);

const questions = assistantQuestions(lesson, {});
assert.equal(questions.length, 3);
assert.equal(questions[0].id, "idea");
assert.equal(questions[1].prompt, "Where should the ghost look for the key?");
assert.deepEqual(questions[1].chips.map((chip) => chip.label), ["Behind a door", "Under a bed", "Next to a tree"]);
assert.match(questions[2].prompt, new RegExp(lesson.grammar.frame.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(questions[2].chips[0].label, /I like apples/i);
assert.match(questions[2].chips[1].label, /I don't like spicy food/i);

const assistant = createArcadeAssistant({ lesson });
const described = await assistant.finish({
  idea: "A ghost lost a treasure in a castle",
  keyPlace: "bed",
  clue: "I like apples. Look under the bed.",
  treasurePlace: "tree",
});
assert.equal(authorOf(described.title), "child");
assert.equal(authorOf(described.goal), "child");
assert.equal(authorOf(described.obstacles[0].keyHidesIn), "child");
assert.equal(read(described.obstacles[0].keyHidesIn), "bed");
assert.equal(authorOf(described.obstacles[0].treasureHidesIn), "child");
assert.equal(read(described.obstacles[0].treasureHidesIn), "tree");
assert.equal(described.clues[0].author, "child");
assert.equal(described.clues[0].text, "I like apples. Look under the bed.");
assert.equal(authorOf(described.scene.background), "template");
assert.equal(authorOf(described.hero), "template");
assert.notEqual(read(described.obstacles[0].keyHidesIn), read(described.obstacles[0].treasureHidesIn));
authorsOnly(described);
walk(described);

const garden = templateArcadeStitch(lesson, { idea: "A cat hid a snack in a garden", keyPlace: "tree" });
assert.equal(read(garden.scene.background), "garden");
assert.equal(read(garden.hero), "cat");
assert.equal(authorOf(garden.scene.background), "template");
assert.equal(read(garden.obstacles[0].keyHidesIn), "tree");

const aiAssistant = createArcadeAssistant({
  lesson,
  stitch(lessonFrame, answers) {
    const drafted = templateArcadeStitch(lessonFrame, answers);
    drafted.scene.background = { value: "garden", author: "ai" };
    drafted.hero = { value: "cat", author: "ai" };
    return drafted;
  },
});
const withArt = await aiAssistant.finish({ idea: "A ghost lost a treasure in a castle", keyPlace: "door" });
assert.equal(authorOf(withArt.scene.background), "ai");
assert.equal(read(withArt.scene.background), "garden");
assert.equal(authorOf(withArt.hero), "ai");
assert.equal(authorOf(withArt.title), "child");
assert.equal(withArt.type, "treasure-hunt");
walk(withArt);

const junk = normalizeSpec({ type: "platformer", code: "while (true) {}" }, lesson);
assert.equal(junk.type, "treasure-hunt");
assert.equal(junk.scene.background.author, "template");
assert.equal(JSON.stringify(junk).includes("while (true)"), false);

const play = createTreasurePlay(template);
const earlyTreasure = play.click("bed");
assert.notEqual(earlyTreasure.won, true);
assert.equal(play.state.won, false);
assert.equal(play.state.haveKey, false);
const locked = play.click("chest");
assert.match(locked.message, /locked/i);
assert.equal(play.state.won, false);
const key = play.click("door");
assert.equal(key.found, "key");
assert.match(key.message, /I like apples/i);
const opened = play.click("chest");
assert.equal(opened.found, "lock");
const won = play.click("bed");
assert.equal(won.won, true);
assert.match(won.message, /under the bed/i);
assert.equal(play.state.won, true);

const childOrder = buildTreasureSpec({
  steps: ["treasure", "key", "lock"],
  stepsAuthor: "child",
  treasureId: "painting",
  treasureAuthor: "child",
});
assert.equal(read(childOrder.steps)[0], "treasure");
assert.equal(authorOf(childOrder.steps), "child");
const free = createTreasurePlay(childOrder);
const instant = free.click("painting");
assert.equal(instant.won, true);

const sameSpot = buildTreasureSpec({ keyId: "door", treasureId: "door" });
assert.notEqual(read(sameSpot.obstacles[0].keyHidesIn), read(sameSpot.obstacles[0].treasureHidesIn));

console.log("arcade checks passed");
