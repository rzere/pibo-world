import { RoomFloor } from "./RoomFloor.js";
import { earnedTrophies } from "../market/progress.js";

/**
 * Your own room, inside the mushroom house. One painted interior with a few
 * trophies, things you choose for the free stools and shelves, a rug color
 * and a light. Friends you invite walk around it with you. Visitors see the
 * owner's decoration, never their own.
 *
 * x and y are the spot on trophy-room.jpg (1280×720) where a sprite sits;
 * w is its width in those pixels. Floor positions are those pixels / 100.
 */
const TROPHIES = [
  { id: "star", src: "assets/painted/trophies/medal-star.png", x: 255, y: 400, w: 62, delay: "0s" },
  { id: "gold", src: "assets/painted/trophies/cup-gold.png", x: 640, y: 492, w: 124, delay: "0.6s" },
  { id: "rosette", src: "assets/painted/trophies/rosette.png", x: 908, y: 404, w: 74, delay: "0.8s" },
];

/** Pibo Market trophies stand in the window box, one per finished level. */
const MARKET_SPOTS = [
  { x: 548, y: 404, w: 64 },
  { x: 640, y: 400, w: 64 },
  { x: 732, y: 404, w: 64 },
];

/** Free spots for decoration: two stools, two shelf ends. */
const SPOTS = [
  { x: 412, y: 500, size: 84 },
  { x: 864, y: 500, size: 84 },
  { x: 328, y: 400, size: 64 },
  { x: 1030, y: 404, size: 64 },
];

export const DECOR_ITEMS = ["🪴", "🧸", "🎸", "📚", "🐠", "🎁", "🕯️", "🌻", "🦖", "🎨", "🪀", "🚀"];
export const RUGS = [
  { id: "green", color: null, label: "Green" },
  { id: "pink", color: "#ff8fc2", label: "Pink" },
  { id: "blue", color: "#7cc4ff", label: "Blue" },
  { id: "sun", color: "#ffd15c", label: "Yellow" },
  { id: "grape", color: "#b18cff", label: "Purple" },
];
const DEFAULT_DECOR = { items: ["🪴", "🧸"], rug: "green", light: "day" };
const DECOR_KEY = "pibo.myroom";
const MAX_ITEMS = SPOTS.length;

const FLOOR = { left: 1.0, right: 11.8, top: 5.3, bottom: 6.95 };
const BLOCKS = [
  { left: 1.2, right: 2.35, bottom: 5.8 }, // plant
  { left: 3.35, right: 4.95, bottom: 5.55 }, // left stool
  { left: 5.6, right: 7.25, bottom: 5.55 }, // middle stool
  { left: 7.75, right: 9.35, bottom: 5.55 }, // right stool
];

const INK = "#3a2a24";

export function cleanDecor(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(d.items) ? d.items.filter((x) => DECOR_ITEMS.includes(x)).slice(0, MAX_ITEMS) : DEFAULT_DECOR.items;
  return {
    items,
    rug: RUGS.some((r) => r.id === d.rug) ? d.rug : DEFAULT_DECOR.rug,
    light: d.light === "cozy" ? "cozy" : "day",
  };
}

export function loadDecor() {
  try {
    return cleanDecor(JSON.parse(localStorage.getItem(DECOR_KEY) || "null") || DEFAULT_DECOR);
  } catch {
    return cleanDecor(DEFAULT_DECOR);
  }
}

