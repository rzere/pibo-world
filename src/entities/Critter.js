import * as THREE from "three";
import { isBlocked, onLand } from "../world/biome.js";
import { placeOnPlate } from "../world/iso.js";
import { createChatterBubble, nearSomeone, setChatterBubble } from "./chatterBubble.js";

/**
 * One of Paria's little animals. It hops a short wander on walkable grass.
 * While it moves it uses the walk drawing that matches that direction.
 * She drew both sides, so nothing is mirrored. A soft empty bubble appears
 * when it chatters or stands near a friend. The bubble has no words.
 */
export class Critter {
  constructor({ textures, basis, def }) {
    this.id = def.id;
    this.x = def.x;
    this.z = def.z;
    this.homeX = def.x;
    this.homeZ = def.z;
    this.roam = def.roam;
    this.speed = def.speed;
    this.radius = 0.34;
    this.width = def.width;
    this.height = def.height;

    this.faceX = -1;
    this.faceZ = 0;
    this.moving = false;
    this.mode = "idle";
    this.idleLeft = def.idle ?? 0.4 + Math.random() * 0.8;
    this.target = null;
    this.stuck = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.idleT = Math.random() * 6;
    this.chatterLeft = 0;
    this.frame = 0;

    this.frames = (def.frames || [def.src]).map((src) => textures.get(src) || null);
    this.material = new THREE.MeshBasicMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.04,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.material);
    this.mesh.renderOrder = 3;
    this.mesh.position.y = this.height * 0.5;

