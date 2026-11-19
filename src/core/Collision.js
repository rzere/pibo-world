/**
 * Keep-outs on the flat island. Houses are convex footprints around the
 * walls. A few big trunks are circles. Pibo is pushed out along the nearest
 * edge so he slides instead of sticking. Water and the ground are not colliders.
 */
export class Collision {
  constructor(obstacles = []) {
    this.obstacles = obstacles.map(shapeOf);
  }

  add(x, z, radius, id = "") {
    this.obstacles.push(shapeOf({ id, type: "circle", x, z, radius }));
  }

  remove(id) {
    this.obstacles = this.obstacles.filter((o) => o.id !== id);
  }

  /**
   * Push a point out of any overlapping house or trunk.
   * `padding` is Pibo's body radius, scaled with him.
   */
  resolve(x, z, padding = 0.2) {
    let px = x;
    let pz = z;
    const skin = padding;
    for (let pass = 0; pass < 6; pass++) {
      let hit = false;
      for (const o of this.obstacles) {
        if (o.type === "poly") {
          const pushed = pushPoly(px, pz, o, skin);
          if (pushed) {
            px = pushed.x;
            pz = pushed.z;
            hit = true;
          }
          continue;
        }
        if (o.type === "box") {
          const hx = o.halfW + skin;
          const hz = o.halfD + skin;
          const dx = px - o.x;
          const dz = pz - o.z;
          const adx = Math.abs(dx);
          const adz = Math.abs(dz);
          if (adx >= hx || adz >= hz) continue;
          const penX = hx - adx;
          const penZ = hz - adz;
          if (penX <= penZ) px += (dx < 0 ? -1 : 1) * (penX + 0.0001);
          else pz += (dz < 0 ? -1 : 1) * (penZ + 0.0001);
          hit = true;
          continue;
        }
        let dx = px - o.x;
        let dz = pz - o.z;
        const min = o.radius + skin;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || min <= 0) continue;
        if (d2 < 1e-8) {
          px += min;
        } else {
          const d = Math.sqrt(d2);
          const push = (min - d) / d;
          px += dx * push;
          pz += dz * push;
        }
        hit = true;
      }
      if (!hit) break;
    }
    return { x: px, z: pz };
  }
}

function pushPoly(px, pz, o, skin) {
  let inside = true;
  let closest = null;
  for (const e of o.edges) {
    const dist = (px - e.ax) * e.nx + (pz - e.az) * e.nz;
    if (dist > 0) inside = false;
    if (!closest || dist > closest.dist) closest = { dist, nx: e.nx, nz: e.nz };
  }
  if (inside) {
    const push = skin - closest.dist + 0.0001;
    return { x: px + closest.nx * push, z: pz + closest.nz * push };
  }

  let best = Infinity;
  let qx = px;
  let qz = pz;
  for (const e of o.edges) {
    const ex = e.bx - e.ax;
    const ez = e.bz - e.az;
    const len2 = ex * ex + ez * ez || 1;
    let t = ((px - e.ax) * ex + (pz - e.az) * ez) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = e.ax + ex * t;
    const cz = e.az + ez * t;
    const ddx = px - cx;
    const ddz = pz - cz;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 < best) {
      best = d2;
      qx = cx;
      qz = cz;
    }
  }
  const d = Math.sqrt(best);
  if (d >= skin) return null;
  if (d < 1e-6) {
    return { x: px + closest.nx * (skin + 0.0001), z: pz + closest.nz * (skin + 0.0001) };
  }
  const push = (skin - d) / d;
  return { x: px + (px - qx) * push, z: pz + (pz - qz) * push };
}

function shapeOf(o) {
  const type = o.type === "poly" ? "poly" : o.type === "box" ? "box" : "circle";
  const shape = {
    id: o.id || "",
    type,
    x: o.x || 0,
    z: o.z || 0,
    radius: o.radius || 0,
    halfW: o.halfW || 0,
    halfD: o.halfD || 0,
    points: o.points || [],
    edges: [],
  };
  if (type === "poly" && shape.points.length >= 3) {
    shape.edges = edgesOf(shape.points);
  }
  return shape;
}

/** Outward edge normals, so the side test does not depend on winding. */
function edgesOf(points) {
  let cx = 0;
  let cz = 0;
  for (const p of points) {
    cx += p.x;
    cz += p.z;
  }
  cx /= points.length;
  cz /= points.length;
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez) || 1;
    let nx = ez / len;
    let nz = -ex / len;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    if ((cx - mx) * nx + (cz - mz) * nz > 0) {
      nx = -nx;
      nz = -nz;
    }
    edges.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, nx, nz });
  }
  return edges;
}
