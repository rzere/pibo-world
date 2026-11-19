/**
 * Pibo Market's shopkeeper brain. Pure functions, no DOM, so the checks in
 * scripts/check-market.mjs can run in Node.
 *
 * The shopkeeper is a tutor, not a judge: a small grammar slip ("two banana")
 * is accepted and the right form is modelled back ("Two bananas! Here you
 * go."). Only a request for the wrong thing or the wrong amount is a retry,
 * because then the shopping really would go wrong.
 */

const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export const ASK = "Can I have";
export const PLEASE = "please?";
export const RUDE_ASK = "Give me";

export function numberWord(n) {
  return NUMBERS[n] ?? String(n);
}

export function cap(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** The amount word for a list entry: "a", "an", "two", or "some". */
export function amountWord(item, qty = 1) {
  if (!item.countable) return "some";
  return qty === 1 ? item.article : numberWord(qty);
}

export function nounFor(item, qty = 1) {
  return item.countable && qty > 1 ? item.plural : item.word;
}

/** "an apple", "two bananas", "some milk". */
export function phrase(item, qty = 1) {
  return `${amountWord(item, qty)} ${nounFor(item, qty)}`;
}

export function fullRequest(item, qty = 1) {
  return `${ASK} ${phrase(item, qty)}, please?`;
}

export function coinWord(n) {
  return `${numberWord(n)} ${n === 1 ? "coin" : "coins"}`;
}

function pickDistinct(pool, n, rng) {
  const bag = pool.slice();
  const out = [];
  while (out.length < n && bag.length) out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  return out;
}

/** Level 1: n different items, one of each. */
export function makeFindList(items, n, rng = Math.random) {
  return pickDistinct(items, n, rng).map((item) => ({ id: item.id, qty: 1 }));
}

/** Level 2: n different items; countable ones get a quantity. */
export function makeAskList(items, n, maxQty = 3, rng = Math.random) {
  return pickDistinct(items, n, rng).map((item) => ({
    id: item.id,
    qty: item.countable ? 1 + Math.floor(rng() * maxQty) : 1,
  }));
}

/**
 * The wrong-pick hint for Level 1. `picked` is what the child tapped,
 * `needed` the first thing still missing from the list.
 */
export function findHint(picked, needed, alreadyHave = false) {
  if (alreadyHave) return `You have ${phrase(picked)} already! Now we need ${phrase(needed)}.`;
  return `That's ${phrase(picked)}. We need ${phrase(needed)}!`;
}

/**
 * Word tiles for one Level 2 request: the right ones plus a few friendly
 * distractors (the other noun form, another amount, another item, "Give me").
 */
export function askTiles(item, qty, items, rng = Math.random) {
  const right = [ASK, amountWord(item, qty), nounFor(item, qty), PLEASE];
  const extra = new Set();
  if (item.countable) {
    extra.add(qty > 1 ? item.word : item.plural);
    const otherQty = qty === 1 ? 2 + Math.floor(rng() * 2) : qty === 2 ? 3 : 2;
    extra.add(numberWord(otherQty));
  } else {
    extra.add("two");
  }
  const others = items.filter((x) => x.id !== item.id);
  if (others.length) extra.add(others[Math.floor(rng() * others.length)].word);
  extra.add(RUDE_ASK);
  for (const t of right) extra.delete(t);
  const tiles = [...right, ...extra];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/**
 * Judge a built request. Returns
 *   { accepted, say, slips }
 * accepted: the shopkeeper hands the item over.
 * say: what the shopkeeper says (a modelled sentence, never a telling-off).
 * slips: small mistakes that were modelled, for the star count.
 */
export function judgeRequest(tiles, item, qty, items) {
  const words = tiles.map((t) => t.trim()).filter(Boolean);
  const want = phrase(item, qty);
  if (!words.length) return { accepted: false, say: "Tap the words to ask me.", slips: 0 };

  const nounForms = new Set([item.word, item.plural]);
  const otherItem = items.find((x) => x.id !== item.id && words.some((w) => w === x.word || w === x.plural));
  const nounAt = words.findIndex((w) => nounForms.has(w));
  if (otherItem || nounAt < 0) {
    return { accepted: false, say: `Hmm, Mum needs ${want}. Can you ask for ${want}?`, slips: 1 };
  }

  const amountAt = words.findIndex((w) => isAmount(w));
  const said = amountAt >= 0 ? words[amountAt] : null;
  const saidQty = said == null ? null : amountValue(said);
  if (item.countable && saidQty != null && saidQty !== qty) {
    return { accepted: false, say: `How many? Mum needs ${want}. Try again!`, slips: 1 };
  }
  if (!item.countable && said && said !== "some") {
    return { accepted: false, say: `We just need ${want}. Try again!`, slips: 1 };
  }

  const issues = [];
  if (item.countable && said == null && qty > 1) {
    return { accepted: false, say: `How many? Mum needs ${want}. Try again!`, slips: 1 };
  }
  if (item.countable && said == null) issues.push("amount");
  if (item.countable && qty === 1 && (said === "a" || said === "an") && said !== item.article) issues.push("article");
  if (words[nounAt] !== nounFor(item, qty)) issues.push("noun");
  const askAt = words.indexOf(ASK);
  if (words.includes(RUDE_ASK)) issues.push("rude");
  else if (askAt < 0) issues.push("ask");
  if (!words.includes(PLEASE)) issues.push("please");
  const pleaseAt = words.indexOf(PLEASE);
  const order = [askAt, amountAt, nounAt, pleaseAt].filter((i) => i >= 0);
  if (order.some((v, i) => i > 0 && v < order[i - 1])) issues.push("order");

  if (!issues.length) return { accepted: true, say: `${cap(want)}? Here you go!`, slips: 0 };
  if (issues.length === 1 && (issues[0] === "noun" || issues[0] === "article" || issues[0] === "amount")) {
    return { accepted: true, say: `${cap(want)}! Here you go.`, slips: 1 };
  }
  if (issues.length === 1 && issues[0] === "rude") {
    return { accepted: true, say: `"${fullRequest(item, qty)}" Lovely! Here you go.`, slips: 1 };
  }
  if (issues.length === 1 && issues[0] === "please") {
    return { accepted: true, say: `${fullRequest(item, qty)} Of course! Here you go.`, slips: 1 };
  }
  return { accepted: true, say: `${fullRequest(item, qty)} Here you go!`, slips: issues.length };
}

function isAmount(w) {
  return w === "a" || w === "an" || w === "some" || NUMBERS.includes(w);
}

function amountValue(w) {
  if (w === "a" || w === "an") return 1;
  if (w === "some") return null;
  const n = NUMBERS.indexOf(w);
  return n >= 0 ? n : null;
}

export function priceOf(list, byId, prices = null) {
  return list.reduce((sum, entry) => sum + (prices?.[entry.id] ?? byId[entry.id].price) * entry.qty, 0);
}

/** Paying at the counter. coins: the values the child put on the dish. */
export function judgePayment(coins, price) {
  const sum = coins.reduce((a, b) => a + b, 0);
  if (!coins.length) return { ok: false, sum, say: `It's ${coinWord(price)}. Put the coins on the dish.` };
  const count = coins.length > 1 ? `Let's count: ${coins.join(" + ")} = ${sum}. ` : "";
  if (sum === price) return { ok: true, sum, say: `${count}${cap(coinWord(price))}. Thank you!` };
  if (sum < price) return { ok: false, sum, say: `${count}It's ${coinWord(price)}. We need ${numberWord(price - sum)} more.` };
  return { ok: false, sum, say: `${count}That's too many! It's only ${coinWord(price)}.` };
}

/** Three stars for a clean run, fewer as slips add up. Never zero. */
export function starsFor(slips) {
  if (slips <= 0) return 3;
  if (slips <= 2) return 2;
  return 1;
}

/**
 * A child's stall, from this browser or from a friend. Everything is
 * re-checked so a bad payload cannot break the shop.
 * clean: text filter for the sign (the chat filter).
 */
export function cleanStall(raw, byId, { maxItems = 4, maxPrice = 5, clean = (t) => t } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const items = [];
  for (const entry of Array.isArray(raw.items) ? raw.items : []) {
    if (!byId[entry?.id] || items.some((x) => x.id === entry.id)) continue;
    const price = Math.round(Number(entry.price));
    items.push({ id: entry.id, price: Math.min(maxPrice, Math.max(1, Number.isFinite(price) ? price : 1)) });
    if (items.length >= maxItems) break;
  }
  if (!items.length) return null;
  const list = [];
  for (const entry of Array.isArray(raw.list) ? raw.list : []) {
    if (!items.some((x) => x.id === entry?.id) || list.some((x) => x.id === entry.id)) continue;
    const item = byId[entry.id];
    const qty = item.countable ? Math.min(3, Math.max(1, Math.round(Number(entry.qty)) || 1)) : 1;
    list.push({ id: entry.id, qty });
  }
  if (!list.length) return null;
  return {
    items,
    list,
    sign: clean(String(raw.sign || "").slice(0, 28)),
    by: String(raw.by || "").slice(0, 16),
  };
}
