import { getVideoApiUrl } from "../config.js";

/**
 * Pluggable "prompt → clip" client for the screen studio.
 *
 * Default: a cozy canvas animation derived from the sentence (no API key).
 * Optional: POST the prompt to a configurable endpoint and play the media it
 * returns. See README for the expected JSON shape (OpenAI / Replicate / …).
 *
 * @typedef {object} Clip
 * @property {"canvas"|"video"|"image"} kind
 * @property {string} caption
 * @property {boolean} [demo]
 * @property {string} [provider]
 * @property {string} [fallbackReason]
 * @property {HTMLCanvasElement} [canvas]
 * @property {(t: number) => void} [draw]
 * @property {number} [duration]
 * @property {string} [url]
 */

const DEMO_DELAY_MS = 1100;

export async function generateClip(prompt, { signal } = {}) {
  const text = String(prompt || "").trim();
  if (!text) {
    throw new Error("Type a little sentence first.");
  }

  const endpoint = getVideoApiUrl();
  if (endpoint) {
    try {
      return await generateFromApi(endpoint, text, { signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn("[pibo] video API failed, using demo clip", err);
      const clip = createMockClip(text);
      clip.demo = true;
      clip.fallbackReason = err?.message || "API unavailable";
      return clip;
    }
  }

  await wait(DEMO_DELAY_MS, signal);
  const clip = createMockClip(text);
  clip.demo = true;
  clip.provider = "demo";
  return clip;
}

/**
 * POST { prompt, source } → { url, kind?, caption? }
 * `kind` may be "video" (default for .mp4/.webm) or "image".
 */
async function generateFromApi(endpoint, prompt, { signal } = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ prompt, source: "pibo-world-studio" }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Studio API ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const url = data.url || data.video_url || data.image_url;
  if (!url) throw new Error("Studio API returned no media url");

  const kind = data.kind
    || (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ? "image" : "video");
  return {
    kind,
    url,
    caption: data.caption || prompt,
    demo: false,
    provider: data.provider || "api",
    duration: Number(data.duration) || 6,
  };
}

export function createMockClip(prompt) {
  const story = parsePrompt(prompt);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");

  return {
    kind: "canvas",
    canvas,
    caption: story.text,
    duration: 6,
    story,
    draw(t) {
      drawStory(ctx, canvas.width, canvas.height, story, t);
    },
  };
}

export function parsePrompt(prompt) {
  const text = String(prompt || "").trim() || "Tiny Pibo waves hello.";
  const lower = text.toLowerCase();

  const color = pick(lower, [
    ["red", "#f26f6f"],
    ["pink", "#ff9ec4"],
    ["coral", "#ff9a76"],
    ["orange", "#ff9a76"],
    ["yellow", "#ffd166"],
    ["gold", "#f5d06f"],
    ["green", "#7bbf6a"],
    ["teal", "#5bb0a0"],
    ["blue", "#7eb6f5"],
    ["purple", "#b9a6ff"],
    ["violet", "#b9a6ff"],
    ["white", "#fff6ea"],
  ], "#ffe27a");

  const subject = pick(lower, [
    ["bird", "bird"],
    ["fish", "fish"],
    ["cat", "cat"],
    ["dog", "dog"],
    ["balloon", "balloon"],
    ["flower", "flower"],
    ["star", "star"],
    ["sun", "sun"],
    ["moon", "moon"],
    ["butterfly", "butterfly"],
    ["cloud", "cloud"],
    ["pibo", "pibo"],
    ["pot", "pibo"],
  ], "pibo");

  const place = pick(lower, [
    ["sea", "sea"],
    ["ocean", "sea"],
    ["fish", "sea"],
    ["swim", "sea"],
    ["night", "night"],
    ["star", "night"],
    ["space", "space"],
    ["snow", "snow"],
    ["cloud", "sky"],
    ["sky", "sky"],
    ["garden", "garden"],
    ["meadow", "garden"],
    ["flower", "garden"],
    ["sun", "garden"],
  ], "meadow");

  const action = pick(lower, [
    ["swim", "swim"],
    ["fly", "fly"],
    ["float", "float"],
    ["hop", "hop"],
    ["jump", "hop"],
    ["dance", "dance"],
    ["sing", "sing"],
    ["grow", "grow"],
    ["wave", "wave"],
  ], "hop");

  return { text, color, subject, place, action };
}

function pick(lower, pairs, fallback) {
  for (const [word, value] of pairs) {
    if (lower.includes(word)) return value;
  }
  return fallback;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true });
  });
}

