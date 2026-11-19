import { STICKERS, HIDE_SPOTS } from "../data/arcadeStickers.js";
import { createArcadeAssistant, templateArcadeStitch } from "../systems/arcadeAssistant.js";
import { read, normalizeSteps, normalizeSpec } from "../systems/gameSpec.js";
import { createTreasurePlay } from "../systems/treasureRuntime.js";
import { loadAuthorshipLog, saveAuthorshipLog, downloadJson } from "../systems/arcadeLog.js";

const SAVE_KEY = "pibo.arcade.spec";
const EDIT_STEPS = ["sticker", "goal", "key", "treasure", "order", "clue0", "clue1"];
const STICKER_PICKS = ["ghost", "cat", "door", "bed", "tree", "chest", "painting"];

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Creation UI drawn on top of the arcade machine's screen. One step at a
 * time: start choices, guided questions, then a big preview with play and
 * change steps. Save, the authorship log, and Export JSON stay in a menu.
 */
export class ArcadeEditor {
  constructor({ root, lesson, assistant, onClose, onScreen } = {}) {
    this.root = root;
    this.onClose = onClose || null;
    this.onScreen = onScreen || null;
    this.assistant = assistant || createArcadeAssistant({ lesson });
    this.lesson = this.assistant.lesson;
    this.log = loadAuthorshipLog();
    this.spec = null;
    this.answers = {};
    this.questionIndex = 0;
    this.questions = [];
    this.play = null;
    this.mode = "start";
    this.editStep = null;
    this.menuOpen = false;
    this.showLog = false;
    this._screenMessage = "";
    this._rect = null;
    this._chromeSent = -1;
    this._pendingToast = "";
    this.screenEl = null;
  }

  open() {
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this.mode = "start";
    this.editStep = null;
    this.menuOpen = false;
    this.showLog = false;
    this._render();
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
    this.onClose?.();
  }

  get isOpen() {
    return this.root && !this.root.classList.contains("hidden");
  }

  /** Move the on-screen UI so it sits inside the machine's display. */
  place(rect) {
    if (!rect || rect.width < 24 || rect.height < 24) return;
    this._rect = rect;
    const chrome = this._chrome();
    this._applyPlace();
    if (chrome !== this._chromeSent) {
      this._chromeSent = chrome;
      this._emitScreen();
    }
  }

  _chrome() {
    const height = this._rect?.height || 420;
    if (this.showLog || this.editStep) return 0;
    if (this.mode === "play") return Math.min(0.42, Math.max(0.32, 118 / height));
    if (this.mode === "edit") return Math.min(0.36, Math.max(0.26, 92 / height));
    return 0;
  }

  _applyPlace() {
    const rect = this._rect;
    const screen = this.screenEl;
    if (!rect || !screen) return;
    screen.style.left = `${rect.left}px`;
    screen.style.top = `${rect.top}px`;
    screen.style.width = `${rect.width}px`;
    screen.style.height = `${rect.height}px`;
    screen.style.setProperty("--chrome", String(this._chrome()));
  }

  _render() {
    this.root.replaceChildren();
    const exit = h("button", "arcade-exit", "Exit");
    exit.type = "button";
    exit.setAttribute("aria-label", "Leave the arcade");
    exit.addEventListener("click", () => this.close());
    this.root.append(exit);

    const stage = this.mode === "edit" || this.mode === "play";
    const covered = this.showLog || !!this.editStep || !stage;
    const screen = h("div", `arcade-screen ${covered ? "is-form" : "is-stage"}`);
    screen.dataset.mode = this.showLog ? "log" : (this.editStep || this.mode);
    this.screenEl = screen;

    if (this.showLog) screen.append(this._logView());
    else if (this.mode === "start") screen.append(this._start());
    else if (this.mode === "ask") screen.append(this._ask());
    else if (this.mode === "play") screen.append(this._playDock());
    else if (this.editStep) screen.append(this._editStep());
    else screen.append(this._editDock());

    if ((this.mode === "edit" || this.mode === "play") && !this.showLog) screen.append(this._menu());
    if (this._pendingToast) {
      screen.append(h("div", "arcade-toast", this._pendingToast));
      this._pendingToast = "";
    }
    this.root.append(screen);
    this._applyPlace();
    this._emitScreen();
  }

