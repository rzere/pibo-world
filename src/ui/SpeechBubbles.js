import * as THREE from "three";

const LIFE = 6;
const FADE = 0.5;

/**
 * Chat bubbles over characters' heads. They are HTML so the words stay sharp.
 * Each frame the speaker's anchor gives a screen point (the top of a sprite
 * on the island, or of a walker in a painted room), or null to hide.
 * One bubble per speaker: a new message replaces the old one.
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
    let bubble = this.bubbles.get(key);
    if (!bubble) {
      const node = document.createElement("div");
      node.className = "speech";
      this.layer.append(node);
      bubble = { node };
      this.bubbles.set(key, bubble);
    }
    bubble.node.textContent = text;
    bubble.node.classList.toggle("emoji", isOnlyEmoji(text));
    bubble.t = LIFE;
    bubble.anchor = anchor;
  }

  clear() {
    for (const bubble of this.bubbles.values()) bubble.node.remove();
    this.bubbles.clear();
  }

  /** Screen point at the top of an island sprite, or null if it is hidden. */
  meshTop(mesh, top = 0.5) {
    if (!mesh || !shown(mesh)) return null;
    const v = this._v.set(0, (mesh.geometry.parameters?.height || 1) * top, 0);
    mesh.localToWorld(v);
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  update(dt) {
    for (const [key, bubble] of this.bubbles) {
      bubble.t -= dt;
      if (bubble.t <= 0) {
        bubble.node.remove();
        this.bubbles.delete(key);
        continue;
      }
      const p = bubble.anchor?.();
      if (!p) {
        bubble.node.style.display = "none";
        continue;
      }
      bubble.node.style.display = "";
      bubble.node.style.left = `${p.x}px`;
      bubble.node.style.top = `${p.y}px`;
      bubble.node.style.opacity = String(Math.min(1, bubble.t / FADE));
    }
  }
}

function shown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function isOnlyEmoji(text) {
  return /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u.test(text) && !/[0-9#*]/.test(text);
}
