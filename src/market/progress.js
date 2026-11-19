/**
 * Pibo Market progress on this browser: stars per finished list, which
 * levels are done (each one is a trophy in the mushroom house), and the
 * stall the child built in Level 3.
 */
const KEY = "pibo.market";
const STALL_KEY = "pibo.market.stall";

const EMPTY = { stars: { 1: [], 2: [], 3: [] }, trophies: [] };

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    const stars = {};
    for (const level of [1, 2, 3]) {
      const list = Array.isArray(raw?.stars?.[level]) ? raw.stars[level] : [];
      stars[level] = list.map((n) => Math.min(3, Math.max(1, Math.round(Number(n)) || 1))).slice(-20);
    }
    const trophies = (Array.isArray(raw?.trophies) ? raw.trophies : [])
      .filter((t) => /^market-[123]$/.test(t?.id) && /^assets\/painted\/trophies\/[\w-]+\.png$/.test(t?.src))
      .map((t) => ({ id: t.id, src: t.src, title: String(t.title || "").slice(0, 60) }));
    return { stars, trophies };
  } catch {
    return structuredClone(EMPTY);
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

/**
 * Record a finished list for a level from market.json.
 * Returns { progress, newTrophy } — newTrophy is set the moment a level is done.
 */
export function addStars(level, stars) {
  const progress = loadProgress();
  progress.stars[level.id] = [...progress.stars[level.id], stars].slice(-20);
  let newTrophy = null;
  const id = `market-${level.id}`;
  if (levelDone(progress, level) && !progress.trophies.some((t) => t.id === id)) {
    newTrophy = { id, src: level.trophy, title: `Pibo Market: ${level.title}` };
    progress.trophies.push(newTrophy);
  }
  saveProgress(progress);
  return { progress, newTrophy };
}

/** A level is done once its number of lists is finished. */
export function levelDone(progress, level) {
  return progress.stars[level.id].length >= level.lists;
}

/** Level 1 is always open; the others open when the one before is done. */
export function levelOpen(progress, levels, id) {
  if (id === 1) return true;
  const before = levels.find((l) => l.id === id - 1);
  return !!before && levelDone(progress, before);
}

/** Trophies earned so far, for the mushroom house. */
export function earnedTrophies() {
  return loadProgress().trophies;
}

export function loadStall() {
  try {
    return JSON.parse(localStorage.getItem(STALL_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveStall(stall) {
  try {
    localStorage.setItem(STALL_KEY, JSON.stringify(stall));
  } catch {
    /* private mode */
  }
}