  _start() {
    const body = h("div", "arcade-body");
    body.append(h("h2", "arcade-title", "Make a tiny game"));
    const choices = h("div", "arcade-choices");
    const template = h("button", "arcade-choice", "Choose a template");
    template.type = "button";
    template.append(h("span", "arcade-choice-note", "Treasure hunt"));
    template.addEventListener("click", () => this._chooseTemplate());
    const describe = h("button", "arcade-choice arcade-choice-alt", "Describe your idea");
    describe.type = "button";
    describe.append(h("span", "arcade-choice-note", "Answer a few questions"));
    describe.addEventListener("click", () => this._startQuestions());
    choices.append(template, describe);
    body.append(choices);
    if (this._savedSpec()) {
      const cont = h("button", "arcade-choice arcade-choice-quiet", "Continue");
      cont.type = "button";
      cont.append(h("span", "arcade-choice-note", "Your saved game"));
      cont.addEventListener("click", () => this._continue());
      body.append(cont);
    }
    return body;
  }

  _chooseTemplate() {
    this.spec = this.assistant.template();
    this.log.add("template-chosen", { id: "ghost-castle", title: read(this.spec.title) }, "child");
    this.log.add("prompt", { id: "template", prompt: "Choose a game template" }, "template");
    this.mode = "edit";
    this.editStep = null;
    this._render();
  }

  _startQuestions() {
    this.answers = {};
    this.questionIndex = 0;
    this.questions = this.assistant.questions(this.answers);
    this.mode = "ask";
    this._logPrompt();
    this._render();
  }

  _logPrompt() {
    const q = this.questions[this.questionIndex];
    if (!q) return;
    this.log.add("prompt", { id: q.id, prompt: q.prompt }, "template");
  }

  _ask() {
    const q = this.questions[this.questionIndex];
    const body = h("div", "arcade-body");
    body.append(h("p", "arcade-step", `${this.questionIndex + 1} of ${this.questions.length}`));
    body.append(h("h2", "arcade-title", q.prompt));
    const chips = h("div", "arcade-chips");
    let picked = null;
    const field = h("textarea", "arcade-type");
    field.rows = 2;
    field.placeholder = q.placeholder || "Type your own";
    for (const chip of q.chips) {
      const button = h("button", "arcade-chip", chip.label);
      button.type = "button";
      button.addEventListener("click", () => {
        picked = chip;
        field.value = chip.label;
        for (const other of chips.querySelectorAll(".arcade-chip")) other.classList.remove("is-on");
        button.classList.add("is-on");
        this.log.add("chip", { questionId: q.id, chipId: chip.id, label: chip.label }, "child");
        this._stage(q, chip, chip.label);
        this._emitScreen();
      });
      chips.append(button);
    }
    field.addEventListener("input", () => {
      this._stage(q, null, field.value);
      this._emitScreen();
    });
    body.append(chips, field);
    const next = h("button", "arcade-go", this.questionIndex === this.questions.length - 1 ? "Make my game" : "Next");
    next.type = "button";
    next.addEventListener("click", () => this._answer(q, picked, field.value));
    body.append(next);
    return body;
  }

  _stage(q, chip, typed) {
    const text = String(typed || "").trim();
    const usedChip = chip && text === chip.label;
    if (q.id === "idea") this.answers.idea = text || chip?.label || "";
    if (q.id === "keyPlace" && (usedChip || text)) {
      this.answers.keyPlace = usedChip ? chip.place || chip.id : this._matchSpot(text);
    }
    if (q.id === "clue" && (usedChip || text)) {
      this.answers.clue = usedChip ? chip.text || chip.label : text;
      if (usedChip?.place) this.answers.treasurePlace = chip.place;
      else this.answers.treasurePlace = this._matchSpot(text);
    }
  }

  _answer(q, chip, typed) {
    const text = String(typed || "").trim();
    if (!text && !chip) return;
    const usedChip = chip && text === chip.label;
    if (!usedChip && text) this.log.add("typed", { questionId: q.id, text }, "child");
    this._stage(q, chip, text);
    this.questionIndex += 1;
    if (this.questionIndex < this.questions.length) {
      this.questions = this.assistant.questions(this.answers);
      this._logPrompt();
      this.mode = "ask";
      this._render();
      return;
    }
    this._finishAssistant();
  }

