/**
 * Plays an arcade recipe for everyone in the hall at once. The arena is
 * 16×9 units. Each client moves its own player and tells the others where
 * it is; whoever reaches the goal first announces the win.
 *
 * Network messages (all { k, id, ... }):
 *   pos   { x, y, fx, fy, sc }   10× a second
 *   take  { i }                  collect: goodie i is gone
 *   throw { x, y, dx, dy }       battle: draw someone's throw
 *   hit   { target }             battle: the thrower saw it land
 *   win   { name }               first one wins; later ones are ignored
 */
const W = 16;
const H = 9;
const R = 0.42;
const FINISH = 14.6;

export class MiniGame {
  constructor({ parent, recipe, seed, me, players, input, send, onEnd }) {
    this.recipe = recipe;
    this.rng = mulberry32(seed >>> 0);
    this.seed = seed >>> 0;
    this.input = input;
    this.send = send;
    this.onEnd = onEnd;
    this.meId = me.id;
    this.t = -3;
    this.over = null;
    this.sendT = 0;
    this.players = new Map();
    const all = [me, ...players.filter((p) => p.id !== me.id)];
    all.forEach((p, i) => this._addPlayer(p, i, all.length));
    this.me = this.players.get(me.id);
    this.taken = new Set();
    this.projectiles = [];
    this.cool = 0;
    this._setupWorld();

    this.el = document.createElement("div");
    this.el.className = "mini-game";
    this.canvas = document.createElement("canvas");
    const quit = document.createElement("button");
    quit.type = "button";
    quit.className = "mini-quit";
    quit.textContent = "✕ Leave game";
    quit.addEventListener("click", () => this.end());
    this.el.append(this.canvas, quit);
    parent.appendChild(this.el);
    this.ctx = this.canvas.getContext("2d");
  }

  _addPlayer(p, i = this.players.size, n = this.players.size + 1) {
    const lane = (i + 1) / (Math.max(n, 1) + 1);
    const img = new Image();
    img.src = p.thumb;
    const startX = this.recipe.type === "race" ? 1.1 : 2 + (i % 4) * 4;
    const startY = this.recipe.type === "race" ? 0.8 + lane * (H - 1.6) : 2.2 + Math.floor(i / 4) * 3 + lane;
    const player = {
      id: p.id,
      name: p.name,
      img,
      x: startX,
      y: Math.min(H - 0.8, startY),
      tx: startX,
      ty: startY,
      fx: 1,
      fy: 0,
      score: 0,
      stun: 0,
      safe: 0,
      boost: 0,
    };
    this.players.set(p.id, player);
    return player;
  }

  _setupWorld() {
    const r = this.recipe;
    const rnd = this.rng;
    this.decor = Array.from({ length: 14 }, () => ({
      x: rnd() * W,
      y: rnd() * H,
      e: r.decor[Math.floor(rnd() * r.decor.length)],
      s: 0.5 + rnd() * 0.5,
    }));
    this.hazards = Array.from({ length: r.hazards }, (_, i) => ({
      x: r.type === "race" ? 3 + rnd() * 10.5 : 1 + rnd() * (W - 2),
      y: 0.8 + rnd() * (H - 1.6),
      vx: (rnd() - 0.5) * 3,
      vy: (rnd() - 0.5) * 3,
      ph: rnd() * 6,
      i,
    }));
    this.boosts = r.type === "race" ? Array.from({ length: 5 }, () => ({ x: 2.6 + rnd() * 10.5, y: 0.8 + rnd() * (H - 1.6), back: 0 })) : [];
    this.goodies = r.type === "collect" ? Array.from({ length: 160 }, () => ({ x: 0.8 + rnd() * (W - 1.6), y: 0.9 + rnd() * (H - 1.8) })) : [];
  }

  /** Where hazard h is at time t. Same on every screen. */
  _hazardAt(h) {
    const t = Math.max(0, this.t);
    if (this.recipe.type === "race") return { x: h.x, y: h.y + Math.sin(t * 1.6 + h.ph) * 0.9 };
    if (this.recipe.type === "battle") return { x: h.x, y: h.y };
    return { x: bounce(h.x + h.vx * t, 0.6, W - 0.6), y: bounce(h.y + h.vy * t, 0.6, H - 0.6) };
  }

