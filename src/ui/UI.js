import { PLANTS } from "../data/plants.js";
import { Joystick } from "./Joystick.js";

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
      factFoot: document.querySelector("#fact-card .fact-foot"),
      collectionBtn: document.getElementById("collection-btn"),
      collection: document.getElementById("collection"),
      collectionList: document.getElementById("collection-list"),
      toast: document.getElementById("toast"),
      mobileControls: document.getElementById("mobile-controls"),
      joystick: document.getElementById("joystick"),
      actionBtn: document.getElementById("action-btn"),
    };

    this.input = null;
    this.joystick = null;
    this._onPick = null;
    this._collected = new Map(); // id -> count
    this._toastTimer = null;
    this._touchUi = false;

    this._buildCards();
    this._renderCollection();

    this.el.collectionBtn.addEventListener("click", () => this.toggleCollection());
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
    this._syncActionBtn();
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
    if (this.isPanelOpen) this.closePanel();
    else if (this.isModalOpen) this.closeFact();
    else this.input.press("KeyE");
  }

  _syncActionBtn() {
    const btn = this.el.actionBtn;
    if (!btn) return;
    if (this.isModalOpen) {
      btn.textContent = "back";
      btn.classList.add("close-mode");
      btn.classList.remove("ready");
      btn.setAttribute("aria-label", "Close");
    } else {
      btn.textContent = "E";
      btn.classList.remove("close-mode");
      btn.setAttribute("aria-label", "Interact");
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
    if (this.el.intro.style.opacity === "0") return;
    this.el.intro.style.opacity = "0";
    setTimeout(() => this.el.intro.classList.add("hidden"), 1200);
  }

  /* prompt --------------------------------------------------------- */
  setPrompt(label) {
    this.el.promptLabel.textContent = label;
    this.el.prompt.classList.remove("hidden");
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
    this.el.factEmoji.textContent = plant.emoji;
    this.el.factName.textContent = plant.name;
    this.el.factText.textContent = plant.fact;
    this.el.fact.classList.remove("hidden");
    this.hidePrompt();
    this._syncActionBtn();
  }
  closeFact() {
    this.el.fact.classList.add("hidden");
    this._syncActionBtn();
  }

  closeModals() {
    this.closePanel();
    this.closeFact();
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
