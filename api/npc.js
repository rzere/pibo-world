import { NPCS } from "../src/data/critters.js";
import { askClaudeJSON, hasKey, readBody } from "./_claude.js";

/**
 * POST /api/npc  { id, history: [{ who: "you"|"npc", text }] }
 * A short English-practice reply from one island animal. The note is a
 * gentle model of the learner's sentence when there was a small slip.
 */
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const turn of raw.slice(-8)) {
    const who = turn?.who === "you" ? "you" : turn?.who === "npc" ? "npc" : null;
    const text = String(turn?.text || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!who || !text) continue;
    out.push({ who, text });
  }
  return out;
}

function saidGoodbye(history) {
  const last = [...history].reverse().find((turn) => turn.who === "you");
  return !!last && /\b(bye|goodbye|good-bye|see you|good night)\b/i.test(last.text);
}

function backup(friend, history) {
  if (saidGoodbye(history)) return `Bye! Come talk to ${friend.name} again.`;
  const n = history.filter((turn) => turn.who === "you").length;
  return friend.lines[n % friend.lines.length];
}

function promptFor(friend, history) {
  const lines = history
    .map((turn) => `${turn.who === "you" ? "Learner" : friend.name}: ${turn.text}`)
    .join("\n");
  return `You are ${friend.name}, ${friend.voice}
You live on a cozy island in Pibo World. A child is practicing beginner English with you.

Rules:
- Use simple English a beginner can read. One or two short sentences. Under 28 words.
- Ask one easy question so they can answer, unless they said goodbye. If they said goodbye, say a short goodbye and do not ask a question.
- Stay kind. Never scold, never mention grades or mistakes.
- If their last line has a small English slip, put a gentle model in "note", exactly like "You can say: I am happy." If their English is fine, or they only said hello, "note" is "".
- Do not repeat the note inside "say". "say" continues the chat in character.
- Kid-safe topics only: greetings, feelings, food, colors, animals, weather, counting, and this island. If they ask for something else, kindly steer back to those.
- No brands, no scare, no romance.
Reply with only this JSON on one line, no markdown: {"say":"...","note":"..."}

Conversation:
${lines}`;
}

function cleanReply(json, friend, history) {
  const say = String(json?.say || "").replace(/\s+/g, " ").trim().slice(0, 240);
  let note = String(json?.note || "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!note || note === say) note = "";
  if (note && !/^you can say:/i.test(note)) note = `You can say: ${note.replace(/^["']|["']$/g, "")}`;
  return { say: say || backup(friend, history), note };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const input = readBody(req);
  const friend = NPCS[String(input.id || "")];
  if (!friend) {
    res.status(400).json({ error: "unknown friend" });
    return;
  }
  const history = cleanHistory(input.history);
  const fallback = { say: backup(friend, history), note: "", source: "builtin" };
  if (!history.length || !hasKey()) {
    res.status(200).json(fallback);
    return;
  }
  try {
    const { json, model } = await askClaudeJSON(promptFor(friend, history), { maxTokens: 280, timeoutMs: 12000 });
    res.status(200).json({ ...cleanReply(json, friend, history), source: "claude", model });
  } catch (err) {
    res.status(200).json({ ...fallback, reason: String(err.message || err).slice(0, 180) });
  }
}
