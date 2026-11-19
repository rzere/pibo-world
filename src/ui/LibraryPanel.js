import { LIBRARY_MASCOT } from "../data/layers.js";
import { FOOD_LIKES_LESSON } from "../data/lessons/foodLikes.js";
import { highlightStory, lessonWords, makeStory, STORY_THEMES } from "../systems/storyGen.js";
import { loadLibraryLog, saveLibraryLog } from "../systems/libraryLog.js";

function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/**
 * Story maker inside the library. Words start from today's lesson. The child
 * can change them, pick Easy or Medium, and pick a theme. Make my story asks
 * the same AI hook as the arcade, then shows the words highlighted.
 */
export class LibraryPanel {
  constructor({ root, lesson = FOOD_LIKES_LESSON, onClose } = {}) {
    this.root = root;
    this.lesson = lesson;
    this.onClose = onClose || null;
    this.isOpen = false;
    this.level = "easy";
    this.theme = "";
    this.words = new Set(lessonWords(lesson).slice(0, 4).map((word) => word.toLowerCase()));
    this.custom = [];
    this.story = null;
    this.busy = false;
    this.log = loadLibraryLog();
    this._utter = null;
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this.log.add("enter", { lessonId: this.lesson.id }, "child");
    saveLibraryLog(this.log, { lessonId: this.lesson.id });
    this._render();
  }

  close() {
    if (!this.isOpen) return;
    this._stopSpeech();
    this.isOpen = false;
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
    this.log.add("exit", {}, "child");
    saveLibraryLog(this.log, { lessonId: this.lesson.id });
    this.onClose?.();
  }

  _selectedWords() {
    const known = lessonWords(this.lesson);
    const picked = [];
    for (const word of known.concat(this.custom)) {
      if (this.words.has(word.toLowerCase()) && !picked.some((item) => item.toLowerCase() === word.toLowerCase())) {
        picked.push(word);
      }
    }
    return picked;
  }

  _render() {
    this.root.innerHTML = "";
    const scene = h("div", "library-scene");
    const stage = h("div", "library-stage");
    const bg = h("img", "library-bg");
    bg.alt = "";
    bg.src = LIBRARY_MASCOT.background;
    const mascot = h("img", "library-mascot");
    mascot.alt = "";
    mascot.src = LIBRARY_MASCOT.src;
    mascot.style.left = LIBRARY_MASCOT.left;
    mascot.style.top = LIBRARY_MASCOT.top;
    mascot.style.width = LIBRARY_MASCOT.width;
    stage.append(bg, mascot);
    scene.append(stage);
    this.root.append(scene);

    const card = h("div", "library-card");
    const bar = h("div", "library-bar");
    bar.append(h("div", "library-kicker", "Library"));
    const exit = h("button", "library-quiet", "Exit");
    exit.type = "button";
    exit.addEventListener("click", () => this.close());
    bar.append(exit);
    card.append(bar);

    const body = h("div", "library-body");
    body.append(h("h2", "library-title", "Make a little story"));
    body.append(h("p", "library-lead", "Pick today's words. Pibo will use them in a short English story."));

    body.append(h("div", "library-label", "Today's words"));
    const chips = h("div", "library-chips");
    for (const word of lessonWords(this.lesson).concat(this.custom)) {
      const on = this.words.has(word.toLowerCase());
      const button = h("button", "library-chip" + (on ? " is-on" : ""), word);
      button.type = "button";
      button.addEventListener("click", () => {
        const key = word.toLowerCase();
        if (this.words.has(key)) this.words.delete(key);
        else this.words.add(key);
        this.log.add("word", { word, on: this.words.has(key) }, "child");
        saveLibraryLog(this.log, { lessonId: this.lesson.id });
        this._render();
      });
      chips.append(button);
    }
    body.append(chips);

    const add = h("form", "library-add");
    const input = h("input", "library-input");
    input.type = "text";
    input.maxLength = 32;
    input.placeholder = "Add a word";
    input.setAttribute("aria-label", "Add a word");
    const addBtn = h("button", "library-quiet", "Add");
    addBtn.type = "submit";
    add.addEventListener("submit", (event) => {
      event.preventDefault();
      const word = input.value.trim().replace(/\s+/g, " ");
      if (!word) return;
      if (!this.custom.some((item) => item.toLowerCase() === word.toLowerCase())
        && !lessonWords(this.lesson).some((item) => item.toLowerCase() === word.toLowerCase())) {
        this.custom.push(word);
      }
      this.words.add(word.toLowerCase());
      this.log.add("word", { word, typed: true, on: true }, "child");
      saveLibraryLog(this.log, { lessonId: this.lesson.id });
      this._render();
    });
    add.append(input, addBtn);
    body.append(add);

    body.append(h("div", "library-label", "Level"));
    body.append(this._choiceRow(
      [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }],
      this.level,
      (id) => {
        this.level = id;
        this.log.add("level", { level: id }, "child");
        saveLibraryLog(this.log, { lessonId: this.lesson.id });
        this._render();
      },
    ));

