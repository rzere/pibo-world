import {
  DEFAULT_LOOK,
  GLASSES,
  HAIRS,
  HATS,
  POTS,
  SCARVES,
  FACE_SRC,
  loadLook,
  onHairSprite,
  paintLook,
  saveLook,
} from "../entities/piboLook.js";
import { DEFAULT_CRITTER_LOOK, loadCritterLook, paintCritterLook, saveCritterLook } from "../entities/critterLook.js";
import { getCharacter } from "../data/characters.js";

const INK = "#3a2a24";

/**
 * Full-screen art room. The cottage studio fills the window. The character
 * the player joined as stands on the rug, with the whole silhouette inside
 * the frame. Pibo can change pot, hair, hat, scarf and glasses; an animal
 * keeps its own drawing and only tries on hats and glasses. Choices are
 * icons, saved for the island too.
 *
 * STAGE is the spot on art-room.jpg (1280×720) where the feet stand.
 */
const STAGE = { x: 620, y: 590 };
/** The animal drawings are small; paint them larger so hats stay crisp. */
const CRITTER_PAINT_SCALE = 5;
/** Headroom above the plain body, so the tallest hat fits without shrinking anyone. */
const HAT_ROOM = 1.45;
export class ArtRoom {
  constructor({ root, onClose, onChange } = {}) {
    this.root = root;
    this.onClose = onClose || null;
    this.onChange = onChange || null;
    this.isOpen = false;
    this.charId = "pibo";
    this.look = loadLook();
    this.view = "front";
    this.sources = {};
    this.critterSource = null;
    this._build();
    this._loadSources();
    onHairSprite(() => {
      if (!this.isOpen) return;
      this._paint();
      this.layout();
    });
  }

  _build() {
    this.root.innerHTML = "";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Art room");

    const bg = document.createElement("img");
    bg.className = "art-bg";
    bg.alt = "";
    bg.src = "assets/painted/art-room.jpg";
    this.root.appendChild(bg);

    this.shadow = document.createElement("div");
    this.shadow.className = "art-shadow";
    this.root.appendChild(this.shadow);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "art-pibo";
    this.root.appendChild(this.canvas);

    const back = document.createElement("button");
    back.type = "button";
    back.className = "art-back";
    back.setAttribute("aria-label", "Back");
    back.innerHTML = arrowIcon();
    back.addEventListener("click", () => this.onClose?.());
    this.root.appendChild(back);

    this.tools = document.createElement("div");
    this.tools.className = "art-tools";
    this.root.appendChild(this.tools);
    this._buildTools();
  }

  _buildTools() {
    const tools = this.tools;
    tools.replaceChildren();
    if (this.charId === "pibo") {
      tools.appendChild(this._row(POTS, "pot", potIcon));
      tools.appendChild(this._row(HAIRS, "hair", hairIcon));
    }
    tools.appendChild(this._row(HATS, "hat", hatIcon));
    if (this.charId === "pibo") tools.appendChild(this._row(SCARVES, "scarf", scarfIcon));
    tools.appendChild(this._row(GLASSES, "glasses", glassesIcon));
  }

  /** Who the player joined as. Pibo, or one of the animals. */
  setCharacter(id) {
    const next = getCharacter(id).id;
    if (next === this.charId) return;
    this.charId = next;
    this.look = this._loadLook();
    this.critterSource = null;
    this._buildTools();
    this._loadSources();
    if (this.isOpen) {
      this._paint();
      this._mark();
      this.layout();
    }
  }

  _loadLook() {
    return this.charId === "pibo" ? loadLook() : loadCritterLook(this.charId);
  }

