/**
 * Authorship log for library stories. Same shape as the arcade log:
 * each event has a time, an author (child, ai, or template), and a kind.
 */
const LOG_KEY = "pibo.library.log";

export function createLibraryLog(events = []) {
  const list = Array.isArray(events) ? events.slice() : [];
  return {
    events: list,
    add(kind, detail = {}, author = "child") {
      list.push({
        t: new Date().toISOString(),
        author,
        kind,
        detail,
      });
      return list[list.length - 1];
    },
    toJSON(extra = {}) {
      return { version: 1, place: "library", ...extra, events: list.slice() };
    },
  };
}

export function loadLibraryLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return createLibraryLog();
    const parsed = JSON.parse(raw);
    return createLibraryLog(parsed.events || []);
  } catch {
    return createLibraryLog();
  }
}

export function saveLibraryLog(log, extra = {}) {
  const data = log.toJSON(extra);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(data));
  } catch {
    // ignore a full or private store
  }
  return data;
}
