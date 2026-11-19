/**
 * A painted room you can walk around with friends. Positions are picture
 * pixels / 100 on a 1280×720 painting, drawn with object-fit: cover.
 * Everyone is drawn tiny, at island proportions, a little smaller toward
 * the back wall. Same contract as the art room: spawnPoint, moveOnFloor,
 * renderWalkers, clearWalkers.
 */
const PX_PER_UNIT = 52;

export class RoomFloor {
  /**
   * @param root   element the painting fills
   * @param bg     the <img> painting (for its natural size)
   * @param floor  { left, right, top, bottom } walkable rectangle
   * @param blocks [{ left, right, bottom }] furniture footprints against the wall
   * @param spawn  { x, y, spreadX, spreadY }
   */
  constructor({ root, bg, floor, blocks = [], spawn }) {
    this.root = root;
    this.bg = bg;
    this.floorBox = floor;
    this.blocks = blocks;
    this.spawn = spawn;
    this.layer = document.createElement("div");
    this.layer.className = "art-floor";
    root.appendChild(this.layer);
    this._walkers = new Map();
  }

  _viewport() {
    const vw = this.root.clientWidth || window.innerWidth;
    const vh = this.root.clientHeight || window.innerHeight;
    const imgW = this.bg?.naturalWidth || 1280;
    const imgH = this.bg?.naturalHeight || 720;
    const cover = Math.max(vw / imgW, vh / imgH) * (imgW / 1280);
    return { vw, cover, ox: (vw - 1280 * cover) / 2, oy: (vh - 720 * cover) / 2 };
  }

  spawnPoint() {
    const s = this.spawn;
    for (let n = 0; n < 20; n++) {
      const x = s.x + (Math.random() - 0.5) * s.spreadX;
      const y = s.y + (Math.random() - 0.5) * s.spreadY;
      if (this._standable(x, y)) return { x, y };
    }
    return { x: s.x, y: s.y };
  }

  _standable(x, y) {
    const f = this.floorBox;
    const { vw, cover, ox } = this._viewport();
    const seenLeft = Math.max(f.left, (-ox + 24) / (100 * cover));
    const seenRight = Math.min(f.right, (vw - ox - 24) / (100 * cover));
    if (x < seenLeft || x > seenRight || y < f.top || y > f.bottom) return false;
    return !this.blocks.some((o) => x > o.left && x < o.right && y < o.bottom);
  }

  moveOnFloor(x, y, dx, dy) {
    if (this._standable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    if (this._standable(x + dx, y)) return { x: x + dx, y };
    if (this._standable(x, y + dy)) return { x, y: y + dy };
    return { x, y };
  }

  renderWalkers(list, dt) {
    const f = this.floorBox;
    const { cover, ox, oy } = this._viewport();
    const seen = new Set();
    for (const w of list) {
      if (!w.image) continue;
      seen.add(w.id);
      const n = this._walkers.get(w.id) || this._make(w.id);
      if (w.name !== n.name) {
        n.name = w.name;
        n.label.textContent = w.name || "";
        n.label.hidden = !w.name;
      }
      const iw = w.image.width || w.image.naturalWidth || 0;
      const ih = w.image.height || w.image.naturalHeight || 0;
      if (w.image !== n.image || iw !== n.iw || ih !== n.ih) {
        n.image = w.image;
        n.iw = iw;
        n.ih = ih;
        n.canvas.width = iw;
        n.canvas.height = ih;
        const ctx = n.canvas.getContext("2d");
        ctx.clearRect(0, 0, iw, ih);
        ctx.drawImage(w.image, 0, 0, iw, ih);
      }
      n.phase += dt * (w.moving ? 10 : 2.4);
      const hop = w.moving ? Math.abs(Math.sin(n.phase)) * 0.14 : Math.sin(n.phase) * 0.012;
      const depth = 0.85 + 0.3 * Math.min(1, Math.max(0, (w.y - f.top) / (f.bottom - f.top)));
      const s = PX_PER_UNIT * cover * depth;
      const bw = w.w * s;
      const bh = w.h * s;
      n.el.style.transform = `translate(${ox + w.x * 100 * cover}px, ${oy + w.y * 100 * cover}px)`;
      n.el.style.zIndex = String(Math.round(w.y * 100));
      n.body.style.width = `${bw}px`;
      n.body.style.height = `${bh}px`;
      n.body.style.transform = `translate(${-bw / 2}px, ${-bh - hop * s}px)`;
      n.shadow.style.width = `${bw * 0.7}px`;
      n.shadow.style.height = `${Math.max(6, bh * 0.14)}px`;
    }
    for (const [id, n] of this._walkers) {
      if (seen.has(id)) continue;
      n.el.remove();
      this._walkers.delete(id);
    }
  }

  _make(id) {
    const el = document.createElement("div");
    el.className = "art-walker";
    const shadow = document.createElement("div");
    shadow.className = "art-walker-shadow";
    const body = document.createElement("div");
    body.className = "art-walker-body";
    const canvas = document.createElement("canvas");
    const label = document.createElement("div");
    label.className = "art-walker-name";
    body.append(label, canvas);
    el.append(shadow, body);
    this.layer.appendChild(el);
    const n = { el, shadow, body, canvas, label, image: null, iw: 0, ih: 0, name: null, phase: Math.random() * 6 };
    this._walkers.set(id, n);
    return n;
  }

  clearWalkers() {
    this.layer.replaceChildren();
    this._walkers.clear();
  }
}
