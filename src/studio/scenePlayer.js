import { CHARACTERS, SCENE_SECONDS } from "./scene.js";
import { getCharacter } from "../data/characters.js";

/**
 * Animate a cleaned scene (see scene.js) onto a 640×360 canvas, as a studio
 * clip: { kind: "canvas", canvas, draw(t) }. The cartoon loops.
 */
const W = 640;
const H = 360;
const GROUND = H * 0.76;
const FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function createSceneClip(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const images = {};
  for (const a of scene.actors) {
    if (CHARACTERS.includes(a.who) && !images[a.who]) {
      const img = new Image();
      img.src = getCharacter(a.who).thumb;
      images[a.who] = img;
    }
  }
  const draw = (t) => drawScene(ctx, scene, images, ((t % SCENE_SECONDS) + SCENE_SECONDS) % SCENE_SECONDS, t);
  return {
    kind: "canvas",
    canvas,
    draw,
    caption: scene.caption,
    duration: SCENE_SECONDS,
    demo: false,
    provider: "claude",
  };
}

const DUR = { walk: 1.5, fly: 1.5, land: 1, jump: 0.7, spin: 0.9, wiggle: 1, dance: 2, grow: 0.6, shrink: 0.6, hide: 0.4, show: 0.4, say: 2.4 };

function actorState(a, beats, tt) {
  const s = { x: a.x, y: a.y, size: a.size, alpha: a.hidden ? 0 : 1, face: 1, rot: 0, hop: 0, moving: false, say: "" };
  for (const b of beats) {
    if (b.actor !== a.id || b.t > tt) continue;
    const d = DUR[b.do] || 1;
    const p = Math.min(1, (tt - b.t) / d);
    const e = ease(p);
    const live = p < 1;
    switch (b.do) {
      case "walk":
        if (b.to != null) {
          if (b.to !== s.x) s.face = b.to > s.x ? 1 : -1;
          s.x += (b.to - s.x) * e;
          if (live) {
            s.moving = true;
            s.hop = Math.abs(Math.sin((tt - b.t) * 12)) * 0.03;
          }
        }
        break;
      case "fly":
        if (b.to != null) {
          if (b.to !== s.x) s.face = b.to > s.x ? 1 : -1;
          s.x += (b.to - s.x) * e;
        }
        s.y += ((b.y ?? 0.5) - s.y) * e;
        break;
      case "land":
        s.y += (0 - s.y) * e;
        break;
      case "jump":
        if (live) s.hop = Math.sin(Math.PI * p) * 0.2;
        break;
      case "spin":
        if (live) s.rot = Math.PI * 2 * e;
        break;
      case "wiggle":
        if (live) s.rot = Math.sin(p * Math.PI * 6) * 0.25;
        break;
      case "dance":
        if (live) {
          s.rot = Math.sin(p * Math.PI * 8) * 0.3;
          s.hop = Math.abs(Math.sin(p * Math.PI * 8)) * 0.06;
          s.face = Math.sin(p * Math.PI * 4) > 0 ? 1 : -1;
        }
        break;
      case "grow":
        s.size *= 1 + 0.5 * e;
        break;
      case "shrink":
        s.size *= 1 - 0.35 * e;
        break;
      case "hide":
        s.alpha *= 1 - e;
        break;
      case "show":
        s.alpha += (1 - s.alpha) * e;
        break;
      case "say":
        if (live && b.text) s.say = b.text;
        break;
    }
  }
  return s;
}

