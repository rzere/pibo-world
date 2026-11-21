import * as THREE from "three";
import { morphBubble, typingDots } from "./typingDots.js";

const LIFE = 6;
const FADE = 0.5;

/**
 * Chat bubbles over characters' heads. They are HTML so the words stay sharp.
 * One bubble per speaker: a new message replaces the old one.
 * Animals can show three dots first (thinking, or typing before a line).
 */
export class SpeechBubbles {
  constructor({ camera, canvas, root = document.getElementById("ui") }) {
    this.camera = camera;
    this.canvas = canvas;
    this.layer = document.createElement("div");
    this.layer.className = "speech-layer";
    root.append(this.layer);
    this.bubbles = new Map();
    this._v = new THREE.Vector3();
  }

  say(key, text, anchor) {
    const bubble = this._ensure(key);
    bubble.phase = "text";
    bubble.sticky = false;
    bubble.t = LIFE;
    bubble.anchor = anchor;
    bubble.node.classList.remove("is-typing");
    bubble.node.classList.toggle("emoji", isOnlyEmoji(text));
    bubble.node.removeAttribute("aria-hidden");
    bubble.node.style.width = "";
    bubble.node.style.height = "";
    bubble.text.textContent = text;
    this._place(bubble);
  }

  /** Dots only, while an animal chatters with nothing to say yet. Refresh each frame. */
  think(key, anchor) {
    const bubble = this._ensure(key);
    bubble.anchor = anchor;
    bubble.hold = 0.32;
    bubble.sticky = false;
    if (bubble.phase !== "thinking") {
      bubble.phase = "thinking";
      bubble.node.classList.add("is-typing");
      bubble.node.classList.remove("emoji");
      bubble.text.textContent = "";
      bubble.node.setAttribute("aria-hidden", "true");
      bubble.node.style.width = "";
      bubble.node.style.height = "";
      bubble.node.style.opacity = "1";
    }
    this._place(bubble);
  }

  /** Dots that stay until showText or dismiss. A fresh bubble pops in at dot size. */
  showDots(key, anchor) {
    let bubble = this.bubbles.get(key);
    if (bubble && bubble.phase !== "dots") {
      bubble.node.remove();
      this.bubbles.delete(key);
      bubble = null;
    }
    bubble = bubble || this._ensure(key);
    bubble.anchor = anchor;
    bubble.sticky = true;
    bubble.phase = "dots";
    bubble.node.style.opacity = "1";
    if (!bubble.node.classList.contains("is-typing")) {
      bubble.node.classList.add("is-typing");
      bubble.node.classList.remove("emoji");
      bubble.text.textContent = "";
      bubble.node.setAttribute("aria-hidden", "true");
      bubble.node.style.width = "";
      bubble.node.style.height = "";
    }
    this._place(bubble);
  }

  /** Dots become this line. Sticky lines stay up until dismiss. */
  showText(key, text, anchor, { sticky = false } = {}) {
    const bubble = this._ensure(key);
    if (anchor) bubble.anchor = anchor;
    bubble.sticky = !!sticky;
    bubble.phase = "text";
    bubble.t = LIFE;
    bubble.node.classList.toggle("emoji", isOnlyEmoji(text));
    bubble.node.removeAttribute("aria-hidden");
    if (bubble.node.classList.contains("is-typing")) morphBubble(bubble.node, bubble.text, text);
    else {
      bubble.node.classList.remove("is-typing");
      bubble.node.style.width = "";
      bubble.node.style.height = "";
      bubble.text.textContent = text;
    }
    this._place(bubble);
  }

  dismiss(key) {
    const bubble = this.bubbles.get(key);
    if (!bubble) return;
    bubble.sticky = false;
    bubble.phase = "bye";
    bubble.t = Math.min(bubble.t || FADE, FADE);
  }

  remove(key) {
    const bubble = this.bubbles.get(key);
    if (!bubble) return;
    bubble.node.remove();
    this.bubbles.delete(key);
  }

  clear() {
    for (const bubble of this.bubbles.values()) bubble.node.remove();
    this.bubbles.clear();
  }

  /** Screen point at the top of an island sprite, or null if it is hidden. */
  meshTop(mesh, top = 0.5) {
    if (!mesh || !shown(mesh)) return null;
    this.camera.updateMatrixWorld();
    const v = this._v.set(0, (mesh.geometry.parameters?.height || 1) * top, 0);
    mesh.localToWorld(v);
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  update(dt) {
    for (const [key, bubble] of this.bubbles) {
      if (bubble.phase === "thinking") {
        bubble.hold -= dt;
        if (bubble.hold <= 0) {
          bubble.phase = "bye";
          bubble.t = FADE;
        }
      }
      const fading = bubble.phase === "bye" || (bubble.phase === "text" && !bubble.sticky);
      if (fading) {
        bubble.t -= dt;
        if (bubble.t <= 0) {
          bubble.node.remove();
          this.bubbles.delete(key);
          continue;
        }
      }
      this._place(bubble);
      const alpha = fading ? Math.min(1, bubble.t / FADE) : 1;
      bubble.node.style.opacity = String(alpha);
    }
  }

  _ensure(key) {
    let bubble = this.bubbles.get(key);
    if (bubble) return bubble;
    const node = document.createElement("div");
    node.className = "speech";
    const text = document.createElement("span");
    text.className = "speech-text";
    node.append(typingDots(), text);
    this.layer.append(node);
    bubble = {
      node,
      text,
      phase: "text",
      sticky: false,
      t: LIFE,
      hold: 0,
      anchor: null,
    };
    this.bubbles.set(key, bubble);
    return bubble;
  }

  _place(bubble) {
    const p = bubble.anchor?.();
    if (!p) {
      bubble.node.style.display = "none";
      return;
    }
    bubble.node.style.display = "";
    bubble.node.style.left = `${p.x}px`;
    bubble.node.style.top = `${p.y}px`;
  }
}

function shown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function isOnlyEmoji(text) {
  return /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u.test(text) && !/[0-9#*]/.test(text);
}