  _matchSpot(text) {
    const lower = text.toLowerCase();
    const found = HIDE_SPOTS.find((spot) => lower.includes(spot.name) || lower.includes(spot.phrase));
    return found?.id;
  }

  async _finishAssistant() {
    this.spec = await this.assistant.finish(this.answers);
    this.mode = "edit";
    this.editStep = null;
    this._render();
  }

  _continue() {
    const saved = this._savedSpec();
    if (!saved) return;
    this.spec = normalizeSpec(saved, this.lesson);
    this.log.add("edit", { field: "continue", id: this.spec.id }, "child");
    this.mode = "edit";
    this.editStep = null;
    this._render();
  }

  _savedSpec() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _editDock() {
    const spec = this.spec;
    const dock = h("div", "arcade-dock");
    dock.append(h("p", "arcade-dock-title", read(spec.title)));
    dock.append(h("p", "arcade-lead", "Drag the pictures."));
    const actions = h("div", "arcade-actions");
    actions.append(this._action("Play", "arcade-go", () => this._beginPlay()));
    actions.append(this._action("Change", "arcade-choice-inline", () => {
      this.editStep = EDIT_STEPS[0];
      this.menuOpen = false;
      this._render();
    }));
    actions.append(this._action("Save", "arcade-quiet", () => this._save()));
    dock.append(actions);
    return dock;
  }

  _editStep() {
    const spec = this.spec;
    const step = this.editStep;
    const index = EDIT_STEPS.indexOf(step);
    const body = h("div", "arcade-body");
    body.append(h("p", "arcade-step", `${index + 1} of ${EDIT_STEPS.length}`));

    if (step === "sticker") {
      body.append(h("h2", "arcade-title", "Pick a picture"));
      const chips = h("div", "arcade-chips is-grid");
      for (const id of STICKER_PICKS) {
        const sticker = STICKERS[id];
        const button = h("button", "arcade-chip", `${sticker.emoji} ${sticker.label}`);
        button.type = "button";
        const hero = id === "ghost" || id === "cat";
        const selected = hero
          ? read(spec.hero) === id
          : spec.objects.some((item) => item.asset === id);
        if (selected) button.classList.add("is-on");
        button.addEventListener("click", () => {
          this._useSticker(sticker);
          this._render();
        });
        chips.append(button);
      }
      body.append(chips);
    } else if (step === "goal") {
      body.append(h("h2", "arcade-title", "The goal"));
      const input = h("textarea", "arcade-type");
      input.rows = 3;
      input.value = read(spec.goal) || "";
      input.addEventListener("input", () => {
        spec.goal = { value: input.value.trim(), author: "child" };
      });
      input.addEventListener("change", () => {
        this.log.add("edit", { field: "goal", value: input.value.trim() }, "child");
      });
      body.append(input);
    } else if (step === "key" || step === "treasure") {
      const key = step === "key";
      body.append(h("h2", "arcade-title", key ? "The key hides…" : "The treasure hides…"));
      const current = read(key ? spec.obstacles[0].keyHidesIn : spec.obstacles[0].treasureHidesIn);
      const chips = h("div", "arcade-chips");
      for (const spot of HIDE_SPOTS) {
        const button = h("button", "arcade-chip", spot.phrase);
        button.type = "button";
        if (spot.id === current) button.classList.add("is-on");
        button.addEventListener("click", () => {
          if (key) this._setKey(spot.id);
          else this._setTreasure(spot.id);
        });
        chips.append(button);
      }
      body.append(chips);
    } else if (step === "order") {
      body.append(h("h2", "arcade-title", "The order"));
      const order = h("div", "arcade-order");
      this._paintOrder(order, spec);
      body.append(order);
    } else if (step === "clue0" || step === "clue1") {
      const clue = spec.clues[step === "clue0" ? 0 : 1];
      body.append(h("h2", "arcade-title", step === "clue0" ? "Clue for the key" : "Clue for the treasure"));
      body.append(h("p", "arcade-lead", this.lesson.grammar.frame));
      const area = h("textarea", "arcade-type");
      area.rows = 3;
      area.value = clue.text || "";
      area.addEventListener("change", () => {
        clue.text = area.value.trim();
        clue.author = "child";
        this.log.add("edit", { field: clue.id, value: clue.text }, "child");
        this._emitScreen();
      });
      body.append(area);
    }

    const actions = h("div", "arcade-actions");
    actions.append(this._action("Back", "arcade-quiet", () => this._stepBy(-1)));
    const last = index === EDIT_STEPS.length - 1;
    actions.append(this._action(last ? "Done" : "Next", "arcade-go", () => this._stepBy(1)));
    body.append(actions);
    return body;
  }

