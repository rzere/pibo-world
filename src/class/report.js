/**
 * Fire-and-forget notes from the game back to the class record.
 * Students are signed in with a cookie. If there is no class session,
 * the request fails quietly and play continues.
 */

function post(body) {
  try {
    fetch("/api/class", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore a missing fetch or a private window
  }
}

export function reportEnglish(text, source) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!clean) return;
  post({ action: "logEnglish", text: clean, source: String(source || "practice").slice(0, 24) });
}

export function reportCreation({ kind, text, title, words } = {}) {
  const clean = String(text || "").trim().slice(0, 2000);
  if (!clean) return;
  post({
    action: "logCreation",
    kind: String(kind || "story").slice(0, 24),
    text: clean,
    title: String(title || "").slice(0, 80),
    words: Array.isArray(words) ? words.slice(0, 12) : [],
  });
}

export function startClassPulse() {
  const send = (start) => post({ action: "pulse", seconds: start ? 0 : 20, start: !!start });
  send(true);
  const timer = setInterval(() => send(false), 20000);
  const onHide = () => {
    if (document.visibilityState === "hidden") send(false);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => send(false));
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
  };
}
