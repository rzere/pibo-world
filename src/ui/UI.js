import { PLANTS } from "../data/plants.js";
import { STUDIO_PROMPTS } from "../data/studioPrompts.js";
import { lockedLabel } from "../data/planets.js";
import { Joystick } from "./Joystick.js";
import { IdeaPanel } from "./IdeaPanel.js";
import { WorldMap } from "./WorldMap.js";
import { ArcadeEditor } from "./ArcadeEditor.js";
import { LibraryPanel } from "./LibraryPanel.js";
import { ArtRoom } from "./ArtRoom.js";

const DOOR_ICON = `<svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8h18a3 3 0 0 1 3 3v29H11V11a3 3 0 0 1 3-3z" fill="#fff6ee" stroke="#3a2a24" stroke-width="3.5" stroke-linejoin="round"/><circle cx="29" cy="26" r="2.2" fill="#3a2a24"/></svg>`;
const CLOSE_ICON = `<svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M16 16l16 16M32 16L16 32" fill="none" stroke="#3a2a24" stroke-width="4" stroke-linecap="round"/></svg>`;

/**
 * Thin controller over the HTML overlay. Keeps the DOM out of gameplay code:
 * the Game asks the UI to show a prompt, open the plant panel, reveal a fact,
 * or toast a world moment. The planet stays the interface; this is just the
 * few soft touches layered on top.
 */
export class UI {
  constructor() {
    this.el = {
      intro: document.getElementById("intro"),
      prompt: document.getElementById("prompt"),
      promptLabel: document.querySelector("#prompt .prompt-label"),
      panel: document.getElementById("plant-panel"),
      panelFoot: document.querySelector("#plant-panel .panel-foot"),
      cards: document.getElementById("plant-cards"),
      fact: document.getElementById("fact-card"),
      factEmoji: document.getElementById("fact-emoji"),
      factName: document.getElementById("fact-name"),
      factText: document.getElementById("fact-text"),
      factFrom: document.getElementById("fact-from"),
      factFoot: document.querySelector("#fact-card .fact-foot"),
      beyond: document.getElementById("beyond"),
      collectionBtn: document.getElementById("collection-btn"),
      collection: document.getElementById("collection"),
      collectionList: document.getElementById("collection-list"),
      toast: document.getElementById("toast"),
      mobileControls: document.getElementById("mobile-controls"),
      joystick: document.getElementById("joystick"),
      actionBtn: document.getElementById("action-btn"),
      flightPad: document.getElementById("flight-pad"),
      climbUp: document.getElementById("climb-up"),
      climbDown: document.getElementById("climb-down"),
      studio: document.getElementById("studio-hud"),
      studioPrompt: document.getElementById("studio-prompt"),
      studioChips: document.getElementById("studio-chips"),
      studioGenerate: document.getElementById("studio-generate"),
      studioLeave: document.getElementById("studio-leave"),
      studioStatus: document.getElementById("studio-status"),
      studioIdea: document.getElementById("studio-idea"),
      lighthouseGo: document.getElementById("lighthouse-go"),
      arcadeGo: document.getElementById("arcade-go"),
      libraryGo: document.getElementById("library-go"),
      mapBtn: document.getElementById("map-btn"),
      lighthouseMarker: document.getElementById("lighthouse-marker"),
      lighthouseDistance: document.getElementById("lighthouse-distance"),
      lighthouseArrow: document.querySelector("#lighthouse-marker .lighthouse-arrow"),
    };

    this.ideas = new IdeaPanel({
      root: document.getElementById("idea-panel"),
      onUse: (idea) => this._acceptIdea(idea),
    });
    this.map = new WorldMap({
      root: document.getElementById("map-overlay"),
      onTravel: (id) => this.onMapTravel?.(id),
      onLocked: (planet) => this.toast(`${planet.name} — ${lockedLabel(planet)}`, 1800),
      onClose: () => this._syncActionBtn(),
    });
    this.arcade = new ArcadeEditor({
      root: document.getElementById("arcade-overlay"),
      onClose: () => {
        document.documentElement.classList.remove("in-arcade");
        this._syncActionBtn();
        this.onArcadeLeave?.();
      },
    });
    this.library = new LibraryPanel({
      root: document.getElementById("library-overlay"),
      onClose: () => {
        document.documentElement.classList.remove("in-library");
        this._syncActionBtn();
        this.onLibraryLeave?.();
      },
    });
    this.art = new ArtRoom({
      root: document.getElementById("art-overlay"),
      onClose: () => {
        document.documentElement.classList.remove("in-art");
        this._syncActionBtn();
        this.onArtLeave?.();
      },
      onChange: (look) => this.onArtChange?.(look),
    });
    this.lastIdea = null;

    this.input = null;
    this.joystick = null;
    this._onPick = null;
    this._onLetterClose = null;
    this._onStudioGenerate = null;
    this._onStudioLeave = null;
    this._studioBusy = false;
    this._collected = new Map(); // id -> count
    this._toastTimer = null;
    this._touchUi = false;

    this._buildCards();
    this._renderCollection();

    this.el.collectionBtn.addEventListener("click", () => this.toggleCollection());
    this.el.lighthouseGo?.addEventListener("click", (e) => {
      this.onGoToLighthouse?.();
      e.currentTarget.blur();
      document.getElementById("scene")?.focus();
    });
    this.el.arcadeGo?.addEventListener("click", (e) => {
      this.onGoToArcade?.();
      e.currentTarget.blur();
      document.getElementById("scene")?.focus();
    });
    this.el.libraryGo?.addEventListener("click", (e) => {
      this.onGoToLibrary?.();
      e.currentTarget.blur();
      document.getElementById("scene")?.focus();
    });
    this.el.mapBtn?.addEventListener("click", () => {
      if (this.isMapOpen) this.closeMap();
      else this.openMap();
    });
    this._bindStudio();
  }

