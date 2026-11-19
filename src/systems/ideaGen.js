/**
 * Constrained idea generator for Pibo lessons.
 *
 * A teacher frame is a lesson: vocab pools, a grammar frame, and optional
 * tone / level. Rolling only fills slots from those pools (subject, stance,
 * object, optional twist). It never free-rolls a character, snack, or grammar
 * point that the lesson did not list.
 *
 * The panel reads Idea objects and does not care how the sentences were
 * written. Wording comes from a stitcher:
 *
 *   stitch(lesson, slots) => { prompt, sentence } | Promise<{ prompt, sentence }>
 *
 * `templateStitch` is the default (no network, no API key). Pass a different
 * stitcher to `createIdeaGenerator({ stitch })` — including an async LLM —
 * and the UI contract stays the same. If that stitcher drifts outside the
 * rolled slots, its wording is dropped and the template is used instead.
 *
 * Idea shape:
 *   {
 *     id, lessonId, title, theme, level, tone, grammarFrame,
 *     prompt,    // 1–2 sentence student-facing hint
 *     sentence,  // short grammar-frame line, e.g. "I don't like spicy food."
 *     slots: { subject, stance, object, twist }
 *   }
 */

const SLOT_KEYS = ["subject", "stance", "object", "twist"];

const DEFAULT_PROMPT =
  "{article} who {verb} {object}. Make a tiny game where players help {who} {goal}{clause}.";

/**
 * Fill `{slot}` markers. Unknown markers become empty so a template cannot
 * smuggle in text the lesson did not provide.
 */
export function fillTemplate(template, vars) {
  return String(template || "")
    .replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? "" : String(vars[key])))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .trim();
}

function cloneSlot(option) {
  return option ? { ...option } : null;
}

function polarityOf(stance) {
  return stance?.polarity === "dislike" ? "dislike" : "like";
}

function templateVars(slots) {
  const stance = slots.stance || {};
  const subject = slots.subject || {};
  const twist = slots.twist;
  const polarity = polarityOf(stance);
  const goal = stance.goal
    || (polarity === "dislike" ? "choose safe snacks" : "share a favorite snack");
  const grammar = stance.grammar
    || (polarity === "dislike" ? "I don't like" : "I like");
  return {
    article: subject.article || subject.label || "",
    who: subject.who || subject.label || "",
    label: subject.label || "",
    verb: stance.verb || stance.label || "",
    stance: stance.label || "",
    grammar,
    goal,
    object: slots.object?.label || "",
    clause: twist?.clause || "",
    twist: twist?.label || "",
  };
}

/**
 * Deterministic wording for a rolled set of slots. Safe default when no LLM
 * is configured, and the fallback when a custom stitcher leaves the frame.
 */
export function templateStitch(lesson, slots) {
  const polarity = polarityOf(slots.stance);
  const custom = lesson?.promptTemplates?.[polarity];
  const template = Array.isArray(custom) && custom.length ? custom[0] : DEFAULT_PROMPT;
  const vars = templateVars(slots);
  const practiceBank = lesson?.practiceTemplates?.[polarity];
  const practice = practiceBank || "{grammar} {object}.";
  return {
    prompt: fillTemplate(template, vars),
    sentence: fillTemplate(practice, vars),
  };
}

function textOf(stitched) {
  return `${stitched?.prompt || ""}\n${stitched?.sentence || ""}`;
}

/** Words the template itself is allowed to use, besides the rolled slots. */
const GLUE_WORDS = new Set(
  "a an the who make tiny game where players help say i to and of with in at on for them their this that your when".split(" ")
);

function wordTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .match(/[a-z0-9']+/g) || [];
}

function allowedWords(lesson, slots) {
  const allowed = new Set(GLUE_WORDS);
  for (const value of Object.values(templateVars(slots))) {
    for (const token of wordTokens(value)) allowed.add(token);
  }
  for (const token of wordTokens(`${lesson?.grammar?.frame || ""} ${lesson?.theme || ""} ${lesson?.themeLabel || ""}`)) {
    allowed.add(token);
  }
  const polarity = polarityOf(slots.stance);
  const custom = lesson?.promptTemplates?.[polarity];
  const template = Array.isArray(custom) && custom.length ? custom[0] : DEFAULT_PROMPT;
  const practice = lesson?.practiceTemplates?.[polarity] || "{grammar} {object}.";
  for (const source of [template, practice]) {
    for (const token of wordTokens(String(source).replace(/\{(\w+)\}/g, " "))) allowed.add(token);
  }
  return allowed;
}

function usesOnlyFrameWords(lesson, slots, stitched) {
  const allowed = allowedWords(lesson, slots);
  return wordTokens(textOf(stitched)).every((token) => allowed.has(token));
}

function hasDislike(text) {
  return /don't like|doesn't like|do not like|does not like/i.test(text);
}

/**
 * True when the wording still names the rolled vocab and stance, and does
 * not drag in another snack or character from the same lesson.
 */
export function honorsLesson(lesson, slots, stitched) {
  const prompt = String(stitched?.prompt || "").trim();
  const sentence = String(stitched?.sentence || "").trim();
  if (!prompt || !sentence) return false;
  const promptParts = prompt.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (promptParts.length < 1 || promptParts.length > 2) return false;

  const object = String(slots.object?.label || "").toLowerCase();
  const verb = String(slots.stance?.verb || slots.stance?.label || "").toLowerCase();
  const grammar = String(templateVars(slots).grammar || "").toLowerCase();
  const promptL = prompt.toLowerCase();
  const sentenceL = sentence.toLowerCase();
  if (!object || !verb || !grammar) return false;
  if (!promptL.includes(object) || !promptL.includes(verb)) return false;
  if (!sentenceL.includes(object) || !sentenceL.includes(grammar)) return false;

  const blob = textOf(stitched).toLowerCase();
  if (polarityOf(slots.stance) === "like" && hasDislike(blob)) return false;
  if (polarityOf(slots.stance) === "dislike" && !hasDislike(blob)) return false;

  for (const item of lesson?.pools?.object || []) {
    const label = String(item.label || "").toLowerCase();
    if (!label || label === object) continue;
    if (blob.includes(label)) return false;
  }
  const who = String(slots.subject?.who || "").toLowerCase();
  for (const item of lesson?.pools?.subject || []) {
    const other = String(item.who || "").toLowerCase();
    if (!other || other === who) continue;
    if (blob.includes(other)) return false;
  }
  return usesOnlyFrameWords(lesson, slots, stitched);
}

function assertLesson(lesson) {
  if (!lesson || typeof lesson !== "object") {
    throw new Error("Idea generator needs a lesson constraint pack");
  }
  if (!lesson.id || !lesson.grammar?.frame) {
    throw new Error("Lesson needs an id and a grammar frame");
  }
  for (const key of ["subject", "stance", "object"]) {
    const pool = lesson.pools?.[key];
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error(`Lesson pool "${key}" is empty`);
    }
    const ids = new Set();
    for (const item of pool) {
      if (!item?.id || !item?.label) {
        throw new Error(`Lesson pool "${key}" has an item without id and label`);
      }
      if (ids.has(item.id)) throw new Error(`Duplicate ${key} id "${item.id}"`);
      ids.add(item.id);
    }
  }
  for (const stance of lesson.pools.stance) {
    if (stance.polarity !== "like" && stance.polarity !== "dislike") {
      throw new Error(`Stance "${stance.id}" needs polarity "like" or "dislike"`);
    }
  }
  if (lesson.pools.twist) {
    const ids = new Set();
    for (const item of lesson.pools.twist) {
      if (!item?.id || item.label == null || item.clause == null) {
        throw new Error("Each twist needs an id, label, and clause");
      }
      if (ids.has(item.id)) throw new Error(`Duplicate twist id "${item.id}"`);
      ids.add(item.id);
    }
  }
}

function pickSlot(pool, lockedId, rng, avoidId) {
  if (lockedId != null) {
    const locked = pool.find((item) => item.id === lockedId);
    if (locked) return cloneSlot(locked);
  }
  let bag = pool;
  if (avoidId != null && pool.length > 1) {
    const filtered = pool.filter((item) => item.id !== avoidId);
    if (filtered.length) bag = filtered;
  }
  const index = Math.min(bag.length - 1, Math.max(0, Math.floor(rng() * bag.length)));
  return cloneSlot(bag[index]);
}

