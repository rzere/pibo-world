import * as THREE from "three";
import { ASSETS } from "../data/assets.js";
import { isBlocked, isFlightAir } from "../world/biome.js";
import { placeOnPlate } from "../world/iso.js";
import { loadLook, onHairSprite, paintLook } from "./piboLook.js";

/**
 * Pick left, right, or front from screen travel.
 * verticalness is 0 for pure left/right and 1 for pure up/down.
 * The band between 0.42 and 0.62 keeps the current facing so diagonals
 * do not flicker. A stop keeps the last facing.
 */
export function chooseFacing(right, away, current = "front", force = false) {
  const ax = Math.abs(right);
  const ay = Math.abs(away);
  const verticalness = ay / (ax + ay + 1e-6);
  const side = right >= 0 ? "right" : "left";
  if (force) return verticalness >= 0.5 ? "front" : side;
  if (current === "left" || current === "right") {
    const opposite = (current === "left" && right > 0.35) || (current === "right" && right < -0.35);
    if (opposite && verticalness < 0.62) return side;
    if (verticalness > 0.62) return "front";
    return current;
  }
  if (verticalness < 0.42) return side;
  return "front";
}

/**
 * Pibo on the flat island. The body is the upright pot (idle, walk).
 * Leaving land for the open sea starts a flight: the pot lifts, keeps its
 * face up, and can cross to another islet. Breaststroke swimming is retired.
 *
 * Movement is screen-relative: W / stick-up goes up the picture, D / stick-right
 * goes right. Pibo turns to face the direction it is traveling.
 */
export class Pibo {
  constructor({ textures, basis, x = 0, z = 0, controllable = true, scale = 1, tint = 0xffffff } = {}) {
    this.basis = basis;
    this.asset = ASSETS.pibo;
    this.controllable = controllable;
    this.charScale = scale;
    this.x = x;
    this.z = z;
    this.y = 0;
    this._safeX = x;
    this._safeZ = z;
    this.faceX = basis.screenUp.x;
    this.faceZ = basis.screenUp.z;
    this._facing = "front";
    this.radius = (this.asset.radius ?? 0.42) * scale;
    this.waterReach = (this.asset.waterReach ?? 0.5) * scale;
    // Body radius against houses and trunks. Scales with the pot.
    this.blockSkin = 0.32 * scale;
    this.linSpeed = 4.6;
    this.flySpeed = 6.4;
    this.moving = false;
    this.flying = false;
    // Kept so older calls that still read the swim flag see the flight instead.
    this.inWater = false;
    this.walkPhase = 0;
    this.flyPhase = 0;
    this.idleT = Math.random() * 6;
    this._flight = null;

    this.frames = {};
    for (const [state, urls] of Object.entries(this.asset.states)) {
      this.frames[state] = urls.map((url) => textures.get(url));
    }

    this.material = new THREE.MeshBasicMaterial({
      map: this.frames.idle[0],
      transparent: true,
      alphaTest: 0.05,
      depthWrite: true,
      side: THREE.DoubleSide,
      color: tint,
    });
    const geo = new THREE.PlaneGeometry(this.asset.width, this.asset.height);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 3;
    const ax = (this.asset.anchor.x - 0.5) * this.asset.width;
    const ay = (this.asset.anchor.y - 0.5) * this.asset.height;
    this.mesh.position.set(-ax, -ay, 0);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(this.asset.width * 0.78, this.asset.height * 0.22),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        premultipliedAlpha: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    this.shadow.position.set(0, 0.03, 0.02);
    this.shadow.renderOrder = 2;

    this.pivot = new THREE.Group();
    this.pivot.quaternion.copy(basis.quaternion);
    this.pivot.add(this.mesh);
    this.group = new THREE.Group();
    this.group.scale.setScalar(scale);
    this.group.add(this.shadow);
    this.group.add(this.pivot);
    // Empty hook for a future parachute drawing. It sits on the top of the pot
    // and follows the flight lift. Nothing is drawn until that art exists.
    this.parachuteAnchor = new THREE.Group();
    this.parachuteAnchor.name = "parachute-anchor";
    this.group.add(this.parachuteAnchor);
    this._faceImage = {};
    this._faceMap = {};
    this._painted = {};
    this._grow = { left: 1, right: 1, front: 1 };
    this._wide = { left: 1, right: 1, front: 1 };
    const faces = this.asset.faces || {};
    for (const view of ["left", "right", "front"]) {
      const tex = textures.get(faces[view]);
      this._faceImage[view] = tex?.image || null;
      this._faceMap[view] = tex || null;
    }
    if (!this._faceImage.left) this._faceImage.left = this.frames.idle[0]?.image || null;
    if (!this._faceMap.left) this._faceMap.left = this.frames.idle[0] || null;
    if (controllable && this._faceImage.left) this.applyLook(loadLook());
    else this._showFacing();
    if (controllable) onHairSprite(() => { if (this.look) this.applyLook(this.look); });
    this._apply();
  }

