/**
 * Arcade game recipes. A recipe is plain data our MiniGame can play; the AI
 * (or the built-in builder below) only fills it in, it never writes code.
 * Shared by the browser and the /api/arcade function.
 */

export const GAME_TYPES = [
  { id: "race", emoji: "🏁", label: "Race", blurb: "First to the finish line wins" },
  { id: "battle", emoji: "⚔️", label: "Battle", blurb: "Throw things, land hits, win" },
  { id: "collect", emoji: "⭐", label: "Collect", blurb: "Grab the most goodies" },
];

export const PLACES = [
  { id: "candy", short: "Candy", emoji: "🍭", label: "Candy land", sky: ["#ffd6ec", "#fff0f6"], ground: "#ffc1dc", accent: "#ff6fae", decor: ["🍭", "🍬", "🧁", "🍩"] },
  { id: "space", short: "Space", emoji: "🚀", label: "Space", sky: ["#1d1b4b", "#3b2f7a"], ground: "#2a2462", accent: "#ffd84d", decor: ["⭐", "🪐", "🌙", "☄️"] },
  { id: "jungle", short: "Jungle", emoji: "🌴", label: "Jungle", sky: ["#bdf0c8", "#e8fff0"], ground: "#8fd19e", accent: "#2f9e5b", decor: ["🌴", "🌺", "🍌", "🦜"] },
  { id: "ocean", short: "Ocean", emoji: "🌊", label: "Under the sea", sky: ["#7fd3f5", "#c9f1ff"], ground: "#5fb8e6", accent: "#1e6fb8", decor: ["🐚", "🐠", "🪸", "🫧"] },
  { id: "snow", short: "Snowy", emoji: "❄️", label: "Snowy hills", sky: ["#dff1ff", "#ffffff"], ground: "#eef7ff", accent: "#5aa0e0", decor: ["⛄", "❄️", "🌲", "🧊"] },
  { id: "island", short: "Island", emoji: "🌸", label: "Pibo island", sky: ["#bfe6ff", "#fff6e6"], ground: "#a9dd8f", accent: "#ff9a76", decor: ["🌸", "🍄", "🌳", "🌼"] },
];

/** Preset details per type. Each option maps onto recipe fields. */
export const DETAILS = {
  race: [
    { id: "speed", label: "Speed", options: [
      { id: "chill", label: "🐢 Chill", set: { speed: 0.9 } },
      { id: "zoomy", label: "⚡ Zoomy", set: { speed: 1.3 } },
    ] },
    { id: "obstacles", label: "Obstacles", options: [
      { id: "few", label: "A few", set: { hazards: 5 } },
      { id: "lots", label: "Lots!", set: { hazards: 11 } },
    ] },
    { id: "boost", label: "Boost", options: [
      { id: "mushroom", label: "🍄 Mushroom", set: { item: "🍄" } },
      { id: "bolt", label: "⚡ Lightning", set: { item: "⚡" } },
      { id: "carrot", label: "🥕 Carrot", set: { item: "🥕" } },
    ] },
  ],
  battle: [
    { id: "weapon", label: "Throw", options: [
      { id: "balloon", label: "🎈 Water balloons", set: { item: "🎈" } },
      { id: "snowball", label: "❄️ Snowballs", set: { item: "❄️" } },
      { id: "tomato", label: "🍅 Tomatoes", set: { item: "🍅" } },
      { id: "pillow", label: "🪶 Pillows", set: { item: "🪶" } },
    ] },
    { id: "goal", label: "Hits to win", options: [
      { id: "3", label: "3 hits", set: { goal: 3 } },
      { id: "6", label: "6 hits", set: { goal: 6 } },
    ] },
  ],
  collect: [
    { id: "item", label: "Collect", options: [
      { id: "stars", label: "⭐ Stars", set: { item: "⭐" } },
      { id: "berries", label: "🍓 Berries", set: { item: "🍓" } },
      { id: "gems", label: "💎 Gems", set: { item: "💎" } },
      { id: "cookies", label: "🍪 Cookies", set: { item: "🍪" } },
    ] },
    { id: "avoid", label: "Avoid", options: [
      { id: "bees", label: "🐝 Bees", set: { hazard: "🐝" } },
      { id: "bombs", label: "💣 Bombs", set: { hazard: "💣" } },
      { id: "ghosts", label: "👻 Ghosts", set: { hazard: "👻" } },
    ] },
    { id: "goal", label: "To win", options: [
      { id: "10", label: "10 goodies", set: { goal: 10 } },
      { id: "20", label: "20 goodies", set: { goal: 20 } },
    ] },
  ],
};

