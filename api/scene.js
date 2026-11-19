import { SCENE_PROMPT_RULES, cleanScene } from "../src/studio/scene.js";
import { askClaudeJSON, hasKey, readBody } from "./_claude.js";

/**
 * POST /api/scene  { prompt }
 * Claude directs a short cartoon for the lighthouse TV as data. The browser
 * animates it. Returns { scene } or { scene: null, reason } so the studio can
 * fall back to its built-in clip.
 */
function prompt(text) {
  return `You direct tiny cartoons for kids aged 6-10 on the TV in "Pibo World", a cozy pastel island.
A kid typed this sentence. Turn it into a fun, clear little cartoon that shows exactly what the sentence says, so a kid learning English can see the meaning.
Sentence: "${text}"

${SCENE_PROMPT_RULES}

Use our characters when the sentence mentions a cat, dog, bunny/rabbit, panda, frog, penguin, unicorn or fox, and pibo (a little yellow flower-pot buddy) as the friendly host if there is no clear main character. Use emoji for everything else (🧒 for a child, 👩‍🍳, 🐘, 🚗, 🍕, ⚽ …). Make the action match the verbs (eat → walk to the food then wiggle and say "Yum!"; play football → ⚽ and players walk/jump; it rains → weather rain). Keep it gentle and kind.

Reply with only one JSON object on one line, no markdown:
{"caption": the sentence as a short TV caption, "backdrop": ..., "weather": ..., "props": [up to 4 extra emoji for the scenery], "actors": [{"id","who","x","y","size","hidden"}], "beats": [{"t","actor","do","to","y","text"}]}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const text = String(readBody(req).prompt || "").trim().slice(0, 240);
  if (!text) {
    res.status(400).json({ scene: null, reason: "empty prompt" });
    return;
  }
  if (!hasKey()) {
    res.status(200).json({ scene: null, reason: "no key" });
    return;
  }
  try {
    const { json, model } = await askClaudeJSON(prompt(text), { maxTokens: 2000, timeoutMs: 25000 });
    res.status(200).json({ scene: cleanScene({ ...json, ai: true }), model });
  } catch (err) {
    res.status(200).json({ scene: null, reason: String(err.message || err).slice(0, 200) });
  }
}
