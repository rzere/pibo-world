import { createIdeaGenerator } from "../systems/ideaGen.js";
import { FOOD_LIKES_LESSON } from "../data/lessons/foodLikes.js";

const SLOT_ORDER = [
  ["subject", "Who"],
  ["stance", "Grammar"],
  ["object", "Vocab"],
  ["twist", "Twist"],
];

/**
 * Small overlay for the constrained idea generator. Talks only to the
 * generator's Idea objects (prompt, sentence, slots, locks) so a later LLM
 * stitcher can replace the template without a UI change.
 */
export class IdeaPanel {
  constructor({ root, lesson = FOOD_LIKES_LESSON, onUse, stitch, rng } = {}) {
    this.root = root;
    this.onUse = onUse || null;
    this._stitch = stitch;
    this._rng = rng;
    this._busy = false;
    this._setLesson(lesson);

    this.el = {
      kicker: root?.querySelector("[data-idea-kicker]"),
      frame: root?.querySelector("[data-idea-frame]"),
      prompt: root?.querySelector("[data-idea-prompt]"),
      sentence: root?.querySelector("[data-idea-sentence]"),
      slots: root?.querySelector("[data-idea-slots]"),
      hint: root?.querySelector("[data-idea-hint]"),
      reroll: root?.querySelector("[data-idea-reroll]"),
      rerollAll: root?.querySelector("[data-idea-reroll-all]"),
      use: root?.querySelector("[data-idea-use]"),
      dismiss: root?.querySelector("[data-idea-dismiss]"),
      card: root?.querySelector(".idea-card"),
    };

    this._bind();
  }

  get isOpen() {
    return !!this.root && !this.root.classList.contains("hidden");
  }

  get idea() {
    return this.gen?.idea || null;
  }

  setLesson(lesson) {
    this._setLesson(lesson);
    if (this.isOpen) this._roll("all");
  }

  _setLesson(lesson) {
    this.gen = createIdeaGenerator({
      lesson,
      stitch: this._stitch,
      rng: this._rng,
    });
  }

  open() {
    if (!this.root) return;
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this._renderLesson();
    if (!this.gen.idea) {
      if (this.el.prompt) this.el.prompt.textContent = "Rolling a hint inside this lesson…";
      this._roll("all");
    } else {
      this._render(this.gen.idea);
    }
  }

  close() {
    if (!this.root) return;
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
  }

  _bind() {
    if (!this.root) return;
    this.el.reroll?.addEventListener("click", () => this._roll("rest"));
    this.el.rerollAll?.addEventListener("click", () => this._roll("all"));
    this.el.use?.addEventListener("click", () => this._use());
    this.el.dismiss?.addEventListener("click", () => this.close());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) this.close();
    });
  }

  async _roll(mode) {
    if (this._busy || !this.gen) return;
    this._busy = true;
    this._setBusy(true);
    try {
      const idea = mode === "all" ? await this.gen.rerollAll() : await this.gen.reroll();
      this._render(idea);
    } catch {
      this._showError("That lesson could not roll an idea. Check its vocab and grammar frame.");
    } finally {
      this._busy = false;
      this._setBusy(false);
    }
  }

  _use() {
    const idea = this.gen?.accept();
    if (!idea || this._busy) return;
    this.onUse?.(idea);
  }

  _setBusy(on) {
    for (const button of [this.el.reroll, this.el.rerollAll, this.el.use]) {
      if (button) button.disabled = !!on;
    }
  }

  _showError(message) {
    if (this.el.prompt) this.el.prompt.textContent = message;
  }

  _renderLesson() {
    const lesson = this.gen?.lesson;
    if (!lesson) return;
    if (this.el.kicker) this.el.kicker.textContent = lesson.title || "Lesson";
    if (this.el.frame) {
      const tone = [lesson.level, lesson.tone].filter(Boolean).join(" · ");
      const theme = lesson.themeLabel || lesson.theme || "Lesson";
      this.el.frame.textContent = tone
        ? `${theme} · ${lesson.grammar.frame} · ${tone}`
        : `${theme} · ${lesson.grammar.frame}`;
    }
  }

  _render(idea) {
    if (!idea) return;
    this._renderLesson();
    if (this.el.prompt) this.el.prompt.textContent = idea.prompt;
    if (this.el.sentence) this.el.sentence.textContent = `Say: “${idea.sentence}”`;
    if (this.el.hint) {
      const present = SLOT_ORDER.filter(([key]) => idea.slots[key]);
      const lockedCount = present.filter(([key]) => this.gen.isLocked(key)).length;
      this.el.hint.textContent = lockedCount === 0
        ? "Tap a slot to lock it, then reroll the rest. Every roll stays inside this lesson."
        : lockedCount === present.length
          ? "Every slot is locked. Reroll all to start fresh — still inside this lesson."
          : "Locked slots stay. Reroll only fills the open ones, still inside this lesson.";
    }
    if (this.el.reroll) {
      const locked = SLOT_ORDER.some(([key]) => this.gen.isLocked(key));
      this.el.reroll.textContent = locked ? "Reroll the rest" : "Reroll";
    }
    this._renderSlots(idea);
  }

  _renderSlots(idea) {
    const wrap = this.el.slots;
    if (!wrap) return;
    wrap.replaceChildren();
    for (const [key, name] of SLOT_ORDER) {
      const slot = idea.slots[key];
      if (!slot) continue;
      const locked = this.gen.isLocked(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = locked ? "idea-slot is-locked" : "idea-slot";
      button.dataset.slot = key;
      button.setAttribute("aria-pressed", locked ? "true" : "false");
      button.setAttribute("aria-label", `${name}: ${slot.label}. ${locked ? "Unlock" : "Lock"} this slot`);

      const emoji = document.createElement("span");
      emoji.className = "idea-slot-emoji";
      emoji.textContent = slot.emoji || "";
      emoji.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "idea-slot-label";
      label.textContent = slot.label;

      const mark = document.createElement("span");
      mark.className = "idea-slot-lock";
      mark.textContent = locked ? "Locked" : "Lock";

      button.append(emoji, label, mark);
      button.addEventListener("click", () => {
        if (this._busy) return;
        this.gen.toggleLock(key);
        this._render(this.gen.idea);
      });
      wrap.appendChild(button);
    }
  }
}
