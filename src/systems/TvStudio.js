import * as THREE from "three";
import { clay, blob, ball, box, cyl, cone, shade } from "../world/materials.js";
import { LAYOUT } from "../world/layout.js";
import { generateClip, createMockClip } from "./videoGen.js";

const INTERACT_RANGE = 3.8;

/**
 * First hub zone: the lighthouse studio. Out on the planet it is a tall
 * striped lighthouse; pressing E swaps the outdoor camera for this interior
 * scene, where a student types a sentence and watches a short clip play on
 * the screen. Leaving (Esc / E) restores the pocket planet.
 */
export class TvStudio {
  constructor(planet, { outdoorScreen = null } = {}) {
    this.planet = planet;
    this.outdoorScreen = outdoorScreen;
    this.active = false;
    this.t = 0;
    this.clip = null;
    this.status = "idle"; // idle | generating | playing
    this._abort = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    this._buildRoom();
    this._buildBroadcast();
    this.resize(window.innerWidth, window.innerHeight);
  }

  worldAnchor() {
    const spot = LAYOUT.lighthouse;
    return new THREE.Vector3(spot.x, 0, spot.z);
  }

  getInteractable(piboPos) {
    if (this.active) return { kind: "leave", label: "Leave the lighthouse" };
    if (piboPos.distanceTo(this.worldAnchor()) < INTERACT_RANGE) {
      return { kind: "enter", label: "Enter lighthouse" };
    }
    return null;
  }

  enter() {
    this.active = true;
    this.t = 0;
    this.camera.position.set(2.35, 1.68, 5.9);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(-0.2, 2.08, -4.1);
  }

  leave() {
    this.active = false;
    this._cancelGenerate();
    this.status = this.clip ? "playing" : "idle";
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  async generate(prompt) {
    this._cancelGenerate();
    const ac = new AbortController();
    this._abort = ac;
    this.status = "generating";
    this._setIdent("thinking");
    this._useCanvas();

    try {
      const clip = await generateClip(prompt, { signal: ac.signal });
      if (ac.signal.aborted) return null;
      this._play(clip);
      return clip;
    } catch (err) {
      if (err?.name === "AbortError" || ac.signal.aborted) return null;
      // Keep the loop playable even if something odd happens.
      const fallback = createMockClip(prompt);
      fallback.demo = true;
      fallback.fallbackReason = err?.message || "generate failed";
      this._play(fallback);
      return fallback;
    } finally {
      if (this._abort === ac) this._abort = null;
    }
  }

  _cancelGenerate() {
    if (this._abort) {
      this._abort.abort();
      this._abort = null;
    }
  }

  _play(clip) {
    this.clip = clip;
    this.status = "playing";
    this._clipT = 0;
    this._detachMedia();

    if (clip.kind === "canvas") {
      clip.draw(0);
      const tex = new THREE.CanvasTexture(clip.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      clip._tex = tex;
      this._setScreenMap(tex);
      return;
    }

    if (clip.kind === "video" && clip.url) {
      const video = document.createElement("video");
      video.src = clip.url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      this._media = video;
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      this._setScreenMap(tex);
      video.play().catch(() => {});
      return;
    }

    if (clip.kind === "image" && clip.url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        this._setScreenMap(tex);
      };
      img.src = clip.url;
      this._media = img;
    }
  }

  _detachMedia() {
    if (this._media && this._media.pause) {
      try { this._media.pause(); } catch { /* ignore */ }
    }
    this._media = null;
  }

  _useCanvas() {
    this.broadcast.needsUpdate = true;
    this._setScreenMap(this.broadcast);
  }

  _setScreenMap(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    const apply = (mat) => {
      if (!mat) return;
      mat.map = texture;
      mat.emissiveMap = texture;
      mat.color.setHex(0xffffff);
      mat.emissive.setHex(0xffffff);
      mat.needsUpdate = true;
    };
    apply(this.screenMat);
    apply(this.outdoorScreen?.material);
  }

  update(dt) {
    this.t += dt;
    const sway = Math.sin(this.t * 0.35) * 0.1;
    this.camera.position.x = 2.35 + sway;
    this.camera.position.y = 1.68 + Math.sin(this.t * 0.5) * 0.04;
    this.camera.lookAt(-0.2, 2.08, -4.1);

    if (this.spot) {
      this.spot.intensity = 1.15 + Math.sin(this.t * 1.6) * 0.12;
    }
    if (this.softs) {
      for (const s of this.softs) {
        s.material.emissiveIntensity = 0.35 + Math.sin(this.t * 2 + s.userData.phase) * 0.12;
      }
    }
    if (this.cameraman) {
      this.cameraman.rotation.y = Math.sin(this.t * 0.7) * 0.08;
    }

    if (this.status === "generating") {
      this._drawIdent(this.t, "thinking");
      this.broadcast.needsUpdate = true;
    } else if (this.clip?.kind === "canvas" && this.clip.draw) {
      this._clipT = (this._clipT || 0) + dt;
      this.clip.draw(this._clipT);
      if (this.clip._tex) this.clip._tex.needsUpdate = true;
    } else if (this.status === "idle") {
      this._drawIdent(this.t, "idle");
      this.broadcast.needsUpdate = true;
    }
  }

  _buildBroadcast() {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    this.ident = canvas;
    this.identCtx = canvas.getContext("2d");
    this.broadcast = new THREE.CanvasTexture(canvas);
    this.broadcast.colorSpace = THREE.SRGBColorSpace;
    this._setScreenMap(this.broadcast);
    this._setIdent("idle");
  }

  _setIdent(mode) {
    this._drawIdent(this.t, mode);
    this.broadcast.needsUpdate = true;
  }

  _drawIdent(t, mode) {
    const ctx = this.identCtx;
    const w = this.ident.width;
    const h = this.ident.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#2a2458");
    g.addColorStop(1, "#1b1438");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const bars = ["#f26f6f", "#ffd166", "#7bbf6a", "#7eb6f5", "#b9a6ff"];
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = bars[i];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(40 + i * 112, 48, 100, 70);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff7ec";
    ctx.font = "700 42px Fredoka, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pibo TV", w / 2, 200);

    ctx.font = "500 20px Fredoka, system-ui, sans-serif";
    ctx.fillStyle = "#ffe6d3";
    const msg = mode === "thinking"
      ? `Making your show${".".repeat(1 + Math.floor((t * 3) % 3))}`
      : "Type a sentence to make a tiny show";
    ctx.fillText(msg, w / 2, 248);
  }

