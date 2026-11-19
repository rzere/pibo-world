/**
 * Chat for players in the same space (the shared world or one room).
 * Bottom-left panel: recent lines, quick picks, and a short text box.
 * It only talks to the game through onSend; Multiplayer feeds lines back in.
 */

export const QUICK_CHAT = ["👋 Hi!", "👍", "❤️", "😂", "🎉", "Follow me!", "Let's play!", "Bye! 👋"];

export const MAX_CHAT = 80;
const MAX_LINES = 40;
const MIN_GAP_MS = 900;

// Kids play here: a small, obvious list. Real moderation would live on a server.
const BLOCKED = [
  "fuck", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "slut", "whore",
  "fag", "nigg", "retard", "kill yourself", "kys", "sex", "porn", "nude",
];

/** Trim, shorten, and star out blocked words. Returns "" if nothing is left. */
export function cleanChat(raw) {
  let text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHAT);
  for (const word of BLOCKED) {
    const re = new RegExp(`\\b${word.replace(/ /g, "\\s*")}\\w*`, "gi");
    text = text.replace(re, (m) => "★".repeat(m.length));
  }
  return text;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export class Chat {
  constructor(root = document.getElementById("ui")) {
    this.onSend = null;
    this._lastSent = 0;
    this._unread = 0;
    this._build(root);
    const touch = document.documentElement.classList.contains("touch-ui")
      || window.matchMedia?.("(pointer: coarse)").matches;
    this.setOpen(!touch);
    window.addEventListener("keydown", (e) => {
      if (this.wrap.classList.contains("hidden")) return;
      if (e.code !== "KeyT" && e.code !== "Slash") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      this.setOpen(true);
      this.input.focus();
    });
  }

  _build(root) {
    const wrap = el("div", "chat hidden");
    this.toggle = el("button", "chat-toggle");
    this.toggle.type = "button";
    this.toggle.setAttribute("aria-label", "Chat");
    this.toggle.append(el("span", null, "💬"));
    this.badge = el("span", "chat-badge hidden");
    this.toggle.append(this.badge);
    this.toggle.addEventListener("click", () => this.setOpen(!this.isOpen));

    const panel = el("div", "chat-panel");
    this.log = el("div", "chat-log");
    this.log.setAttribute("aria-live", "polite");
    this.log.append(el("div", "chat-empty", "Say hi to your friends!"));

    const quick = el("div", "chat-quick");
    for (const text of QUICK_CHAT) {
      const b = el("button", "chat-chip", text);
      b.type = "button";
      b.addEventListener("click", () => this._send(text));
      quick.append(b);
    }

    const form = el("form", "chat-form");
    this.input = el("input", "chat-input");
    this.input.type = "text";
    this.input.maxLength = MAX_CHAT;
    this.input.placeholder = "Type a message…";
    this.input.autocomplete = "off";
    this.input.setAttribute("aria-label", "Chat message");
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.input.blur();
        document.getElementById("scene")?.focus();
      }
    });
    const send = el("button", "chat-send", "Send");
    send.type = "submit";
    form.append(this.input, send);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this._send(this.input.value)) this.input.value = "";
    });

    panel.append(this.log, quick, form);
    wrap.append(panel, this.toggle);
    root.append(wrap);
    this.wrap = wrap;
  }

  get isOpen() {
    return this.wrap.classList.contains("open");
  }

  setOpen(open) {
    this.wrap.classList.toggle("open", open);
    this.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      this._unread = 0;
      this._badge();
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  show() {
    this.wrap.classList.remove("hidden");
  }

  _send(raw) {
    const text = cleanChat(raw);
    if (!text) return false;
    const now = Date.now();
    if (now - this._lastSent < MIN_GAP_MS) return false;
    this._lastSent = now;
    this.onSend?.(text);
    return true;
  }

  /** A line in the log. mine marks your own lines; system lines have no name. */
  add({ name = "", text, mine = false, system = false }) {
    this.log.querySelector(".chat-empty")?.remove();
    const line = el("div", `chat-line${mine ? " mine" : ""}${system ? " system" : ""}`);
    if (!system) line.append(el("b", null, `${name || "Someone"}: `));
    line.append(document.createTextNode(text));
    const stick = this.log.scrollTop + this.log.clientHeight >= this.log.scrollHeight - 8;
    this.log.append(line);
    while (this.log.children.length > MAX_LINES) this.log.firstChild.remove();
    if (stick || mine) this.log.scrollTop = this.log.scrollHeight;
    if (!this.isOpen && !mine && !system) {
      this._unread += 1;
      this._badge();
    }
  }

  _badge() {
    this.badge.textContent = this._unread > 9 ? "9+" : String(this._unread);
    this.badge.classList.toggle("hidden", this._unread === 0);
  }
}
