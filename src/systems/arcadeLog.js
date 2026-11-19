/**
 * Authorship log for thesis data. Every prompt, chip, typed answer, template
 * choice, and edit is stored with a timestamp and an author tag.
 */
const LOG_KEY = "pibo.arcade.log";

export function createAuthorshipLog(events = []) {
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
      return { version: 1, ...extra, events: list.slice() };
    },
  };
}

export function loadAuthorshipLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return createAuthorshipLog();
    const parsed = JSON.parse(raw);
    return createAuthorshipLog(parsed.events || []);
  } catch {
    return createAuthorshipLog();
  }
}

export function saveAuthorshipLog(log, extra = {}) {
  const data = log.toJSON(extra);
  localStorage.setItem(LOG_KEY, JSON.stringify(data));
  return data;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
