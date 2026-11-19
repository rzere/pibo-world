import { DEFAULT_LOOK, loadLook } from "../entities/piboLook.js";
import { loadLibraryLog } from "../systems/libraryLog.js";

/**
 * Full-screen trophy room. One painted mushroom interior, with the prizes
 * as separate sprites. Nothing on screen is a word: the exit is the same
 * arrow button as the art room. A few prizes light up from saves that
 * already exist (a changed look, an arcade spec, a library story). The
 * rest stay dim so there is room to grow.
 *
 * x and y are the spot on trophy-room.jpg (1280×720) where the sprite
 * sits. w is the sprite width in those same pixels.
 */
const ARCADE_SPEC_KEY = "pibo.arcade.spec";

const SLOTS = [
  { id: "shelf-star", src: "assets/painted/trophies/medal-star.png", x: 255, y: 400, w: 62, unlock: "always", delay: "0s" },
  { id: "shelf-medal", src: "assets/painted/trophies/medal-blue.png", x: 322, y: 404, w: 52, unlock: "library", delay: "0.4s" },
  { id: "shelf-rose", src: "assets/painted/trophies/rosette.png", x: 908, y: 404, w: 74, unlock: "art", delay: "0.8s" },
  { id: "shelf-wait", src: "assets/painted/trophies/medal-star.png", x: 1028, y: 412, w: 60, unlock: "locked", delay: "1.1s" },
  { id: "pad-silver", src: "assets/painted/trophies/cup-silver.png", x: 410, y: 508, w: 108, unlock: "arcade", delay: "0.2s" },
  { id: "pad-gold", src: "assets/painted/trophies/cup-gold.png", x: 640, y: 492, w: 124, unlock: "always", delay: "0.6s" },
  { id: "pad-bronze", src: "assets/painted/trophies/cup-bronze.png", x: 862, y: 504, w: 104, unlock: "locked", delay: "1.3s" },
];

const INK = "#3a2a24";

export class TrophyRoom {
  constructor({ root, onClose } = {}) {
    this.root = root;
    this.onClose = onClose || null;
    this.isOpen = false;
    this.slots = [];
    this._build();
  }

  _build() {
    this.root.innerHTML = "";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Trophy room");

    const bg = document.createElement("img");
    bg.className = "trophy-bg";
    bg.alt = "";
    bg.src = "assets/painted/trophy-room.jpg";
    bg.addEventListener("load", () => this.layout());
    this.bg = bg;
    this.root.appendChild(bg);

    for (const slot of SLOTS) {
      const el = document.createElement("div");
      el.className = "trophy-slot";
      el.style.animationDelay = slot.delay;
      const img = document.createElement("img");
      img.className = "trophy-sprite";
      img.alt = "";
      img.draggable = false;
      img.src = slot.src;
      const shadow = document.createElement("span");
      shadow.className = "trophy-shadow";
      el.append(img, shadow);
      this.root.appendChild(el);
      this.slots.push({ ...slot, el });
    }

    const back = document.createElement("button");
    back.type = "button";
    back.className = "art-back";
    back.setAttribute("aria-label", "Back");
    back.innerHTML = arrowIcon();
    back.addEventListener("click", () => this.onClose?.());
    this.root.appendChild(back);
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this._mark();
    this.layout();
  }

  close() {
    this.isOpen = false;
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
  }

  layout() {
    if (!this.isOpen) return;
    const vw = this.root.clientWidth || window.innerWidth;
    const vh = this.root.clientHeight || window.innerHeight;
    const imgW = this.bg.naturalWidth || 1280;
    const imgH = this.bg.naturalHeight || 720;
    const cover = Math.max(vw / imgW, vh / imgH);
    const ox = (vw - imgW * cover) / 2;
    const oy = (vh - imgH * cover) / 2;
    const sx = imgW / 1280;
    const sy = imgH / 720;
    for (const slot of this.slots) {
      const x = ox + slot.x * sx * cover;
      const y = oy + slot.y * sy * cover;
      const w = slot.w * sx * cover;
      slot.el.style.left = `${x}px`;
      slot.el.style.top = `${y}px`;
      slot.el.style.width = `${w}px`;
    }
  }

  _mark() {
    const have = readUnlocks();
    for (const slot of this.slots) {
      const on = !!have[slot.unlock];
      slot.el.classList.toggle("is-locked", !on);
    }
  }
}

function readUnlocks() {
  const look = loadLook();
  const art = Object.keys(DEFAULT_LOOK).some((key) => look[key] !== DEFAULT_LOOK[key]);
  let arcade = false;
  try {
    arcade = !!localStorage.getItem(ARCADE_SPEC_KEY);
  } catch {
    arcade = false;
  }
  let library = false;
  try {
    library = loadLibraryLog().events.length > 0;
  } catch {
    library = false;
  }
  return { always: true, art, arcade, library, locked: false };
}

function arrowIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 12L16 24l12 12" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