  _stepBy(dir) {
    const index = EDIT_STEPS.indexOf(this.editStep);
    const next = index + dir;
    this.editStep = next < 0 || next >= EDIT_STEPS.length ? null : EDIT_STEPS[next];
    this._render();
  }

  _setKey(id) {
    const obstacle = this.spec.obstacles[0];
    obstacle.keyHidesIn = { value: id, author: "child" };
    if (read(obstacle.treasureHidesIn) === id) {
      const other = HIDE_SPOTS.find((spot) => spot.id !== id);
      obstacle.treasureHidesIn = { value: other.id, author: "child" };
    }
    this.log.add("edit", { field: "keyHidesIn", value: id }, "child");
    this._render();
  }

  _setTreasure(id) {
    if (id === read(this.spec.obstacles[0].keyHidesIn)) {
      this._toast("The treasure needs its own place.");
      return;
    }
    this.spec.obstacles[0].treasureHidesIn = { value: id, author: "child" };
    this.log.add("edit", { field: "treasureHidesIn", value: id }, "child");
    this._render();
  }

  _playDock() {
    const spec = this.spec;
    const dock = h("div", "arcade-dock");
    const clue = this.play?.clueForStep() || read(spec.goal);
    dock.append(h("p", "arcade-clue", clue));
    const message = this.play?.state?.won ? "You did it!" : (this._screenMessage || "Tap a picture.");
    dock.append(h("p", `arcade-message${this.play?.state?.won ? " is-won" : ""}`, message));
    dock.append(this._action("Back", "arcade-quiet", () => {
      this.mode = "edit";
      this._render();
    }));
    return dock;
  }

  _menu() {
    const wrap = h("div", "arcade-menu");
    const button = h("button", "arcade-menu-btn", "Menu");
    button.type = "button";
    button.setAttribute("aria-expanded", this.menuOpen ? "true" : "false");
    button.addEventListener("click", () => {
      this.menuOpen = !this.menuOpen;
      this._render();
    });
    wrap.append(button);
    if (this.menuOpen) {
      const panel = h("div", "arcade-menu-panel");
      if (this.spec) panel.append(this._action("Save", "arcade-menu-item", () => this._save()));
      panel.append(this._action("Export JSON", "arcade-menu-item", () => this._export()));
      panel.append(this._action("Authorship log", "arcade-menu-item", () => {
        this.showLog = true;
        this.menuOpen = false;
        this._render();
      }));
      panel.append(this._action("Start over", "arcade-menu-item", () => {
        this.mode = "start";
        this.editStep = null;
        this.menuOpen = false;
        this.showLog = false;
        this.play = null;
        this._render();
      }));
      wrap.append(panel);
    }
    return wrap;
  }

  _logView() {
    const data = saveAuthorshipLog(this.log, { specId: this.spec?.id, lessonId: this.lesson.id });
    const body = h("div", "arcade-body");
    body.append(h("h2", "arcade-title", "Authorship log"));
    const pre = h("pre", "arcade-log");
    pre.textContent = JSON.stringify({ version: data.version, events: data.events }, null, 2);
    body.append(pre);
    body.append(this._action("Close", "arcade-go", () => {
      this.showLog = false;
      this._render();
    }));
    return body;
  }

