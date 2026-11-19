import * as THREE from "three";

/**
 * Helpers for living on the surface of a tiny planet.
 *
 * Everything in Pibo happens on a sphere. Positions are stored as unit
 * direction vectors and scaled by the planet radius when placed in the world.
 * Keeping the math here means future planets of any size/shape reuse the same
 * movement + placement rules.
 */

const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();

/**
 * Convert a latitude/longitude (degrees) into a unit direction on the sphere.
 * lat = 0 sits at the "north pole" (0,1,0) — the player's starting region.
 */
export function latLonToDir(latDeg, lonDeg) {
  const phi = THREE.MathUtils.degToRad(latDeg); // angle away from pole
  const theta = THREE.MathUtils.degToRad(lonDeg);
  const s = Math.sin(phi);
  return new THREE.Vector3(s * Math.cos(theta), Math.cos(phi), s * Math.sin(theta));
}

/** Inverse of latLonToDir. lat is degrees from the north pole, lon is degrees. */
export function latLonOf(dir) {
  const y = THREE.MathUtils.clamp(dir.y, -1, 1);
  const lat = THREE.MathUtils.radToDeg(Math.acos(y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(dir.z, dir.x));
  return { lat, lon };
}

/** A stable tangent (points roughly "south") at a given surface direction. */
export function tangentAt(dir, ref = _up) {
  const up = dir.clone().normalize();
  let t = new THREE.Vector3().crossVectors(ref, up);
  if (t.lengthSq() < 1e-6) t = new THREE.Vector3(1, 0, 0); // at the poles
  t.normalize();
  // re-project to be perpendicular to up
  return t.sub(up.clone().multiplyScalar(t.dot(up))).normalize();
}

/** Tangent at `fromDir` that points toward `toDir` along the surface. */
export function tangentToward(fromDir, toDir) {
  const up = fromDir.clone().normalize();
  const t = toDir.clone().sub(up.clone().multiplyScalar(toDir.dot(up)));
  if (t.lengthSq() < 1e-6) return tangentAt(fromDir);
  return t.normalize();
}

/**
 * Build a quaternion that orients a +Y-up, +Z-forward model so that it stands
 * on the surface at `dir`, facing along the tangent `forward`.
 */
export function surfaceQuaternion(dir, forward, target = new THREE.Quaternion()) {
  const up = dir.clone().normalize();
  let fwd = forward.clone();
  fwd.sub(up.clone().multiplyScalar(fwd.dot(up)));
  if (fwd.lengthSq() < 1e-6) fwd = tangentAt(up);
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const f2 = new THREE.Vector3().crossVectors(right, up).normalize();
  _m.makeBasis(right, up, f2);
  return target.setFromRotationMatrix(_m);
}

/** Great-circle angular distance between two surface directions (radians). */
export function arcBetween(a, b) {
  return a.clone().normalize().angleTo(b.clone().normalize());
}