function drawScene(ctx, scene, images, tt, tAll) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, scene.sky[0]);
  g.addColorStop(1, scene.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = scene.ground;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, GROUND, W, 6);

  const props = scene.props;
  const spots = [0.07, 0.27, 0.73, 0.93, 0.5, 0.15];
  props.forEach((p, i) => {
    const sky = i >= 4;
    emoji(ctx, p, spots[i] * W, sky ? 46 + i * 8 : GROUND - 18, sky ? 26 : 44, 0.9);
  });

  weather(ctx, scene.weather, tAll);

  const states = scene.actors.map((a) => ({ a, s: actorState(a, scene.beats, tt) }));
  states.sort((p, q) => q.s.y - p.s.y || p.s.size - q.s.size);
  for (const { a, s } of states) {
    if (s.alpha <= 0.01) continue;
    const px = s.x * W;
    const py = GROUND + 6 - (s.y + s.hop) * (GROUND - 50) - Math.sin(tAll * 2.2 + px) * 1.5;
    const h = 72 * s.size;
    ctx.save();
    ctx.globalAlpha = s.alpha;
    if (s.y < 0.05) {
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.ellipse(px, GROUND + 8, h * 0.32, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(px, py - h / 2);
    ctx.rotate(s.rot);
    ctx.scale(s.face, 1);
    const img = images[a.who];
    if (img) {
      if (img.complete && img.naturalWidth) {
        const w = (h * img.naturalWidth) / img.naturalHeight;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    } else {
      emoji(ctx, a.who, 0, 4, h * 0.95, 1);
    }
    ctx.restore();
    if (s.say && s.alpha > 0.5) bubble(ctx, s.say, px, py - h - 6);
  }

  ctx.fillStyle = "rgba(40, 28, 24, 0.72)";
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = "#fff7ec";
  ctx.font = "600 19px Fredoka, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(scene.caption, W / 2, H - 20, W - 30);
}

function weather(ctx, kind, t) {
  if (kind === "none") return;
  for (let i = 0; i < 36; i++) {
    const r1 = rand(i * 7.1);
    const r2 = rand(i * 3.3 + 1);
    const speed = 0.4 + r2 * 0.6;
    if (kind === "rain") {
      const y = ((r2 * H + t * 320 * speed) % (GROUND + 20)) - 20;
      const x = r1 * W;
      ctx.strokeStyle = "rgba(90, 140, 220, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 12);
      ctx.stroke();
    } else if (kind === "confetti") {
      const y = ((r2 * H + t * 90 * speed) % (GROUND + 20)) - 20;
      const x = r1 * W + Math.sin(t * 3 + i) * 10;
      ctx.fillStyle = ["#ff6f91", "#ffd15c", "#7cc4ff", "#8be08b", "#b18cff"][i % 5];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 4 + i);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    } else {
      const map = { snow: "❄️", stars: "⭐", hearts: "💖", leaves: "🍂", bubbles: "🫧", sparkles: "✨" };
      const e = map[kind];
      if (!e) return;
      const up = kind === "hearts" || kind === "bubbles";
      const still = kind === "stars" || kind === "sparkles";
      let y = still ? r2 * GROUND * 0.7 : ((r2 * H + t * 40 * speed) % (GROUND + 20)) - 20;
      if (up) y = GROUND - y;
      const x = r1 * W + (still ? 0 : Math.sin(t * 1.5 + i) * 14);
      const a = still ? 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)) : 0.85;
      emoji(ctx, e, x, y, 14 + r1 * 10, a);
    }
  }
}

function bubble(ctx, text, x, y) {
  ctx.font = "600 17px Fredoka, system-ui, sans-serif";
  const w = Math.min(W - 20, ctx.measureText(text).width + 24);
  const bx = Math.min(W - w - 8, Math.max(8, x - w / 2));
  const by = Math.max(8, y - 34);
  ctx.fillStyle = "#fffaf0";
  ctx.strokeStyle = "#5c4a3e";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, 32, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, by + 31);
  ctx.lineTo(x, by + 42);
  ctx.lineTo(x + 6, by + 31);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a2a24";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + w / 2, by + 16, w - 12);
}

function emoji(ctx, e, x, y, size, alpha) {
  ctx.globalAlpha = alpha;
  ctx.font = `${Math.round(size)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, x, y);
  ctx.globalAlpha = 1;
}

function ease(p) {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

function rand(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
