/**
 * Constraint checks for the idea generator. No browser, no network.
 * Run: node --experimental-detect-module scripts/check-idea-gen.mjs
 */
import assert from "node:assert/strict";
import { FOOD_LIKES_LESSON } from "../src/data/lessons/foodLikes.js";
import { createIdeaGenerator, honorsLesson, templateStitch } from "../src/systems/ideaGen.js";

const lesson = FOOD_LIKES_LESSON;
const vocab = new Set(lesson.pools.object.map((item) => item.id));
const subjects = new Set(lesson.pools.subject.map((item) => item.id));
const stances = new Set(lesson.pools.stance.map((item) => item.id));
const twists = new Set(lesson.pools.twist.map((item) => item.id));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gen = createIdeaGenerator({ lesson, rng: mulberry32(7) });
const seen = new Set();
for (let i = 0; i < 240; i++) {
  const idea = await gen.rerollAll();
  assert.equal(idea.lessonId, "food-likes");
  assert.equal(idea.grammarFrame, "I like / I don't like");
  assert.equal(idea.theme, "food");
  assert.ok(vocab.has(idea.slots.object.id), idea.slots.object.id);
  assert.ok(subjects.has(idea.slots.subject.id));
  assert.ok(stances.has(idea.slots.stance.id));
  assert.ok(twists.has(idea.slots.twist.id));
  assert.ok(honorsLesson(lesson, idea.slots, idea));
  assert.ok(idea.prompt.split(/[.!?]+/).filter((part) => part.trim()).length <= 2);
  assert.ok(idea.sentence.startsWith(idea.slots.stance.grammar), idea.sentence);
  assert.ok(idea.sentence.includes(idea.slots.object.label));
  assert.ok(!/mars|pirate|pizza/i.test(idea.prompt + idea.sentence));
  seen.add(idea.id);
}
assert.ok(seen.size > 40, `expected a spread of ideas, got ${seen.size}`);

const locked = createIdeaGenerator({ lesson, rng: mulberry32(3) });
await locked.rerollAll();
locked.toggleLock("subject");
locked.toggleLock("object");
const subjectId = locked.idea.slots.subject.id;
const objectId = locked.idea.slots.object.id;
const stanceBefore = new Set();
for (let i = 0; i < 30; i++) {
  const idea = await locked.reroll();
  assert.equal(idea.slots.subject.id, subjectId);
  assert.equal(idea.slots.object.id, objectId);
  stanceBefore.add(idea.slots.stance.id);
  assert.ok(honorsLesson(lesson, idea.slots, idea));
}
assert.ok(stanceBefore.size >= 1);
await locked.rerollAll();
assert.deepEqual(locked.locks, {});

const slots = {
  subject: lesson.pools.subject.find((item) => item.id === "dragon"),
  stance: lesson.pools.stance.find((item) => item.id === "dislike"),
  object: lesson.pools.object.find((item) => item.id === "spicy-food"),
  twist: lesson.pools.twist.find((item) => item.id === "none"),
};
const stitched = templateStitch(lesson, slots);
assert.equal(
  stitched.prompt,
  "A shy dragon who doesn't like spicy food. Make a tiny game where players help the dragon choose safe snacks."
);
assert.equal(stitched.sentence, "I don't like spicy food.");
assert.ok(honorsLesson(lesson, slots, stitched));

const pinned = createIdeaGenerator({
  lesson,
  rng: mulberry32(5),
  locks: {
    subject: "dragon",
    stance: "dislike",
    object: "spicy-food",
    twist: "none",
  },
});
const example = await pinned.reroll();
assert.equal(example.prompt, stitched.prompt);
assert.equal(example.sentence, stitched.sentence);
assert.equal(example.slots.subject.id, "dragon");
const again = await pinned.reroll();
assert.equal(again.prompt, example.prompt);

const picnic = templateStitch(lesson, {
  ...slots,
  twist: lesson.pools.twist.find((item) => item.id === "picnic"),
});
assert.equal(
  picnic.prompt,
  "A shy dragon who doesn't like spicy food. Make a tiny game where players help the dragon choose safe snacks at a picnic."
);

const likeLine = templateStitch(lesson, {
  subject: lesson.pools.subject.find((item) => item.id === "girl"),
  stance: lesson.pools.stance.find((item) => item.id === "like"),
  object: lesson.pools.object.find((item) => item.id === "strawberries"),
  twist: lesson.pools.twist.find((item) => item.id === "friend"),
});
assert.equal(likeLine.sentence, "I like strawberries.");
assert.match(likeLine.prompt, /likes strawberries/);
assert.doesNotMatch(likeLine.prompt, /don't like|doesn't like/i);

const sneaky = createIdeaGenerator({
  lesson,
  rng: mulberry32(4),
  stitch(_lesson, slots) {
    return {
      prompt: `${slots.subject.article} who ${slots.stance.verb} ${slots.object.label}. Make a tiny game where players help ${slots.subject.who} ${slots.stance.goal} on Mars.`,
      sentence: `${slots.stance.grammar} ${slots.object.label}.`,
    };
  },
});
const keptInFrame = await sneaky.rerollAll();
assert.doesNotMatch(keptInFrame.prompt, /mars/i);
assert.ok(honorsLesson(lesson, keptInFrame.slots, keptInFrame));

const drifted = createIdeaGenerator({
  lesson,
  rng: mulberry32(11),
  stitch() {
    return {
      prompt: "A pirate spaceship explores Mars. Collect crystals.",
      sentence: "I like outer space.",
    };
  },
});
const safe = await drifted.rerollAll();
assert.ok(honorsLesson(lesson, safe.slots, safe));
assert.doesNotMatch(safe.prompt, /mars|pirate|crystal/i);
assert.ok(safe.prompt.includes(safe.slots.object.label));

const bogus = createIdeaGenerator({
  lesson,
  rng: () => 0.2,
  locks: { object: "pizza", subject: "dragon" },
});
const recovered = await bogus.reroll();
assert.ok(vocab.has(recovered.slots.object.id));
assert.notEqual(recovered.slots.object.id, "pizza");
assert.equal(recovered.slots.subject.id, "dragon");
assert.equal(bogus.locks.object, undefined);
assert.equal(bogus.locks.subject, "dragon");

console.log(`idea generator ok (${seen.size} distinct rolls in the food lesson)`);
