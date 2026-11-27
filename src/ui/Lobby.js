import { CHARACTERS } from "../data/characters.js";
import { cleanWorldName, randomWorldName } from "../net/Net.js";

const PROFILE_KEY = "pibo.player";

export function loadProfile() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    saved = {};
  }
  const id = saved.id || crypto.randomUUID?.() || `p${Math.random().toString(36).slice(2, 12)}`;
  return { id, name: saved.name || "", char: saved.char || "pibo" };
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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

/**
 * Join screen, the world bar at the top, and the invite card.
 * It only talks to the game through callbacks.
 */
export class Lobby {
  constructor(root = document.getElementById("ui")) {
    this.root = root;
    this.profile = loadProfile();
    this.onJoin = null;
    this.onGoHome = null;
    this.onGoWorld = null;
    this.onInvite = null;
    this._sent = new Set();
    this._buildJoin();
    this._buildBar();
    this._buildInviteCard();
  }

  get isOpen() {
    return !this.join.classList.contains("hidden");
  }

  _buildJoin() {
    const wrap = el("div", "lobby");
    const card = el("form", "lobby-card");
    card.noValidate = true;
    card.append(el("div", "lobby-kicker", "Pibo World"));
    card.append(el("h1", "lobby-title", "Pick a world"));
    card.append(el("p", "lobby-copy", "Friends who type the same two words land on the same island."));

    const worldRow = el("div", "lobby-row");
    const world = el("input", "lobby-input");
    world.id = "lobby-world";
    world.autocomplete = "off";
    world.spellcheck = false;
    world.placeholder = "sunny-otter";
    const fromUrl = cleanWorldName(new URLSearchParams(location.search).get("w"));
    world.value = fromUrl || randomWorldName();
    const dice = el("button", "lobby-dice", "🎲");
    dice.type = "button";
    dice.setAttribute("aria-label", "New world name");
    dice.addEventListener("click", () => {
      world.value = randomWorldName();
    });
    worldRow.append(world, dice);
    card.append(this._label("World", world), worldRow);

    const name = el("input", "lobby-input");
    name.id = "lobby-name";
    name.maxLength = 16;
    name.autocomplete = "nickname";
    name.placeholder = "Your name";
    name.value = this.profile.name;
    card.append(this._label("Your name", name), name);

    card.append(el("div", "lobby-label", "Play as"));
    const grid = el("div", "lobby-chars");
    this._charButtons = new Map();
    for (const c of CHARACTERS) {
      const b = el("button", "lobby-char");
      b.type = "button";
      b.title = c.label;
      const img = el("img");
      img.src = c.thumb;
      img.alt = "";
      b.append(img, el("span", null, c.label));
      b.addEventListener("click", () => this._pick(c.id));
      grid.append(b);
      this._charButtons.set(c.id, b);
    }
    card.append(grid);
    this._pick(this.profile.char);

    const go = el("button", "lobby-go", "Join world");
    go.type = "submit";
    card.append(go);
    this.status = el("div", "lobby-status");
    card.append(this.status);

    card.addEventListener("submit", (e) => {
      e.preventDefault();
      const worldName = cleanWorldName(world.value) || randomWorldName();
      const playerName = name.value.trim().slice(0, 16) || this._defaultName();
      this.profile = { ...this.profile, name: playerName, char: this._char };
      saveProfile(this.profile);
      const url = new URL(location.href);
      url.searchParams.set("w", worldName);
      history.replaceState(null, "", url);
      this.world = worldName;
      this.join.classList.add("hidden");
      this.bar.classList.remove("hidden");
      this.onJoin?.({ world: worldName, me: this.profile });
    });

    wrap.append(card);
    this.root.append(wrap);
    this.join = wrap;
    this._worldInput = world;
    this._nameInput = name;
    setTimeout(() => (fromUrl ? name : world).focus(), 50);
  }

  _label(text, input) {
    const label = el("label", "lobby-label", text);
    label.htmlFor = input.id;
    return label;
  }

  _defaultName() {
    const c = CHARACTERS.find((x) => x.id === this._char);
    return `${c?.label || "Pibo"} ${Math.floor(10 + Math.random() * 89)}`;
  }

  _pick(id) {
    this._char = this._charButtons.has(id) ? id : "pibo";
    for (const [cid, b] of this._charButtons) b.classList.toggle("on", cid === this._char);
  }

  _buildBar() {
    const bar = el("div", "world-bar hidden");
    this.barWhere = el("button", "world-where");
    this.barWhere.type = "button";
    this.barWhere.addEventListener("click", () => this._togglePeople());
    this.barCount = el("span", "world-count");
    this.barWhere.append(this.barCount);

    this.homeBtn = el("button", "world-btn", "🏠 My room");
    this.homeBtn.type = "button";
    this.homeBtn.addEventListener("click", () => {
      if (this._space === "world") this.onGoHome?.();
      else this.onGoWorld?.();
    });

    const share = el("button", "world-btn", "🔗 Share");
    share.type = "button";
    share.title = "Copy invite link";
    share.addEventListener("click", () => this._copyLink());

    this.people = el("div", "world-people hidden");
    bar.append(this.barWhere, this.homeBtn, share, this.people);
    this.root.append(bar);
    this.bar = bar;
    this._space = "world";
    this.setWhere({ space: "world", count: 1, hostName: "" });
  }

