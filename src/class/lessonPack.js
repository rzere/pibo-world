/**
 * Turn a teacher's unit (vocab, grammar, short text) into the lesson pack
 * the idea generator, library, and arcade already understand.
 * Returns null when there is not enough to constrain a prompt.
 */

const SUBJECTS = [
  { id: "boy", label: "shy boy", article: "A shy boy", who: "the boy", emoji: "👦" },
  { id: "girl", label: "curious girl", article: "A curious girl", who: "the girl", emoji: "👧" },
  { id: "dragon", label: "shy dragon", article: "A shy dragon", who: "the dragon", emoji: "🐉" },
  { id: "cat", label: "picky cat", article: "A picky cat", who: "the cat", emoji: "🐱" },
  { id: "bird", label: "hungry bird", article: "A hungry bird", who: "the bird", emoji: "🐦" },
];

const TWISTS = [
  { id: "island", label: "on the island", kind: "place", clause: " on the island", emoji: "🏝️" },
  { id: "picnic", label: "at a picnic", kind: "place", clause: " at a picnic", emoji: "🧺" },
  { id: "garden", label: "in the garden", kind: "place", clause: " in the garden", emoji: "🌿" },
  { id: "none", label: "no extra twist", kind: "none", clause: "", emoji: "✨" },
];

const LIKE = {
  id: "like",
  label: "likes",
  verb: "likes",
  grammar: "I like",
  polarity: "like",
  goal: "share a favorite",
  emoji: "💛",
};

const DISLIKE = {
  id: "dislike",
  label: "doesn't like",
  verb: "doesn't like",
  grammar: "I don't like",
  polarity: "dislike",
  goal: "choose something else",
  emoji: "🙅",
};

function slug(raw, index) {
  const s = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return s || `item-${index}`;
}

function uniqueSlug(raw, index, used) {
  let id = slug(raw, index);
  if (!used.has(id)) {
    used.add(id);
    return id;
  }
  id = `${id}-${index}`;
  used.add(id);
  return id;
}

export function grammarSides(grammar) {
  const lines = (Array.isArray(grammar) ? grammar : [grammar])
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (lines.length === 1 && lines[0].includes("/")) {
    return lines[0].split("/").map((part) => part.trim()).filter(Boolean);
  }
  return lines;
}

function stanceFromSide(side, index, used) {
  const text = side.trim();
  if (/don't like|do not like|doesn't like|does not like/i.test(text)) {
    return { ...DISLIKE, grammar: text };
  }
  if (/^i like$/i.test(text)) return { ...LIKE };
  if (/\blikes?\b/i.test(text) && text.length < 24 && !/n't| not /i.test(text)) {
    return { ...LIKE, grammar: text };
  }
  const id = uniqueSlug(text, index, used);
  return {
    id,
    label: text.toLowerCase(),
    verb: text.toLowerCase(),
    grammar: text,
    polarity: "like",
    goal: "say the line",
    emoji: "✨",
  };
}

/**
 * @param {object} lesson teacher unit: { id, title, topic, vocabulary, grammar, text }
 * @param {object} [world] { level }
 */
export function packFromLesson(lesson, world = {}) {
  const vocabulary = [...new Set(
    (lesson?.vocabulary || []).map((word) => String(word || "").trim()).filter((word) => word && word.length <= 32),
  )].slice(0, 40);
  if (!vocabulary.length) return null;
  const sides = grammarSides(lesson?.grammar);
  if (!sides.length) return null;

  const used = new Set();
  let stances = sides.slice(0, 4).map((side, index) => stanceFromSide(side, index, used));
  const seen = new Set();
  stances = stances.filter((stance) => {
    if (seen.has(stance.id)) return false;
    seen.add(stance.id);
    return true;
  });
  if (!stances.length) return null;

  const objects = [];
  const objectIds = new Set();
  vocabulary.forEach((word, index) => {
    const id = uniqueSlug(word, index, objectIds);
    objects.push({ id, label: word, emoji: "✦" });
  });

  const likeOnly = stances.every((stance) => stance.polarity === "like");
  const frame = sides.join(" / ");
  const topic = String(lesson.topic || lesson.title || "Class").trim().slice(0, 40);

  const pack = {
    id: `class-${lesson.id || "unit"}`,
    title: String(lesson.title || "Class unit").slice(0, 60),
    theme: slug(topic, 0),
    themeLabel: topic,
    level: String(world.level || "beginner").slice(0, 40),
    tone: "friendly",
    fromTeacher: true,
    classText: String(lesson.text || "").trim().slice(0, 600),
    grammarPoints: sides,
    grammar: { id: slug(frame, 0), frame },
    pools: {
      subject: SUBJECTS,
      stance: stances,
      object: objects,
      twist: TWISTS,
    },
    practiceTemplates: {
      like: "{grammar} {object}.",
      dislike: "{grammar} {object}.",
    },
  };

  if (likeOnly && stances.some((stance) => stance.id !== "like")) {
    pack.promptTemplates = {
      like: ["{article} says {verb} {object}. Help {who} practice this{clause}."],
      dislike: ["{article} says {verb} {object}. Help {who} practice this{clause}."],
    };
  }
  return pack;
}

export function practiceLines(pack) {
  if (!pack) return ["Hello!", "I am happy.", "What do you like?", "Goodbye!"];
  const words = (pack.pools?.object || []).map((item) => item.label).filter(Boolean);
  const sides = grammarSides(pack.grammar?.frame);
  const lines = ["Hello!"];
  if (words[0] && sides[0]) lines.push(`${sides[0]} ${words[0]}.`);
  const secondSide = sides[1] || sides[0];
  if (words[1] && secondSide) lines.push(`${secondSide} ${words[1]}.`);
  else if (words[0] && sides[1]) lines.push(`${sides[1]} ${words[0]}.`);
  lines.push("Goodbye!");
  return lines.slice(0, 4);
}

export function studioLines(pack) {
  if (!pack) return null;
  const words = (pack.pools?.object || []).map((item) => item.label).filter(Boolean);
  const sides = grammarSides(pack.grammar?.frame);
  if (!words.length || !sides.length) return null;
  return words.slice(0, 4).map((word, index) => ({
    label: word,
    text: `${sides[index % sides.length]} ${word}.`,
  }));
}