    body.append(h("div", "library-label", "Theme"));
    body.append(this._choiceRow(
      STORY_THEMES,
      this.theme,
      (id) => {
        this.theme = this.theme === id ? "" : id;
        const theme = STORY_THEMES.find((item) => item.id === this.theme);
        this.log.add("theme", { theme: theme?.label || "" }, "child");
        saveLibraryLog(this.log, { lessonId: this.lesson.id });
        this._render();
      },
    ));

    const make = h("button", "library-go", this.busy ? "Writing…" : "Make my story");
    make.type = "button";
    make.disabled = this.busy;
    make.addEventListener("click", () => this._make(false));
    body.append(make);

    if (this.story) {
      const story = h("div", "library-story");
      story.innerHTML = highlightStory(this.story.text, this.story.words);
      body.append(story);
      const credit = this.story.author === "ai"
        ? "You picked the words. The helper wrote this story."
        : "You picked the words. This story uses your lesson cards.";
      body.append(h("p", "library-credit", credit));
      const actions = h("div", "library-actions");
      const again = h("button", "library-quiet", "New story");
      again.type = "button";
      again.disabled = this.busy;
      again.addEventListener("click", () => this._make(true));
      const read = h("button", "library-quiet", "Read aloud");
      read.type = "button";
      read.addEventListener("click", () => this._read());
      actions.append(again, read);
      body.append(actions);
    }

    if (this._note) body.append(h("p", "library-note", this._note));
    card.append(body);
    this.root.append(card);
  }

  _choiceRow(options, current, onPick) {
    const row = h("div", "library-chips");
    for (const option of options) {
      const button = h("button", "library-chip" + (option.id === current ? " is-on" : ""), option.label);
      button.type = "button";
      button.addEventListener("click", () => onPick(option.id));
      row.append(button);
    }
    return row;
  }

  async _make(reroll) {
    const words = this._selectedWords();
    if (!words.length) {
      this._note = "Pick one word first.";
      this._render();
      return;
    }
    this._stopSpeech();
    this.busy = true;
    this._note = "";
    if (reroll) this.log.add("reroll", { level: this.level, theme: this.theme }, "child");
    this._render();
    const theme = STORY_THEMES.find((item) => item.id === this.theme)?.label || "";
    const story = await makeStory({
      words,
      level: this.level,
      theme,
      lesson: this.lesson,
    });
    this.story = story;
    this.busy = false;
    this.log.add("story", {
      text: story.text,
      words: story.words,
      level: story.level,
      theme: story.theme,
    }, story.author);
    saveLibraryLog(this.log, { lessonId: this.lesson.id });
    this._render();
  }

  _read() {
    if (!this.story?.text || typeof window.speechSynthesis === "undefined") {
      this._note = "Read aloud needs the browser voice.";
      this._render();
      return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      this._stopSpeech();
      return;
    }
    const utter = new SpeechSynthesisUtterance(this.story.text);
    utter.lang = "en-US";
    utter.rate = this.level === "easy" ? 0.86 : 0.92;
    this._utter = utter;
    this.log.add("read-aloud", { level: this.level }, "child");
    saveLibraryLog(this.log, { lessonId: this.lesson.id });
    synth.cancel();
    synth.speak(utter);
  }

  _stopSpeech() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    this._utter = null;
  }
}