  _row(items, key, icon) {
    const row = document.createElement("div");
    row.className = "art-row";
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "art-choice";
      btn.dataset.group = key;
      btn.dataset.id = item.id;
      btn.setAttribute("aria-label", item.label);
      btn.innerHTML = icon(item);
      btn.addEventListener("click", () => this._pick(key, item.id));
      row.appendChild(btn);
    }
    return row;
  }

  _pick(key, id) {
    this.look = { ...this.look, [key]: id };
    if (this.charId === "pibo") saveLook(this.look);
    else saveCritterLook(this.charId, this.look);
    this._paint();
    this.layout();
    this._mark();
    this.onChange?.(this.look, this.charId);
  }

  _loadSources() {
    if (this.charId !== "pibo") {
      const charId = this.charId;
      const img = new Image();
      img.onload = () => {
        if (this.charId !== charId) return;
        this.critterSource = img;
        if (this.isOpen) {
          this._paint();
          this.layout();
        }
      };
      img.src = getCharacter(charId).def.frames[0];
      return;
    }
    for (const [view, url] of Object.entries(FACE_SRC)) {
      if (this.sources[view]) continue;
      const img = new Image();
      img.onload = () => {
        this.sources[view] = img;
        if (this.isOpen && this.charId === "pibo" && this.view === view) {
          this._paint();
          this.layout();
        }
      };
      img.src = url;
    }
  }

  open(view = this.view) {
    if (FACE_SRC[view]) this.view = view;
    this.isOpen = true;
    this.look = this._loadLook();
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this._paint();
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
    const bg = this.root.querySelector(".art-bg");
    const imgW = bg?.naturalWidth || 1280;
    const imgH = bg?.naturalHeight || 720;
    const cover = Math.max(vw / imgW, vh / imgH);
    const ox = (vw - imgW * cover) / 2;
    const oy = (vh - imgH * cover) / 2;
    const tools = this.root.querySelector(".art-tools")?.getBoundingClientRect();
    const margin = Math.max(18, Math.round(Math.min(vw, vh) * 0.035));
    let safeLeft = margin;
    let safeTop = margin;
    let safeRight = vw - margin;
    let safeBottom = vh - margin;
    const stageX = ox + (imgW / 1280) * STAGE.x * cover;
    const stageY = oy + (imgH / 720) * STAGE.y * cover;
    if (tools && tools.width > 0 && tools.height > 0) {
      const topRight = tools.left > vw * 0.4 && tools.top < vh * 0.4;
      // A tall column on the right narrows the stage; a short strip along the
      // top only lowers the ceiling, and only if the character stands under it.
      if (topRight && tools.bottom > vh * 0.6) safeRight = Math.min(safeRight, tools.left - 16);
      else if (topRight && stageX + 80 > tools.left) safeTop = Math.max(safeTop, tools.bottom + 12);
      else if (tools.top > vh * 0.5) safeBottom = Math.min(safeBottom, tools.top - 12);
    }
    const feetX = Math.min(Math.max(stageX, safeLeft + 48), Math.max(safeLeft + 48, safeRight - 48));
    const feetY = Math.min(Math.max(stageY, safeTop + 96), Math.max(safeTop + 96, safeBottom - 10));

    // Size and place by the plain body (no hat, default hair), never by the
    // outfit, so trying things on does not resize or shift the character.
    const body = this._body || {
      left: 0,
      top: 0,
      right: this.canvas.width || 645,
      bottom: this.canvas.height || 838,
    };
    const contentW = Math.max(1, body.right - body.left);
    const contentH = Math.max(1, body.bottom - body.top);
    const halfW = contentW / 2;
    const midX = (body.left + body.right) / 2;
    const roomAbove = Math.max(48, feetY - safeTop);
    const roomLeft = Math.max(24, feetX - safeLeft);
    const roomRight = Math.max(24, safeRight - feetX);
    // The animals are smaller than Pibo on the island, so they stand smaller here too.
    const fill = this.charId === "pibo" ? 0.88 : 0.6;
    const fitted = Math.min(
      roomAbove / (contentH * HAT_ROOM),
      roomLeft / (halfW * 1.3),
      roomRight / (halfW * 1.3),
    ) * fill;
    const left = feetX - midX * fitted;
    const top = feetY - body.bottom * fitted;
    this.canvas.style.width = `${this.canvas.width * fitted}px`;
    this.canvas.style.height = `${this.canvas.height * fitted}px`;
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    const sw = contentW * fitted * 0.62;
    const sh = Math.max(16, contentH * fitted * 0.07);
    this.shadow.style.width = `${sw}px`;
    this.shadow.style.height = `${sh}px`;
    this.shadow.style.left = `${feetX - sw / 2}px`;
    this.shadow.style.top = `${feetY - sh * 0.55}px`;
  }

  _measure(canvas = this.canvas) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return null;
    const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    let left = w;
    let top = h;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] < 16) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < 0) return { left: 0, top: 0, right: w, bottom: h };
    return {
      left: Math.max(0, left - 4),
      top: Math.max(0, top - 4),
      right: Math.min(w, right + 5),
      bottom: Math.min(h, bottom + 5),
    };
  }

  _paint() {
    if (this.charId !== "pibo") {
      if (!this.critterSource) return;
      const plain = paintCritterLook(this.critterSource, DEFAULT_CRITTER_LOOK, null, { scale: CRITTER_PAINT_SCALE });
      paintCritterLook(this.critterSource, this.look, this.canvas, { scale: CRITTER_PAINT_SCALE });
      this._body = this._placeBody(plain);
      return;
    }
    const source = this.sources[this.view];
    if (!source) return;
    const plain = paintLook(source, DEFAULT_LOOK, null, this.view);
    paintLook(source, this.look || DEFAULT_LOOK, this.canvas, this.view);
    this._body = this._placeBody(plain);
  }

  /**
   * Outfits only add canvas on top and evenly on both sides, so the plain
   * body sits at the same feet and center inside the dressed canvas.
   */
  _placeBody(plain) {
    const b = this._measure(plain);
    if (!b) return null;
    const dx = (this.canvas.width - plain.width) / 2;
    const dy = this.canvas.height - plain.height;
    return { left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy };
  }

  _mark() {
    for (const btn of this.root.querySelectorAll(".art-choice")) {
      const on = this.look[btn.dataset.group] === btn.dataset.id;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
}

function potIcon(item) {
  const color = item.color
    ? `rgb(${item.color.join(",")})`
    : "#ffd24a";
  if (item.pattern === "dots") {
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="${color}" stroke="${INK}" stroke-width="3"/><circle cx="18" cy="20" r="3" fill="#fff8ee"/><circle cx="28" cy="18" r="3" fill="#fff8ee"/><circle cx="24" cy="28" r="3" fill="#fff8ee"/></svg>`;
  }
  if (item.pattern === "stars") {
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="${color}" stroke="${INK}" stroke-width="3"/><path d="M24 12l2.2 6.2H33l-5.2 3.8 2 6.2L24 24.6 18.2 28.2l2-6.2L15 18.2h6.8z" fill="#ffe56a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="${color}" stroke="${INK}" stroke-width="3"/></svg>`;
}

function hairIcon(item) {
  const src = item.src || (item.id === "tuft" ? "assets/pibo/hair/tuft-icon.png" : "");
  if (!src) return noneIcon();
  return `<img src="${src}" alt="">`;
}

function hatIcon(item) {
  if (!item.src) return noneIcon();
  return `<img src="${item.src}" alt="">`;
}

function scarfIcon(item) {
  if (item.id === "none") return noneIcon();
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 16h32v10H8z" fill="${item.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M14 21h20v4H14z" fill="#fff6ee" opacity="0.85"/><path d="M30 22h7v14h-7z" fill="${item.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

function glassesIcon(item) {
  if (item.id === "none") return noneIcon();
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="16" width="14" height="12" rx="4" fill="${item.color}" stroke="${INK}" stroke-width="3"/><rect x="28" y="16" width="14" height="12" rx="4" fill="${item.color}" stroke="${INK}" stroke-width="3"/><path d="M20 22h8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function noneIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14" fill="#fff8ee" stroke="${INK}" stroke-width="3"/><path d="M16 16l16 16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function arrowIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 12L16 24l12 12" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
