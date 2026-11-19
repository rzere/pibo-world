import * as THREE from "three";
import { Critter } from "./Critter.js";

const LIFT = 0.82;
const LABEL_GAP = 0.2;

/**
 * A player on the island, drawn as one of the characters. It does not wander.
 * The local player copies Pibo's walker each frame; a remote player eases
 * toward the last position the network sent.
 */
export class Avatar extends Critter {
  constructor({ textures, basis, def, name = "", x = 0, z = 0 }) {
    super({ textures, basis, def: { ...def, x, z, roam: 0, speed: 0 } });
    this.group.name = `avatar-${def.id}`;
    this.targetX = x;
    this.targetZ = z;
    this.remoteMoving = false;
    this.flying = false;
    this.lift = 0;
    this.label = makeLabel(name);
    this.label.position.y = this.height + LABEL_GAP;
    this.pivot.add(this.label);
    this.bubble.visible = false;
  }

  setName(name) {
    const next = makeLabel(name);
    next.position.copy(this.label.position);
    this.pivot.remove(this.label);
    this.label.material.map?.dispose();
    this.label = next;
    this.pivot.add(next);
  }

  setVisible(v) {
    this.group.visible = v;
  }

  /** Mirror the local walker (Pibo), which owns input, collision and flight. */
  follow(dt, walker) {
    this.x = walker.x;
    this.z = walker.z;
    this.faceX = walker.faceX;
    this.faceZ = walker.faceZ;
    this.moving = walker.moving;
    this.flying = walker.flying;
    this._step(dt);
  }

  /** Remote players: set by the network, eased every frame. */
  setTarget({ x, z, fx, fz, m, f }) {
    this.targetX = x;
    this.targetZ = z;
    if (fx || fz) {
      this.faceX = fx;
      this.faceZ = fz;
    }
    this.remoteMoving = !!m;
    this.flying = !!f;
  }

  snap() {
    this.x = this.targetX;
    this.z = this.targetZ;
    this._apply();
  }

  drive(dt) {
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 6) {
      this.x = this.targetX;
      this.z = this.targetZ;
    } else {
      const k = 1 - Math.exp(-dt * 12);
      this.x += dx * k;
      this.z += dz * k;
    }
    this.moving = this.remoteMoving || dist > 0.05;
    this._step(dt);
  }

  _step(dt) {
    this.mode = this.moving ? "walk" : "idle";
    this._animate(dt);
    const k = 1 - Math.exp(-dt * 8);
    this.lift += ((this.flying ? LIFT : 0) - this.lift) * k;
    this.mesh.position.y += this.lift;
    this.label.position.y = this.height + LABEL_GAP + this.lift;
    this.shadow.material.opacity = this.flying ? 0.28 : this.shadow.material.opacity;
    this._apply();
  }
}

function makeLabel(name) {
  const text = (name || "").slice(0, 18);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 44px Fredoka, system-ui, sans-serif";
  ctx.font = font;
  const w = Math.max(80, Math.ceil(ctx.measureText(text).width) + 44);
  const h = 72;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = "rgba(255, 250, 240, 0.92)";
  ctx.strokeStyle = "rgba(90, 70, 56, 0.85)";
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, w - 4, h - 4, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4a3a30";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const scale = 0.0085;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * scale, h * scale),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
  );
  mesh.renderOrder = 10;
  mesh.visible = !!text;
  return mesh;
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