function saveDecor(decor) {
  try {
    localStorage.setItem(DECOR_KEY, JSON.stringify(decor));
  } catch {
    /* private mode */
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export class TrophyRoom {
  constructor({ root, onClose, onDecor } = {}) {
    this.root = root;
    this.onClose = onClose || null;
    this.onDecor = onDecor || null;
    this.isOpen = false;
    this.mine = true;
    this.decor = loadDecor();
    this._build();
  }

  _build() {
    this.root.innerHTML = "";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "My room");

    const bg = el("img", "trophy-bg");
    bg.alt = "";
    bg.src = "assets/painted/trophy-room.jpg";
    bg.addEventListener("load", () => this.layout());
    this.bg = bg;
    this.root.appendChild(bg);

    this.rug = el("div", "room-rug");
    this.root.appendChild(this.rug);

    this.placed = [];
    for (const t of TROPHIES) {
      const node = el("div", "trophy-slot");
      node.style.animationDelay = t.delay;
      const img = el("img", "trophy-sprite");
      img.alt = "";
      img.draggable = false;
      img.src = t.src;
      node.append(img, el("span", "trophy-shadow"));
      this.root.appendChild(node);
      this.placed.push({ ...t, el: node });
    }
    this.market = MARKET_SPOTS.map((spot) => {
      const node = el("div", "trophy-slot hidden");
      const img = el("img", "trophy-sprite");
      img.alt = "";
      img.draggable = false;
      node.append(img, el("span", "trophy-shadow"));
      this.root.appendChild(node);
      return { ...spot, el: node, img };
    });

    this.spots = SPOTS.map((s) => {
      const node = el("div", "room-thing");
      this.root.appendChild(node);
      return { ...s, el: node };
    });

    this.night = el("div", "room-night");
    this.root.appendChild(this.night);

    this.floor = new RoomFloor({
      root: this.root,
      bg,
      floor: FLOOR,
      blocks: BLOCKS,
      spawn: { x: 6.4, y: 6.35, spreadX: 2.2, spreadY: 0.4 },
    });

    const back = el("button", "art-back");
    back.type = "button";
    back.setAttribute("aria-label", "Back");
    back.innerHTML = arrowIcon();
    back.addEventListener("click", () => this.onClose?.());
    this.root.appendChild(back);

    this.decorBtn = el("button", "hall-build room-decorate", "🎨 Decorate");
    this.decorBtn.type = "button";
    this.decorBtn.addEventListener("click", () => this._togglePanel());
    this.root.appendChild(this.decorBtn);

    this.panel = el("div", "room-panel hidden");
    this.root.appendChild(this.panel);
  }

  /** owner: { mine, name, decor } */
  open({ mine = true, decor = null } = {}) {
    this.isOpen = true;
    this.mine = mine;
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this.decorBtn.classList.toggle("hidden", !mine);
    this.panel.classList.add("hidden");
    this.show(mine ? this.decor : cleanDecor(decor));
    const earned = mine ? earnedTrophies() : [];
    this.market.forEach((spot, i) => {
      const t = earned[i];
      spot.el.classList.toggle("hidden", !t);
      if (t) {
        spot.img.src = t.src;
        spot.el.title = t.title;
      }
    });
  }

  close() {
    this.isOpen = false;
    this.panel.classList.add("hidden");
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
    this.floor.clearWalkers();
  }

  get busy() {
    return false;
  }

  /* floor contract (same as the art room) */
  spawnPoint() { return this.floor.spawnPoint(); }
  moveOnFloor(x, y, dx, dy) { return this.floor.moveOnFloor(x, y, dx, dy); }
  renderWalkers(list, dt) { this.floor.renderWalkers(list, dt); }
  clearWalkers() { this.floor.clearWalkers(); }
  walkerTop(id) { return this.floor.walkerTop(id); }

  /** Draw a decoration (yours, or the owner's when visiting). */
  show(decor) {
    this.shown = cleanDecor(decor);
    this.spots.forEach((spot, i) => {
      const item = this.shown.items[i];
      spot.el.textContent = item || "";
      spot.el.classList.toggle("hidden", !item);
    });
    const rug = RUGS.find((r) => r.id === this.shown.rug);
    this.rug.style.background = rug?.color || "transparent";
    this.root.classList.toggle("is-cozy", this.shown.light === "cozy");
    this.layout();
  }

  _set(change) {
    this.decor = cleanDecor({ ...this.decor, ...change });
    saveDecor(this.decor);
    this.show(this.decor);
    this._renderPanel();
    this.onDecor?.(this.decor);
  }

  _togglePanel() {
    const open = this.panel.classList.contains("hidden");
    if (open) this._renderPanel();
    this.panel.classList.toggle("hidden", !open);
  }

  _renderPanel() {
    const d = this.decor;
    const card = el("div", "room-panel-card");
    card.append(el("div", "lobby-label", `Things (up to ${MAX_ITEMS})`));
    const things = el("div", "room-things");
    for (const item of DECOR_ITEMS) {
      const on = d.items.includes(item);
      const b = el("button", `room-pick${on ? " on" : ""}`, item);
      b.type = "button";
      b.addEventListener("click", () => {
        const items = on ? d.items.filter((x) => x !== item) : [...d.items, item].slice(-MAX_ITEMS);
        this._set({ items });
      });
      things.appendChild(b);
    }
    card.appendChild(things);

    card.append(el("div", "lobby-label", "Rug"));
    const rugs = el("div", "room-things");
    for (const r of RUGS) {
      const b = el("button", `room-swatch${d.rug === r.id ? " on" : ""}`);
      b.type = "button";
      b.title = r.label;
      b.style.background = r.color || "#9fcf7a";
      b.addEventListener("click", () => this._set({ rug: r.id }));
      rugs.appendChild(b);
    }
    card.appendChild(rugs);

    card.append(el("div", "lobby-label", "Light"));
    const lights = el("div", "hall-chips");
    for (const [id, label] of [["day", "☀️ Day"], ["cozy", "🌙 Cozy night"]]) {
      const b = el("button", `hall-chip${d.light === id ? " on" : ""}`, label);
      b.type = "button";
      b.addEventListener("click", () => this._set({ light: id }));
      lights.appendChild(b);
    }
    card.appendChild(lights);
    this.panel.replaceChildren(card);
  }

  layout() {
    if (!this.isOpen) return;
    const vw = this.root.clientWidth || window.innerWidth;
    const vh = this.root.clientHeight || window.innerHeight;
    const imgW = this.bg.naturalWidth || 1280;
    const imgH = this.bg.naturalHeight || 720;
    const cover = Math.max(vw / imgW, vh / imgH) * (imgW / 1280);
    const ox = (vw - 1280 * cover) / 2;
    const oy = (vh - 720 * cover) / 2;
    for (const t of this.placed) {
      t.el.style.left = `${ox + t.x * cover}px`;
      t.el.style.top = `${oy + t.y * cover}px`;
      t.el.style.width = `${t.w * cover}px`;
    }
    for (const t of this.market) {
      t.el.style.left = `${ox + t.x * cover}px`;
      t.el.style.top = `${oy + t.y * cover}px`;
      t.el.style.width = `${t.w * cover}px`;
    }
    for (const s of this.spots) {
      s.el.style.left = `${ox + s.x * cover}px`;
      s.el.style.top = `${oy + s.y * cover}px`;
      s.el.style.fontSize = `${s.size * cover}px`;
    }
    const rx = 232;
    const ry = 72;
    Object.assign(this.rug.style, {
      left: `${ox + (637 - rx) * cover}px`,
      top: `${oy + (621 - ry) * cover}px`,
      width: `${rx * 2 * cover}px`,
      height: `${ry * 2 * cover}px`,
    });
  }
}

function arrowIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 12L16 24l12 12" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
