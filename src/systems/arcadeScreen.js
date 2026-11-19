/**
 * Draws the 2D treasure hunt onto the arcade machine's screen.
 * Positions are percentages of the play area (the same numbers the child drags).
 */
import { STICKERS, BACKGROUNDS } from "../data/arcadeStickers.js";
import { read } from "./gameSpec.js";

export const SCREEN_INSET = 0.075;

/**
 * `chrome` is the fraction of the play area reserved for the control dock
 * along the bottom, so taps and pictures share the same region.
 */
export function screenPoint(u, v, chrome = 0) {
  const spanX = 1 - 2 * SCREEN_INSET;
  const spanY = spanX * (1 - chrome);
  const x = ((u - SCREEN_INSET) / spanX) * 100;
  const y = (((1 - v) - SCREEN_INSET) / spanY) * 100;
  return { x, y };
}

export function objectAt(spec, u, v, chrome = 0) {
  if (!spec?.objects) return null;
  const { x, y } = screenPoint(u, v, chrome);
  if (x < -4 || x > 104 || y < -4 || y > 104) return null;
  let best = null;
  let bestD = 14;
  for (const object of spec.objects) {
    const d = Math.hypot((object.x ?? 50) - x, (object.y ?? 50) - y);
    if (d < bestD) {
      best = object;
      bestD = d;
    }
  }
  return best;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stripes(ctx, w, h) {
  ctx.fillStyle = "#c4192a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(90, 8, 18, 0.45)";
  ctx.lineWidth = 10;
  for (let i = -h; i < w + h; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
  }
}

function playArea(w, h, chrome = 0) {
  const x = w * SCREEN_INSET;
  const y = h * SCREEN_INSET;
  const fullH = h * (1 - 2 * SCREEN_INSET);
  const dock = fullH * chrome;
  return {
    x,
    y,
    w: w * (1 - 2 * SCREEN_INSET),
    h: fullH - dock,
    dock,
    fullH,
  };
}

export function paintArcadeScreen(ctx, w, h, view = {}) {
  const spec = view.spec;
  stripes(ctx, w, h);
  const chrome = Math.min(0.5, Math.max(0, view.chrome || 0));
  const area = playArea(w, h, chrome);
  const radius = Math.min(area.w, area.fullH) * 0.08;

  ctx.save();
  ctx.shadowColor = "rgba(255, 244, 230, 0.85)";
  ctx.shadowBlur = 28;
  roundRect(ctx, area.x - 10, area.y - 10, area.w + 20, area.fullH + 20, radius + 10);
  ctx.fillStyle = "#fff6ee";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, area.x, area.y, area.w, area.fullH, radius);
  ctx.clip();

  if (!spec) {
    const g = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    g.addColorStop(0, "#2a1030");
    g.addColorStop(1, "#6a1830");
    ctx.fillStyle = g;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.fillStyle = "#fff6ee";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 54px Fredoka, system-ui, sans-serif";
    ctx.fillText("Your game", w / 2, h * 0.44);
    ctx.font = "500 28px Fredoka, system-ui, sans-serif";
    ctx.fillStyle = "#ffd0c4";
    ctx.fillText("shows up on this screen", w / 2, h * 0.56);
    ctx.restore();
    return;
  }

  const background = read(spec.scene?.background) || "castle";
  const g = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
  if (background === "garden") {
    g.addColorStop(0, "#9fd7ff");
    g.addColorStop(0.45, "#d7f0b8");
    g.addColorStop(1, "#67b85a");
  } else {
    g.addColorStop(0, "#241838");
    g.addColorStop(0.42, "#6d4c8a");
    g.addColorStop(1, "#d2b6ea");
  }
  ctx.fillStyle = g;
  ctx.fillRect(area.x, area.y, area.w, area.h);

  const bg = BACKGROUNDS[background] || BACKGROUNDS.castle;
  ctx.fillStyle = "rgba(255,246,238,0.92)";
  ctx.font = "700 22px Fredoka, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(bg.label, area.x + 16, area.y + 12);

  const hero = STICKERS[read(spec.hero)] || STICKERS.ghost;
  ctx.font = "72px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hero.emoji, area.x + area.w * 0.5, area.y + area.h * 0.2);

  const obstacle = spec.obstacles?.[0];
  const keyIn = obstacle ? read(obstacle.keyHidesIn) : "";
  const treasureIn = obstacle ? read(obstacle.treasureHidesIn) : "";
  const lockId = obstacle ? read(obstacle.lockId) : "";
  const showTags = view.mode === "edit" || view.mode === "ask";

  for (const object of spec.objects || []) {
    const sticker = STICKERS[object.asset] || STICKERS.door;
    const px = area.x + (object.x / 100) * area.w;
    const py = area.y + (object.y / 100) * area.h;
    ctx.fillStyle = "rgba(255,250,240,0.92)";
    roundRect(ctx, px - 46, py - 40, 92, showTags ? 92 : 78, 16);
    ctx.fill();
    ctx.font = "40px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1020";
    ctx.fillText(sticker.emoji, px, py - 8);
    ctx.font = "700 16px Fredoka, system-ui, sans-serif";
    ctx.fillText(object.name, px, py + 24);
    if (showTags) {
      const tags = [];
      if (object.id === keyIn) tags.push("key");
      if (object.id === treasureIn) tags.push("treasure");
      if (object.id === lockId) tags.push("lock");
      if (tags.length) {
        ctx.fillStyle = "#7b5ea7";
        ctx.font = "700 13px Fredoka, system-ui, sans-serif";
        ctx.fillText(tags.join(" · "), px, py + 42);
      }
    }
  }

  if (view.mode === "play" && chrome === 0) {
    const clue = view.clue || "";
    if (clue) {
      ctx.fillStyle = "rgba(255,246,238,0.94)";
      roundRect(ctx, area.x + 16, area.y + 8, area.w - 32, 54, 12);
      ctx.fill();
      ctx.fillStyle = "#3a2430";
      ctx.font = "700 20px Fredoka, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(trimLine(clue, 52), area.x + area.w / 2, area.y + 35);
    }
    const message = view.won ? "You did it!" : (view.message || "Tap a thing on the screen.");
    ctx.fillStyle = view.won ? "rgba(123, 191, 106, 0.95)" : "rgba(36, 16, 32, 0.78)";
    roundRect(ctx, area.x + 16, area.y + area.h - 58, area.w - 32, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#fffaf6";
    ctx.font = "700 20px Fredoka, system-ui, sans-serif";
    ctx.fillText(trimLine(message, 48), area.x + area.w / 2, area.y + area.h - 36);
  }

  if (area.dock > 0) {
    ctx.fillStyle = "#fff6ee";
    ctx.fillRect(area.x, area.y + area.h, area.w, area.dock + 2);
  }

  ctx.restore();
}

function trimLine(text, max) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
