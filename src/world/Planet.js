import * as THREE from "three";
import { clay, shade } from "./materials.js";
import { latLonToDir } from "../core/SphereMath.js";
import { OCEAN_LAT, SHORE_WIDTH, oceanAmount } from "./biome.js";

/**
 * The Pocket Planet itself: a small sphere the player lives on.
 *
 * Default surface is open ocean (opaque blue). A grassy northern cap and
 * painted islands sit on top, so empty hillside reads as sea instead of a
 * green ball with a tiny pond sticker.
 */
export class Planet {
  constructor(config = {}) {
    this.radius = config.radius ?? 10;
    this.group = new THREE.Group();
    this.surface = new THREE.Group(); // props/entities live here
    this.group.add(this.surface);

    this._build(config);
  }

  _build(config) {
    // Warm soil core — peeks out under the sea at the silhouette
    const soil = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.978, 32, 32),
      clay(config.soil ?? 0xcaa46a, { roughness: 1 })
    );
    this.group.add(soil);

    this._buildOcean();
    this._buildLandCap(config);

    this._grassPatches(config.grassDark ?? 0x7cbb63);
  }

  _buildOcean() {
    const R = this.radius;
    const geo = new THREE.SphereGeometry(R, 64, 48);
    this._tintOcean(geo);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f96c8,
      roughness: 0.2,
      metalness: 0.05,
      vertexColors: true,
      emissive: 0x0d4c78,
      emissiveIntensity: 0.28,
    });
    const water = new THREE.Mesh(geo, mat);
    water.receiveShadow = true;
    water.castShadow = true;
    this.group.add(water);
    this.ground = water;
    this.oceanWater = water;
    this.oceanBase = Float32Array.from(geo.attributes.position.array);
    this.t = 0;
  }

  _tintOcean(geo) {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const shallow = new THREE.Color(0x5ec9de);
    const deep = new THREE.Color(0x1a6fa8);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const lat = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)));
      const depth = THREE.MathUtils.smoothstep(OCEAN_LAT - 4, OCEAN_LAT + 40, lat);
      const c = shallow.clone().lerp(deep, depth);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  _buildLandCap(config) {
    const R = this.radius * 1.006;
    const grassTheta = THREE.MathUtils.degToRad(OCEAN_LAT - 1.5);
    const grass = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, grassTheta),
      clay(config.grass ?? 0x8fce74, { roughness: 0.95 })
    );
    grass.receiveShadow = true;
    grass.castShadow = true;
    this.group.add(grass);

    const shoreStart = THREE.MathUtils.degToRad(OCEAN_LAT - SHORE_WIDTH);
    const shoreLen = THREE.MathUtils.degToRad(SHORE_WIDTH + 6);
    const shore = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.001, 48, 10, 0, Math.PI * 2, shoreStart, shoreLen),
      clay(0xe6d09a, { roughness: 1 })
    );
    shore.receiveShadow = true;
    this.group.add(shore);
  }

  update(dt) {
    if (!this.oceanWater) return;
    this.t += dt;
    const pos = this.oceanWater.geometry.attributes.position;
    const base = this.oceanBase;
    const t = this.t;
    const shoreY = Math.cos(THREE.MathUtils.degToRad(OCEAN_LAT + 3));
    for (let i = 0; i < pos.count; i++) {
      const ox = base[i * 3], oy = base[i * 3 + 1], oz = base[i * 3 + 2];
      const len = Math.hypot(ox, oy, oz) || 1;
      const nx = ox / len, ny = oy / len, nz = oz / len;
      // keep the village seam still so grass/sand caps don't z-fight
      const wave = ny < shoreY
        ? Math.sin(ox * 0.55 + oz * 0.4 - t * 2.0) * 0.032
          + Math.sin(oy * 0.85 + ox * 0.3 + t * 1.35) * 0.018
        : 0;
      const s = len + wave;
      pos.setXYZ(i, nx * s, ny * s, nz * s);
    }
    pos.needsUpdate = true;
  }

  _grassPatches(color) {
    const patchMat = clay(color, { roughness: 1 });
    const group = new THREE.Group();
    const rng = mulberry32(1337);
    let placed = 0;
    let guard = 0;
    while (placed < 26 && guard < 80) {
      guard++;
      const lat = 8 + rng() * 48;
      const lon = rng() * 360;
      const dir = latLonToDir(lat, lon);
      if (oceanAmount(dir) > 0.22) continue;
      const r = 0.5 + rng() * 1.4;
      const patch = new THREE.Mesh(new THREE.CircleGeometry(r, 14), patchMat);
      this.placeOnSurface(patch, dir, { lift: 0.02, flatDecal: true });
      patch.rotateZ(rng() * Math.PI);
      group.add(patch);
      placed++;
    }
    shade(group, false, true);
    this.surface.add(group);
  }

  /** World-space point for a surface direction, lifted `lift` above ground. */
  pointAt(dir, lift = 0) {
    return dir.clone().normalize().multiplyScalar(this.radius + lift);
  }

  /**
   * Place an object on the surface at a unit direction.
   * By default orients its +Y up along the surface normal.
   */
  placeOnSurface(obj, dir, { lift = 0, flatDecal = false, yaw = 0 } = {}) {
    const n = dir.clone().normalize();
    obj.position.copy(n).multiplyScalar(this.radius + lift);
    if (flatDecal) {
      // circle geometry faces +Z; lay it flat against the surface
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    } else {
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    }
    if (yaw) obj.rotateY(yaw); // spin around the surface normal
    this.surface.add(obj);
    return obj;
  }
}

// tiny deterministic RNG so the world looks the same every visit
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