  /**
   * Reveal the on-screen stick on phones/tablets (or the first touch),
   * and let taps fire the same actions as E / Esc.
   */
  attachInput(input) {
    this.input = input;
    this.joystick = new Joystick(this.el.joystick, (x, y) => input.setAxis(x, y));

    const show = () => this._enableTouchUi();
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) show();
    window.addEventListener("touchstart", show, { once: true, passive: true });

    this.el.actionBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this._onAction();
    });
    this.el.prompt.addEventListener("click", () => input.press("KeyE"));
    this.el.fact.addEventListener("click", () => this.closeFact());
    this._bindHold(this.el.climbUp, 1);
    this._bindHold(this.el.climbDown, -1);
    this._syncActionBtn();
  }

  _bindHold(el, dir) {
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      this.input?.setClimb(dir);
    };
    const off = () => this.input?.setClimb(0);
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }

  setFlying(on) {
    if (on) this.el.flightPad.classList.remove("hidden");
    else {
      this.el.flightPad.classList.add("hidden");
      this.input?.setClimb(0);
    }
  }

  useTouchControls() {
    this._enableTouchUi();
  }

  _enableTouchUi() {
    if (this._touchUi) return;
    this._touchUi = true;
    document.documentElement.classList.add("touch-ui");
    this.el.mobileControls.classList.remove("hidden");
    this.el.panelFoot.innerHTML = "<b>tap</b> a plant · tap <b>E</b> to step back";
    this.el.factFoot.innerHTML = "<b>tap</b> to close";
    this._syncActionBtn();
  }

  _onAction() {
    if (!this.input) return;
    if (this.isArtOpen) {
      this.closeArt();
      return;
    }
    if (this.isLibraryOpen) {
      this.closeLibrary();
      return;
    }
    if (this.isArcadeOpen) {
      this.closeArcade();
      return;
    }
    if (this.isMapOpen) {
      this.closeMap();
      return;
    }
    if (this.isIdeaOpen) {
      this.closeIdeas();
      return;
    }
    if (this.isStudioOpen) this._onStudioLeave?.();
    else if (this.isPanelOpen) this.closePanel();
    else if (this.isModalOpen) this.closeFact();
    else this.input.press("KeyE");
  }

  _syncActionBtn() {
    const btn = this.el.actionBtn;
    if (!btn) return;
    if (this.isArtOpen || this.isLibraryOpen || this.isArcadeOpen || this.isMapOpen || this.isIdeaOpen || this.isStudioOpen || this.isModalOpen) {
      btn.innerHTML = CLOSE_ICON;
      btn.classList.add("close-mode");
      btn.classList.remove("ready");
      btn.setAttribute("aria-label", "Close");
    } else {
      btn.innerHTML = DOOR_ICON;
      btn.classList.remove("close-mode");
      btn.setAttribute("aria-label", "Enter");
    }
  }

  _buildCards() {
    this.el.cards.innerHTML = "";
    PLANTS.forEach((plant, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-emoji">${plant.emoji}</div>
        <div class="card-name">${plant.name}</div>
        <div class="card-hint"><span class="kb-only">press ${i + 1}</span><span class="touch-only">tap</span></div>`;
      card.addEventListener("click", () => this.pick(plant.id));
      this.el.cards.appendChild(card);
    });
  }

  hideIntro() {
    // The title used to sit in the sky. It is not drawn.
    this.el.intro?.classList.add("hidden");
  }

  /* prompt --------------------------------------------------------- */
  setPrompt() {
    if (this.el.promptLabel) this.el.promptLabel.textContent = "";
    const phone = document.documentElement.classList.contains("phone-landscape")
      || document.documentElement.classList.contains("touch-ui");
    // Phones tap the round door button. Keyboards get the E key cap.
    this.el.prompt.classList.toggle("hidden", phone);
    if (phone && this.el.actionBtn) {
      this.el.actionBtn.innerHTML = DOOR_ICON;
      this.el.actionBtn.setAttribute("aria-label", "Enter");
    }
    this.el.actionBtn.classList.add("ready");
  }
  hidePrompt() {
    this.el.prompt.classList.add("hidden");
    if (!this.isModalOpen) this.el.actionBtn.classList.remove("ready");
  }

  /* plant panel ---------------------------------------------------- */
  get isModalOpen() {
    return !this.el.panel.classList.contains("hidden") ||
      !this.el.fact.classList.contains("hidden");
  }
  get isPanelOpen() {
    return !this.el.panel.classList.contains("hidden");
  }

  openPlantPanel(onPick) {
    this._onPick = onPick;
    this.el.panel.classList.remove("hidden");
    this.hidePrompt();
    this._syncActionBtn();
  }
  pick(id) {
    if (!this.isPanelOpen) return;
    const cb = this._onPick;
    this.closePanel();
    if (cb) cb(id);
  }
  pickByIndex(i) {
    const plant = PLANTS[i];
    if (plant) this.pick(plant.id);
  }
  closePanel() {
    this.el.panel.classList.add("hidden");
    this._onPick = null;
    this._syncActionBtn();
  }

  /* fact card ------------------------------------------------------ */
  showFact(plant) {
    this.el.fact.classList.remove("letter");
    this.el.factEmoji.textContent = plant.emoji;
    this.el.factName.textContent = plant.name;
    this.el.factText.textContent = plant.fact;
    this.el.factFrom.textContent = "";
    this.el.fact.classList.remove("hidden");
    this.hidePrompt();
    this._syncActionBtn();
  }

  showLetter({ emoji = "💌", name = "", text, from = "", onClose } = {}) {
    this._onLetterClose = onClose || null;
    this.el.fact.classList.add("letter");
    this.el.factEmoji.textContent = emoji;
    this.el.factName.textContent = name;
    this.el.factText.textContent = text;
    this.el.factFrom.textContent = from;
    this.el.fact.classList.remove("hidden");
    this.hidePrompt();
    this._syncActionBtn();
  }

  closeFact() {
    this.el.fact.classList.add("hidden");
    this.el.fact.classList.remove("letter");
    this._syncActionBtn();
    const cb = this._onLetterClose;
    this._onLetterClose = null;
    if (cb) cb();
  }

  showBeyond() {
    this.el.beyond.classList.remove("hidden");
    requestAnimationFrame(() => this.el.beyond.classList.add("show"));
  }

  closeModals() {
    this.closePanel();
    this.closeFact();
    this.closeMap();
    this.closeArcade();
    this.closeLibrary();
    this.closeArt();
  }

  /* library -------------------------------------------------------- */
  get isLibraryOpen() {
    return !!this.library?.isOpen;
  }

  openLibrary() {
    this.closeMap();
    this.closeCollection();
    this.library?.open();
    document.documentElement.classList.add("in-library");
    this.hidePrompt();
    this._syncActionBtn();
  }

  closeLibrary() {
    this.library?.close();
  }

  /* art room ------------------------------------------------------- */
  get isArtOpen() {
    return !!this.art?.isOpen;
  }

  openArt(view) {
    this.closeMap();
    this.closeCollection();
    this.art?.open(view);
    document.documentElement.classList.add("in-art");
    this.hidePrompt();
    this._syncActionBtn();
  }

  closeArt() {
    this.art?.close();
    document.documentElement.classList.remove("in-art");
    this._syncActionBtn();
  }

  /* arcade editor -------------------------------------------------- */
  get isArcadeOpen() {
    return !!this.arcade?.isOpen;
  }

  openArcade() {
    this.closeMap();
    this.closeCollection();
    this.arcade?.open();
    document.documentElement.classList.add("in-arcade");
    this.hidePrompt();
    this._syncActionBtn();
  }

  closeArcade() {
    this.arcade?.close();
  }

  /* world map ------------------------------------------------------ */
  get isMapOpen() {
    return !!this.map?.isOpen;
  }

  openMap() {
    this.closeCollection();
    this.map.open(this.onMapHere?.() ?? { lat: 0, lon: 0 });
    this.el.mapBtn?.setAttribute("aria-expanded", "true");
    this._syncActionBtn();
  }

  closeMap() {
    this.map?.close();
    this.el.mapBtn?.setAttribute("aria-expanded", "false");
    this._syncActionBtn();
  }

  /* lighthouse guide ----------------------------------------------- */
  setLighthouseGuide({ hidden } = {}) {
    // The travel buttons are the way to the lighthouse. No distance chip on the island.
    const marker = this.el.lighthouseMarker;
    if (marker) {
      marker.classList.add("hidden");
      marker.setAttribute("aria-hidden", "true");
    }
    const indoors = !!hidden && (this.isStudioOpen || this.isArcadeOpen || this.isLibraryOpen || this.isArtOpen);
    this.el.lighthouseGo?.classList.toggle("hidden", indoors);
  }

  /* screen studio -------------------------------------------------- */
  get isStudioOpen() {
    return this.el.studio && !this.el.studio.classList.contains("hidden");
  }
  get isStudioTyping() {
    return this.isStudioOpen && document.activeElement === this.el.studioPrompt;
  }

  _bindStudio() {
    const hud = this.el.studio;
    if (!hud) return;
    this._renderStudioChips();
    this.el.studioGenerate.addEventListener("click", () => this.submitStudio());
    this.el.studioLeave.addEventListener("click", () => this._onStudioLeave?.());
    this.el.studioIdea?.addEventListener("click", () => this.openIdeas());
    this.el.studioPrompt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submitStudio();
      }
    });
  }

  _renderStudioChips() {
    const wrap = this.el.studioChips;
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const item of STUDIO_PROMPTS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "studio-chip";
      chip.textContent = item.label;
      chip.addEventListener("click", () => {
        this.el.studioPrompt.value = item.text;
        this.el.studioPrompt.focus();
      });
      wrap.appendChild(chip);
    }
  }

  /* idea generator -------------------------------------------------- */
  get isIdeaOpen() {
    return !!this.ideas?.isOpen;
  }

  openIdeas() {
    if (!this.isStudioOpen) return;
    this.el.studioPrompt?.blur();
    this.ideas.open();
    this._syncActionBtn();
  }

  closeIdeas() {
    this.ideas?.close();
    this._syncActionBtn();
  }

  _acceptIdea(idea) {
    this.lastIdea = idea;
    if (this.el.studioPrompt) {
      this.el.studioPrompt.value = idea.prompt;
    }
    this.setStudioStatus(`Using your idea · ${idea.sentence}`);
    this.closeIdeas();
    window.dispatchEvent(new CustomEvent("pibo-idea", { detail: idea }));
  }

  openStudio({ onGenerate, onLeave } = {}) {
    this.closeMap();
    this.closeArcade();
    this.closeLibrary();
    this._onStudioGenerate = onGenerate || null;
    this._onStudioLeave = onLeave || null;
    this._studioBusy = false;
    this.el.studio.classList.remove("hidden");
    this.el.studioGenerate.disabled = false;
    this.setStudioStatus("Type a sentence, then generate");
    document.documentElement.classList.add("in-studio");
    this.hidePrompt();
    this._syncActionBtn();
  }

  closeStudio() {
    this.closeIdeas();
    this.el.studio.classList.add("hidden");
    this._onStudioGenerate = null;
    this._onStudioLeave = null;
    this._studioBusy = false;
    document.documentElement.classList.remove("in-studio");
    this._syncActionBtn();
  }

  submitStudio() {
    if (!this.isStudioOpen || this._studioBusy || this.isIdeaOpen) return;
    const prompt = (this.el.studioPrompt.value || "").trim();
    if (!prompt) {
      this.setStudioStatus("Type a little English sentence first");
      this.el.studioPrompt.focus();
      return;
    }
    this._onStudioGenerate?.(prompt);
  }

  setStudioBusy(on) {
    this._studioBusy = !!on;
    if (this.el.studioGenerate) this.el.studioGenerate.disabled = !!on;
    this.el.studioGenerate.textContent = on ? "Making…" : "Generate";
  }

  setStudioStatus(msg) {
    if (this.el.studioStatus) this.el.studioStatus.textContent = msg || "";
  }

  /* collection ----------------------------------------------------- */
  addGrown(plant) {
    this._collected.set(plant.id, (this._collected.get(plant.id) || 0) + 1);
    this._renderCollection();
    this.el.collectionBtn.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.25) rotate(-8deg)" }, { transform: "scale(1)" }],
      { duration: 420, easing: "ease-out" }
    );
  }
  _renderCollection() {
    const list = this.el.collectionList;
    list.innerHTML = "";
    if (this._collected.size === 0) {
      const empty = document.createElement("div");
      empty.className = "collection-empty";
      empty.textContent = "Nothing yet — go plant something in the garden.";
      list.appendChild(empty);
      return;
    }
    for (const [id, count] of this._collected) {
      const plant = PLANTS.find((p) => p.id === id);
      const row = document.createElement("div");
      row.className = "collection-row";
      row.innerHTML = `<span class="dot">${plant.emoji}</span> ${plant.name} ×${count}`;
      list.appendChild(row);
    }
  }
  toggleCollection() {
    this.el.collection.classList.toggle("hidden");
  }
  closeCollection() {
    this.el.collection.classList.add("hidden");
  }

  /* toast ---------------------------------------------------------- */
  toast(msg, dur = 3200) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.remove("hidden");
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.classList.add("hidden"), 400);
    }, dur);
  }
}