  _buildRoom() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(0x1c1730, 14, 28);
    scene.background = new THREE.Color(0x1c1730);

    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x3a2a58, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1cf, 0.85);
    key.position.set(4, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    this.spot = new THREE.PointLight(0x9fd7ff, 1.2, 16, 2);
    this.spot.position.set(0, 2.4, -2.4);
    scene.add(this.spot);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 40),
      clay(0x3d3358, { roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 28),
      clay(0x5a4a78, { roughness: 1 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.02;
    scene.add(rug);

    const wall = box(9.2, 5.2, 0.28, clay(0x4a3f68));
    wall.position.set(0, 2.5, -5.15);
    scene.add(wall);

    const frame = box(5.35, 3.15, 0.18, clay(0x2a2438));
    frame.position.set(0, 2.15, -4.92);
    scene.add(frame);

    this.screenMat = clay(0xffffff, {
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.76), this.screenMat);
    screen.position.set(0, 2.15, -4.8);
    scene.add(screen);
    this.screen = screen;

    // chunky studio cameras
    this.cameraman = buildStudioCamera();
    this.cameraman.position.set(-2.6, 0, 1.4);
    this.cameraman.rotation.y = 0.45;
    scene.add(this.cameraman);
    const cam2 = buildStudioCamera();
    cam2.position.set(3.1, 0, 2.2);
    cam2.rotation.y = -0.55;
    cam2.scale.setScalar(0.85);
    scene.add(cam2);

    const desk = buildDesk();
    desk.position.set(1.55, 0, 3.35);
    scene.add(desk);

    const pibo = buildMiniPibo();
    pibo.position.set(-1.35, 0, 3.05);
    pibo.rotation.y = 0.35;
    scene.add(pibo);

    this.softs = [];
    for (const [x, z, phase] of [[-2.4, -3.4, 0], [2.4, -3.4, 1.2], [0, 1.2, 2.1]]) {
      const lamp = box(0.9, 0.12, 0.55, clay(0xfff0c7, {
        emissive: 0xffd889,
        emissiveIntensity: 0.4,
      }));
      lamp.position.set(x, 4.15, z);
      lamp.userData.phase = phase;
      scene.add(lamp);
      this.softs.push(lamp);
    }

    // side set pieces
    const plant = buildCornerPlant();
    plant.position.set(-3.6, 0, -3.4);
    scene.add(plant);
    const plant2 = buildCornerPlant();
    plant2.position.set(3.7, 0, -2.8);
    plant2.scale.setScalar(0.8);
    scene.add(plant2);

    const clap = buildClapper();
    clap.position.set(2.35, 0.92, 3.05);
    clap.rotation.y = -0.4;
    scene.add(clap);

    shade(scene, true, true);
    screen.castShadow = false;
    screen.receiveShadow = false;
  }
}

function buildStudioCamera() {
  const g = new THREE.Group();
  const stand = cyl(0.06, 0.08, 1.15, clay(0x6b7280), 10);
  stand.position.y = 0.58;
  g.add(stand);
  const body = box(0.55, 0.32, 0.72, clay(0x3f4b66));
  body.position.set(0, 1.28, 0);
  g.add(body);
  const lens = cyl(0.16, 0.2, 0.28, clay(0x25324d), 16);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.28, -0.48);
  g.add(lens);
  const glass = ball(0.12, clay(0x8fd7ff, { emissive: 0x66c6ff, emissiveIntensity: 0.4 }), 12);
  glass.position.set(0, 1.28, -0.62);
  g.add(glass);
  const light = ball(0.05, clay(0xf26f6f, { emissive: 0xf26f6f, emissiveIntensity: 0.8 }), 8);
  light.position.set(0.22, 1.46, -0.2);
  g.add(light);
  return g;
}

