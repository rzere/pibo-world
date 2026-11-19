import { GAME_TYPES, PLACES, buildRecipe, cleanRecipe } from "../src/arcade/spec.js";
import { askClaudeJSON, hasKey, readBody } from "./_claude.js";

/**
 * POST /api/arcade  { type, place, details, text, players: [{ name, char }] }
 * Claude fills in a game recipe for our own game types. The reply is clamped
 * by cleanRecipe, and the built-in recipe is returned if anything goes wrong.
 */
function prompt(input, base) {
  const type = GAME_TYPES.find((g) => g.id === base.type);
  const place = PLACES.find((p) => p.id === base.place);
  const players = (input.players || []).map((p) => `${p.name} (${p.char})`).join(", ") || "one player";
  return `You design tiny multiplayer party games for kids aged 6-10 in "Pibo World", a cozy pastel island.
Our engine can only play three game types: race (top-down dash to a finish flag, boosts and obstacles), battle (throw things at each other, first to N hits), collect (grab goodies, avoid hazards, first to N).

The kid picked: type=${type.label}, place=${place.label}, details=${JSON.stringify(input.details || {})}.
Players in the room: ${players}.
The kid also wrote: "${String(input.text || "").slice(0, 300)}"

Start from this recipe and make it match the kid's wish (rename it, pick fitting emoji and colors, tune numbers). Keep the type "${base.type}" unless the kid clearly asked for another of the three types.
${JSON.stringify(base)}

Rules: friendly and non-violent wording (bonk, splash, tag), no real brands. title <= 32 chars, intro <= 140 chars and says how to play (arrows/joystick to move${base.type === "battle" ? ", Space or the button to throw" : ""}), winText is a short phrase that follows a player's name. item, hazard and each decor are single emoji. sky is two hex colors, ground and accent are hex. goal: race 1, battle 2-8, collect 5-25. speed 0.7-1.5, hazards 0-14, seconds 30-120.
Reply with only the JSON object on one line, no markdown and no other text.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const input = readBody(req);
  const base = buildRecipe(input);
  if (!hasKey()) {
    res.status(200).json({ recipe: base, source: "builtin", reason: "no key" });
    return;
  }
  try {
    const { json, model } = await askClaudeJSON(prompt(input, base));
    res.status(200).json({ recipe: cleanRecipe({ ...base, ...json, ai: true }), source: "claude", model });
  } catch (err) {
    res.status(200).json({ recipe: base, source: "builtin", reason: String(err.message || err).slice(0, 200) });
  }
}
