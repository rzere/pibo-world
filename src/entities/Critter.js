import * as THREE from "three";
import { isBlocked, onLand } from "../world/biome.js";
import { placeOnPlate } from "../world/iso.js";
import { createChatterBubble, nearSomeone, setChatterBubble } from "./chatterBubble.js";

/**
 * One of Paria's little animals. It stays near home and only ambles a step
 * now and then. When you walk up, it turns to face you and waits to talk.
 * While it moves it uses the walk drawing that matches that direction.
 * She drew both sides, so nothing is mirrored. A speech bubble with
 * thinking dots appears when it chatters or stands near a friend.
 * The painted bubble stays hidden; the words, when there are any, come later.
 */
export class Critter {
  constructor({ textures, basis, def }) {
    this.id = def.id;
    this.name = def.name || def.id;
    this.emoji = def.emoji || "🐾";
    this.hello = def.hello || "Hello! How are you?";
    this.lines = def.lines || [this.hello];
    this.x = def.x;
    this.z = def.z;
    this.homeX = def.x;
    this.homeZ = def.z;
    this.roam = def.roam;
    this.speed = def.speed;
    this.radius = 0.34;
    this.talking = false;
    this._holding = false;
    this.width = def.width;
    this.height = def.height;

    this.faceX = -1;
    this.faceZ = 0;
    this.moving = false;
    this.mode = "idle";
    this.idleLeft = (def.idle ?? 6) + Math.random() * 4;
    this.target = null;
    this.stuck = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.idleT = Math.random() * 6;
    this.chatterLeft = 0;
    this.chatting = false;
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

  /** Face the player and stay put for a conversation. */
  setTalking(on, face) {
    this.talking = !!on;
    this.moving = false;
    this.target = null;
    this.mode = "idle";
    if (face) {
      this.faceX = face.x;
      this.faceZ = face.z;
    }
  }

  update(dt, collision, pibo, others = []) {
    if (this.talking || this._closeTo(pibo)) {
      this._hold(dt, collision, pibo);
      return;
    }
    if (this._holding) {
      this._holding = false;
      this.mode = "idle";
      this.idleLeft = 6 + Math.random() * 6;
      this.moving = false;
      this.target = null;
    }
    this._stroll(dt, collision);
    this._separate(others, collision);
    this.chatting = this.mode === "chatter" || nearSomeone(this, others, 1.2);
    setChatterBubble(this.bubble, false, dt, this.idleT, this.height);
    this._animate(dt);
    this._apply();
  }

  _closeTo(pibo) {
    if (!pibo) return false;
    return Math.hypot(this.x - pibo.x, this.z - pibo.z) < 2.15;
  }

  _hold(dt, collision, pibo) {
    this._holding = true;
    this.target = null;
    this.mode = "idle";
    this.moving = false;
    if (pibo) {
      const dx = pibo.x - this.x;
      const dz = pibo.z - this.z;
      const dist = Math.hypot(dx, dz) || 1;
      this.faceX = dx / dist;
      this.faceZ = dz / dist;
      const raw = Math.hypot(dx, dz);
      const need = (pibo.radius || 0.45) + this.radius * 0.45;
      if (raw < need) {
        const awayX = raw < 0.02 ? 1 : -dx / dist;
        const awayZ = raw < 0.02 ? 0 : -dz / dist;
        this._tryMove(awayX * Math.min(0.035, need - raw), awayZ * Math.min(0.035, need - raw), collision, this.roam + 0.12);
        this.moving = false;
      }
    }
    this.chatting = false;
    setChatterBubble(this.bubble, false, dt, this.idleT, this.height);
    this._animate(dt);
    this._apply();
  }

  _stroll(dt, collision) {
    if (this.mode === "chatter") {
      this.chatterLeft -= dt;
      this.moving = false;
      if (this.chatterLeft <= 0) {
        this.mode = "idle";
        this.idleLeft = 5 + Math.random() * 6;
      }
      return;
    }

    if (this.mode === "idle") {
      this.moving = false;
      this.idleLeft -= dt;
      if (this.idleLeft > 0) return;
      if (Math.random() > 0.22) {
        this.idleLeft = 5 + Math.random() * 7;
        if (Math.random() < 0.4) {
          this.mode = "chatter";
          this.chatterLeft = 1.15 + Math.random() * 0.75;
          this.walkPhase = 0;
        }
        return;
      }
      const next = this._pickTarget(collision);
      if (next) {
        this.target = next;
        this.mode = "walk";
        this.stuck = 0;
      } else {
        this.idleLeft = 4 + Math.random() * 4;
      }
      return;
    }

    if (!this.target) {
      this.mode = "idle";
      this.idleLeft = 4;
      this.moving = false;
      return;
    }

    let dx = this.target.x - this.x;
    let dz = this.target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06) {
      this.mode = "idle";
      this.idleLeft = 8 + Math.random() * 8;
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
      this.idleLeft = 5 + Math.random() * 5;
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
