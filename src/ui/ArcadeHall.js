import { RoomFloor } from "./RoomFloor.js";
import { DETAILS, GAME_TYPES, PLACES, buildRecipe, cleanRecipe } from "../arcade/spec.js";

/**
 * Shared arcade. Friends walk the floor together; anyone can build a game
 * from presets plus one sentence, and anyone can start it for everyone.
 * Floor coordinates are arcade-room.jpg pixels / 100.
 */
const FLOOR = { left: 0.4, right: 12.4, top: 5.05, bottom: 7.1 };
const BLOCKS = [
  { left: 4.55, right: 8.05, bottom: 5.25 }, // big cabinet
  { left: 8.9, right: 12.3, bottom: 5.75 }, // claw machine
];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export class ArcadeHall {
  constructor({ parent = document.getElementById("ui"), onClose, onBuild, onStart, getPlayers } = {}) {
    this.onClose = onClose || null;
    this.onBuild = onBuild || null;
    this.onStart = onStart || null;
    this.getPlayers = getPlayers || (() => []);
    this.isOpen = false;
    this.playing = false;
    this.pick = { type: "race", place: "island", details: {}, text: "" };

    const root = el("div", "art-overlay hall-overlay hidden");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Arcade");
    const bg = el("img", "art-bg");
    bg.alt = "";
    bg.src = "assets/painted/arcade-room.jpg";
    root.appendChild(bg);
    this.floor = new RoomFloor({
      root,
      bg,
      floor: FLOOR,
      blocks: BLOCKS,
      spawn: { x: 6.1, y: 6.2, spreadX: 2.6, spreadY: 0.6 },
    });

    const back = el("button", "art-back");
    back.type = "button";
    back.setAttribute("aria-label", "Back");
    back.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 12L16 24l12 12" fill="none" stroke="#3a2a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    back.addEventListener("click", () => this.onClose?.());
    root.appendChild(back);

    const panel = el("div", "hall-panel");
    const build = el("button", "hall-build", "🕹️ Build a game");
    build.type = "button";
    build.addEventListener("click", () => this.openBuilder());
    this.card = el("div", "hall-card hidden");
    panel.append(build, this.card);
    root.appendChild(panel);

    this.builder = el("div", "hall-builder hidden");
    root.appendChild(this.builder);

    parent.appendChild(root);
    this.root = root;
  }

  get busy() {
    return this.playing || !this.builder.classList.contains("hidden");
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove("hidden");
    document.documentElement.classList.add("in-hall");
  }

  close() {
    this.isOpen = false;
    this.closeBuilder();
    this.root.classList.add("hidden");
    document.documentElement.classList.remove("in-hall");
    this.floor.clearWalkers();
  }

  /* floor contract (same as the art room) */
  spawnPoint() { return this.floor.spawnPoint(); }
  moveOnFloor(x, y, dx, dy) { return this.floor.moveOnFloor(x, y, dx, dy); }
  renderWalkers(list, dt) { this.floor.renderWalkers(list, dt); }
  clearWalkers() { this.floor.clearWalkers(); }
  walkerTop(id) { return this.floor.walkerTop(id); }

  /** The game everyone in the hall can start. */
  setGame(recipe, byName) {
    this.card.replaceChildren();
    if (!recipe) {
      this.card.classList.add("hidden");
      return;
    }
    const type = GAME_TYPES.find((g) => g.id === recipe.type);
    const title = el("div", "hall-card-title", `${type?.emoji || "🎮"} ${recipe.title}`);
    const by = el("div", "hall-card-by", `by ${byName || "a friend"}${recipe.ai ? " · made with Claude ✨" : ""}`);
    const intro = el("div", "hall-card-intro", recipe.intro);
    const start = el("button", "lobby-go hall-start", "▶ Start for everyone");
    start.type = "button";
    start.addEventListener("click", () => this.onStart?.());
    this.card.append(title, by, intro, start);
    this.card.classList.remove("hidden");
  }

  openBuilder() {
    this._renderBuilder();
    this.builder.classList.remove("hidden");
  }

  closeBuilder() {
    this.builder.classList.add("hidden");
  }

  _renderBuilder(status = "") {
    const p = this.pick;
    const card = el("div", "hall-builder-card");
    const close = el("button", "map-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => this.closeBuilder());
    card.append(close, el("div", "lobby-kicker", "Arcade"), el("h2", "lobby-title", "Build a game"));

    card.append(el("div", "lobby-label", "Type of game"));
    const types = el("div", "hall-types");
    for (const g of GAME_TYPES) {
      const b = el("button", `hall-type${p.type === g.id ? " on" : ""}`);
      b.type = "button";
      b.append(el("span", "hall-type-emoji", g.emoji), el("b", null, g.label), el("small", null, g.blurb));
      b.addEventListener("click", () => {
        p.type = g.id;
        p.details = {};
        this._renderBuilder();
      });
      types.appendChild(b);
    }
    card.appendChild(types);

    card.append(el("div", "lobby-label", "Where"));
    card.appendChild(this._chips(PLACES.map((x) => ({ id: x.id, label: `${x.emoji} ${x.label}` })), p.place, (id) => {
      p.place = id;
    }));

    for (const group of DETAILS[p.type]) {
      card.append(el("div", "lobby-label", group.label));
      const current = p.details[group.id] || group.options[0].id;
      card.appendChild(this._chips(group.options, current, (id) => {
        p.details[group.id] = id;
      }));
    }

    card.append(el("div", "lobby-label", "Your idea (optional)"));
    const text = el("textarea", "lobby-input hall-text");
    text.rows = 2;
    text.maxLength = 300;
    text.placeholder = "A space race where cats ride rockets and dodge comets…";
    text.value = p.text;
    text.addEventListener("input", () => {
      p.text = text.value;
    });
    card.appendChild(text);

    const go = el("button", "lobby-go", "✨ Make my game");
    go.type = "button";
    go.addEventListener("click", () => this._make(go, statusEl));
    const statusEl = el("div", "lobby-status", status);
    card.append(go, statusEl);

    this.builder.replaceChildren(card);
  }

  _chips(options, current, onPick) {
    const row = el("div", "hall-chips");
    for (const o of options) {
      const b = el("button", `hall-chip${o.id === current ? " on" : ""}`, o.label);
      b.type = "button";
      b.addEventListener("click", () => {
        onPick(o.id);
        for (const x of row.children) x.classList.toggle("on", x === b);
      });
      row.appendChild(b);
    }
    return row;
  }

  async _make(button, statusEl) {
    const p = this.pick;
    const details = {};
    for (const group of DETAILS[p.type]) details[group.id] = p.details[group.id] || group.options[0].id;
    const input = { type: p.type, place: p.place, details, text: p.text, players: this.getPlayers() };
    button.disabled = true;
    button.textContent = "Creating your game";
    button.classList.add("is-loading");
    statusEl.textContent = "";
    let recipe = null;
    try {
      const r = await fetch("/api/arcade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(25000),
      });
      if (r.ok) recipe = cleanRecipe((await r.json()).recipe);
    } catch {
      recipe = null;
    }
    if (!recipe) recipe = buildRecipe(input);
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = "✨ Make my game";
    this.closeBuilder();
    this.onBuild?.(recipe);
  }
}
