/**
 * Mistake detection for a child's English line.
 *
 * The rules run every time, with no API key, so a class still gets a log.
 * When ANTHROPIC_API_KEY is set, Claude (the same helper the animal chat
 * uses) reads the line too. The two lists are merged. Kids are not shown
 * this log; the animal chat keeps its own gentle "You can say" note.
 */
import { askClaudeJSON, hasKey } from "./_claude.js";

const STOP = new Set("a an the to some my your very really and or but so of in on at for with is are was were am be it we they you he she i me do does did not no yes hello hi bye goodbye happy sad good please thanks thank you".split(" "));

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text, phrase) {
  const p = String(phrase || "").trim().toLowerCase();
  if (!p) return false;
  return new RegExp(`(^|[^a-z])${escapeRegExp(p)}([^a-z]|$)`, "i").test(String(text || "").toLowerCase());
}

function levenshtein(a, b) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const row = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tmp = row[j];
      row[j] = s[i - 1] === t[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[t.length];
}

function push(list, mistake) {
  const pattern = String(mistake.pattern || mistake.excerpt || "").toLowerCase();
  if (!pattern) return;
  if (list.some((item) => item.kind === mistake.kind && item.pattern.toLowerCase() === pattern)) return;
  list.push({
    kind: mistake.kind,
    pattern: mistake.pattern,
    excerpt: mistake.excerpt || mistake.pattern,
    detail: mistake.detail,
    suggestion: mistake.suggestion || "",
  });
}

