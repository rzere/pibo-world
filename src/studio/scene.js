/**
 * A tiny cartoon for the lighthouse TV. Claude writes it as data; the
 * scene player animates it. Shared by the browser and /api/scene.
 *
 * x is 0 (left) … 1 (right). y is 0 (on the ground) … 1 (top of the sky).
 * Beats run in time order over SCENE_SECONDS, then the cartoon loops.
 */
export const SCENE_SECONDS = 9;
export const CHARACTERS = ["pibo", "cat", "dog", "bunny", "panda", "frog", "penguin", "unicorn", "fox"];
export const BACKDROPS = {
  meadow: { sky: ["#bfe6ff", "#fff6e6"], ground: "#a9dd8f", props: ["🌳", "🌼", "🌸", "🍄"] },
  beach: { sky: ["#8fd8ff", "#fff3d6"], ground: "#f7dfa3", props: ["🌴", "🐚", "🏖️", "🦀"] },
  space: { sky: ["#140f3a", "#3b2f7a"], ground: "#5a4a8a", props: ["🪐", "⭐", "🌙", "🛸"] },
  night: { sky: ["#1f2a5a", "#5a5aa0"], ground: "#3f6b4f", props: ["🌙", "⭐", "🏠", "🌲"] },
  snow: { sky: ["#d9efff", "#ffffff"], ground: "#f2f8ff", props: ["⛄", "🌲", "❄️", "🏔️"] },
  city: { sky: ["#ffd7c2", "#fff2e6"], ground: "#c9c3bd", props: ["🏠", "🏢", "🚦", "🌳"] },
  underwater: { sky: ["#3fb4e6", "#9be3ff"], ground: "#e8d39a", props: ["🪸", "🐠", "🫧", "🐚"] },
  candy: { sky: ["#ffd6ec", "#fff0f6"], ground: "#ffc1dc", props: ["🍭", "🧁", "🍬", "🍩"] },
  jungle: { sky: ["#bdf0c8", "#e8fff0"], ground: "#6fbf7f", props: ["🌴", "🦜", "🍌", "🌺"] },
  room: { sky: ["#fff1dc", "#ffe6c7"], ground: "#d9a77a", props: ["🪴", "🛋️", "🖼️", "🧸"] },
};
export const WEATHER = ["none", "rain", "snow", "stars", "hearts", "confetti", "leaves", "bubbles", "sparkles"];
export const ACTIONS = ["walk", "jump", "spin", "grow", "shrink", "say", "wiggle", "fly", "land", "hide", "show", "dance"];

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const str = (v, n, d = "") => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);
const emoji = (v) => (typeof v === "string" && v.trim() && [...v.trim()].length <= 4 ? v.trim() : null);

export function cleanScene(raw = {}) {
  const bg = BACKDROPS[raw.backdrop] ? raw.backdrop : "meadow";
  const base = BACKDROPS[bg];
  const actors = [];
  for (const a of Array.isArray(raw.actors) ? raw.actors.slice(0, 6) : []) {
    const id = str(a?.id, 16);
    if (!id || actors.some((x) => x.id === id)) continue;
    const who = CHARACTERS.includes(a.who) ? a.who : emoji(a.who);
    if (!who) continue;
    actors.push({
      id,
      who,
      x: num(a.x, 0.05, 0.95, 0.5),
      y: num(a.y, 0, 0.9, 0),
      size: num(a.size, 0.5, 2.2, 1),
      hidden: !!a.hidden,
    });
  }
  const ids = new Set(actors.map((a) => a.id));
  const beats = [];
  for (const b of Array.isArray(raw.beats) ? raw.beats.slice(0, 24) : []) {
    if (!ids.has(b?.actor) || !ACTIONS.includes(b.do)) continue;
    beats.push({
      t: num(b.t, 0, SCENE_SECONDS - 0.5, 0),
      actor: b.actor,
      do: b.do,
      to: b.to == null ? null : num(b.to, 0.05, 0.95, 0.5),
      y: b.y == null ? null : num(b.y, 0, 0.9, 0.5),
      text: str(b.text, 40),
    });
  }
  beats.sort((a, b) => a.t - b.t);
  return {
    caption: str(raw.caption, 90, "A little show"),
    backdrop: bg,
    sky: Array.isArray(raw.sky) && raw.sky.length === 2 && raw.sky.every((c) => HEX.test(c)) ? raw.sky : base.sky,
    ground: HEX.test(raw.ground) ? raw.ground : base.ground,
    props: (Array.isArray(raw.props) ? raw.props.map(emoji).filter(Boolean).slice(0, 6) : []).concat(base.props).slice(0, 6),
    weather: WEATHER.includes(raw.weather) ? raw.weather : "none",
    actors: actors.length ? actors : [{ id: "pibo", who: "pibo", x: 0.5, y: 0, size: 1, hidden: false }],
    beats,
    ai: !!raw.ai,
  };
}

export const SCENE_PROMPT_RULES = `Stage: x from 0 (left) to 1 (right); y from 0 (standing on the ground) to 0.9 (high in the sky). The show is ${SCENE_SECONDS} seconds and loops.
Backdrops: ${Object.keys(BACKDROPS).join(", ")}. Weather: ${WEATHER.join(", ")}.
Actors (max 6): who is one of our characters (${CHARACTERS.join(", ")}) or any single emoji for other people, animals, vehicles or objects. size 0.5-2.2 (1 = normal). hidden:true to make them appear later with "show".
Beats (max 24, sorted by t in seconds): do is one of ${ACTIONS.join(", ")}.
- walk: move to x "to" (about 1.5 s). fly: rise to height "y" and optionally x "to". land: back to the ground.
- jump, spin, wiggle, dance: short moves in place. grow / shrink: change size. hide / show: disappear / appear.
- say: speech bubble with "text" (max 40 chars, simple English for kids learning, about 2 s).`;
