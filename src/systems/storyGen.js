/**
 * Short English stories for the library.
 *
 * The child picks the words, the level, and an optional theme. Wording comes
 * from a stitcher, same seam as createIdeaGenerator({ stitch }) and
 * createArcadeAssistant({ stitch }):
 *
 *   stitch(lesson, { words, level, theme }) => { text } | Promise<{ text }>
 *
 * With no stitch, a configured story URL is tried (see getStoryApiUrl).
 * If that is missing, fails, or does not use the child's words, the offline
 * template writes the story. AI text is marked author "ai". The template is
 * "template". The words themselves stay the child's.
 */
import { FOOD_LIKES_LESSON } from "../data/lessons/foodLikes.js";
import { getAiKey, getStoryApiUrl } from "../config.js";

export const STORY_THEMES = [
  { id: "library", label: "the library" },
  { id: "picnic", label: "a picnic" },
  { id: "garden", label: "the garden" },
  { id: "island", label: "the island" },
  { id: "friends", label: "with friends" },
  { id: "rain", label: "a rainy day" },
];

export function lessonWords(lesson = FOOD_LIKES_LESSON) {
  const pool = lesson?.pools?.object || [];
  const words = [];
  for (const item of pool) {
    const label = String(item?.label || "").trim();
    if (label && !words.some((word) => word.toLowerCase() === label.toLowerCase())) {
      words.push(label);
    }
  }
  return words;
}

export function normalizeWords(words) {
  const out = [];
  for (const raw of words || []) {
    const label = String(raw || "").trim().replace(/\s+/g, " ");
    if (!label || label.length > 32) continue;
    if (out.some((word) => word.toLowerCase() === label.toLowerCase())) continue;
    out.push(label);
  }
  return out.slice(0, 12);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap each target word or phrase in a <mark>, longest phrases first. */
export function highlightStory(text, words) {
  const source = escapeHtml(text);
  const sorted = normalizeWords(words).sort((a, b) => b.length - a.length);
  if (!sorted.length) return source;
  const pattern = sorted.map((word) => escapeRegExp(escapeHtml(word))).join("|");
  const re = new RegExp(`\\b(${pattern})\\b`, "gi");
  return source.replace(re, "<mark class=\"library-word\">$1</mark>");
}

function storyUsesWords(text, words) {
  const blob = String(text || "").toLowerCase();
  return words.every((word) => blob.includes(String(word).toLowerCase()));
}

function sentenceCount(text) {
  return String(text || "")
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function joinWords(list) {
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function fitSentences(lines, min, max) {
  const out = lines.filter(Boolean);
  while (out.length > max) {
    const extra = out.splice(out.length - 2, 1)[0].replace(/[.!?]$/, "");
    const last = out[out.length - 1].replace(/[.!?]$/, "");
    const tail = /^Pibo\b/.test(last) ? last : last.charAt(0).toLowerCase() + last.slice(1);
    out[out.length - 1] = `${extra}, and ${tail}.`;
  }
  while (out.length < min) out.push("Pibo likes the quiet.");
  return out.slice(0, max).join(" ");
}

/**
 * Offline story. Easy is 5 or 6 very short sentences. Medium is 7 or 8,
 * still A1–A2, with and / but / then. Every chosen word appears once.
 */
export function templateStory({ words, level = "easy", theme = "" } = {}) {
  const place = theme || "the library";
  const list = normalizeWords(words);
  const spicy = list.filter((word) => /spicy/i.test(word));
  const nice = list.filter((word) => !/spicy/i.test(word));
  const easy = level !== "medium";
  const size = list.length > 6 ? 3 : 2;
  const lines = [];
  if (easy) {
    lines.push(`Pibo is at ${place}.`);
    for (const group of chunk(nice, size)) lines.push(`Pibo likes ${joinWords(group)}.`);
    if (spicy.length) lines.push(`Pibo does not like ${joinWords(spicy)}.`);
    lines.push("Pibo reads a little book.");
    lines.push("Pibo is happy.");
    return fitSentences(lines, 5, 6);
  }
  lines.push(`Pibo sits down at ${place}.`);
  lines.push("Pibo opens a small book.");
  for (const group of chunk(nice, size)) lines.push(`The book says, I like ${joinWords(group)}.`);
  if (spicy.length) lines.push(`But Pibo does not like ${joinWords(spicy)}.`);
  lines.push("Then Pibo looks at the pictures.");
  lines.push("The words are easy to read.");
  lines.push("Pibo smiles and closes the book.");
  return fitSentences(lines, 7, 8);
}

async function fetchStory(url, { words, level, theme, lesson }) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const key = getAiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "pibo-world-library",
      words,
      level,
      theme,
      lessonId: lesson?.id || "",
      grammar: lesson?.grammar?.frame || "",
      sentences: level === "medium" ? 8 : 6,
      levelBand: "A1-A2",
    }),
  });
  if (!res.ok) throw new Error(`Story API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const text = String(data.story || data.text || (Array.isArray(data.sentences) ? data.sentences.join(" ") : "")).trim();
  if (!text) throw new Error("Story API returned no story");
  return text;
}

export async function makeStory({
  words,
  level = "easy",
  theme = "",
  lesson = FOOD_LIKES_LESSON,
  stitch = null,
} = {}) {
  const clean = normalizeWords(words);
  const safeLevel = level === "medium" ? "medium" : "easy";
  const safeTheme = String(theme || "").trim();
  let aiText = "";
  if (typeof stitch === "function") {
    try {
      const drafted = await stitch(lesson, { words: clean, level: safeLevel, theme: safeTheme });
      aiText = String(drafted?.text || drafted?.story || "").trim();
    } catch {
      aiText = "";
    }
  }
  if (!aiText && getStoryApiUrl()) {
    try {
      aiText = await fetchStory(getStoryApiUrl(), {
        words: clean,
        level: safeLevel,
        theme: safeTheme,
        lesson,
      });
    } catch {
      aiText = "";
    }
  }
  const count = sentenceCount(aiText);
  if (aiText && storyUsesWords(aiText, clean) && count >= 4 && count <= 9) {
    return {
      text: aiText,
      author: "ai",
      words: clean,
      level: safeLevel,
      theme: safeTheme,
    };
  }
  return {
    text: templateStory({ words: clean, level: safeLevel, theme: safeTheme }),
    author: "template",
    words: clean,
    level: safeLevel,
    theme: safeTheme,
  };
}
