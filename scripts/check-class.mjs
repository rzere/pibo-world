/**
 * Teacher accounts, class material, and mistake rules.
 * Run: node scripts/check-class.mjs
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { packFromLesson } from "../src/class/lessonPack.js";
import { createIdeaGenerator, honorsLesson } from "../src/systems/ideaGen.js";
import { makeStory } from "../src/systems/storyGen.js";
import { ruleMistakes } from "../api/_mistakes.js";

const dir = await mkdtemp(path.join(tmpdir(), "pibo-class-"));
process.env.PIBO_STORE_PATH = path.join(dir, "store.json");

const { demoSeed } = await import("../api/_seed.js");
const { verifyPassword } = await import("../api/_auth.js");
const seed = demoSeed();
await writeFile(process.env.PIBO_STORE_PATH, JSON.stringify(seed));
const auth = (await import("../api/auth.js")).default;
const klass = (await import("../api/class.js")).default;

function res() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; },
  };
}

function cookie(response) {
  const raw = response.headers["set-cookie"] || "";
  const match = raw.match(/pibo_session=[^;]+/);
  return match ? match[0] : "";
}

async function call(handler, method, body, cookieHeader = "", url = "/api/class") {
  const response = res();
  await handler({
    method,
    body,
    url,
    headers: { cookie: cookieHeader },
    query: Object.fromEntries(new URL(url, "http://localhost").searchParams),
  }, response);
  return response;
}

const food = {
  id: "unit-food",
  title: "Food I like",
  topic: "Food",
  vocabulary: ["apples", "bananas", "soup"],
  grammar: ["I like", "I don't like"],
  text: "At a picnic, tell a friend what you like.",
};
const garden = {
  id: "unit-garden",
  title: "In the garden",
  topic: "Garden",
  vocabulary: ["flowers", "trees", "birds"],
  grammar: ["There is", "There are"],
  text: "Say what you see.",
};

for (const lesson of [food, garden]) {
  const pack = packFromLesson(lesson, { level: "A1" });
  assert.ok(pack, lesson.id);
  const gen = createIdeaGenerator({ lesson: pack, rng: () => 0.2 });
  for (let i = 0; i < 12; i++) {
    const idea = await gen.rerollAll();
    assert.equal(honorsLesson(pack, idea.slots, idea), true, `${lesson.id} ${idea.sentence}`);
    assert.ok(idea.sentence.toLowerCase().includes(idea.slots.object.label.toLowerCase()));
  }
  const story = await makeStory({
    words: lesson.vocabulary.slice(0, 4),
    level: "easy",
    theme: "a picnic",
    lesson: pack,
  });
  for (const word of lesson.vocabulary.slice(0, 4)) {
    assert.ok(story.text.toLowerCase().includes(word.toLowerCase()), story.text);
  }
}

const rules = ruleMistakes("I likes apples.", { vocabulary: food.vocabulary, grammar: food.grammar });
assert.ok(rules.some((item) => item.kind === "grammar" && /i likes/i.test(item.pattern)));
const spelled = ruleMistakes("I like appel.", { vocabulary: food.vocabulary, grammar: food.grammar });
assert.ok(spelled.some((item) => item.kind === "spelling"));
const wrong = ruleMistakes("I like soda.", { vocabulary: food.vocabulary, grammar: food.grammar });
assert.ok(wrong.some((item) => item.kind === "word" && item.pattern === "soda"));
const fine = ruleMistakes("I like apples.", { vocabulary: food.vocabulary, grammar: food.grammar });
assert.equal(fine.length, 0);

const teacherAccount = seed.teachers[0];
assert.equal(verifyPassword("demo-class", teacherAccount.passSalt, teacherAccount.passHash), true);
assert.equal(seed.students.length, 4);
assert.ok(seed.students.every((student) => student.demo));
assert.ok((seed.students.find((student) => student.id === "s_lina").mistakes || []).length >= 2);

const bad = await call(auth, "POST", { action: "teacher-signin", username: "demo", password: "nope" }, "", "/api/auth");
assert.equal(bad.statusCode, 401);

const signed = await call(auth, "POST", { action: "teacher-signin", username: "demo", password: "demo-class" }, "", "/api/auth");
assert.equal(signed.statusCode, 200);
assert.equal(signed.body.role, "teacher");
const teacherCookie = cookie(signed);
assert.ok(teacherCookie);

const preview = await call(klass, "GET", null, "", "/api/class?code=mint-garden");
assert.equal(preview.statusCode, 200);
assert.equal(preview.body.name, "Mint Garden");

const list = await call(klass, "POST", { action: "list" }, teacherCookie);
assert.equal(list.statusCode, 200);
assert.ok(list.body.worlds.some((world) => world.code === "mint-garden" && world.demo));

const created = await call(klass, "POST", {
  action: "createWorld",
  name: "Friday Readers",
  description: "Short stories",
  level: "A2",
}, teacherCookie);
assert.equal(created.statusCode, 200);
assert.ok(created.body.world.code);

const saved = await call(klass, "POST", {
  action: "saveLesson",
  worldId: created.body.world.id,
  title: "Pets",
  topic: "Animals",
  vocabulary: "cats\ndogs",
  grammar: "I like\nI don't like",
  text: "Tell a friend about a pet.",
  active: true,
}, teacherCookie);
assert.equal(saved.statusCode, 200);
assert.equal(saved.body.lessons[0].vocabulary[0], "cats");
assert.equal(saved.body.lessons[0].active, true);

const joined = await call(auth, "POST", {
  action: "student-signup",
  code: created.body.world.code,
  username: "nova",
  password: "island-1",
  nickname: "Nova",
}, "", "/api/auth");
assert.equal(joined.statusCode, 200, joined.body?.error);
assert.equal(joined.body.world.code, created.body.world.code);
assert.equal(joined.body.pack.grammar.frame.includes("I like"), true);
const studentCookie = cookie(joined);

const logged = await call(klass, "POST", {
  action: "logEnglish",
  text: "I likes cats.",
  source: "practice",
}, studentCookie);
assert.equal(logged.statusCode, 200);
assert.equal(logged.body.mistakes >= 1, true);

const detail = await call(klass, "POST", { action: "detail", worldId: created.body.world.id }, teacherCookie);
const nova = detail.body.students.find((student) => student.username === "nova");
assert.ok(nova);
assert.ok(nova.mistakes.some((item) => item.kind === "grammar"));
assert.ok((nova.wordCounts.cats || 0) >= 1);
assert.equal(nova.passHash, undefined);

const blocked = await call(klass, "POST", { action: "list" }, studentCookie);
assert.equal(blocked.statusCode, 403);

const made = await call(klass, "POST", {
  action: "createStudent",
  worldId: created.body.world.id,
  username: "pio",
  password: "island-1",
  nickname: "Pio",
}, teacherCookie);
assert.equal(made.statusCode, 200);
assert.ok(made.body.students.some((student) => student.username === "pio"));

console.log("class checks ok");
