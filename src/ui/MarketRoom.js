import {
  askTiles,
  cap,
  cleanStall,
  coinWord,
  findHint,
  fullRequest,
  judgePayment,
  judgeRequest,
  makeAskList,
  makeFindList,
  numberWord,
  phrase,
  priceOf,
  starsFor,
} from "../market/tutor.js";
import { addStars, levelDone, levelOpen, loadProgress, loadStall, saveStall } from "../market/progress.js";
import { cleanChat } from "./Chat.js";

/**
 * Pibo Market: the grocery stall on the right of the island, inside.
 * Learn words in class, use them here.
 *
 *   Level 1  Find it         pick the list's items off the shelves
 *   Level 2  Ask for it      build "Can I have two bananas, please?", then pay
 *   Level 3  Run your stall  choose stock, prices, a sign and a list for friends
 *
 * Item data lives in src/data/market.json. Positions are pixels on
 * market-room.jpg (1280×720), the same cover-fit as the other rooms.
 */
const DATA_URL = "src/data/market.json";

const UNITS = [
  { category: "fruit", left: 19, right: 231 },
  { category: "vegetables", left: 231, right: 431 },
  { category: "bakery", left: 431, right: 638 },
  { category: "dairy", left: 638, right: 844 },
];
const SIGN_Y = 200;
const SHELF_FLOORS = [312, 412, 506];
const ITEM_W = 66;
const KEEPER = { x: 1012, feet: 446, w: 196, clipBottom: 404 };
const DISH = { x: 931, y: 396 };
const COUNTER_GOODS = { x: 1080, y: 400 };
const DOOR = { left: 1172, top: 196, right: 1280, bottom: 510 };
const BANNER = { x: 431, y: 128 };

