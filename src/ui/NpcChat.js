import { cleanChat } from "./Chat.js";
import { practiceLines } from "../class/lessonPack.js";
import { reportEnglish } from "../class/report.js";
import { morphBubble, typingDelayMs, typingDots, wait } from "./typingDots.js";

const CHIPS = ["Hello!", "I am happy.", "What do you like?", "Goodbye!"];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * English practice with one island animal. Each of their lines starts as
 * three dots, then becomes the words. Later lines come from /api/npc,
 * with a small backup if that is quiet.
 */
export class NpcChat {
  constructor(root = document.getElementById("ui")) {
    this.onClose = null;
    this.onSpeak = null;
    this.friend = null;
    this.messages = [];
    this.busy = false;
    this._typing = false;
    this._liveBubble = null;
    this._build(root);
  }

  get isOpen() {
    return !this.wrap.classList.contains("hidden");
  }

  open(friend) {
    this._token = (this._token || 0) + 1;
    const token = this._token;
    this.friend = friend;
    this.messages = [];
    this._typing = true;
    this.emoji.textContent = friend.emoji || "🐾";
    this.name.textContent = friend.name || "Friend";
    this.input.value = "";
    this.wrap.classList.remove("hidden");
    document.documentElement.classList.add("talking-npc");
    this._setBusy(true);
    this._render();
    this._emit("typing");
    const hello = friend.hello;
    this._after(typingDelayMs(hello), token, () => this._finishNpc(hello));
  }

  close() {
    if (!this.isOpen) return;
    this._emit("clear");
    this._token = (this._token || 0) + 1;
    this._typing = false;
    this._liveBubble = null;
    this.wrap.classList.add("hidden");
    document.documentElement.classList.remove("talking-npc");
    this.friend = null;
    this.messages = [];
    this._setBusy(false);
    this.input.blur();
  }

  _build(root) {
    const wrap = el("div", "npc-chat hidden");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "npc-name");
    this.wrap = wrap;

    const card = el("div", "npc-card");
    const close = el("button", "npc-x", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => this._requestClose());

    const head = el("div", "npc-head");
    this.emoji = el("span", "npc-emoji", "🐾");
    const titles = el("div", "npc-titles");
    titles.append(el("div", "npc-kicker", "Practice English"));
    this.name = el("div", "npc-name", "Friend");
    this.name.id = "npc-name";
    titles.append(this.name);
    head.append(this.emoji, titles);

    this.log = el("div", "npc-log");
    this.log.setAttribute("aria-live", "polite");

    const chips = el("div", "npc-chips");
    this.chips = chips;
    this._fillChips(CHIPS);

