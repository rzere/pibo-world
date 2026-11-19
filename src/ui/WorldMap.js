import { LAYOUT } from "../world/layout.js";
import { onLand } from "../world/biome.js";
import { ISLANDS, lockedLabel } from "../data/planets.js";

/**
 * Places drawn on the home island. Coordinates come from the world layout so
 * the map stays lined up with the ground you can walk.
 */
const PLACES = [
  { id: "village", name: "Village", at: LAYOUT.start, featured: true },
  { id: "home", name: "Cottage", at: LAYOUT.home },
  { id: "lighthouse", name: "Lighthouse Studio", short: "Lighthouse", at: LAYOUT.lighthouse, featured: true, travel: "lighthouse" },
  { id: "arcade", name: "Arcade", at: LAYOUT.arcade, featured: true, travel: "arcade" },
  { id: "library", name: "Library", at: LAYOUT.library, featured: true, travel: "library" },
];

/** Map the painted plate into the card. */
function project(x, z) {
  return {
    left: 50 + (x / 16) * 34,
    top: 44 + (z / 9) * 30,
  };
}

function distance(a, b) {
  return Math.hypot((a.x || 0) - b.x, (a.z || 0) - b.z);
}

/**
 * Map overlay: the home island with a you-are-here dot, plus later islands
 * that stay locked until a points system exists.
 */
export class WorldMap {
  constructor({ root, onTravel, onLocked, onClose } = {}) {
    this.root = root;
    this.onTravel = onTravel || null;
    this.onLocked = onLocked || null;
    this.onClose = onClose || null;
    this.isOpen = false;
    this._here = { x: LAYOUT.start.x, z: LAYOUT.start.z };
    this._selected = null;

    this.disc = root.querySelector("[data-map-disc]");
    this.you = root.querySelector("[data-map-you]");
    this.detailName = root.querySelector("[data-map-detail-name]");
    this.detailNote = root.querySelector("[data-map-detail-note]");
    this.go = root.querySelector("[data-map-go]");
    this.galaxy = root.querySelector("[data-map-galaxy]");

    this._buildPins();
    this._buildIslands();
    this._bind();
    this._select(null);
  }

  _bind() {
    this.root.querySelector("[data-map-scrim]")?.addEventListener("click", () => this.close());
    this.root.querySelector("[data-map-close]")?.addEventListener("click", () => this.close());
    this.go?.addEventListener("click", () => {
      const id = this._selected?.travel;
      if (!id) return;
      this.close();
      this.onTravel?.(id);
    });
  }

  _buildPins() {
    for (const place of PLACES) {
      const pos = project(place.at.x, place.at.z);
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "map-pin" + (place.featured ? " is-featured" : "");
      pin.style.left = `${pos.left}%`;
      pin.style.top = `${pos.top}%`;
      pin.setAttribute("aria-label", place.name);
      pin.innerHTML = `<span class="map-pin-dot"></span><span class="map-pin-name">${place.short || place.name}</span>`;
      pin.addEventListener("click", () => this._select(place));
      this.disc.appendChild(pin);
    }

    const ocean = project(9.2, 0.2);
    const label = document.createElement("div");
    label.className = "map-ocean-label";
    label.style.left = `${ocean.left}%`;
    label.style.top = `${ocean.top}%`;
    label.textContent = "Ocean";
    this.disc.appendChild(label);
  }

  _buildIslands() {
    this.galaxy.innerHTML = "";
    for (const island of ISLANDS) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "island-card" + (island.locked ? " is-locked" : "") + (island.home ? " is-home" : "");
      const note = island.locked ? lockedLabel(island) : island.home ? "You are here" : island.blurb;
      card.title = island.locked ? note : island.name;
      card.innerHTML = `
        <span class="island-blob" style="background:${island.color}"></span>
        <span class="island-copy">
          <span class="island-name">${island.name}</span>
          <span class="island-note">${island.locked ? "🔒 " + lockedLabel(island) : note}</span>
        </span>`;
      card.addEventListener("click", () => {
        if (island.locked) this.onLocked?.(island);
        else this._select(null);
      });
      this.galaxy.appendChild(card);
    }
  }

  _select(place) {
    this._selected = place;
    const hereName = this._nearestName();
    if (!place) {
      this.detailName.textContent = "You are here";
      this.detailNote.textContent = hereName;
      this.go.classList.add("hidden");
      return;
    }
    this.detailName.textContent = place.name;
    const standingThere = hereName === place.name;
    this.detailNote.textContent = standingThere ? "You are here" : place.travel ? "Tap to travel" : "On your island";
    if (place.travel) {
      const travelLabel = {
        lighthouse: "Go to the lighthouse",
        arcade: "Go to Arcade",
        library: "Go to Library",
      };
      this.go.textContent = travelLabel[place.travel] || `Go to ${place.name}`;
      this.go.classList.remove("hidden");
    } else {
      this.go.classList.add("hidden");
    }
    for (const pin of this.disc.querySelectorAll(".map-pin")) {
      pin.classList.toggle("is-selected", pin.getAttribute("aria-label") === place.name);
    }
  }

  _nearestName() {
    let best = "Village";
    let bestD = Infinity;
    for (const place of PLACES) {
      const d = distance(this._here, place.at);
      if (d < bestD) {
        bestD = d;
        best = place.name;
      }
    }
    if (!onLand(this._here.x || 0, this._here.z || 0) && bestD > 2.2) return "Ocean";
    return best;
  }

  open(here = {}) {
    this._here = { x: here.x || 0, z: here.z || 0 };
    const pos = project(this._here.x, this._here.z);
    this.you.style.left = `${pos.left}%`;
    this.you.style.top = `${pos.top}%`;
    this._select(null);
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this.isOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
    this.isOpen = false;
    this.onClose?.();
  }

  toggle(here) {
    if (this.isOpen) this.close();
    else this.open(here);
  }
}