  _togglePeople() {
    this.people.classList.toggle("hidden");
  }

  /**
   * Skip the free-world form. A signed-in student already belongs to one class.
   * `title` is the class name shown on the bar. `world` is the join code.
   */
  enter({ world, name, char, title }) {
    const worldName = cleanWorldName(world) || randomWorldName();
    this._pick(char || this.profile.char || "pibo");
    const playerName = String(name || "").trim().slice(0, 16) || this._defaultName();
    this.profile = { ...this.profile, name: playerName, char: this._char };
    saveProfile(this.profile);
    this.world = worldName;
    this.worldTitle = String(title || "").trim() || worldName;
    this.classJoin = true;
    const url = new URL(location.href);
    url.searchParams.set("w", worldName);
    url.searchParams.delete("code");
    url.searchParams.delete("as");
    history.replaceState(null, "", url);
    this.join.classList.add("hidden");
    this.bar.classList.remove("hidden");
    this.onJoin?.({
      world: worldName,
      me: { ...this.profile, classTitle: this.worldTitle },
    });
  }

  async _copyLink() {
    const url = new URL(location.origin + location.pathname);
    if (this.classJoin) url.searchParams.set("code", this.world || "");
    else url.searchParams.set("w", this.world || "");
    try {
      await navigator.clipboard.writeText(url.toString());
      this.onToast?.("Link copied. Send it to a friend!");
    } catch {
      this.onToast?.(url.toString());
    }
  }

  /** space: "world" | "home:<id>". */
  setWhere({ space, count, hostName }) {
    this._space = space;
    const mine = space === `home:${this.profile.id}`;
    let where = `🌍 ${this.worldTitle || this.world || ""}`;
    if (space.startsWith("art:")) where = "🎨 Art room";
    else if (space.startsWith("arcade:")) where = "🕹️ Arcade";
    else if (space !== "world") where = mine ? "🏠 Your room" : `🏠 ${hostName || "A friend"}'s room`;
    this.barWhere.textContent = where;
    this.barCount.textContent = ` · ${count} here`;
    this.barWhere.append(this.barCount);
    this.homeBtn.textContent = space === "world" ? "🏠 My room" : "🌍 Back to world";
  }

  /** peers: [{ id, name, char, space }] for the whole world. */
  setPeople(peers, mySpace) {
    this.people.replaceChildren();
    if (!peers.length) {
      this.people.append(el("div", "world-empty", "Nobody else yet. Share the link!"));
      return;
    }
    for (const p of peers) {
      const row = el("div", "world-person");
      const c = CHARACTERS.find((x) => x.id === p.char) || CHARACTERS[0];
      const img = el("img");
      img.src = c.thumb;
      img.alt = "";
      const where = p.space === mySpace
        ? "with you"
        : p.space === "world"
          ? "in the world"
          : p.space?.startsWith("art:")
            ? "in the art room"
            : p.space?.startsWith("arcade:") ? "in the arcade" : "in a room";
      const label = el("div", "world-person-name");
      label.append(el("b", null, p.name || "Someone"), el("small", null, where));
      const invite = el("button", "world-invite", "Invite");
      invite.type = "button";
      const here = p.space === `home:${this.profile.id}`;
      invite.disabled = here || this._sent.has(p.id);
      if (here) invite.textContent = "Here";
      else if (invite.disabled) invite.textContent = "Sent ✓";
      invite.addEventListener("click", () => {
        this._sent.add(p.id);
        setTimeout(() => this._sent.delete(p.id), 20000);
        this.onInvite?.(p.id);
        invite.textContent = "Sent ✓";
        invite.disabled = true;
      });
      row.append(img, label, invite);
      this.people.append(row);
    }
  }

  setStatus(text) {
    this.status.textContent = text || "";
  }

  _buildInviteCard() {
    const card = el("div", "invite-card hidden");
    this.inviteText = el("div", "invite-text");
    const yes = el("button", "lobby-go", "Visit");
    yes.type = "button";
    const no = el("button", "world-btn", "Not now");
    no.type = "button";
    const actions = el("div", "invite-actions");
    actions.append(no, yes);
    card.append(this.inviteText, actions);
    yes.addEventListener("click", () => {
      card.classList.add("hidden");
      this._onAccept?.();
    });
    no.addEventListener("click", () => card.classList.add("hidden"));
    this.root.append(card);
    this.inviteCard = card;
  }

  showInvite(name, onAccept) {
    this.inviteText.textContent = `${name || "A friend"} invites you to their room 🏠`;
    this._onAccept = onAccept;
    this.inviteCard.classList.remove("hidden");
    clearTimeout(this._inviteTimer);
    this._inviteTimer = setTimeout(() => this.inviteCard.classList.add("hidden"), 15000);
  }
}
