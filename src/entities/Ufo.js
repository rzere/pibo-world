import * as THREE from "three";
import { clay, blob, ball, cyl, cone, shade } from "../world/materials.js";
import { surfaceQuaternion, tangentAt } from "../core/SphereMath.js";

const PARKED_ALT = 0.42;
const CRUISE_ALT = 5.2;
const MIN_FLY_ALT = 3.6;
const MAX_FLY_ALT = 34;
const FLY_SPEED = 9.2;
const CLIMB_SPEED = 7.5;
const TURN_SPEED = 2.1;

/**
 * A pot-shaped UFO parked on the landing pad. Pibo can hop in and fly it
 * around the pocket planet or out into the toy-sky "space" beyond the clouds.
 * Position lives as a surface direction + altitude so orbiting the world is
 * the same math as walking, just higher up.
 */
export class Ufo {
  constructor(planet, startDir, startForward, opts = {}) {
    this.planet = planet;
    this.dir = startDir.clone().normalize();
    this.forward = startForward
      ? startForward.clone().normalize()
      : tangentAt(this.dir);
    this.size = opts.scale ?? 1;
    this.autoVoyage = !!opts.voyage;
    this.canLand = opts.canLand !== false;
    this.boardLabel = opts.boardLabel ?? "Board the pot-ship";
    this.interactRange = opts.interactRange ?? 2.9;
    this.revealed = opts.hidden ? false : true;
    this.grow = this.revealed ? 1 : 0;
    this.heading = this.dir.clone();
    this.altitude = PARKED_ALT;
    this.mode = "parked"; // parked | takingOff | flying | landing | voyage
    this.t = 0;
    this.phaseT = 0;
    this.onLanded = null;

    this.group = new THREE.Group();
    this._buildModel();
    if (opts.crew) this._buildCrew();
    this.group.scale.setScalar(this.size);
    this.group.visible = this.revealed;
    planet.group.add(this.group);
    this._applyTransform();
  }

  get riding() {
    return this.mode !== "parked";
  }

  get altitudeWorld() {
    return this.altitude;
  }

  worldPosition(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }

  getInteractable(piboPos) {
    if (!this.revealed || !this.group.visible) return null;
    if (this.mode === "voyage") return null;
    if (this.riding) {
      return this.canLand ? { kind: "land", label: "Land" } : null;
    }
    if (piboPos.distanceTo(this.worldPosition()) < this.interactRange) {
      return { kind: "board", label: this.boardLabel };
    }
    return null;
  }

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.group.visible = true;
    this.grow = 0.02;
    this.group.scale.setScalar(0.02);
  }

  board() {
    if (this.mode !== "parked") return;
    this.mode = "takingOff";
    this.phaseT = 0;
    this._setPilotVisible(true);
    if (this.crew) this.crew.visible = true;
    this._setGlow(1.6);
  }

  requestLand(onLanded) {
    if (this.mode !== "flying") return;
    this.mode = "landing";
    this.phaseT = 0;
    this.onLanded = onLanded || null;
  }

  /** Park immediately, wherever the pot currently is in its flight. */
  settle(dir, forward) {
    this.mode = "parked";
    this.onLanded = null;
    this.phaseT = 0;
    this.altitude = PARKED_ALT;
    this.parkAt(dir, forward);
    this._setPilotVisible(false);
    this._setGlow(0.55);
  }

  parkAt(dir, forward) {
    this.dir.copy(dir).normalize();
    this.forward.copy(forward);
    const up = this.dir.clone();
    this.forward.sub(up.clone().multiplyScalar(this.forward.dot(up))).normalize();
    this.altitude = PARKED_ALT;
    this._applyTransform();
  }

  update(dt, input, { frozen = false } = {}) {
    this.t += dt;

    if (this.mode === "parked") {
      this._bobParked();
      this._spin(dt, 0.8);
      this._setGlow(0.55 + Math.sin(this.t * 2.2) * 0.2);
      this._animate(dt, 0, 0);
      if (this.grow < 1) this._growIn(dt);
      return;
    }

    if (this.mode === "takingOff") {
      this.phaseT += dt;
      const u = Math.min(1, this.phaseT / 1.15);
      const e = 1 - (1 - u) ** 3;
      this.altitude = PARKED_ALT + (CRUISE_ALT - PARKED_ALT) * e;
      this._spin(dt, 2.4);
      this._setGlow(0.7 + e * 1.4);
      this._applyTransform();
      this._animate(dt, 0, 0.4);
      if (u >= 1) {
        if (this.autoVoyage) {
          this.mode = "voyage";
          this.heading = this.dir.clone().multiplyScalar(0.55).add(this.forward).normalize();
          this.voyageUp = this.dir.clone();
        } else {
          this.mode = "flying";
        }
      }
      return;
    }

    if (this.mode === "voyage") {
      this.phaseT += dt;
      this._spin(dt, 3.4);
      this._setGlow(2.1);
      if (this.altitude < 36) {
        this.altitude += 11 * dt;
        const right = new THREE.Vector3().crossVectors(this.dir, this.forward).normalize();
        this.dir.applyAxisAngle(right, 0.12 * dt).normalize();
        this.forward.applyAxisAngle(right, 0.12 * dt);
        this.forward.sub(this.dir.clone().multiplyScalar(this.forward.dot(this.dir))).normalize();
        this._applyTransform();
      } else {
        this.group.position.add(this.heading.clone().multiplyScalar(22 * dt));
        // Keep the pot upright — lookAt + heading-as-up was flipping it.
        let up = (this.voyageUp || this.dir).clone();
        up.sub(this.heading.clone().multiplyScalar(up.dot(this.heading)));
        if (up.lengthSq() < 1e-6) up = tangentAt(this.heading);
        up.normalize();
        this.voyageUp = up;
        surfaceQuaternion(up, this.heading, this.group.quaternion);
      }
      this._animate(dt, 0.15, 0.7);
      if (this.grow < 1) this._growIn(dt);
      return;
    }

    if (this.mode === "landing") {
      this.phaseT += dt;
      this.altitude = Math.max(PARKED_ALT, this.altitude - 11 * dt);
      this._spin(dt, 1.6);
      this._setGlow(0.5 + this.altitude * 0.08);
      this._applyTransform();
      this._animate(dt, 0, -0.15);
      if (this.altitude <= PARKED_ALT + 0.02) {
        this.altitude = PARKED_ALT;
        this.mode = "parked";
        this._setPilotVisible(false);
        this._applyTransform();
        const cb = this.onLanded;
        this.onLanded = null;
        if (cb) cb();
      }
      return;
    }

    // flying
    let move = 0, turn = 0, climb = 0;
    if (input && !frozen) {
      move = input.moveForward;
      turn = input.turn;
      climb = input.climb;
    }

    const up = this.dir.clone().normalize();
    if (turn !== 0) {
      this.forward.applyAxisAngle(up, -turn * TURN_SPEED * dt);
    }

    if (move !== 0) {
      const right = new THREE.Vector3().crossVectors(up, this.forward).normalize();
      const da = (move * FLY_SPEED * dt) / (this.planet.radius + this.altitude);
      this.dir.applyAxisAngle(right, da).normalize();
      this.forward.applyAxisAngle(right, da);
    }

    if (climb !== 0) {
      this.altitude = THREE.MathUtils.clamp(
        this.altitude + climb * CLIMB_SPEED * dt,
        MIN_FLY_ALT,
        MAX_FLY_ALT
      );
    }

    this.forward.sub(this.dir.clone().multiplyScalar(this.forward.dot(this.dir))).normalize();
    this._spin(dt, 2.8 + Math.abs(move) * 1.4);
    this._setGlow(1.3 + Math.abs(move) * 0.7 + Math.max(0, climb) * 0.5);
    this._applyTransform();
    this._animate(dt, turn, move);
    if (this.grow < 1) this._growIn(dt);
  }

  _growIn(dt) {
    this.grow = Math.min(1, this.grow + dt * 1.35);
    const e = 1 - (1 - this.grow) ** 3;
    const pop = e < 1 ? e + Math.sin(e * Math.PI) * 0.08 : 1;
    this.group.scale.setScalar(pop * this.size);
  }

  _applyTransform() {
    const r = this.planet.radius + this.altitude;
    this.group.position.copy(this.dir).multiplyScalar(r);
    surfaceQuaternion(this.dir, this.forward, this.group.quaternion);
  }

  _bobParked() {
    const bob = PARKED_ALT + Math.sin(this.t * 1.7) * 0.06;
    this.group.position.copy(this.dir).multiplyScalar(this.planet.radius + bob);
    surfaceQuaternion(this.dir, this.forward, this.group.quaternion);
  }

  _spin(dt, speed) {
    if (this.ring) this.ring.rotation.z += dt * speed;
  }

  _setGlow(intensity) {
    if (this.glowMat) this.glowMat.emissiveIntensity = intensity;
    if (this.beamMat) this.beamMat.opacity = THREE.MathUtils.clamp(intensity * 0.18, 0.08, 0.45);
  }

  _setPilotVisible(visible) {
    if (this.pilot) this.pilot.visible = visible;
  }

  _animate(dt, turn, move) {
    const k = 1 - Math.exp(-8 * dt);
    const tiltZ = THREE.MathUtils.clamp(-turn * 0.28, -0.32, 0.32);
    const tiltX = THREE.MathUtils.clamp(move * 0.16, -0.2, 0.22);
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, tiltZ, k);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, tiltX, k);
    const hover = this.mode === "flying" ? Math.sin(this.t * 3.2) * 0.03 : 0;
    this.body.position.y = hover;
  }

  _buildModel() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    const pot = clay(0xffe27a);
    const potDark = clay(0xefc65c);
    const soil = clay(0x5a3f2c, { roughness: 1 });

    // planter-pot hull — taper like a flower pot, wide brim like a saucer
    const hull = cyl(0.92, 0.58, 0.72, pot, 28);
    hull.position.y = 0.48;
    this.body.add(hull);

    const belly = cyl(0.58, 0.82, 0.18, potDark, 28);
    belly.position.y = 0.08;
    this.body.add(belly);

    const brim = cyl(1.28, 1.12, 0.12, potDark, 28);
    brim.position.y = 0.82;
    this.body.add(brim);

    const lip = cyl(0.88, 0.9, 0.1, pot, 28);
    lip.position.y = 0.88;
    this.body.add(lip);

    const dirt = cyl(0.7, 0.7, 0.1, soil, 20);
    dirt.position.y = 0.9;
    this.body.add(dirt);

    // underside engine glow
    this.glowMat = clay(0x9eecff, { emissive: 0x66d8ff, emissiveIntensity: 0.7, roughness: 0.35 });
    const glow = cyl(0.5, 0.78, 0.08, this.glowMat, 22);
    glow.position.y = -0.02;
    this.body.add(glow);

    this.beamMat = clay(0x9eecff, {
      emissive: 0x7ae0ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.16,
      roughness: 0.4,
    });
    const beam = cyl(0.15, 0.55, 0.7, this.beamMat, 16);
    beam.position.y = -0.32;
    this.body.add(beam);

    // spinning halo — the "UFO" read
    const ringMat = clay(0xbfe9ff, { emissive: 0x8fd7ff, emissiveIntensity: 1.1, roughness: 0.35 });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 10, 36), ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.78;
    this.body.add(this.ring);

    // bubble canopy
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      clay(0xc8f0ff, {
        roughness: 0.12,
        transparent: true,
        opacity: 0.42,
        emissive: 0x8fd7ff,
        emissiveIntensity: 0.12,
      })
    );
    dome.position.y = 0.9;
    this.body.add(dome);

    // Mini Pibo pilot: visible only after boarding, so the player never vanishes.
    this.pilot = new THREE.Group();
    this.pilot.visible = false;
    this.pilot.position.set(0, 0.98, 0.1);
    this.pilot.scale.setScalar(0.42);
    this.body.add(this.pilot);

    const pilotBody = blob(0.4, pot, 1);
    pilotBody.scale.set(1.0, 1.1, 0.9);
    pilotBody.position.y = 0.12;
    this.pilot.add(pilotBody);

    const pilotRim = cyl(0.43, 0.5, 0.11, potDark, 18);
    pilotRim.position.y = 0.48;
    this.pilot.add(pilotRim);

    const eyeMat = clay(0x30303c, { roughness: 0.5 });
    for (const sx of [-1, 1]) {
      const eye = ball(0.055, eyeMat, 8);
      eye.scale.set(0.9, 1.1, 0.45);
      eye.position.set(sx * 0.12, 0.18, 0.36);
      this.pilot.add(eye);

      const cheek = ball(0.045, clay(0xffb6b6), 8);
      cheek.scale.set(1, 0.72, 0.4);
      cheek.position.set(sx * 0.22, 0.08, 0.34);
      this.pilot.add(cheek);
    }

    const pilotSoil = cyl(0.27, 0.3, 0.06, soil, 14);
    pilotSoil.position.y = 0.55;
    this.pilot.add(pilotSoil);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = cone(0.045, 0.36 + (i % 2) * 0.08, clay(0x6fbf5f), 8);
      leaf.scale.z = 0.3;
      leaf.position.set(Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08);
      leaf.rotation.y = a;
      leaf.rotation.z = -Math.cos(a) * 0.16;
      leaf.rotation.x = Math.sin(a) * 0.12;
      this.pilot.add(leaf);
    }

    // stubby landing legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const leg = cyl(0.045, 0.07, 0.32, potDark, 8);
      leg.position.set(Math.cos(a) * 0.78, 0.08, Math.sin(a) * 0.78);
      leg.rotation.z = Math.cos(a) * 0.45;
      leg.rotation.x = -Math.sin(a) * 0.45;
      this.body.add(leg);
      const foot = ball(0.09, pot, 10);
      foot.position.set(Math.cos(a) * 0.92, -0.04, Math.sin(a) * 0.92);
      this.body.add(foot);
    }

    // tiny antenna
    const ant = cyl(0.02, 0.02, 0.38, clay(0x9aa0a6), 6);
    ant.position.set(0.22, 1.38, -0.08);
    this.body.add(ant);
    const tip = ball(0.055, clay(0xff9a76, { emissive: 0xff9a76, emissiveIntensity: 0.45 }), 8);
    tip.position.set(0.22, 1.58, -0.08);
    this.body.add(tip);

    shade(this.group, true, false);
  }

  /** Three little passengers — yellow, blue, and tiny white Pino. */
  _buildCrew() {
    this.crew = new THREE.Group();
    this.crew.visible = false;
    this.crew.position.set(0, 1.02, 0.06);
    this.body.add(this.crew);

    const pals = [
      { color: 0xffe27a, dark: 0xefc65c, x: -0.22, s: 0.38 },
      { color: 0x7eb6f5, dark: 0x5a94d6, x: 0.22, s: 0.38 },
      { color: 0xfff6ea, dark: 0xe8dcc8, x: 0, s: 0.24 },
    ];
    for (const p of pals) {
      const g = new THREE.Group();
      g.position.set(p.x, p.s === 0.24 ? -0.02 : 0, 0.08);
      g.scale.setScalar(p.s);
      const body = blob(0.38, clay(p.color), 1);
      body.scale.set(1, 1.05, 0.9);
      g.add(body);
      const eyeMat = clay(0x30303c, { roughness: 0.5 });
      for (const sx of [-1, 1]) {
        const eye = ball(0.05, eyeMat, 8);
        eye.position.set(sx * 0.1, 0.06, 0.32);
        g.add(eye);
      }
      this.crew.add(g);
    }
  }
}
