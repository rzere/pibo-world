import * as THREE from "three";
import { clay, ball, box, cyl } from "../world/materials.js";
import { SCREEN_INSET, objectAt, paintArcadeScreen, screenPoint } from "./arcadeScreen.js";

/**
 * Interior you step into from the outdoor cabinet, same idea as the lighthouse
 * studio: a separate scene, a close camera, and a screen that shows the work.
 * Here the screen is the arcade machine itself.
 */
export class ArcadeRoom {
  constructor(canvas) {
    this.active = false;
    this.t = 0;
    this.view = { spec: null, mode: "start", message: "", clue: "", won: false };
    this._drag = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.08, 40);
    this.raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._tmp = new THREE.Vector3();
    this._fitPoints = [];

    this._buildRoom();
    this._buildScreen();
    this.resize(window.innerWidth, window.innerHeight);
    this._bind(canvas);
    this.show(this.view);
  }

  enter() {
    this.active = true;
    this.t = 0;
    this._placeCamera();
  }

  leave() {
    this.active = false;
    this._drag = null;
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this._placeCamera();
  }

  show(view = {}) {
    this.view = {
      spec: view.spec || null,
      mode: view.mode || "start",
      message: view.message || "",
      clue: view.clue || "",
      won: !!view.won,
      chrome: view.chrome || 0,
    };
    this._paint();
  }

  update(dt) {
    this.t += dt;
    if (this.glow) this.glow.intensity = 1.35 + Math.sin(this.t * 1.8) * 0.08;
  }

  /**
   * Straight-on view: the camera sits on the screen's normal, aimed at the
   * center of the screen mesh. Field of view comes from that same center plus
   * the cabinet around it, so the screen stays locked to the viewport center
   * and the whole machine still fits when the window changes size.
   */
  _placeCamera() {
    if (!this.screen || !this._fitPoints.length) return;
    const bounds = new THREE.Box3().setFromObject(this.screen);
    const center = bounds.getCenter(new THREE.Vector3());
    const aspect = Math.max(0.2, this.camera.aspect || 1);
    const margin = 0.93;
    const maxFov = 40;

    const fovForDistance = (distance) => {
      this._aimAtScreen(center, distance, aspect, 50);
      let lo = 8;
      let hi = 70;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        this.camera.fov = mid;
        this.camera.updateProjectionMatrix();
        if (this._cabinetFits(margin)) hi = mid;
        else lo = mid;
      }
      return hi;
    };

    let near = 1.6;
    let far = 20;
    for (let i = 0; i < 14; i++) {
      const mid = (near + far) / 2;
      if (fovForDistance(mid) <= maxFov) far = mid;
      else near = mid;
    }
    const distance = far;
    const fov = fovForDistance(distance);
    this._aimAtScreen(center, distance, aspect, fov);
    if (this.scene.fog) {
      this.scene.fog.near = distance + 1.5;
      this.scene.fog.far = distance + 12;
    }
  }

  _aimAtScreen(center, distance, aspect, fov) {
    this.camera.position.set(center.x, center.y, center.z + distance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center);
    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  _cabinetFits(margin) {
    for (const point of this._fitPoints) {
      this._tmp.copy(point).project(this.camera);
      if (this._tmp.z < -1 || this._tmp.z > 1) return false;
      if (Math.abs(this._tmp.x) > margin || Math.abs(this._tmp.y) > margin) return false;
    }
    return true;
  }

  /** Inner screen rectangle in CSS pixels, matching the painted play area. */
  screenCssRect(canvas) {
    if (!this.screen || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const geo = this.screen.geometry.parameters;
    const ix = (geo.width / 2) * (1 - 2 * SCREEN_INSET);
    const iy = (geo.height / 2) * (1 - 2 * SCREEN_INSET);
    const corners = [
      [-ix, iy], [ix, iy], [-ix, -iy], [ix, -iy],
    ];
    this.screen.updateWorldMatrix(true, false);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of corners) {
      this._tmp.set(x, y, 0).applyMatrix4(this.screen.matrixWorld).project(this.camera);
      const sx = (this._tmp.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-this._tmp.y * 0.5 + 0.5) * rect.height + rect.top;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  _buildScreen() {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 720;
    this.screenCanvas = canvas;
    this.screenCtx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.screenTex = tex;
    this.screenMat = new THREE.MeshBasicMaterial({
      map: tex,
      toneMapped: false,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.29), this.screenMat);
    screen.position.set(0, 1.58, 0.28);
    screen.userData.fit = true;
    this.scene.add(screen);
    this.screen = screen;
    this._collectFit();
    paintMarquee(this.marquee);
    document.fonts?.ready?.then(() => paintMarquee(this.marquee));
  }

  _collectFit() {
    const points = [];
    const box = new THREE.Box3();
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((obj) => {
      if (!obj.isMesh || !obj.userData.fit) return;
      box.setFromObject(obj);
      const { min, max } = box;
      points.push(
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
      );
    });
    this._fitPoints = points;
  }

  _paint() {
    paintArcadeScreen(this.screenCtx, this.screenCanvas.width, this.screenCanvas.height, this.view);
    this.screenTex.needsUpdate = true;
  }

  _bind(canvas) {
    if (!canvas) return;
    canvas.addEventListener("pointerdown", (event) => this._down(event));
    canvas.addEventListener("pointermove", (event) => this._move(event));
    canvas.addEventListener("pointerup", (event) => this._up(event));
    canvas.addEventListener("pointercancel", (event) => this._up(event));
  }

  _uv(event) {
    const rect = event.target.getBoundingClientRect();
    this._ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.screen, false);
    return hits[0]?.uv || null;
  }

  _down(event) {
    if (!this.active || event.button > 0) return;
    const uv = this._uv(event);
    if (!uv || !this.view.spec) return;
    const chrome = this.view.chrome || 0;
    const object = objectAt(this.view.spec, uv.x, uv.y, chrome);
    if (!object) return;
    if (this.view.mode === "play") {
      this.onPlay?.(object.id);
      return;
    }
    if (this.view.mode !== "edit") return;
    const point = screenPoint(uv.x, uv.y, chrome);
    this._drag = { id: object.id, x: point.x, y: point.y, moved: false };
  }

  _move(event) {
    if (!this._drag) return;
    const uv = this._uv(event);
    if (!uv) return;
    const point = screenPoint(uv.x, uv.y, this.view.chrome || 0);
    const x = Math.min(92, Math.max(8, point.x));
    const y = Math.min(88, Math.max(12, point.y));
    if (Math.hypot(x - this._drag.x, y - this._drag.y) < 1.2 && !this._drag.moved) return;
    this._drag.moved = true;
    this._drag.x = x;
    this._drag.y = y;
    this.onMove?.(this._drag.id, x, y, false);
  }

  _up() {
    if (!this._drag) return;
    const drag = this._drag;
    this._drag = null;
    if (drag.moved) this.onMove?.(drag.id, drag.x, drag.y, true);
  }

  _buildRoom() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x14080c);
    scene.fog = new THREE.Fog(0x14080c, 6.5, 14);

    scene.add(new THREE.AmbientLight(0xfff2ea, 0.35));
    const key = new THREE.DirectionalLight(0xfff4ec, 1.25);
    key.position.set(0.6, 3.4, 4.2);
    scene.add(key);
    this.glow = new THREE.PointLight(0xffd0dc, 1.4, 6, 2);
    this.glow.position.set(0, 1.7, 1.1);
    scene.add(this.glow);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 32),
      clay(0x2a1218, { roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const wall = box(8, 4.2, 0.2, clay(0x3a1520));
    wall.position.set(0, 2.1, -1.4);
    scene.add(wall);

    const stripe = stripeMaterial();
    const silver = new THREE.MeshStandardMaterial({
      color: 0xd5d8de,
      metalness: 0.72,
      roughness: 0.28,
    });
    const red = clay(0xd01224, { roughness: 0.55 });
    const black = clay(0x1a1a1a, { roughness: 0.4 });

    const mark = (obj) => {
      obj.traverse((child) => {
        if (child.isMesh) child.userData.fit = true;
      });
      return obj;
    };

    for (const sx of [-1, 1]) {
      const side = box(0.14, 2.72, 0.62, silver);
      side.position.set(sx * 1.18, 1.42, 0.05);
      scene.add(mark(side));
      const trim = box(0.05, 2.5, 0.08, clay(0xf2f3f6, { roughness: 0.35 }));
      trim.position.set(sx * 1.08, 1.42, 0.32);
      scene.add(mark(trim));
    }

    const body = box(2.15, 2.2, 0.48, stripe);
    body.position.set(0, 1.28, -0.08);
    scene.add(mark(body));

    const hood = box(2.15, 0.42, 0.5, stripe);
    hood.position.set(0, 2.52, 0.02);
    scene.add(mark(hood));

    const marquee = new THREE.Mesh(
      new THREE.PlaneGeometry(1.62, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xfff6ee, toneMapped: false })
    );
    marquee.position.set(0, 2.52, 0.3);
    marquee.userData.fit = true;
    scene.add(marquee);
    this.marquee = marquee;

    const deckPivot = new THREE.Group();
    deckPivot.position.set(0, 0.58, 0.62);
    deckPivot.rotation.x = 0.72;

    const deck = box(2.2, 0.07, 0.92, red);
    deckPivot.add(deck);

    const deckStripe = box(2.05, 0.02, 0.78, stripe);
    deckStripe.position.y = 0.045;
    deckPivot.add(deckStripe);

    deckPivot.add(joystick(-0.72));
    deckPivot.add(joystick(0.28));
    deckPivot.add(buttonRow(-0.28));
    deckPivot.add(buttonRow(0.72));
    scene.add(mark(deckPivot));

    const strip = box(2.05, 0.14, 0.08, black);
    strip.position.set(0, 0.86, 0.34);
    scene.add(mark(strip));
    for (const sx of [-0.28, 0.28]) {
      const start = cyl(0.045, 0.045, 0.03, clay(0xfff6ee), 12);
      start.rotation.x = Math.PI / 2;
      start.position.set(sx, 0.86, 0.39);
      scene.add(mark(start));
    }
    for (const sx of [-0.52, 0.52]) {
      const coin = box(0.16, 0.05, 0.02, clay(0x8a9098, { roughness: 0.35 }));
      coin.position.set(sx, 0.86, 0.39);
      scene.add(mark(coin));
    }

    // A second cabinet, small and off to the side, so the room reads as an arcade.
    const extra = box(0.7, 1.3, 0.4, stripe);
    extra.position.set(-2.15, 0.7, -0.4);
    extra.rotation.y = 0.4;
    scene.add(extra);
    const extra2 = box(0.6, 1.15, 0.36, clay(0x1f4c8a));
    extra2.position.set(2.25, 0.62, -0.35);
    extra2.rotation.y = -0.35;
    scene.add(extra2);
  }
}