const INK = "#3a2a24";

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function button(cls, text, onClick) {
  const b = el("button", cls, text);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

export class MarketRoom {
  /**
   * getPlayer: () => ({ name, thumb }) for greetings and Level 3.
   * getFriendStalls: () => [{ name, stall }] from players in the same world.
   * onStall(stall): share the saved stall.  onTrophy(trophy): a level was finished.
   */
  constructor({ parent = document.getElementById("ui"), onClose, getPlayer, getFriendStalls, onStall, onTrophy } = {}) {
    this.onClose = onClose || null;
    this.getPlayer = getPlayer || (() => ({ name: "Pibo", thumb: "" }));
    this.getFriendStalls = getFriendStalls || (() => []);
    this.onStall = onStall || null;
    this.onTrophy = onTrophy || null;
    this.isOpen = false;
    this.muted = false;
    this.data = null;
    this.byId = {};
    this._build(parent);
    this.ready = this._load();
  }

  async _load() {
    try {
      const res = await fetch(DATA_URL);
      this.data = await res.json();
    } catch {
      this.data = null;
      return;
    }
    for (const item of this.data.items) this.byId[item.id] = item;
    this._buildShelves();
    this.layout();
  }

  /* ---------------------------------------------------------------- build */

  _build(parent) {
    const root = el("div", "art-overlay market-overlay hidden");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Pibo Market");
    const bg = el("img", "art-bg");
    bg.alt = "";
    bg.src = "assets/painted/market-room.jpg";
    bg.addEventListener("load", () => this.layout());
    root.appendChild(bg);
    this.bg = bg;

    this.stage = el("div", "market-stage");
    root.appendChild(this.stage);

    this.banner = el("div", "market-banner hidden");
    this.stage.appendChild(this.banner);

    this.signs = [];
    this.slots = [];

    this.keeperBox = el("div", "market-keeper");
    this.keeper = el("img", "market-keeper-img");
    this.keeper.alt = "Shopkeeper";
    this.keeper.draggable = false;
    this.keeperBox.appendChild(this.keeper);
    this.stage.appendChild(this.keeperBox);

    this.bubble = el("div", "market-bubble hidden");
    this.bubble.setAttribute("aria-live", "polite");
    this.stage.appendChild(this.bubble);

    this.dish = el("div", "market-dish");
    this.stage.appendChild(this.dish);
    this.goods = el("div", "market-goods");
    this.stage.appendChild(this.goods);

    this.door = button("market-door", "", () => this.onClose?.());
    this.door.setAttribute("aria-label", "Exit to the island");
    this.door.title = "Exit";
    this.door.appendChild(el("span", "market-door-tag", "Exit"));
    this.stage.appendChild(this.door);

    const back = button("art-back", "", () => this.onClose?.());
    back.setAttribute("aria-label", "Exit");
    back.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 12L16 24l12 12" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    root.appendChild(back);

    this.levelBar = el("div", "market-levels");
    root.appendChild(this.levelBar);

    this.listCard = el("div", "market-list");
    root.appendChild(this.listCard);

    this.tray = el("div", "market-tray hidden");
    root.appendChild(this.tray);

    this.sheet = el("div", "market-sheet hidden");
    root.appendChild(this.sheet);

    parent.appendChild(root);
    this.root = root;
  }

  _buildShelves() {
    const cats = Object.fromEntries(this.data.categories.map((c) => [c.id, c.label]));
    for (const unit of UNITS) {
      const sign = el("div", "market-sign", cats[unit.category] || unit.category);
      this.stage.appendChild(sign);
      this.signs.push({ el: sign, x: (unit.left + unit.right) / 2 });
      const ids = this.data.shelves[unit.category] || [];
      ids.forEach((id, i) => {
        const item = this.byId[id];
        if (!item) return;
        const floor = Math.floor(i / 2);
        const col = i % 2;
        const x = unit.left + (unit.right - unit.left) * (col ? 0.69 : 0.31);
        const y = SHELF_FLOORS[floor] - 3;
        const b = button("market-item", "", () => this._tapItem(id, b));
        b.dataset.word = item.word;
        b.dataset.id = id;
        b.setAttribute("aria-label", item.word);
        const img = el("img");
        img.src = item.image;
        img.alt = "";
        img.draggable = false;
        b.appendChild(img);
        this.stage.appendChild(b);
        this.slots.push({ el: b, id, x, y });
      });
    }
  }

  /* ----------------------------------------------------------- open/close */

  async open() {
    this.isOpen = true;
    this.root.classList.remove("hidden");
    document.documentElement.classList.add("in-market");
    await this.ready;
    if (!this.data) {
      this._say("The shop is closed for now. Come back soon!");
      return;
    }
    const progress = loadProgress();
    const levels = this.data.levels;
    const next = levels.find((l) => levelOpen(progress, levels, l.id) && !levelDone(progress, l))
      || [...levels].reverse().find((l) => levelOpen(progress, levels, l.id));
    this._startLevel(next.id, { greet: true });
    this.layout();
  }

  close() {
    this.isOpen = false;
    this.root.classList.add("hidden");
    document.documentElement.classList.remove("in-market");
    this.sheet.classList.add("hidden");
    window.speechSynthesis?.cancel();
  }

  /** Esc: close a card first, then leave the shop. Returns true if handled inside. */
  back() {
    if (!this.sheet.classList.contains("hidden")) {
      this.sheet.classList.add("hidden");
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- voice */

  /** queue: wait for the child's own sentence to finish instead of cutting it off. */
  _say(text, { speak = true, queue = false } = {}) {
    this.bubble.textContent = text;
    this.bubble.classList.remove("hidden");
    this.bubble.classList.remove("pop");
    void this.bubble.offsetWidth;
    this.bubble.classList.add("pop");
    if (speak) this._speak(text, 1.15, queue);
  }

  _speak(text, pitch = 1, queue = false) {
    const synth = window.speechSynthesis;
    if (this.muted || !synth || typeof SpeechSynthesisUtterance === "undefined") return;
    if (!queue) synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/"/g, ""));
    u.lang = "en-GB";
    u.rate = 0.9;
    u.pitch = pitch;
    const voice = synth.getVoices().find((v) => v.lang === "en-GB") || synth.getVoices().find((v) => v.lang?.startsWith("en"));
    if (voice) u.voice = voice;
    synth.speak(u);
  }

  _sayWord(item) {
    if (item.audio) {
      const audio = new Audio(item.audio);
      if (!this.muted) audio.play().catch(() => this._speak(item.word));
      return;
    }
    this._speak(item.word);
  }

  /* -------------------------------------------------------------- levels */

  _startLevel(id, { greet = false } = {}) {
    const level = this.data.levels.find((l) => l.id === id);
    if (!level) return;
    this.level = level;
    this.mode = "level";
    this.stall = null;
    this.sheet.classList.add("hidden");
    this.banner.classList.add("hidden");
    this._keeperAs(null);
    this._renderLevels();
    if (level.id === 3) {
      this.list = [];
      this._clearCounter();
      this._renderList();
      this._renderStallMenu();
      this._say(greet
        ? `Hi ${this._name()}! Today you're the shopkeeper. Build your own stall!`
        : "Now you're the shopkeeper! Build your stall, then friends can shop there.");
      return;
    }
    this._newList(greet);
  }

  _newList(greet = false) {
    const level = this.level;
    const items = this.data.items;
    this.slips = 0;
    this.dishCoins = [];
    this.handed = [];
    this._clearCounter();
    if (level.id === 1) {
      this.list = makeFindList(items, level.itemsPerList).map((e) => ({ ...e, done: false }));
      this.phase = "find";
    } else {
      this.list = makeAskList(items, level.itemsPerList, level.maxQuantity).map((e) => ({ ...e, done: false }));
      this.phase = "ask";
      this.current = 0;
    }
    this._renderList();
    this._renderTray();
    const hello = `Hi ${this._name()}! Mum needs some things. Can you help?`;
    if (level.id === 1) this._say(greet ? hello : "Here's a new list. Find everything on the shelves!");
    else this._say(greet ? `${hello} What would you like?` : "Here's a new list. What would you like?");
  }

  _name() {
    return this.getPlayer()?.name || "Pibo";
  }

  _renderLevels() {
    const progress = loadProgress();
    this.levelBar.replaceChildren();
    for (const level of this.data.levels) {
      const open = levelOpen(progress, this.data.levels, level.id);
      const done = levelDone(progress, level);
      const b = button(`market-level${this.level?.id === level.id && this.mode !== "challenge" ? " on" : ""}`, "", () => {
        if (open) this._startLevel(level.id);
        else this._say(`Finish level ${level.id - 1} first. You can do it!`);
      });
      b.setAttribute("aria-label", `Level ${level.id}: ${level.title}${open ? "" : " (locked)"}`);
      b.append(el("b", null, open ? String(level.id) : "🔒"), el("span", null, level.title));
      const stars = progress.stars[level.id];
      if (done) b.append(el("i", "market-level-done", "🏆"));
      else if (stars.length) b.append(el("i", null, `${stars.length}/${level.lists}`));
      if (!open) b.classList.add("locked");
      this.levelBar.appendChild(b);
    }
    const mute = button("market-level market-mute", this.muted ? "🔇" : "🔊", () => {
      this.muted = !this.muted;
      if (this.muted) window.speechSynthesis?.cancel();
      this._renderLevels();
    });
    mute.setAttribute("aria-label", this.muted ? "Turn voice on" : "Turn voice off");
    this.levelBar.appendChild(mute);
  }

  _renderList() {
    const card = this.listCard;
    card.replaceChildren();
    const title = this.mode === "challenge"
      ? `${this.stall.by || "A friend"}'s list`
      : this.level?.id === 3 ? "Your stall" : "Shopping list";
    card.append(el("div", "market-list-title", `🧾 ${title}`));
    if (this.mode === "level" && this.level.id !== 3) {
      const progress = loadProgress();
      const count = Math.min(progress.stars[this.level.id].length + 1, this.level.lists);
      card.append(el("div", "market-list-sub", `Level ${this.level.id} · list ${count} of ${this.level.lists}`));
    }
    if (this.mode === "level" && this.level.id === 3) {
      const stall = this._myStall();
      card.append(el("div", "market-list-sub", stall ? `“${stall.sign || "My stall"}”` : "Not built yet"));
      for (const s of stall?.items || []) {
        const row = el("div", "market-list-row");
        const img = el("img");
        img.src = this.byId[s.id].image;
        img.alt = "";
        row.append(img, el("span", null, this.byId[s.id].word), el("b", "market-price", coinWord(s.price)));
        card.appendChild(row);
      }
      return;
    }
    this.list.forEach((entry, i) => {
      const item = this.byId[entry.id];
      const row = el("div", `market-list-row${entry.done ? " done" : ""}${this.phase === "ask" && i === this.current ? " now" : ""}`);
      const img = el("img");
      img.src = item.image;
      img.alt = "";
      row.append(img, el("span", null, phrase(item, entry.qty)), el("b", "market-tick", entry.done ? "✓" : ""));
      row.addEventListener("click", () => this._sayWord(item));
      card.appendChild(row);
    });
  }

  /* ------------------------------------------------------- level 1: find */

  _tapItem(id, node) {
    const item = this.byId[id];
    node.classList.remove("named");
    void node.offsetWidth;
    node.classList.add("named");
    clearTimeout(node._named);
    node._named = setTimeout(() => node.classList.remove("named"), 1400);
    const finding = (this.mode === "level" && this.level.id === 1) || (this.mode === "challenge" && this.phase === "find");
    if (!finding) {
      this._sayWord(item);
      if (this.mode === "level" && this.level.id === 2 && this.phase === "ask") {
        this._say(`That's ${phrase(item)}. Ask me for things at the counter!`, { speak: false });
      }
      return;
    }
    if (this.phase !== "find") return;
    const entry = this.list.find((e) => e.id === id);
    const needed = this.list.find((e) => !e.done);
    if (!needed) return;
    if (entry && !entry.done) {
      entry.done = true;
      this._sayWord(item);
      this._flyToBasket(node, item);
      this._renderList();
      this._renderTray();
      const left = this.list.filter((e) => !e.done).length;
      if (!left) {
        if (this.mode === "challenge") this._toPay();
        else this._finishList();
      } else {
        this._say(`Yes, ${phrase(item, entry.qty)}! ${left === 1 ? "One more thing." : `${cap(numberWord(left))} more things.`}`, { speak: false });
      }
      return;
    }
    this.slips += 1;
    node.classList.add("nope");
    setTimeout(() => node.classList.remove("nope"), 450);
    this._say(findHint(item, this.byId[needed.id], !!entry));
  }

  _flyToBasket(node, item) {
    const from = node.getBoundingClientRect();
    const to = this.tray.querySelector(".market-basket")?.getBoundingClientRect();
    if (!to || !from.width) return;
    const ghost = el("img", "market-fly");
    ghost.src = item.image;
    ghost.alt = "";
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px` });
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top - from.top}px) scale(0.6)`;
      ghost.style.opacity = "0.2";
    });
    setTimeout(() => ghost.remove(), 520);
  }

  /* -------------------------------------------------------- level 2: ask */

  _renderTray() {
    const tray = this.tray;
    tray.replaceChildren();
    tray.classList.remove("hidden");
    if (this.phase === "find") {
      const basket = el("div", "market-basket");
      basket.append(el("span", "market-basket-icon", "🧺"));
      for (const entry of this.list.filter((e) => e.done)) {
        const img = el("img");
        img.src = this.byId[entry.id].image;
        img.alt = this.byId[entry.id].word;
        basket.appendChild(img);
      }
      tray.append(basket, el("div", "market-hint", "Tap the things on the list."));
      return;
    }
    if (this.phase === "ask") {
      const entry = this.list[this.current];
      const item = this.byId[entry.id];
      if (!this.tiles) this.tiles = askTiles(item, entry.qty, this.data.items);
      this.built = this.built || [];
      const line = el("div", "market-sentence");
      if (!this.built.length) line.append(el("span", "market-sentence-empty", "Tap words to ask…"));
      this.built.forEach((word, i) => {
        line.appendChild(button("market-tile in", word, () => {
          this.built.splice(i, 1);
          this._renderTray();
        }));
      });
      const tiles = el("div", "market-tiles");
      const used = [...this.built];
      for (const word of this.tiles) {
        const k = used.indexOf(word);
        const isUsed = k >= 0;
        if (isUsed) used.splice(k, 1);
        const t = button("market-tile", word, () => {
          this.built.push(word);
          this._renderTray();
        });
        t.disabled = isUsed;
        tiles.appendChild(t);
      }
      const actions = el("div", "market-actions");
      actions.append(
        button("market-quiet", "Clear", () => {
          this.built = [];
          this._renderTray();
        }),
        button("market-go", "Ask 💬", () => this._ask()),
      );
      tray.append(line, tiles, actions);
      return;
    }
    if (this.phase === "price") {
      const actions = el("div", "market-actions");
      actions.append(button("market-go big", "How much is it? 🪙", () => this._askPrice()));
      tray.append(actions);
      return;
    }
    if (this.phase === "pay") {
      const coins = el("div", "market-coins");
      for (const value of this.data.coins) {
        const c = button("market-coin", String(value), () => {
          if (this.dishCoins.length >= 12) return;
          this.dishCoins.push(value);
          this._renderDish();
          this._renderTray();
        });
        c.setAttribute("aria-label", coinWord(value));
        coins.appendChild(c);
      }
      const actions = el("div", "market-actions");
      actions.append(
        button("market-quiet", "Take back", () => {
          this.dishCoins.pop();
          this._renderDish();
          this._renderTray();
        }),
        button("market-go", "Pay", () => this._pay()),
      );
      tray.append(el("div", "market-hint", `Put ${coinWord(this.price)} on the dish.`), coins, actions);
      return;
    }
    tray.classList.add("hidden");
  }

  _ask() {
    const entry = this.list[this.current];
    const item = this.byId[entry.id];
    const said = this.built.join(" ");
    this._speak(said, 1);
    const verdict = judgeRequest(this.built, item, entry.qty, this.data.items);
    this.slips += verdict.slips;
    this._say(verdict.say, { queue: !!said });
    if (!verdict.accepted) return;
    entry.done = true;
    this.handed.push(entry);
    this._renderCounter();
    this.built = [];
    this.tiles = null;
    const next = this.list.findIndex((e) => !e.done);
    if (next >= 0) {
      this.current = next;
      setTimeout(() => {
        if (this.phase === "ask") this._say("Anything else?");
      }, 3200);
    } else {
      this.phase = "price";
    }
    this._renderList();
    this._renderTray();
  }

  _toPay() {
    this.phase = "price";
    this._renderTray();
    this._say("Great, you found everything! Now pay at the counter.");
  }

  _askPrice() {
    this._speak("How much is it?", 1);
    const prices = this.mode === "challenge" ? Object.fromEntries(this.stall.items.map((s) => [s.id, s.price])) : null;
    this.price = priceOf(this.list, this.byId, prices);
    this.dishCoins = [];
    this.phase = "pay";
    this._renderDish();
    this._renderTray();
    this._say(`That's ${coinWord(this.price)}, please.`, { queue: true });
  }

  _pay() {
    const verdict = judgePayment(this.dishCoins, this.price);
    this._say(verdict.say);
    if (!verdict.ok) {
      this.slips += 1;
      return;
    }
    this.phase = "paid";
    this._renderTray();
    setTimeout(() => {
      if (this.mode === "challenge") this._finishChallenge();
      else this._finishList();
    }, 1800);
  }

  _renderDish() {
    this.dish.replaceChildren();
    this.dishCoins.forEach((value, i) => {
      const c = el("span", "market-dish-coin", String(value));
      c.style.setProperty("--i", String(i));
      this.dish.appendChild(c);
    });
  }

  _renderCounter() {
    this.goods.replaceChildren();
    for (const entry of this.handed) {
      for (let n = 0; n < entry.qty; n++) {
        const img = el("img");
        img.src = this.byId[entry.id].image;
        img.alt = "";
        this.goods.appendChild(img);
      }
    }
  }

  _clearCounter() {
    this.handed = [];
    this.dishCoins = [];
    this.tiles = null;
    this.built = [];
    this._renderCounter();
    this._renderDish();
  }

  /* ---------------------------------------------------------- finishing */

  _finishList() {
    const stars = starsFor(this.slips);
    const { progress, newTrophy } = addStars(this.level, stars);
    this.phase = "done";
    this._renderTray();
    this._renderLevels();
    const levels = this.data.levels;
    const done = levelDone(progress, this.level);
    const nextLevel = levels.find((l) => l.id === this.level.id + 1);
    this._say(stars === 3 ? "Perfect shopping! Thank you so much!" : "Well done! Mum will be so happy!");
    const card = el("div", "market-card");
    card.append(el("div", "market-stars", "⭐".repeat(stars) + "☆".repeat(3 - stars)));
    card.append(el("div", "market-card-title", stars === 3 ? "Perfect list!" : "List done!"));
    if (newTrophy) {
      const t = el("div", "market-trophy");
      const img = el("img");
      img.src = newTrophy.src;
      img.alt = "";
      t.append(img, el("span", null, `New trophy! It's waiting in your mushroom house.`));
      card.append(t);
      this.onTrophy?.(newTrophy);
    }
    const actions = el("div", "market-actions");
    if (done && nextLevel) {
      actions.append(button("market-go", `Level ${nextLevel.id}: ${nextLevel.title} →`, () => this._startLevel(nextLevel.id)));
      actions.append(button("market-quiet", "Another list", () => this._startLevel(this.level.id)));
    } else {
      actions.append(button("market-go", "Next list →", () => {
        this.sheet.classList.add("hidden");
        this._newList();
      }));
    }
    actions.append(button("market-quiet", "Back outside", () => this.onClose?.()));
    card.append(actions);
    this._showSheet(card);
  }

  _showSheet(card) {
    this.sheet.replaceChildren(card);
    this.sheet.classList.remove("hidden");
  }

  /* -------------------------------------------------- level 3: the stall */

  _myStall() {
    const raw = loadStall();
    return raw ? cleanStall(raw, this.byId, this._stallRules()) : null;
  }

  _stallRules() {
    const level = this.data.levels.find((l) => l.id === 3);
    return { maxItems: level.stallItems, maxPrice: level.maxPrice, clean: cleanChat };
  }

  _renderStallMenu() {
    this.phase = "stall";
    const tray = this.tray;
    tray.replaceChildren();
    tray.classList.remove("hidden");
    const mine = this._myStall();
    const actions = el("div", "market-actions");
    actions.append(button("market-go", mine ? "✏️ Change my stall" : "🛠️ Build my stall", () => this._openStallEditor()));
    if (mine) actions.append(button("market-quiet", "Try my list", () => this._playStall({ ...mine, by: this._name() }, true)));
    tray.append(actions);
    const friends = this.getFriendStalls()
      .map((f) => ({ name: f.name, stall: cleanStall(f.stall, this.byId, this._stallRules()) }))
      .filter((f) => f.stall);
    const row = el("div", "market-friends");
    if (friends.length) {
      row.append(el("span", "market-hint", "Friends' stalls:"));
      for (const f of friends) row.append(button("market-quiet", `🛒 ${f.name || "Friend"}`, () => this._playStall({ ...f.stall, by: f.name })));
    } else {
      row.append(el("span", "market-hint", "When friends in your world build stalls, you can shop there too."));
    }
    tray.append(row);
  }

  _openStallEditor() {
    const level = this.data.levels.find((l) => l.id === 3);
    const saved = this._myStall();
    const draft = {
      items: saved ? saved.items.map((s) => ({ ...s })) : [],
      sign: saved?.sign || "",
      list: saved ? saved.list.map((e) => ({ ...e })) : [],
    };
    const card = el("div", "market-card market-editor");
    const render = () => {
      card.replaceChildren();
      card.append(el("div", "market-card-title", "🛠️ My stall"));
      card.append(el("div", "market-label", `1. Choose up to ${level.stallItems} things to sell`));
      const grid = el("div", "market-pick-grid");
      for (const item of this.data.items) {
        const on = draft.items.some((s) => s.id === item.id);
        const b = button(`market-pick${on ? " on" : ""}`, "", () => {
          if (on) {
            draft.items = draft.items.filter((s) => s.id !== item.id);
            draft.list = draft.list.filter((e) => e.id !== item.id);
          } else if (draft.items.length < level.stallItems) {
            draft.items.push({ id: item.id, price: item.price });
          }
          this._sayWord(item);
          render();
        });
        const img = el("img");
        img.src = item.image;
        img.alt = "";
        b.append(img, el("span", null, item.word));
        grid.appendChild(b);
      }
      card.append(grid);
      if (draft.items.length) {
        card.append(el("div", "market-label", "2. Set prices and make a shopping list for friends"));
        for (const s of draft.items) {
          const item = this.byId[s.id];
          const row = el("div", "market-edit-row");
          const img = el("img");
          img.src = item.image;
          img.alt = "";
          const price = el("div", "market-stepper");
          price.append(
            button("market-step", "−", () => { s.price = Math.max(1, s.price - 1); render(); }),
            el("b", null, `🪙 ${s.price}`),
            button("market-step", "+", () => { s.price = Math.min(level.maxPrice, s.price + 1); render(); }),
          );
          const entry = draft.list.find((e) => e.id === s.id);
          const qty = entry?.qty || 0;
          const maxQty = item.countable ? 3 : 1;
          const want = el("div", "market-stepper");
          want.append(
            button("market-step", "−", () => {
              if (!entry) return;
              if (entry.qty <= 1) draft.list = draft.list.filter((e) => e.id !== s.id);
              else entry.qty -= 1;
              render();
            }),
            el("b", null, qty ? phrase(item, qty) : "not on list"),
            button("market-step", "+", () => {
              if (!entry) draft.list.push({ id: s.id, qty: 1 });
              else entry.qty = Math.min(maxQty, entry.qty + 1);
              render();
            }),
          );
          row.append(img, el("span", "market-edit-word", item.word), price, want);
          card.append(row);
        }
      }
      card.append(el("div", "market-label", "3. Write your sign"));
      const sign = el("input", "market-input");
      sign.type = "text";
      sign.maxLength = 28;
      sign.placeholder = "Fresh fruit here!";
      sign.value = draft.sign;
      sign.addEventListener("input", () => { draft.sign = sign.value; });
      card.append(sign);
      const status = el("div", "market-hint");
      const actions = el("div", "market-actions");
      actions.append(
        button("market-quiet", "Cancel", () => this.sheet.classList.add("hidden")),
        button("market-go", "Save my stall", () => {
          const stall = cleanStall({ ...draft, by: this._name() }, this.byId, this._stallRules());
          if (!stall) {
            status.textContent = "Choose something to sell and put at least one thing on the list.";
            return;
          }
          this._saveStall(stall);
        }),
      );
      card.append(status, actions);
    };
    render();
    this._showSheet(card);
  }

  _saveStall(stall) {
    saveStall(stall);
    this.onStall?.(stall);
    this.sheet.classList.add("hidden");
    const level = this.data.levels.find((l) => l.id === 3);
    const progress = loadProgress();
    let newTrophy = null;
    if (!levelDone(progress, level)) newTrophy = addStars(level, 3).newTrophy;
    this._renderList();
    this._renderLevels();
    this._renderStallMenu();
    this._say(stall.sign ? `"${stall.sign}" What a lovely stall!` : "What a lovely stall! Friends can shop here now.");
    if (newTrophy) {
      this.onTrophy?.(newTrophy);
      const card = el("div", "market-card");
      const t = el("div", "market-trophy");
      const img = el("img");
      img.src = newTrophy.src;
      img.alt = "";
      t.append(img, el("span", null, "New trophy! It's waiting in your mushroom house."));
      card.append(el("div", "market-card-title", "Your stall is open!"), t);
      const actions = el("div", "market-actions");
      actions.append(button("market-go", "Try my list", () => this._playStall({ ...stall, by: this._name() }, true)));
      actions.append(button("market-quiet", "Close", () => this.sheet.classList.add("hidden")));
      card.append(actions);
      this._showSheet(card);
    }
  }

  /** Play a stall's list: find the things, then pay its prices. */
  _playStall(stall, mine = false) {
    this.mode = "challenge";
    this.stall = stall;
    this.sheet.classList.add("hidden");
    this.slips = 0;
    this._clearCounter();
    this.list = stall.list.map((e) => ({ ...e, done: false }));
    this.phase = "find";
    this.banner.textContent = stall.sign || `${stall.by || "A friend"}'s stall`;
    this.banner.classList.remove("hidden");
    this._keeperAs(mine ? this.getPlayer()?.thumb : null);
    this._renderLevels();
    this._renderList();
    this._renderTray();
    this._say(mine ? "This is your list. Let's test it!" : `Welcome to ${stall.by || "my friend"}'s stall! Here's their list.`);
    this.layout();
  }

  _finishChallenge() {
    this.phase = "done";
    this._renderTray();
    const card = el("div", "market-card");
    card.append(el("div", "market-stars", "🛍️"));
    card.append(el("div", "market-card-title", `You shopped at ${this.stall.by || "a friend"}'s stall!`));
    const actions = el("div", "market-actions");
    actions.append(button("market-go", "Back to my stall", () => this._startLevel(3)));
    actions.append(button("market-quiet", "Back outside", () => this.onClose?.()));
    card.append(actions);
    this._showSheet(card);
    this._say("Thank you for shopping here!");
  }

  _keeperAs(src) {
    this.keeper.src = src || "assets/critters/penguin/front-a.png";
    this.keeperBox.classList.toggle("is-player", !!src);
  }

  /* -------------------------------------------------------------- layout */

  layout() {
    if (!this.isOpen) return;
    const vw = this.root.clientWidth || window.innerWidth;
    const vh = this.root.clientHeight || window.innerHeight;
    const imgW = this.bg.naturalWidth || 1280;
    const imgH = this.bg.naturalHeight || 720;
    const cover = Math.max(vw / imgW, vh / imgH) * (imgW / 1280);
    const ox = (vw - 1280 * cover) / 2;
    const oy = (vh - 720 * cover) / 2;
    const at = (node, x, y) => {
      node.style.left = `${ox + x * cover}px`;
      node.style.top = `${oy + y * cover}px`;
    };
    this.root.style.setProperty("--market-scale", String(cover));
    for (const s of this.signs) at(s.el, s.x, SIGN_Y);
    for (const slot of this.slots) {
      at(slot.el, slot.x, slot.y);
      slot.el.style.width = `${ITEM_W * cover}px`;
    }
    // The whole character, uncropped, standing on the counter top.
    const keeperH = KEEPER.clipBottom - 236;
    Object.assign(this.keeperBox.style, {
      left: `${ox + (KEEPER.x - KEEPER.w / 2) * cover}px`,
      top: `${oy + 210 * cover}px`,
      width: `${KEEPER.w * cover}px`,
      height: `${(KEEPER.clipBottom - 210) * cover}px`,
    });
    this.keeper.style.height = `${keeperH * cover}px`;
    at(this.bubble, KEEPER.x - 40, 236);
    at(this.dish, DISH.x, DISH.y);
    at(this.goods, COUNTER_GOODS.x, COUNTER_GOODS.y);
    at(this.banner, BANNER.x, BANNER.y);
    Object.assign(this.door.style, {
      left: `${ox + DOOR.left * cover}px`,
      top: `${oy + DOOR.top * cover}px`,
      width: `${(DOOR.right - DOOR.left) * cover}px`,
      height: `${(DOOR.bottom - DOOR.top) * cover}px`,
    });
  }
}