const DEFAULTS = {
  race: { item: "🍄", hazard: "🪨", goal: 1, speed: 1, hazards: 6, seconds: 60 },
  battle: { item: "🎈", hazard: "🌵", goal: 3, speed: 1, hazards: 3, seconds: 60 },
  collect: { item: "⭐", hazard: "🐝", goal: 10, speed: 1, hazards: 4, seconds: 60 },
};

const HAZARD_BY_PLACE = {
  race: { candy: "🍬", space: "☄️", jungle: "🪵", ocean: "🦀", snow: "⛄", island: "🪨" },
  battle: { candy: "🍬", space: "🪐", jungle: "🌵", ocean: "🪸", snow: "🧊", island: "🍄" },
};

const NAMES = {
  race: ["Dash", "Zoom Rally", "Turbo Trot", "Speedy Scramble"],
  battle: ["Splash Brawl", "Bonk Arena", "Toss Party", "Showdown"],
  collect: ["Treasure Grab", "Goodie Rush", "Snack Sprint", "Sparkle Hunt"],
};

/** A complete recipe from picks alone. Also the fallback when the AI is away. */
export function buildRecipe({ type = "race", place = "island", details = {}, text = "" } = {}) {
  const t = GAME_TYPES.some((g) => g.id === type) ? type : "race";
  const p = PLACES.find((x) => x.id === place) || PLACES[PLACES.length - 1];
  const recipe = { ...DEFAULTS[t], type: t, place: p.id };
  const hz = HAZARD_BY_PLACE[t]?.[p.id];
  if (hz) recipe.hazard = hz;
  for (const group of DETAILS[t]) {
    const pick = group.options.find((o) => o.id === details[group.id]) || group.options[0];
    Object.assign(recipe, pick.set);
  }
  const names = NAMES[t];
  const title = `${p.short} ${names[Math.abs(hash(text + p.id)) % names.length]}`;
  return cleanRecipe({
    ...recipe,
    title: title.replace(/^\w/, (c) => c.toUpperCase()),
    intro: introFor(recipe),
    winText: t === "race" ? "crossed the finish first!" : t === "battle" ? "is the champion!" : "grabbed the most goodies!",
    sky: p.sky,
    ground: p.ground,
    accent: p.accent,
    decor: p.decor,
  });
}

function introFor(r) {
  if (r.type === "race") return `Race to the flag! Grab ${r.item} to zoom and dodge ${r.hazard}.`;
  if (r.type === "battle") return `Throw ${r.item} with Space or the button. First to ${r.goal} hits wins!`;
  return `Collect ${r.goal} ${r.item} before anyone else. Watch out for ${r.hazard}!`;
}

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : d);
const short = (s, n, d) => (typeof s === "string" && s.trim() ? s.trim().slice(0, n) : d);
const emoji = (s, d) => (typeof s === "string" && s.trim() && [...s.trim()].length <= 4 ? s.trim() : d);

/** Clamp anything (AI output included) into a recipe the MiniGame can play. */
export function cleanRecipe(raw = {}) {
  const type = GAME_TYPES.some((g) => g.id === raw.type) ? raw.type : "race";
  const d = DEFAULTS[type];
  const place = PLACES.find((x) => x.id === raw.place) || PLACES[PLACES.length - 1];
  const sky = Array.isArray(raw.sky) && raw.sky.length === 2 && raw.sky.every((c) => HEX.test(c)) ? raw.sky : place.sky;
  const decor = Array.isArray(raw.decor) ? raw.decor.map((x) => emoji(x, null)).filter(Boolean).slice(0, 6) : [];
  return {
    type,
    place: place.id,
    title: short(raw.title, 32, "Mystery Game"),
    intro: short(raw.intro, 140, introFor({ ...d, type })),
    winText: short(raw.winText, 60, "wins!"),
    item: emoji(raw.item, d.item),
    hazard: emoji(raw.hazard, d.hazard),
    goal: Math.round(clamp(raw.goal, 1, type === "collect" ? 25 : 8, d.goal)),
    speed: clamp(raw.speed, 0.7, 1.5, d.speed),
    hazards: Math.round(clamp(raw.hazards, 0, 14, d.hazards)),
    seconds: Math.round(clamp(raw.seconds, 30, 120, d.seconds)),
    sky,
    ground: HEX.test(raw.ground) ? raw.ground : place.ground,
    accent: HEX.test(raw.accent) ? raw.accent : place.accent,
    decor: decor.length ? decor : place.decor,
    by: short(raw.by, 16, ""),
    ai: !!raw.ai,
  };
}

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}
