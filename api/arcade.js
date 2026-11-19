import { GAME_TYPES, PLACES, buildRecipe, cleanRecipe } from "../src/arcade/spec.js";

/**
 * POST /api/arcade  { type, place, details, text, players: [{ name, char }] }
 * Claude fills in a game recipe for our own game types. The reply is clamped
 * by cleanRecipe, and the built-in recipe is returned if anything goes wrong.
 */
const API = "https://api.anthropic.com/v1";
let modelPromise = null;

function pickModel(key) {
  if (process.env.ANTHROPIC_MODEL) return Promise.resolve(process.env.ANTHROPIC_MODEL);
  modelPromise ||= fetch(`${API}/models?limit=50`, {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  })
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then(({ data = [] }) => {
      const ids = data.map((m) => m.id);
      return ids.find((id) => id.includes("haiku")) || ids.find((id) => id.includes("sonnet")) || ids[0] || "claude-3-5-haiku-latest";
    })
    .catch(() => "claude-3-5-haiku-latest");
  return modelPromise;
}

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
Reply with only the JSON object, no other text.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const input = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const base = buildRecipe(input);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(200).json({ recipe: base, source: "builtin", reason: "no key" });
    return;
  }
  try {
    const model = await pickModel(key);
    const r = await fetch(`${API}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt(input, base) }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const json = safeJson(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (!json) throw new Error(`no json from ${model} (${data.stop_reason}): ${text.slice(0, 160)}`);
    res.status(200).json({ recipe: cleanRecipe({ ...base, ...json, ai: true }), source: "claude", model });
  } catch (err) {
    res.status(200).json({ recipe: base, source: "builtin", reason: String(err.message || err).slice(0, 200) });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}