function paintMarquee(mesh) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff6ee";
  ctx.fillRect(0, 0, 640, 128);
  ctx.fillStyle = "#d01224";
  ctx.font = "700 78px Fredoka, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ARCADE", 320, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const previous = mesh.material.map;
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  if (previous && previous !== tex) previous.dispose();
}

function stripeMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d01224";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#9a0c1c";
  ctx.lineWidth = 14;
  for (let i = -256; i < 512; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 180, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.04 });
}

function joystick(x) {
  const g = new THREE.Group();
  const base = cyl(0.1, 0.12, 0.045, clay(0x222222), 16);
  base.position.y = 0.06;
  g.add(base);
  const shaft = cyl(0.028, 0.028, 0.18, clay(0x1a1a1a), 10);
  shaft.position.y = 0.16;
  g.add(shaft);
  const knob = ball(0.055, clay(0x111111, { roughness: 0.35 }), 16);
  knob.position.y = 0.27;
  g.add(knob);
  g.position.set(x, 0.04, 0.2);
  return g;
}

function buttonRow(x) {
  const g = new THREE.Group();
  const colors = [0xe23b3b, 0xf5d03a, 0x3cba5a, 0x3a7de8];
  colors.forEach((color, i) => {
    const button = cyl(0.045, 0.05, 0.035, clay(color, { roughness: 0.4 }), 14);
    button.position.set((i - 1.5) * 0.11, 0.07, -0.12);
    g.add(button);
  });
  g.position.set(x, 0.04, 0);
  return g;
}