    this.body = new THREE.Group();
    this.body.add(this.mesh);
    this.pivot = new THREE.Group();
    this.pivot.quaternion.copy(basis.quaternion);
    this.pivot.add(this.body);
    this.bubble = createChatterBubble(this.width);
    this.pivot.add(this.bubble);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width * 0.55, this.height * 0.18),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        premultipliedAlpha: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    this.shadow.position.set(0, 0.02, 0.02);
    this.shadow.renderOrder = 2;

    this.group = new THREE.Group();
    this.group.name = `critter-${def.id}`;
    this.group.add(this.shadow);
    this.group.add(this.pivot);
    this._apply();
  }

  update(dt, collision, pibo, others = []) {
    const yielded = this._yield(dt, collision, pibo);
    if (!yielded) this._stroll(dt, collision);
    this._separate(others, collision);
    const chatting = this.mode === "chatter" || nearSomeone(this, others, 1.2);
    setChatterBubble(this.bubble, chatting, dt, this.idleT, this.height);
    this._animate(dt);
    this._apply();
  }

  _yield(dt, collision, pibo) {
    if (!pibo) return false;
    const dx = this.x - pibo.x;
    const dz = this.z - pibo.z;
    const dist = Math.hypot(dx, dz);
    const need = (pibo.radius || 0.45) + this.radius + 0.12;
    if (dist >= need) {
      if (this.mode === "yield") {
        this.mode = "idle";
        this.idleLeft = 0.25 + Math.random() * 0.4;
        this.moving = false;
      }
      return false;
    }
    const awayX = dist < 0.02 ? -(pibo.faceZ || 0) : dx / (dist || 1);
    const awayZ = dist < 0.02 ? (pibo.faceX || 1) : dz / (dist || 1);
    const push = Math.min(this.speed * 1.4 * dt, Math.max(0.01, need - dist + 0.02));
    if (this._tryMove(awayX * push, awayZ * push, collision, this.roam + 0.4)) {
      this.faceX = awayX;
      this.faceZ = awayZ;
      this.moving = true;
      this.mode = "yield";
      this.target = null;
      return true;
    }
    this.moving = false;
    return true;
  }

  _stroll(dt, collision) {
    if (this.mode === "chatter") {
      this.chatterLeft -= dt;
      this.moving = false;
      if (this.chatterLeft <= 0) {
        this.mode = "idle";
        this.idleLeft = 0.25 + Math.random() * 0.45;
      }
      return;
    }

    if (this.mode === "idle") {
      this.moving = false;
      this.idleLeft -= dt;
      if (this.idleLeft > 0) return;
      if (Math.random() < 0.42) {
        this.mode = "chatter";
        this.chatterLeft = 0.38 + Math.random() * 0.25;
        this.walkPhase = 0;
        return;
      }
      const next = this._pickTarget(collision);
      if (next) {
        this.target = next;
        this.mode = "walk";
        this.stuck = 0;
      } else {
        this.idleLeft = 0.4 + Math.random() * 0.5;
      }
      return;
    }

    if (!this.target) {
      this.mode = "idle";
      this.idleLeft = 0.4;
      this.moving = false;
      return;
    }

    let dx = this.target.x - this.x;
    let dz = this.target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06) {
      this.mode = "idle";
      this.idleLeft = 0.45 + Math.random() * 0.9;
      this.moving = false;
      this.target = null;
      return;
    }
    dx /= dist;
    dz /= dist;
    const step = Math.min(dist, this.speed * dt);
    const before = dist;
    if (!this._tryMove(dx * step, dz * step, collision, this.roam)) {
      this.stuck += dt;
      this.moving = false;
    } else {
      const after = Math.hypot(this.target.x - this.x, this.target.z - this.z);
      this.faceX = dx;
      this.faceZ = dz;
      this.moving = true;
      this.stuck = after < before - 0.002 ? 0 : this.stuck + dt;
    }
    if (this.stuck > 0.35) {
      this.mode = "idle";
      this.idleLeft = 0.3 + Math.random() * 0.5;
      this.moving = false;
      this.target = null;
      this.stuck = 0;
    }
  }

  _pickTarget(collision) {
    for (let n = 0; n < 12; n++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.sqrt(Math.random()) * this.roam * 0.9;
      const x = this.homeX + Math.cos(angle) * reach;
      const z = this.homeZ + Math.sin(angle) * reach;
      if (Math.hypot(x - this.x, z - this.z) < 0.16) continue;
      if (!this._standable(x, z, collision)) continue;
      return { x, z };
    }
    return null;
  }

  _tryMove(dx, dz, collision, leash) {
    const x0 = this.x;
    const z0 = this.z;
    this.x += dx;
    this.z += dz;
    this._clamp(collision, leash);
    if (!this._standable(this.x, this.z, collision)) {
      this.x = x0;
      this.z = z0;
      return false;
    }
    return Math.hypot(this.x - x0, this.z - z0) > 0.0001;
  }

  _separate(others, collision) {
    for (const other of others) {
      if (!other || other === this) continue;
      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      const need = this.radius + (other.radius || 0.4) * 0.9;
      if (dist >= need) continue;
      const push = (need - dist) * 0.55;
      this._tryMove((dx / dist) * push, (dz / dist) * push, collision, this.roam + 0.2);
    }
  }

  _clamp(collision, leash) {
    if (collision) {
      const p = collision.resolve(this.x, this.z, this.radius * 0.7);
      this.x = p.x;
      this.z = p.z;
    }
    const dx = this.x - this.homeX;
    const dz = this.z - this.homeZ;
    const dist = Math.hypot(dx, dz);
    if (dist > leash) {
      this.x = this.homeX + (dx / dist) * leash;
      this.z = this.homeZ + (dz / dist) * leash;
    }
  }

  _standable(x, z, collision) {
    if (!onLand(x, z) || isBlocked(x, z)) return false;
    const reach = this.radius * 0.7;
    for (const [dx, dz] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
      if (!onLand(x + dx, z + dz) || isBlocked(x + dx, z + dz)) return false;
    }
    if (collision) {
      const p = collision.resolve(x, z, this.radius * 0.7);
      if (Math.hypot(p.x - x, p.z - z) > 0.08) return false;
    }
    return true;
  }

  _animate(dt) {
    this.idleT += dt;
    const hopping = this.moving || this.mode === "chatter";
    let bob = Math.sin(this.idleT * 2.4) * 0.012;
    let sx = 1;
    let sy = 1;

    if (hopping) {
      this.walkPhase += dt * (this.moving ? 9.5 : 11);
      const hop = Math.max(0, Math.sin(this.walkPhase));
      bob = hop * (this.moving ? 0.14 : 0.09);
      sy = 1 - (1 - hop) * 0.07;
      sx = 1 + (1 - hop) * 0.04;
    }

    this._showFrame();
    this.mesh.scale.set(sx, sy, 1);
    this.mesh.position.y = this.height * sy * 0.5 + bob;
    if (this.shadow) {
      const lift = hopping ? bob : 0;
      this.shadow.scale.set(1 - lift * 0.8, 1, 1);
      this.shadow.material.opacity = 0.42 - lift * 0.7;
    }
  }

  /**
   * 0 front, 1 three-left, 2 side-left, 3 back-left,
   * 4 front, 5 three-right, 6 side-right, 7 back-right.
   * Toward the camera swaps the two front drawings. Away uses a back view.
   */
  _showFrame() {
    const ax = Math.abs(this.faceX);
    const az = Math.abs(this.faceZ);
    const vertical = az / (ax + az + 1e-6);
    const step = Math.floor(this.walkPhase) % 2;
    const right = this.faceX >= 0;
    let frame = 0;
    const acting = this.moving || this.mode === "chatter";
    if (acting && vertical > 0.62 && this.faceZ > 0) frame = step ? 4 : 0;
    else if (acting && vertical > 0.62) frame = right ? 7 : 3;
    else if (this.moving && vertical < 0.42) frame = right ? 6 : 2;
    else if (this.moving && this.faceZ > 0) frame = right ? 5 : 1;
    else if (this.moving) frame = right ? 7 : 3;
    else if (this.mode === "chatter") frame = step ? 4 : 0;
    const tex = this.frames[frame] || this.frames[0];
    if (tex && this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
  }

  _apply() {
    placeOnPlate(this.group, this.x, this.z, 0.035);
  }
}

let shadowMap = null;

function contactShadowTexture() {
  if (shadowMap) return shadowMap;
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
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
  shadowMap = new THREE.CanvasTexture(canvas);
  shadowMap.premultiplyAlpha = true;
  shadowMap.needsUpdate = true;
  return shadowMap;
}
