/**
 * Three bouncing dots, then the words. No letters in the indicator itself.
 * The wait is a little longer for a longer line, and never quite the same twice.
 */

export function typingDots() {
  const dots = document.createElement("span");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) dots.append(document.createElement("i"));
  return dots;
}

/** Milliseconds to show dots before this line. Clamped to about 0.8–2s. */
export function typingDelayMs(text) {
  const len = [...String(text || "")].length;
  const t = Math.min(1, Math.max(0, (len - 8) / 80));
  const base = 800 + t * 1200;
  const jitter = (Math.random() * 2 - 1) * 140;
  return Math.round(Math.min(2000, Math.max(800, base + jitter)));
}

export function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const reduceMotion = () =>
  typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/**
 * The line is laid out at its real width first, then the whole bubble
 * eases open from the tail. Width is never animated, so the words cannot
 * restack into a skinny column on the way.
 */
export function morphBubble(node, textNode, text) {
  if (!node || !textNode) return;
  const fromW = Math.max(1, node.offsetWidth);
  const fromH = Math.max(1, node.offsetHeight);
  textNode.textContent = text;
  node.classList.remove("is-typing");
  textNode.classList.add("is-revealing");
  if (reduceMotion()) return;
  const toW = Math.max(fromW, node.offsetWidth);
  const toH = Math.max(fromH, node.offsetHeight);
  if (toW - fromW < 2 && toH - fromH < 2) return;
  node.style.width = `${toW}px`;
  node.style.height = `${toH}px`;
  const positioned = getComputedStyle(node).position === "absolute";
  node.style.transformOrigin = positioned ? "center bottom" : "18px bottom";
  const place = positioned ? "translate(-50%, calc(-100% - 14px)) " : "";
  const start = Math.max(0.55, Math.min(fromW / toW, fromH / toH));
  const anim = node.animate(
    [
      { transform: `${place}scale(${start})` },
      { transform: `${place}scale(1)` },
    ],
    { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
  const clear = () => {
    if (!node.isConnected) return;
    node.style.width = "";
    node.style.height = "";
    node.style.transformOrigin = "";
  };
  anim.onfinish = clear;
  anim.oncancel = clear;
}