function buildDesk() {
  const g = new THREE.Group();
  const top = box(1.6, 0.08, 0.7, clay(0xc8a06a));
  top.position.y = 0.78;
  g.add(top);
  for (const sx of [-1, 1]) {
    const leg = box(0.08, 0.74, 0.08, clay(0x8f6548));
    leg.position.set(sx * 0.68, 0.37, 0.24);
    g.add(leg);
    const leg2 = box(0.08, 0.74, 0.08, clay(0x8f6548));
    leg2.position.set(sx * 0.68, 0.37, -0.24);
    g.add(leg2);
  }
  const panel = box(0.7, 0.42, 0.06, clay(0x25324d, { emissive: 0x72bfff, emissiveIntensity: 0.25 }));
  panel.position.set(0, 1.08, -0.12);
  g.add(panel);
  return g;
}

function buildMiniPibo() {
  const g = new THREE.Group();
  const pot = clay(0xffe27a);
  const body = blob(0.38, pot, 1);
  body.scale.set(1, 1.1, 0.9);
  body.position.y = 0.5;
  g.add(body);
  const rim = cyl(0.4, 0.46, 0.1, clay(0xefc65c), 16);
  rim.position.y = 0.82;
  g.add(rim);
  const eyeMat = clay(0x30303c, { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const eye = ball(0.055, eyeMat, 8);
    eye.position.set(sx * 0.12, 0.54, 0.32);
    g.add(eye);
  }
  const leaf = cone(0.08, 0.42, clay(0x6fbf5f), 8);
  leaf.scale.z = 0.3;
  leaf.position.set(0, 1.12, 0);
  g.add(leaf);
  return g;
}

function buildCornerPlant() {
  const g = new THREE.Group();
  const pot = cyl(0.22, 0.16, 0.32, clay(0xe08a6b), 12);
  pot.position.y = 0.16;
  g.add(pot);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const blade = cone(0.07, 0.7 + (i % 2) * 0.12, clay(0x6fbf5f), 8);
    blade.scale.z = 0.28;
    blade.position.set(Math.cos(a) * 0.08, 0.72, Math.sin(a) * 0.08);
    blade.rotation.z = -Math.cos(a) * 0.2;
    blade.rotation.x = Math.sin(a) * 0.16;
    g.add(blade);
  }
  return g;
}

function buildClapper() {
  const g = new THREE.Group();
  const board = box(0.42, 0.28, 0.04, clay(0xfff0c7));
  board.position.y = 0.14;
  g.add(board);
  const bar = box(0.42, 0.06, 0.04, clay(0x2a2438));
  bar.position.set(0, 0.3, 0);
  bar.rotation.z = -0.18;
  g.add(bar);
  return g;
}