    const form = el("form", "npc-form");
    this.input = el("input", "npc-input");
    this.input.type = "text";
    this.input.maxLength = 140;
    this.input.placeholder = "Type in English";
    this.input.setAttribute("aria-label", "Your English sentence");
    this.input.autocomplete = "off";
    this.sendBtn = el("button", "npc-send", "Send");
    this.sendBtn.type = "submit";
    form.append(this.input, this.sendBtn);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._send(this.input.value);
    });

    const foot = el("div", "npc-foot");
    foot.append(el("span", "kb-only"));
    foot.lastChild.innerHTML = "press <b>Esc</b> to close";
    foot.append(el("span", "touch-only", "tap × to close"));

    card.append(close, head, this.log, chips, form, foot);
    wrap.append(card);
    root.append(wrap);
  }

  setLesson(lesson) {
    this.lesson = lesson || null;
    this._fillChips(practiceLines(this.lesson));
  }

  _fillChips(lines) {
    if (!this.chips) return;
    this.chips.replaceChildren();
    for (const text of lines) {
      const chip = el("button", "npc-chip", text);
      chip.type = "button";
      chip.addEventListener("click", () => this._send(text));
      this.chips.append(chip);
    }
  }

  _lessonPayload() {
    const lesson = this.lesson;
    if (!lesson?.fromTeacher) return undefined;
    return {
      vocabulary: (lesson.pools?.object || []).map((item) => item.label),
      grammar: lesson.grammar?.frame || "",
      topic: lesson.classText || lesson.themeLabel || "",
    };
  }

  _requestClose() {
    this.close();
    this.onClose?.();
  }

  _send(raw) {
    if (!this.friend || this.busy) return;
    const text = cleanChat(raw);
    if (!text) return;
    this.input.value = "";
    if (text.includes("★")) {
      const token = this._token;
      const line = "Let's use kind words. What do you like?";
      this.messages.push({ who: "you", text: "…" });
      this._typing = true;
      this._setBusy(true);
      this._render();
      this._emit("typing");
      this._after(typingDelayMs(line), token, () => this._finishNpc(line));
      return;
    }
    this.messages.push({ who: "you", text });
    reportEnglish(text, "practice");
    this._render();
    this._ask();
  }

  async _ask() {
    const friend = this.friend;
    const token = this._token;
    const started = performance.now();
    this._setBusy(true);
    this._typing = true;
    this._render();
    this._emit("typing");
    const history = this.messages
      .filter((m) => m.who === "you" || m.who === "npc")
      .slice(-8)
      .map((m) => ({ who: m.who, text: m.text }));
    let say = this._backup();
    let note = "";
    try {
      const res = await fetch("/api/npc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: friend.id, history, lesson: this._lessonPayload() }),
      });
      const data = await res.json();
      if (data?.say) say = String(data.say).slice(0, 240);
      if (data?.note) note = String(data.note).slice(0, 140);
    } catch {
      say = this._backup();
    }
    if (token !== this._token || !this.isOpen) return;
    const remain = typingDelayMs(say) - (performance.now() - started);
    if (remain > 0) {
      await wait(remain);
      if (token !== this._token || !this.isOpen) return;
    }
    this._finishNpc(say, note);
  }

  _backup() {
    const friend = this.friend;
    const said = this.messages.filter((m) => m.who === "you").length;
    const last = [...this.messages].reverse().find((m) => m.who === "you");
    if (last && /\b(bye|goodbye|see you|good night)\b/i.test(last.text)) {
      return `Bye! Come talk to ${friend.name} again.`;
    }
    return friend.lines[said % friend.lines.length] || friend.hello;
  }

  _setBusy(on) {
    this.busy = on;
    this.input.disabled = on;
    this.sendBtn.disabled = on;
    this.wrap.classList.toggle("busy", on);
  }

  _finishNpc(text, note = "") {
    if (note) this.messages.push({ who: "note", text: note });
    this.messages.push({ who: "npc", text });
    this._typing = false;
    const bubble = this._liveBubble;
    const row = bubble?.closest(".npc-line");
    if (note && row) row.before(el("div", "npc-line note", note));
    if (bubble) morphBubble(bubble, bubble.querySelector(".say-text"), text);
    else this._render();
    this._liveBubble = null;
    this._setBusy(false);
    this._emit("text", text);
    this.log.scrollTop = this.log.scrollHeight;
    const touch = document.documentElement.classList.contains("touch-ui")
      || document.documentElement.classList.contains("phone-landscape");
    if (!touch) this.input.focus();
  }

  _emit(phase, text) {
    this.onSpeak?.({ phase, text, id: this.friend?.id });
  }

  _after(ms, token, fn) {
    wait(ms).then(() => {
      if (token !== this._token || !this.isOpen) return;
      fn();
    });
  }

  _render() {
    this.log.replaceChildren();
    this._liveBubble = null;
    const name = this.friend?.name || "Friend";
    for (const message of this.messages) {
      if (message.who === "note") {
        this.log.append(el("div", "npc-line note", message.text));
        continue;
      }
      if (message.who === "npc") {
        const row = el("div", "npc-line npc");
        row.append(el("b", null, name));
        const bubble = el("div", "say-bubble");
        bubble.append(el("span", "say-text", message.text));
        row.append(bubble);
        this.log.append(row);
        continue;
      }
      const row = el("div", "npc-line you");
      row.append(el("b", null, "You"), document.createTextNode(` ${message.text}`));
      this.log.append(row);
    }
    if (this._typing) {
      const row = el("div", "npc-line npc");
      row.append(el("b", null, name));
      const bubble = el("div", "say-bubble is-typing");
      const text = el("span", "say-text");
      bubble.append(typingDots(), text);
      row.append(bubble);
      this.log.append(row);
      this._liveBubble = bubble;
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
}