export function ruleMistakes(text, { vocabulary = [], grammar = [] } = {}) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  const mistakes = [];
  if (!raw) return mistakes;
  const lower = raw.toLowerCase();

  if (/\bi\s+likes\b/i.test(raw)) {
    push(mistakes, {
      kind: "grammar",
      pattern: "I likes",
      excerpt: (raw.match(/\bi\s+likes\b/i) || ["I likes"])[0],
      detail: "After I, use like.",
      suggestion: raw.replace(/\bi\s+likes\b/i, "I like"),
    });
  }
  if (/\b(he|she|it)\s+like\b/i.test(raw) && !/\b(he|she|it)\s+likes\b/i.test(raw)) {
    const found = raw.match(/\b(he|she|it)\s+like\b/i);
    push(mistakes, {
      kind: "grammar",
      pattern: found ? found[0] : "he like",
      excerpt: found ? found[0] : "he like",
      detail: "After he, she, or it, use likes.",
      suggestion: raw.replace(/\b(he|she|it)\s+like\b/i, (m, who) => `${who} likes`),
    });
  }
  if (/\b(do|does|don't|doesn't|dont|doesnt)\s+likes\b/i.test(raw)) {
    push(mistakes, {
      kind: "grammar",
      pattern: "don't likes",
      excerpt: (raw.match(/\b(?:do|does|don't|doesn't|dont|doesnt)\s+likes\b/i) || ["don't likes"])[0],
      detail: "After don't or doesn't, use like.",
      suggestion: raw.replace(/\blikes\b/i, "like"),
    });
  }
  if (/\b(he|she|it)\s+don't\b/i.test(raw) || /\b(i|you|we|they)\s+doesn't\b/i.test(raw)) {
    const found = raw.match(/\b(he|she|it)\s+don't\b|\b(i|you|we|they)\s+doesn't\b/i);
    push(mistakes, {
      kind: "grammar",
      pattern: found ? found[0] : "she don't",
      excerpt: found ? found[0] : "she don't",
      detail: "Use doesn't with he, she, and it. Use don't with I, you, we, and they.",
      suggestion: "",
    });
  }
  if (/\bi\s+am\s+like\b/i.test(raw)) {
    push(mistakes, {
      kind: "grammar",
      pattern: "I am like",
      excerpt: "I am like",
      detail: "To talk about a favorite, say I like.",
      suggestion: raw.replace(/\bi\s+am\s+like\b/i, "I like"),
    });
  }
  if (/\btheir\s+(is|are)\b/i.test(raw)) {
    push(mistakes, {
      kind: "spelling",
      pattern: "their is",
      excerpt: (raw.match(/\btheir\s+(?:is|are)\b/i) || ["their is"])[0],
      detail: "For a place, write there.",
      suggestion: raw.replace(/\btheir\b/i, "there"),
    });
  }

  const targets = vocabulary.map((word) => String(word || "").trim()).filter(Boolean);
  const tokens = lower.match(/[a-z][a-z'-]*/g) || [];
  for (const token of tokens) {
    if (token.length < 4 || STOP.has(token)) continue;
    if (targets.some((word) => word.toLowerCase() === token)) continue;
    let best = null;
    for (const word of targets) {
      const piece = word.toLowerCase();
      if (piece.includes(" ")) continue;
      const distance = levenshtein(token, piece);
      const limit = piece.length >= 6 ? 2 : 1;
      if (distance > 0 && distance <= limit && (!best || distance < best.distance)) {
        best = { word, distance };
      }
    }
    if (best) {
      push(mistakes, {
        kind: "spelling",
        pattern: token,
        excerpt: token,
        detail: `This looks like the class word “${best.word}”.`,
        suggestion: best.word,
      });
    }
  }

  const object = lower.match(/\b(?:like|likes)\s+([a-z][a-z'-]{2,})(?:[^a-z]|$)/);
  if (object && targets.length) {
    const word = object[1];
    if (!STOP.has(word) && !targets.some((item) => item.toLowerCase() === word)) {
      const near = targets.some((item) => {
        const piece = item.toLowerCase();
        return !piece.includes(" ") && levenshtein(word, piece) <= (piece.length >= 6 ? 2 : 1);
      });
      if (!near) {
        push(mistakes, {
          kind: "word",
          pattern: word,
          excerpt: word,
          detail: `“${word}” is not one of this week's words.`,
          suggestion: targets[0] ? `Try a class word such as ${targets[0]}.` : "",
        });
      }
    }
  }

  const grammarBlob = (Array.isArray(grammar) ? grammar : [grammar]).join(" ").toLowerCase();
  if (/there is/.test(grammarBlob) && /\bthere\s+is\s+[a-z]+s\b/i.test(raw)) {
    const found = raw.match(/\bthere\s+is\s+[a-z]+s\b/i);
    push(mistakes, {
      kind: "grammar",
      pattern: found ? found[0] : "there is",
      excerpt: found ? found[0] : "there is",
      detail: "When there is more than one, try there are.",
      suggestion: "",
    });
  }

  return mistakes.slice(0, 4);
}

function cleanAiList(json) {
  const rows = Array.isArray(json?.mistakes) ? json.mistakes : [];
  const out = [];
  for (const row of rows) {
    const kind = row?.kind === "spelling" || row?.kind === "word" || row?.kind === "grammar" ? row.kind : "";
    const excerpt = String(row?.excerpt || row?.pattern || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!kind || !excerpt) continue;
    push(out, {
      kind,
      pattern: String(row?.pattern || excerpt).replace(/\s+/g, " ").trim().slice(0, 80),
      excerpt,
      detail: String(row?.detail || "").replace(/\s+/g, " ").trim().slice(0, 160),
      suggestion: String(row?.suggestion || "").replace(/\s+/g, " ").trim().slice(0, 160),
    });
  }
  return out.slice(0, 4);
}

async function claudeMistakes(text, lesson) {
  const words = (lesson.vocabulary || []).slice(0, 20).join(", ");
  const grammar = (Array.isArray(lesson.grammar) ? lesson.grammar : []).slice(0, 6).join(" / ");
  const prompt = `You check one sentence from a child aged 9-12 practicing English.
Class words: ${words || "(none)"}
Target grammar: ${grammar || "(none)"}
Sentence: "${String(text).slice(0, 400)}"

List only clear mistakes in THIS sentence: grammar, spelling, or a wrong word (a content word used instead of the class words).
If the sentence is fine, return an empty list. Do not invent mistakes. Do not comment on style.
Reply with only this JSON on one line, no markdown:
{"mistakes":[{"kind":"grammar|spelling|word","pattern":"short label","excerpt":"the bit they wrote","detail":"one simple sentence a teacher can read","suggestion":"a corrected phrase or empty"}]}`;
  const { json } = await askClaudeJSON(prompt, { maxTokens: 400, timeoutMs: 12000 });
  return cleanAiList(json);
}

export async function detectMistakes(text, lesson = {}) {
  const rules = ruleMistakes(text, lesson);
  if (!hasKey()) return { mistakes: rules, source: "rules" };
  try {
    const ai = await claudeMistakes(text, lesson);
    const merged = [];
    for (const item of ai) push(merged, item);
    for (const item of rules) push(merged, item);
    return { mistakes: merged.slice(0, 4), source: ai.length ? "claude" : "rules" };
  } catch {
    return { mistakes: rules, source: "rules" };
  }
}

export function lessonTargets(lessons = []) {
  const vocabulary = [];
  const grammar = [];
  for (const lesson of lessons) {
    for (const word of lesson.vocabulary || []) {
      const clean = String(word || "").trim();
      if (clean && !vocabulary.some((item) => item.toLowerCase() === clean.toLowerCase())) vocabulary.push(clean);
    }
    for (const line of lesson.grammar || []) {
      const clean = String(line || "").trim();
      if (!clean) continue;
      const parts = clean.includes("/") ? clean.split("/").map((part) => part.trim()) : [clean];
      for (const part of parts) {
        if (part && !grammar.some((item) => item.toLowerCase() === part.toLowerCase())) grammar.push(part);
      }
    }
  }
  return { vocabulary, grammar };
}

export function countTargets(text, { vocabulary = [], grammar = [] } = {}) {
  const words = {};
  const structures = {};
  const lower = String(text || "").toLowerCase();
  const sorted = [...vocabulary].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(lower)) words[word] = (words[word] || 0) + 1;
  }
  for (const phrase of grammar) {
    if (hasPhrase(lower, phrase)) structures[phrase] = (structures[phrase] || 0) + 1;
  }
  return { words, structures };
}
