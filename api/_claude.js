/**
 * Shared Claude call for the /api functions. Files starting with "_" are not
 * routes. Returns the parsed JSON object from the reply, or throws.
 */
const API = "https://api.anthropic.com/v1";
let modelPromise = null;

function headers(key) {
  return { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
}

export function hasKey() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function pickModel(key) {
  if (process.env.ANTHROPIC_MODEL) return Promise.resolve(process.env.ANTHROPIC_MODEL);
  modelPromise ||= fetch(`${API}/models?limit=50`, { headers: headers(key) })
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then(({ data = [] }) => {
      const ids = data.map((m) => m.id);
      return ids.find((id) => id.includes("haiku")) || ids.find((id) => id.includes("sonnet")) || ids[0] || "claude-3-5-haiku-latest";
    })
    .catch(() => "claude-3-5-haiku-latest");
  return modelPromise;
}

export async function askClaudeJSON(prompt, { maxTokens = 1500, timeoutMs = 20000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no key");
  const model = await pickModel(key);
  const r = await fetch(`${API}/messages`, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const json = safeJson(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  if (!json) throw new Error(`no json from ${model} (${data.stop_reason}): ${text.slice(0, 160)}`);
  return { json, model };
}

export function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function readBody(req) {
  return typeof req.body === "string" ? safeJson(req.body) || {} : req.body || {};
}
