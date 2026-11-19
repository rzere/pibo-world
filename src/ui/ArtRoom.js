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

const INK = "#3a2a24";

/**
 * Full-screen art room. The cottage studio fills the window. Pibo stands
 * on the rug, with the whole silhouette inside the frame. Choices are
 * icons, saved for the island too.
 *
 * STAGE is the spot on art-room.jpg (1280×720) where the feet stand.
 */
const STAGE = { x: 620, y: 590 };
export class ArtRoom {
  constructor({ root, onClose, onChange } = {}) {
    this.root = root;
    this.onClose = onClose || null;
    this.onChange = onChange || null;
    this.isOpen = false;
    this.look = loadLook();
    this.view = "front";
    this.sources = {};
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

    const tools = document.createElement("div");
    tools.className = "art-tools";
    tools.appendChild(this._row(POTS, "pot", potIcon));
    tools.appendChild(this._row(HAIRS, "hair", hairIcon));
    tools.appendChild(this._row(HATS, "hat", hatIcon));
    tools.appendChild(this._row(SCARVES, "scarf", scarfIcon));
    tools.appendChild(this._row(GLASSES, "glasses", glassesIcon));
    this.root.appendChild(tools);
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
    saveLook(this.look);
    this._paint();
    this.layout();
    this._mark();
    this.onChange?.(this.look);
  }

  _loadSources() {
    for (const [view, url] of Object.entries(FACE_SRC)) {
      const img = new Image();
      img.onload = () => {
        this.sources[view] = img;
        if (this.isOpen && this.view === view) {
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
    this.look = loadLook();
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
    if (tools && tools.width > 0 && tools.height > 0) {
      if (tools.left > vw * 0.4 && tools.top < vh * 0.4) safeRight = Math.min(safeRight, tools.left - 16);
      else if (tools.top > vh * 0.5) safeBottom = Math.min(safeBottom, tools.top - 12);
    }
    const stageX = ox + (imgW / 1280) * STAGE.x * cover;
    const stageY = oy + (imgH / 720) * STAGE.y * cover;
    const feetX = Math.min(Math.max(stageX, safeLeft + 48), Math.max(safeLeft + 48, safeRight - 48));
    const feetY = Math.min(Math.max(stageY, safeTop + 96), Math.max(safeTop + 96, safeBottom - 10));

    const bounds = this._bounds || {
      left: 0,
      top: 0,
      right: this.canvas.width || 645,
      bottom: this.canvas.height || 838,
    };
    const contentW = Math.max(1, bounds.right - bounds.left);
    const contentH = Math.max(1, bounds.bottom - bounds.top);
    const midX = (bounds.left + bounds.right) / 2;
    const roomAbove = Math.max(48, feetY - safeTop);
    const roomLeft = Math.max(24, feetX - safeLeft);
    const roomRight = Math.max(24, safeRight - feetX);
    // Leave air around the outline so the frame never chops the silhouette.
    const fitted = Math.min(
      roomAbove / contentH,
      roomLeft / Math.max(1, midX - bounds.left),
      roomRight / Math.max(1, bounds.right - midX),
    ) * 0.88;
    const left = feetX - midX * fitted;
    const top = feetY - bounds.bottom * fitted;
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

  _measure() {
    const canvas = this.canvas;
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
    const source = this.sources[this.view];
    if (!source) return;
    paintLook(source, this.look || DEFAULT_LOOK, this.canvas, this.view);
    this._bounds = this._measure();
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