/* ------------------------------------------------------------------ */
/* Demo animation — clay-toy shapes, the student's sentence as a caption */
/* ------------------------------------------------------------------ */

function drawStory(ctx, w, h, story, t) {
  const loop = ((t % 6) + 6) % 6;
  const u = loop / 6;

  paintPlace(ctx, w, h, story.place, loop);

  const cx = 0.42 * w + Math.sin(loop * 1.4) * (story.action === "swim" ? 70 : 36);
  let cy = 0.58 * h;
  if (story.action === "hop") cy -= Math.abs(Math.sin(loop * 4.2)) * 42;
  if (story.action === "dance") cy -= Math.abs(Math.sin(loop * 6)) * 18;
  if (story.action === "float" || story.action === "fly") {
    cy = 0.38 * h + Math.sin(loop * 2.1) * 36;
  }
  if (story.action === "grow") cy = 0.72 * h - u * 70;
  if (story.place === "sea") cy = 0.62 * h + Math.sin(loop * 2.4) * 16;

  drawSubject(ctx, cx, cy, story.subject, story.color, loop, story.action);
  drawCaption(ctx, w, h, story.text);
}

function paintPlace(ctx, w, h, place, t) {
  let top, bot, ground;
  if (place === "sea") {
    top = "#b7e4ff"; bot = "#5bb6db"; ground = "#2b7fb0";
  } else if (place === "night") {
    top = "#1b1438"; bot = "#2a2458"; ground = "#3d355c";
  } else if (place === "space") {
    top = "#0b0a18"; bot = "#1b1438"; ground = "#111018";
  } else if (place === "snow") {
    top = "#e8f4ff"; bot = "#f7fbff"; ground = "#fffefb";
  } else if (place === "sky") {
    top = "#9fd7ff"; bot = "#cdeafd"; ground = "#fff2d8";
  } else {
    top = "#b7e4ff"; bot = "#ffe7cf"; ground = "#8fce74";
  }

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (place === "night" || place === "space") {
    ctx.fillStyle = "rgba(255, 243, 166, 0.9)";
    for (let i = 0; i < 18; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + i);
      ctx.globalAlpha = tw;
      ctx.beginPath();
      ctx.arc((i * 97) % w, 18 + (i * 53) % (h * 0.45), 1.6 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (place === "sky" || place === "meadow" || place === "garden") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    drawCloud(ctx, 90 + Math.sin(t * 0.4) * 20, 58, 1);
    drawCloud(ctx, 430 + Math.cos(t * 0.35) * 16, 78, 0.8);
  }

  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.92, w * 0.62, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  if (place === "garden" || place === "meadow") {
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 90;
      ctx.fillStyle = i % 2 ? "#ff9ec4" : "#ffd166";
      ctx.beginPath();
      ctx.arc(x, h * 0.82, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (place === "sea") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const y = h * 0.7 + i * 18;
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x * 0.04 + t * 2.2 + i) * 6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

function drawCloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 24 * s, y + 4 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x - 20 * s, y + 6 * s, 16 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawSubject(ctx, x, y, subject, color, t, action) {
  ctx.save();
  ctx.translate(x, y);
  if (action === "dance") ctx.rotate(Math.sin(t * 8) * 0.18);
  if (action === "sing") ctx.rotate(Math.sin(t * 3) * 0.08);

  if (subject === "bird") {
    ctx.fillStyle = color;
    ellipse(ctx, 0, 0, 28, 20);
    ctx.beginPath();
    ctx.moveTo(26, -2);
    ctx.lineTo(40, 2);
    ctx.lineTo(26, 6);
    ctx.closePath();
    ctx.fillStyle = "#ff9a76";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.save();
    ctx.rotate(Math.sin(t * 10) * 0.5);
    ellipse(ctx, -4, -6, 18, 8);
    ctx.restore();
    eye(ctx, 10, -6);
  } else if (subject === "fish") {
    ctx.fillStyle = color;
    ellipse(ctx, 0, 0, 30, 16);
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-46, -14);
    ctx.lineTo(-46, 14);
    ctx.closePath();
    ctx.fill();
    eye(ctx, 12, -3);
  } else if (subject === "balloon") {
    ctx.fillStyle = color;
    ellipse(ctx, 0, -8, 22, 28);
    ctx.strokeStyle = "#7a6a60";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.quadraticCurveTo(8, 40, 0, 56);
    ctx.stroke();
  } else if (subject === "flower") {
    ctx.strokeStyle = "#6fae5a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, -4);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.4;
      ellipseAt(ctx, Math.cos(a) * 16, Math.sin(a) * 16 - 8, 10, 8);
    }
    ctx.fillStyle = "#ffd166";
    ellipse(ctx, 0, -8, 8, 8);
  } else if (subject === "butterfly") {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.save();
    ctx.rotate(Math.sin(t * 12) * 0.4);
    ellipse(ctx, -18, 0, 18, 24);
    ellipse(ctx, 18, 0, 18, 24);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#4a3b35";
    ellipse(ctx, 0, 0, 5, 16);
  } else if (subject === "star" || subject === "sun") {
    ctx.fillStyle = color;
    star(ctx, 0, 0, 8, 22, 12);
  } else if (subject === "cloud") {
    ctx.fillStyle = "#fffefb";
    drawCloud(ctx, 0, 0, 1.1);
  } else if (subject === "cat" || subject === "dog") {
    ctx.fillStyle = color;
    ellipse(ctx, 0, 6, 26, 20);
    ellipse(ctx, 0, -12, 18, 16);
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.lineTo(-8, -32);
    ctx.lineTo(-2, -18);
    ctx.moveTo(14, -18);
    ctx.lineTo(8, -32);
    ctx.lineTo(2, -18);
    ctx.fill();
    eye(ctx, -6, -14);
    eye(ctx, 6, -14);
  } else {
    // tiny Pibo — a round pot with a leaf
    ctx.fillStyle = color;
    roundRect(ctx, -22, -8, 44, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#5a3f2c";
    roundRect(ctx, -16, -14, 32, 10, 4);
    ctx.fill();
    ctx.fillStyle = "#6fbf5f";
    ctx.beginPath();
    ctx.ellipse(-6, -28, 6, 16, -0.3, 0, Math.PI * 2);
    ctx.ellipse(6, -30, 6, 18, 0.25, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, -8, 6);
    eye(ctx, 8, 6);
    ctx.strokeStyle = "#c4a05a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 14, 6, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapCaption(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const next = current ? `${current} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines - 1) {
      const rest = words.slice(i).join(" ");
      lines.push(fitEllipsis(ctx, rest, maxWidth));
      return lines;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitEllipsis(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1).trimEnd();
  }
  return `${clipped}…`;
}

function drawCaption(ctx, w, h, text) {
  ctx.font = "600 16px Fredoka, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = w - 80;
  const lines = wrapCaption(ctx, text, maxWidth, 3);
  const lineH = 22;
  const padY = 12;
  const boxH = padY * 2 + lines.length * lineH;
  const top = h - 14 - boxH;
  ctx.fillStyle = "rgba(74, 59, 53, 0.82)";
  roundRect(ctx, 20, top, w - 40, boxH, 14);
  ctx.fill();
  ctx.fillStyle = "#fff7ec";
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, top + padY + lineH * i + lineH / 2);
  });
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function ellipseAt(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function eye(ctx, x, y) {
  ctx.fillStyle = "#30303c";
  ellipse(ctx, x, y, 3.2, 4.2);
  ctx.fillStyle = "#fff";
  ellipse(ctx, x + 1.2, y - 1.4, 1.2, 1.2);
}
function star(ctx, x, y, n, rOuter, rInner) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rInner : rOuter;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