  _visibleGoodies() {
    const out = [];
    for (let i = 0; i < this.goodies.length && out.length < 6; i++) if (!this.taken.has(i)) out.push(i);
    return out;
  }

  receive(m) {
    if (!m || m.id === this.meId) return;
    let p = this.players.get(m.id);
    if (!p && m.k === "pos") p = this._addPlayer({ id: m.id, name: m.name || "Friend", thumb: m.thumb || "" });
    if (m.k === "pos" && p) {
      p.tx = m.x;
      p.ty = m.y;
      p.fx = m.fx;
      p.fy = m.fy;
      p.score = m.sc;
    } else if (m.k === "take") {
      this.taken.add(m.i);
    } else if (m.k === "throw") {
      this.projectiles.push({ x: m.x, y: m.y, dx: m.dx, dy: m.dy, life: 1.2, owner: m.id });
    } else if (m.k === "hit" && m.target === this.meId) {
      this.me.stun = 0.6;
      this.me.safe = 1.3;
    } else if (m.k === "win") {
      this._finish(m.name, m.id);
    }
  }

  update(dt) {
    if (!this.el.isConnected) return;
    this.t += dt;
    const me = this.me;
    const r = this.recipe;
    if (!this.over && this.t > r.seconds) this._timeUp();

    if (this.t > 0 && !this.over) this._moveMe(dt);
    for (const p of this.players.values()) {
      if (p === me) continue;
      const k = 1 - Math.exp(-dt * 12);
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
    }
    for (const pr of this.projectiles) {
      pr.x += pr.dx * 9 * dt;
      pr.y += pr.dy * 9 * dt;
      pr.life -= dt;
      if (pr.owner !== this.meId || this.over) continue;
      for (const p of this.players.values()) {
        if (p === me || p.safe > 0 || Math.hypot(p.x - pr.x, p.y - pr.y) > R + 0.2) continue;
        pr.life = 0;
        p.safe = 1.3;
        me.score += 1;
        this.send({ k: "hit", target: p.id });
        if (me.score >= r.goal) this._win();
        break;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0 && pr.x > -1 && pr.x < W + 1 && pr.y > -1 && pr.y < H + 1);
    for (const p of this.players.values()) p.safe = Math.max(0, p.safe - dt);

    this.sendT += dt;
    if (this.sendT > 0.1) {
      this.sendT = 0;
      this.send({ k: "pos", x: round(me.x), y: round(me.y), fx: round(me.fx), fy: round(me.fy), sc: me.score });
    }
    this._draw();
  }

  _moveMe(dt) {
    const me = this.me;
    const r = this.recipe;
    me.stun = Math.max(0, me.stun - dt);
    me.boost = Math.max(0, me.boost - dt);
    this.cool = Math.max(0, this.cool - dt);
    let dx = this.input.turn;
    let dy = -this.input.moveForward;
    const mag = Math.hypot(dx, dy);
    if (mag > 0.08 && me.stun <= 0) {
      dx /= mag;
      dy /= mag;
      const speed = 4.4 * r.speed * (me.boost > 0 ? 1.7 : 1) * Math.min(1, mag);
      me.x = clamp(me.x + dx * speed * dt, 0.5, W - 0.5);
      me.y = clamp(me.y + dy * speed * dt, 0.6, H - 0.5);
      me.fx = dx;
      me.fy = dy;
    }

    for (const h of this.hazards) {
      const at = this._hazardAt(h);
      const d = Math.hypot(me.x - at.x, me.y - at.y);
      if (r.type === "battle") {
        if (d < R + 0.38) {
          me.x = at.x + ((me.x - at.x) / (d || 1)) * (R + 0.38);
          me.y = at.y + ((me.y - at.y) / (d || 1)) * (R + 0.38);
        }
      } else if (d < R + 0.3 && me.safe <= 0) {
        me.stun = 0.7;
        me.safe = 1.4;
        if (r.type === "race") me.x = Math.max(0.5, me.x - 0.8);
        else me.score = Math.max(0, me.score - 1);
      }
    }

    if (r.type === "race") {
      for (const b of this.boosts) {
        b.back = Math.max(0, b.back - dt);
        if (b.back <= 0 && Math.hypot(me.x - b.x, me.y - b.y) < R + 0.3) {
          b.back = 4;
          me.boost = 2;
        }
      }
      if (me.x >= FINISH) this._win();
    } else if (r.type === "collect") {
      for (const i of this._visibleGoodies()) {
        const g = this.goodies[i];
        if (Math.hypot(me.x - g.x, me.y - g.y) > R + 0.3) continue;
        this.taken.add(i);
        me.score += 1;
        this.send({ k: "take", i });
        if (me.score >= r.goal) this._win();
      }
    } else if (r.type === "battle" && this.cool <= 0 && this.input.consume("Space", "KeyE", "Enter")) {
      this.cool = 0.4;
      const len = Math.hypot(me.fx, me.fy) || 1;
      const shot = { x: me.x, y: me.y, dx: me.fx / len, dy: me.fy / len };
      this.projectiles.push({ ...shot, life: 1.2, owner: this.meId });
      this.send({ k: "throw", ...shot });
    }
  }

  _win() {
    if (this.over) return;
    this.send({ k: "win", name: this.me.name });
    this._finish(this.me.name, this.meId);
  }

  _timeUp() {
    let best = null;
    for (const p of this.players.values()) {
      const v = this.recipe.type === "race" ? p.x : p.score;
      if (!best || v > best.v) best = { p, v };
    }
    this._finish(best?.p.name || "Nobody", best?.p.id);
  }

  _finish(name, id) {
    if (this.over) return;
    this.over = { name, id, at: this.t };
    setTimeout(() => this.end(), 5000);
  }

  end() {
    if (!this.el.isConnected) return;
    this.el.remove();
    this.onEnd?.();
  }

  /* drawing ---------------------------------------------------------- */

  _draw() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vw = this.el.clientWidth;
    const vh = this.el.clientHeight;
    if (c.width !== Math.round(vw * dpr) || c.height !== Math.round(vh * dpr)) {
      c.width = Math.round(vw * dpr);
      c.height = Math.round(vh * dpr);
    }
    const ctx = this.ctx;
    const r = this.recipe;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, r.sky[0]);
    g.addColorStop(1, r.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    const top = 82;
    const u = Math.min((vw - 24) / W, (vh - top - 16) / H);
    const ox = (vw - W * u) / 2;
    const oy = top + (vh - top - 16 - H * u) / 2;
    const X = (x) => ox + x * u;
    const Y = (y) => oy + y * u;

    ctx.fillStyle = r.ground;
    roundRect(ctx, ox, oy, W * u, H * u, u * 0.5);
    ctx.fill();
    ctx.lineWidth = Math.max(3, u * 0.08);
    ctx.strokeStyle = r.accent;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.35;
    for (const d of this.decor) emojiAt(ctx, d.e, X(d.x), Y(d.y), u * 0.7 * d.s);
    ctx.globalAlpha = 1;

    if (r.type === "race") {
      for (let y = 0; y < H; y += 0.9) emojiAt(ctx, "🏁", X(FINISH + 0.45), Y(y + 0.45), u * 0.6);
      for (const b of this.boosts) if (b.back <= 0) emojiAt(ctx, r.item, X(b.x), Y(b.y), u * 0.75);
    }
    if (r.type === "collect") {
      for (const i of this._visibleGoodies()) {
        const gd = this.goodies[i];
        emojiAt(ctx, r.item, X(gd.x), Y(gd.y + Math.sin(this.t * 3 + i) * 0.06), u * 0.75);
      }
    }
    for (const h of this.hazards) {
      const at = this._hazardAt(h);
      emojiAt(ctx, r.hazard, X(at.x), Y(at.y), u * 0.85);
    }
    for (const pr of this.projectiles) emojiAt(ctx, r.item, X(pr.x), Y(pr.y), u * 0.6);

    const sorted = [...this.players.values()].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const blink = p.safe > 0 && Math.floor(this.t * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.4 : 1;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(X(p.x), Y(p.y) + u * 0.42, u * 0.38, u * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      const h = u * 1.1;
      const iw = p.img.naturalWidth || 1;
      const ih = p.img.naturalHeight || 1;
      const w = (h * iw) / ih;
      const hop = this.t > 0 && !this.over ? Math.abs(Math.sin(this.t * 9 + p.x)) * u * 0.06 : 0;
      if (p.img.complete && p.img.naturalWidth) ctx.drawImage(p.img, X(p.x) - w / 2, Y(p.y) + u * 0.48 - h - hop, w, h);
      else emojiAt(ctx, "🙂", X(p.x), Y(p.y), u);
      ctx.globalAlpha = 1;
      if (p.boost > 0) emojiAt(ctx, "💨", X(p.x) - u * 0.6, Y(p.y), u * 0.5);
      label(ctx, p.id === this.meId ? `${p.name} (you)` : p.name, X(p.x), Y(p.y) - h + u * 0.3, p.id === this.meId ? r.accent : "#5c4a3e");
    }

    this._hud(ctx, vw, vh, u);
  }

  _hud(ctx, vw, vh) {
    const r = this.recipe;
    ctx.fillStyle = "rgba(255, 248, 238, 0.92)";
    roundRect(ctx, 12, 8, vw - 24, 64, 22);
    ctx.fill();
    ctx.fillStyle = "#4a3a30";
    ctx.textAlign = "left";
    ctx.font = "700 19px Fredoka, system-ui, sans-serif";
    ctx.fillText(r.title, 28, 29);
    const left = Math.max(0, Math.ceil(r.seconds - Math.max(0, this.t)));
    ctx.textAlign = "right";
    ctx.fillText(`⏱ ${left}s`, vw - 28, 29);
    const scores = [...this.players.values()]
      .map((p) => (r.type === "race" ? `${p.name} ${Math.round((Math.min(p.x, FINISH) / FINISH) * 100)}%` : `${p.name} ${p.score}/${r.goal}`))
      .join("  ·  ");
    ctx.textAlign = "left";
    ctx.font = "600 14px Fredoka, system-ui, sans-serif";
    ctx.fillText(scores, 28, 54, vw - 56);

    ctx.textAlign = "center";
    if (this.t < 0) {
      const n = Math.ceil(-this.t);
      banner(ctx, vw, vh, `${n}`, r.intro);
    } else if (this.t < 0.8) {
      banner(ctx, vw, vh, "GO!", r.intro);
    }
    if (this.over) banner(ctx, vw, vh, `🏆 ${this.over.name}`, r.winText);
  }
}

function banner(ctx, vw, vh, big, small) {
  ctx.fillStyle = "rgba(255, 248, 238, 0.95)";
  const w = Math.min(560, vw - 40);
  roundRect(ctx, (vw - w) / 2, vh / 2 - 80, w, 150, 28);
  ctx.fill();
  ctx.strokeStyle = "#5c4a3e";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#4a3a30";
  ctx.font = "700 48px Fredoka, system-ui, sans-serif";
  ctx.fillText(big, vw / 2, vh / 2 - 22);
  ctx.font = "500 17px Fredoka, system-ui, sans-serif";
  wrap(ctx, small, vw / 2, vh / 2 + 28, w - 40, 22);
}

function wrap(ctx, text, x, y, max, lh) {
  const words = String(text).split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

function label(ctx, text, x, y, color) {
  ctx.font = "600 13px Fredoka, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(255, 250, 240, 0.92)";
  roundRect(ctx, x - w / 2, y - 11, w, 20, 10);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#4a3a30";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function emojiAt(ctx, e, x, y, size) {
  ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(e, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bounce(v, lo, hi) {
  const span = hi - lo;
  let m = (v - lo) % (2 * span);
  if (m < 0) m += 2 * span;
  return lo + (m > span ? 2 * span - m : m);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