  get facing() {
    return this._facing || "front";
  }

  applyLook(look) {
    const base = this._faceImage?.left;
    if (!base) return;
    this.look = look;
    for (const view of ["left", "right", "front"]) {
      const image = this._faceImage[view] || base;
      const canvas = paintLook(image, look, null, view);
      const srcH = image.height || image.naturalHeight || canvas.height;
      const srcW = image.width || image.naturalWidth || canvas.width;
      this._grow[view] = srcH ? canvas.height / srcH : 1;
      this._wide[view] = srcW ? canvas.width / srcW : 1;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      this._painted[view]?.dispose();
      this._painted[view] = tex;
    }
    this._showFacing();
  }

  _screenAxes() {
    const right = this.faceX * this.basis.screenRight.x + this.faceZ * this.basis.screenRight.z;
    const away = this.faceX * this.basis.screenUp.x + this.faceZ * this.basis.screenUp.z;
    return { right, away };
  }

  _showFacing() {
    const view = this.facing;
    const tex = this._painted[view] || this._faceMap[view] || this._faceMap.left;
    if (tex && this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
  }

  get scriptedFlight() {
    return !!this._flight;
  }

  worldPosition(target = new THREE.Vector3()) {
    return target.set(this.x, 0, this.z);
  }

  setVisible(v) {
    this.group.visible = v;
  }

  placeAt(x, z, faceX = 0, faceZ = -1, collision = null) {
    const p = collision ? collision.resolve(x, z, this.blockSkin) : { x, z };
    this.x = p.x;
    this.z = p.z;
    const len = Math.hypot(faceX, faceZ) || 1;
    this.faceX = faceX / len;
    this.faceZ = faceZ / len;
    this.moving = false;
    const axes = this._screenAxes();
    this._facing = chooseFacing(axes.right, axes.away, this._facing, true);
    this._flight = null;
    this._keepOnLand();
    this._setFlying(isFlightAir(this.x, this.z, this.faceX, this.faceZ, this.waterReach));
    this._animate(0);
    this._apply();
  }

  /**
   * Arc from here to a pad on another islet. Steering is ignored until landing.
   * onArrive runs after the pot is standing on the destination.
   */
  flyTo(x, z, face = { x: 0, z: -1 }, onArrive = null) {
    const dist = Math.hypot(x - this.x, z - this.z);
    this._flight = {
      x0: this.x,
      z0: this.z,
      x1: x,
      z1: z,
      faceX: face.x,
      faceZ: face.z,
      t: 0,
      dur: Math.max(1.05, dist / 6.2),
      onArrive,
    };
    this._setFlying(true);
  }

  update(dt, input, { frozen = false, collision = null } = {}) {
    let sx = 0;
    let sy = 0;
    if (this.controllable && input && !frozen) {
      sx = input.turn;
      sy = input.moveForward;
    }

    if (this._flight && !frozen) {
      this._stepFlight(dt, collision);
      this._animate(dt);
      this._apply();
      return;
    }

    const right = this.basis.screenRight;
    const up = this.basis.screenUp;
    let dx = right.x * sx + up.x * sy;
    let dz = right.z * sx + up.z * sy;
    const mag = Math.hypot(dx, dz);
    this.moving = mag > 0.08;

    if (this.moving) {
      dx /= mag;
      dz /= mag;
      const speed = (this.flying ? this.flySpeed : this.linSpeed) * Math.min(1, mag);
      this.x += dx * speed * dt;
      this.z += dz * speed * dt;
      this.faceX = dx;
      this.faceZ = dz;
    }

    if (collision && !this.flying) {
      const p = collision.resolve(this.x, this.z, this.blockSkin);
      this.x = p.x;
      this.z = p.z;
    }
    this._keepOnLand();
    this._setFlying(isFlightAir(this.x, this.z, this.faceX, this.faceZ, this.waterReach));

    this._animate(dt);
    this._apply();
  }

  _setFlying(on) {
    if (on && !this.flying) this.flyPhase = 0;
    this.flying = on;
    this.inWater = on;
  }

  _stepFlight(dt, collision) {
    const flight = this._flight;
    flight.t += dt;
    const u = Math.min(1, flight.t / flight.dur);
    const e = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    this.x = flight.x0 + (flight.x1 - flight.x0) * e;
    this.z = flight.z0 + (flight.z1 - flight.z0) * e;
    const fx = flight.x1 - flight.x0;
    const fz = flight.z1 - flight.z0;
    const len = Math.hypot(fx, fz) || 1;
    this.faceX = fx / len;
    this.faceZ = fz / len;
    this.moving = true;
    this._setFlying(true);
    if (u < 1) return;
    const arrive = flight.onArrive;
    const faceX = flight.faceX;
    const faceZ = flight.faceZ;
    const x1 = flight.x1;
    const z1 = flight.z1;
    this._flight = null;
    this.placeAt(x1, z1, faceX, faceZ, collision);
    arrive?.();
  }

  _animate(dt) {
    const fps = this.asset.fps;
    let state = "idle";
    this.idleT += dt;

    let bob = Math.sin(this.idleT * 2.1) * 0.028;
    let sx = 1;
    let sy = 1;
    let tilt = 0;

    if (this.flying) {
      state = "idle";
      this.flyPhase += dt * (this.moving ? 8 : 3.4);
      const flap = Math.sin(this.flyPhase);
      let arc = 0;
      if (this._flight) {
        const u = Math.min(1, this._flight.t / this._flight.dur);
        arc = Math.sin(u * Math.PI) * 0.42;
      }
      bob = 0.82 + flap * 0.07 + arc;
      sx = 1.04;
      sy = 0.96;
      tilt = 0.16 + flap * 0.05;
    } else if (this.moving) {
      state = "walk";
      this.walkPhase += dt * fps.walk;
      const step = Math.sin(this.walkPhase * Math.PI);
      const hit = step * step;
      // Squash on the step, stretch back up, and lean into the walk.
      sy = 1 - hit * 0.12;
      sx = 1 + hit * 0.08;
      bob = (1 - hit) * 0.09;
      tilt = 0.07 + step * 0.1;
    }

    const axes = this._screenAxes();
    if (this.moving) this._facing = chooseFacing(axes.right, axes.away, this._facing, false);
    this._showFacing();

    // Her drawing already faces the way she is going. Do not mirror it.
    const view = this.facing;
    const grow = this._grow?.[view] || 1;
    const wide = this._wide?.[view] || 1;
    this.mesh.scale.set(sx * wide, sy * grow, 1);
    // Positive rotation leans the top toward screen-left.
    const lean = state === "walk" || (state === "idle" && this.flying) ? -axes.right * tilt : 0;
    this.mesh.rotation.z = lean;
    // The plane is centered. Park its base on the ground while it squishes or lies flat.
    this.mesh.position.y = this.asset.height * sy * grow * 0.5 + bob;
    if (this.parachuteAnchor) {
      const top = this.mesh.position.y + this.asset.height * this.mesh.scale.y * 0.5;
      this.parachuteAnchor.position.set(0, top, 0);
    }
    if (this.shadow) {
      this.shadow.material.opacity = this.flying ? 0.34 : 0.58;
      const spread = this.flying ? 0.62 : state === "walk" ? 1 + (1 - sy) * 1.4 : 1;
      this.shadow.scale.set(spread, this.flying ? 0.72 : 1, 1);
    }
  }

  _keepOnLand() {
    if (!isBlocked(this.x, this.z)) {
      this._safeX = this.x;
      this._safeZ = this.z;
      return;
    }
    const nx = this.x;
    const nz = this.z;
    // Slide along the sky edge instead of snapping the whole step back.
    if (!isBlocked(nx, this._safeZ)) {
      this.z = this._safeZ;
      this._safeX = nx;
      return;
    }
    if (!isBlocked(this._safeX, nz)) {
      this.x = this._safeX;
      this._safeZ = nz;
      return;
    }
    this.x = this._safeX;
    this.z = this._safeZ;
  }

  _apply() {
    placeOnPlate(this.group, this.x, this.z, 0.045);
  }
}

/** Soft black ellipse. RGB stays black so the feather cannot turn into a light ring. */
function contactShadowTexture() {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, h * 0.48);
  g.addColorStop(0, "rgba(0,0,0,0.95)");
  g.addColorStop(0.45, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.premultiplyAlpha = true;
  tex.needsUpdate = true;
  return tex;
}
