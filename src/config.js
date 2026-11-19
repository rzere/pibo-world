/**
 * Runtime knobs that stay out of gameplay code.
 *
 * Video generation talks to whatever endpoint you set. An empty endpoint
 * uses the built-in demo clip so the studio is playable without secrets.
 *
 * Ways to point at a real provider (never commit keys here):
 *   1. window.PIBO_VIDEO_API = "https://your-api.example/generate"
 *   2. localStorage.setItem("PIBO_VIDEO_API", "https://...")
 *   3. Open the game with ?videoApi=https://your-api.example/generate
 */
/**
 * The blue companion and the little white Pino stay in the world (positions,
 * letter, family voyage) but stay hidden until this is turned back on.
 */
export const SHOW_VILLAGE_FRIENDS = false;

export function getVideoApiUrl() {
  try {
    const q = new URLSearchParams(window.location.search).get("videoApi");
    if (q) return q;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.PIBO_VIDEO_API) {
    return String(window.PIBO_VIDEO_API);
  }
  try {
    const stored = localStorage.getItem("PIBO_VIDEO_API");
    if (stored) return stored;
  } catch {
    // ignore
  }
  return "";
}

/**
 * Story writing for the library. Same idea as the studio hook: nothing is
 * set in the repo. With no URL and no key, the library uses its offline story.
 *
 *   window.PIBO_STORY_API = "https://your-api.example/story"
 *   localStorage.setItem("PIBO_STORY_API", "https://...")
 *   ?storyApi=https://your-api.example/story
 *
 * A key is sent as a bearer token and is never required:
 *   window.PIBO_AI_KEY / localStorage PIBO_AI_KEY / ?aiKey=
 */
function readSetting(queryName, windowName, storageName) {
  try {
    const q = new URLSearchParams(window.location.search).get(queryName);
    if (q) return q;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window[windowName]) {
    return String(window[windowName]);
  }
  try {
    const stored = localStorage.getItem(storageName);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return "";
}

export function getStoryApiUrl() {
  return readSetting("storyApi", "PIBO_STORY_API", "PIBO_STORY_API");
}

export function getAiKey() {
  return readSetting("aiKey", "PIBO_AI_KEY", "PIBO_AI_KEY");
}
