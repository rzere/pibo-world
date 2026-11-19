import * as THREE from "three";
import { LAYOUT, GROUND_Y } from "../world/layout.js";
import { getPlant } from "../data/plants.js";

const STAGE_TIME = 2.6;
const INTERACT_RANGE = 2.2;

/**
 * Three flower beds on the island. Planting, growing, and inspecting stay the
 * same; the beds and sprouts are flat so they sit in the painterly world.
 * Swap in drawn plant frames later by replacing `_paintStage`.
 */
export class GardenSystem {
  constructor(parent, { isoQuat } = {}) {
    this.parent = parent;
    this.isoQuat = isoQuat || new THREE.Quaternion();
    this.spots = [];
    this.onAllGrown = null;
    this.onBloom = null;
    this._rewarded = false;
  }

  build() {
    LAYOUT.garden.forEach((entry, i) => {
      const bed = buildBed();
      bed.position.set(entry.x, GROUND_Y + 0.03, entry.z);
      this.parent.add(bed);

      const holder = new THREE.Group();
      holder.position.set(entry.x, GROUND_Y + 0.15, entry.z);
      holder.quaternion.copy(this.isoQuat);
      this.parent.add(holder);

      this.spots.push({
        index: i,
        worldPos: new THREE.Vector3(entry.x, GROUND_Y, entry.z),
        holder,
        state: "empty",
        plantId: null,
        stage: 0,
        timer: 0,
        inspected: false,
        plantMesh: null,
        popT: 0,
      });
    });
    return this;
  }

  get grownCount() {
    return this.spots.filter((s) => s.state === "bloomed").length;
  }

  getInteractable(worldPos) {
    let best = null;
    let bestD = INTERACT_RANGE;
    for (const s of this.spots) {
      const d = Math.hypot(worldPos.x - s.worldPos.x, worldPos.z - s.worldPos.z);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (!best) return null;
    if (best.state === "empty") return { spot: best, kind: "plant", label: "Plant something" };
    if (best.state === "growing") return { spot: best, kind: "wait", label: "Growing…", disabled: true };
    return { spot: best, kind: "inspect", label: best.inspected ? "Look again" : "What is it?" };
  }

  plant(spot, plantId) {
    if (spot.state !== "empty") return;
    spot.plantId = plantId;
    spot.state = "growing";
    spot.stage = 0;
    spot.timer = 0;
    this._setStageMesh(spot);
  }

  factFor(spot) {
    const plant = getPlant(spot.plantId);
    if (plant) spot.inspected = true;
    return plant;
  }

  update(dt) {
    for (const s of this.spots) {
      if (s.state === "growing") {
        s.timer += dt;
        const plant = getPlant(s.plantId);
        if (s.timer >= STAGE_TIME) {
          s.timer = 0;
          s.stage++;
          if (s.stage >= plant.stages - 1) {
            s.stage = plant.stages - 1;
            s.state = "bloomed";
            this._setStageMesh(s);
            this.onBloom?.(s);
          } else {
            this._setStageMesh(s);
          }
        }
      }
      if (s.plantMesh) {
        if (s.popT < 1) {
          s.popT = Math.min(1, s.popT + dt * 2.2);
          const pop = easeOutBack(s.popT);
          s.plantMesh.scale.set(pop, pop, 1);
        }
        s.plantMesh.position.y = 0.55 + Math.sin(performance.now() * 0.001 * 1.4 + s.index) * 0.04;
      }
    }
    if (!this._rewarded && this.grownCount === this.spots.length && this.spots.length > 0) {
      this._rewarded = true;
      this.onAllGrown?.();
    }
  }

  _setStageMesh(spot) {
    if (spot.plantMesh) {
      spot.holder.remove(spot.plantMesh);
      spot.plantMesh.geometry?.dispose();
      spot.plantMesh.material.map?.dispose();
      spot.plantMesh.material.dispose();
    }
    const plant = getPlant(spot.plantId);
    const mesh = buildSprout(plant, spot.stage);
    spot.plantMesh = mesh;
    spot.popT = 0;
    mesh.scale.set(0.001, 0.001, 1);
    spot.holder.add(mesh);
  }
}

function buildBed() {
  const g = new THREE.Group();
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0x6a4a33 })
  );
  soil.rotation.x = -Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.62, 22),
    new THREE.MeshBasicMaterial({ color: 0xc4925a, side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  g.add(soil);
  g.add(rim);
  return g;
}

function buildSprout(plant, stage) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  paintStage(ctx, plant, stage);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.15,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), mat);
  mesh.position.y = 0.55;
  return mesh;
}

function paintStage(ctx, plant, stage) {
  const color = css(plant.color);
  const accent = css(plant.accent);
  const leaf = css(plant.leaf ?? 0x6fae5a);
  ctx.clearRect(0, 0, 128, 160);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5a4638";
  ctx.lineWidth = 4;
  const stemTop = stage === 0 ? 118 : stage === 1 ? 96 : stage === 2 ? 72 : 58;
  ctx.beginPath();
  ctx.moveTo(64, 142);
  ctx.quadraticCurveTo(60, (142 + stemTop) / 2, 64, stemTop);
  ctx.strokeStyle = leaf;
  ctx.stroke();
  ctx.strokeStyle = "#5a4638";
  if (stage >= 1) {
    leafBlob(ctx, 48, stemTop + 16, leaf, -0.6);
    leafBlob(ctx, 80, stemTop + 20, leaf, 0.5);
  }
  if (stage === 0) {
    ctx.fillStyle = "#8a5a3a";
    circle(ctx, 64, 132, 7);
    return;
  }
  if (stage === 1) return;
  if (stage === 2) {
    ctx.fillStyle = accent;
    circle(ctx, 64, stemTop - 6, 10);
    return;
  }
  if (plant.type === "sun") {
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      circle(ctx, 64 + Math.cos(a) * 16, stemTop - 8 + Math.sin(a) * 12, 7);
    }
    ctx.fillStyle = accent;
    circle(ctx, 64, stemTop - 8, 8);
  } else if (plant.type === "bell") {
    ctx.fillStyle = color;
    for (const dx of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.ellipse(64 + dx, stemTop + 2, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64, stemTop);
      ctx.quadraticCurveTo(64 + side * 20, stemTop - 10, 64 + side * 28, stemTop + 8);
      ctx.stroke();
    }
  }
}

function leafBlob(ctx, x, y, color, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function css(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
