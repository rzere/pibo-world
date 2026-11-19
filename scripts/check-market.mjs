// Checks the Pibo Market shopkeeper rules. Run: node scripts/check-market.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  askTiles,
  cleanStall,
  findHint,
  judgePayment,
  judgeRequest,
  makeAskList,
  makeFindList,
  phrase,
  priceOf,
  starsFor,
} from "../src/market/tutor.js";

const data = JSON.parse(readFileSync(new URL("../src/data/market.json", import.meta.url)));
const items = data.items;
const byId = Object.fromEntries(items.map((i) => [i.id, i]));
const ask = (text, id, qty) => judgeRequest(text.split("|"), byId[id], qty, items);

assert.equal(items.length, 12);
for (const item of items) {
  for (const key of ["id", "word", "image", "category", "price"]) assert.ok(key in item, `${item.id} has ${key}`);
  assert.ok(data.categories.some((c) => c.id === item.category), `${item.id} category`);
  assert.ok(Object.values(data.shelves).flat().includes(item.id), `${item.id} is on a shelf`);
}

assert.equal(phrase(byId.apple), "an apple");
assert.equal(phrase(byId.banana, 2), "two bananas");
assert.equal(phrase(byId.milk), "some milk");
assert.equal(findHint(byId.pear, byId.apple), "That's a pear. We need an apple!");

const find = makeFindList(items, 3);
assert.equal(new Set(find.map((e) => e.id)).size, 3);
for (const e of makeAskList(items, 12, 3)) {
  assert.ok(e.qty >= 1 && e.qty <= 3);
  if (!byId[e.id].countable) assert.equal(e.qty, 1);
}

for (let n = 0; n < 50; n++) {
  const tiles = askTiles(byId.banana, 2, items);
  for (const t of ["Can I have", "two", "bananas", "please?"]) assert.ok(tiles.includes(t));
  assert.equal(new Set(tiles).size, tiles.length);
}

let v = ask("Can I have|two|bananas|please?", "banana", 2);
assert.deepEqual([v.accepted, v.slips], [true, 0]);
v = ask("Can I have|two|banana|please?", "banana", 2);
assert.equal(v.accepted, true);
assert.equal(v.say, "Two bananas! Here you go.");
v = ask("Can I have|a|apple|please?", "apple", 1);
assert.equal(v.say, "An apple! Here you go.");
v = ask("Give me|two|bananas|please?", "banana", 2);
assert.equal(v.accepted, true);
assert.match(v.say, /Can I have two bananas, please\?/);
v = ask("Can I have|two|bananas", "banana", 2);
assert.equal(v.accepted, true);
assert.equal(v.slips, 1);
v = ask("Can I have|three|bananas|please?", "banana", 2);
assert.equal(v.accepted, false);
v = ask("Can I have|bananas|please?", "banana", 2);
assert.equal(v.accepted, false);
v = ask("Can I have|two|pears|please?", "banana", 2);
assert.equal(v.accepted, false);
v = ask("Can I have|some|milk|please?", "milk", 1);
assert.deepEqual([v.accepted, v.slips], [true, 0]);
v = ask("bananas|two|please?|Can I have", "banana", 2);
assert.equal(v.accepted, true);
assert.ok(v.slips >= 1);
assert.equal(ask("", "apple", 1).accepted, false);

assert.equal(priceOf([{ id: "banana", qty: 2 }, { id: "milk", qty: 1 }], byId), 4);
assert.equal(priceOf([{ id: "banana", qty: 2 }], byId, { banana: 3 }), 6);
assert.equal(judgePayment([2, 2], 4).ok, true);
v = judgePayment([2, 2], 6);
assert.equal(v.ok, false);
assert.equal(v.say, "Let's count: 2 + 2 = 4. It's six coins. We need two more.");
assert.equal(judgePayment([5], 4).ok, false);
assert.equal(judgePayment([], 4).ok, false);

assert.deepEqual([starsFor(0), starsFor(2), starsFor(5)], [3, 2, 1]);

const stall = cleanStall({
  items: [{ id: "apple", price: 99 }, { id: "nope", price: 1 }, { id: "milk", price: 0 }, { id: "apple", price: 2 }],
  list: [{ id: "apple", qty: 9 }, { id: "milk", qty: 3 }, { id: "bread", qty: 1 }],
  sign: "x".repeat(60),
  by: "Mia",
}, byId, { maxItems: 4, maxPrice: 5 });
assert.deepEqual(stall.items, [{ id: "apple", price: 5 }, { id: "milk", price: 1 }]);
assert.deepEqual(stall.list, [{ id: "apple", qty: 3 }, { id: "milk", qty: 1 }]);
assert.equal(stall.sign.length, 28);
assert.equal(cleanStall({ items: [{ id: "apple", price: 1 }], list: [] }, byId), null);
assert.equal(cleanStall("junk", byId), null);

console.log("market checks passed");