function buildIdea(lesson, slots, stitched) {
  const twist = slots.twist;
  const id = [
    lesson.id,
    slots.subject.id,
    slots.stance.id,
    slots.object.id,
    twist?.id || "none",
  ].join(":");
  return Object.freeze({
    id,
    lessonId: lesson.id,
    title: lesson.title || lesson.id,
    theme: lesson.theme || "",
    level: lesson.level || null,
    tone: lesson.tone || null,
    grammarFrame: lesson.grammar.frame,
    prompt: String(stitched.prompt).trim(),
    sentence: String(stitched.sentence).trim(),
    slots: Object.freeze({
      subject: Object.freeze(slots.subject),
      stance: Object.freeze(slots.stance),
      object: Object.freeze(slots.object),
      twist: twist ? Object.freeze(twist) : null,
    }),
  });
}

/**
 * @param {object} options
 * @param {object} options.lesson  teacher constraint pack
 * @param {(lesson: object, slots: object) => ({prompt: string, sentence: string}|Promise<any>)} [options.stitch]
 * @param {() => number} [options.rng]
 */
export function createIdeaGenerator({
  lesson,
  stitch = templateStitch,
  rng = Math.random,
  locks: initialLocks = null,
} = {}) {
  assertLesson(lesson);
  /** @type {Record<string, string>} */
  let locks = initialLocks && typeof initialLocks === "object" ? { ...initialLocks } : {};
  /** @type {any} */
  let current = null;
  let ticket = 0;

  function held(key, pool) {
    if (!Object.prototype.hasOwnProperty.call(locks, key)) return undefined;
    const id = locks[key];
    if (pool?.some((item) => item.id === id)) return id;
    delete locks[key];
    return undefined;
  }

  async function roll({ clearLocks = false } = {}) {
    if (clearLocks) locks = {};
    const my = ++ticket;
    const previous = current?.slots;
    const slots = {
      subject: pickSlot(lesson.pools.subject, held("subject", lesson.pools.subject), rng, previous?.subject?.id),
      stance: pickSlot(lesson.pools.stance, held("stance", lesson.pools.stance), rng, previous?.stance?.id),
      object: pickSlot(lesson.pools.object, held("object", lesson.pools.object), rng, previous?.object?.id),
      twist: lesson.pools.twist?.length
        ? pickSlot(lesson.pools.twist, held("twist", lesson.pools.twist), rng, previous?.twist?.id)
        : null,
    };
    let stitched;
    try {
      stitched = await stitch(lesson, slots);
    } catch {
      stitched = null;
    }
    if (my !== ticket) return current;
    if (!honorsLesson(lesson, slots, stitched)) {
      stitched = templateStitch(lesson, slots);
    }
    if (!honorsLesson(lesson, slots, stitched)) {
      throw new Error("Lesson wording does not stay inside the teacher frame");
    }
    current = buildIdea(lesson, slots, stitched);
    return current;
  }

  return {
    get lesson() {
      return lesson;
    },
    get idea() {
      return current;
    },
    get locks() {
      return { ...locks };
    },
    isLocked(key) {
      return Object.prototype.hasOwnProperty.call(locks, key);
    },
    /** Roll unlocked slots again. Locked slots stay put. */
    reroll() {
      return roll({ clearLocks: false });
    },
    /** Drop every lock and roll a new idea inside the same lesson. */
    rerollAll() {
      return roll({ clearLocks: true });
    },
    /**
     * Lock or unlock one slot. Locking keeps that slot's current id on the
     * next reroll. Returns the lock map.
     */
    toggleLock(key) {
      if (!SLOT_KEYS.includes(key)) return { ...locks };
      if (key === "twist" && !lesson.pools.twist?.length) return { ...locks };
      if (Object.prototype.hasOwnProperty.call(locks, key)) {
        delete locks[key];
      } else if (current?.slots?.[key]?.id) {
        locks[key] = current.slots[key].id;
      }
      return { ...locks };
    },
    /** The idea the student accepted. Null until the first roll. */
    accept() {
      return current;
    },
  };
}

export { SLOT_KEYS };