  _action(label, className, onClick) {
    const button = h("button", className, label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  _paintOrder(order, spec) {
    order.replaceChildren();
    const steps = read(spec.steps);
    steps.forEach((step, index) => {
      const row = h("div", "arcade-step-row");
      row.append(h("span", "", `${index + 1}. ${step}`));
      if (index > 0) {
        const up = h("button", "arcade-mini", "Up");
        up.type = "button";
        up.addEventListener("click", () => {
          const next = steps.slice();
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          spec.steps = { value: normalizeSteps(next), author: "child" };
          this.log.add("edit", { field: "steps", value: next }, "child");
          this._paintOrder(order, spec);
        });
        row.append(up);
      }
      order.append(row);
    });
  }

  _useSticker(sticker) {
    const spec = this.spec;
    if (sticker.id === "ghost" || sticker.id === "cat") {
      spec.hero = { value: sticker.id, author: "child" };
      this.log.add("edit", { field: "hero", value: sticker.id }, "child");
    } else {
      const object = spec.objects.find((item) => item.id === sticker.id || item.asset === sticker.id);
      if (object) {
        object.asset = sticker.id;
        object.author = "child";
      }
      this.log.add("edit", { field: "sticker", value: sticker.id }, "child");
    }
    this._emitScreen();
  }

  /** Drag on the machine screen. `commit` logs the drop. */
  moveOnScreen(id, x, y, commit) {
    if (this.mode !== "edit" || this.editStep || !this.spec) return false;
    const object = this.spec.objects.find((item) => item.id === id);
    if (!object) return false;
    object.x = x;
    object.y = y;
    if (commit) {
      object.author = "child";
      this.log.add("edit", { field: "move", id, x: Math.round(x), y: Math.round(y) }, "child");
    }
    this._emitScreen();
    return true;
  }

  _beginPlay() {
    this.play = createTreasurePlay(this.spec);
    this.mode = "play";
    this.editStep = null;
    this.menuOpen = false;
    this._screenMessage = "Tap a picture.";
    this.log.add("play", { id: this.spec.id }, "child");
    this._render();
  }

  hitPlay(objectId) {
    if (this.mode !== "play") return false;
    this._onPlayClick(objectId);
    return true;
  }

  _onPlayClick(objectId) {
    if (!this.play) return;
    const result = this.play.click(objectId);
    this._screenMessage = result.message;
    this.log.add("play", { click: objectId, won: !!result.won, message: result.message }, "child");
    this._render();
  }

  _emitScreen() {
    let spec = null;
    if (this.mode === "edit" || this.mode === "play") spec = this.spec;
    else if (this.mode === "ask" && (this.answers.idea || this.answers.keyPlace || this.answers.clue)) {
      spec = templateArcadeStitch(this.lesson, this.answers);
    }
    const chrome = this._chrome();
    this._chromeSent = chrome;
    this.onScreen?.({
      spec,
      mode: this.mode,
      message: this._screenMessage || "",
      clue: this.mode === "play" && this.play ? (this.play.clueForStep() || "") : "",
      won: !!this.play?.state?.won,
      chrome,
    });
  }

  _save() {
    if (!this.spec) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.spec));
    saveAuthorshipLog(this.log, { specId: this.spec?.id, lessonId: this.lesson.id });
    this.log.add("save", { id: this.spec.id }, "child");
    saveAuthorshipLog(this.log, { specId: this.spec?.id, lessonId: this.lesson.id });
    this.menuOpen = false;
    this._pendingToast = "Saved in this browser";
    this._render();
  }

  _export() {
    const data = saveAuthorshipLog(this.log, { specId: this.spec?.id, lessonId: this.lesson.id });
    this.log.add("export", { events: data.events.length }, "child");
    const fresh = saveAuthorshipLog(this.log, { specId: this.spec?.id, lessonId: this.lesson.id });
    downloadJson("pibo-arcade-log.json", fresh);
    this.menuOpen = false;
    this.showLog = true;
    this._pendingToast = "Exported the log";
    this._render();
  }

  _toast(text) {
    this._pendingToast = text;
    let note = this.screenEl?.querySelector(".arcade-toast");
    if (!note && this.screenEl) {
      note = h("div", "arcade-toast");
      this.screenEl.append(note);
    }
    if (note) note.textContent = text;
  }
}
