import * as THREE from "three";
import { clay, blob, ball, box, cyl, cone, shade } from "./materials.js";
import { LAYOUT, dirOf } from "./layout.js";
import { mulberry32 } from "./Planet.js";
import { surfaceQuaternion, tangentToward } from "../core/SphereMath.js";

/**
 * Every handcrafted structure and piece of nature on the starter planet.
 * Each builder returns a Group whose base sits at y=0 and grows upward, so the
 * Planet can place it flush on the surface. Props holds references to the few
 * things that animate or react (pond water, landing beacon, observatory lights,
 * and the reward pieces).
 */
export class Props {
  constructor(planet) {
    this.planet = planet;
    this.t = 0;
    this.observatoryLights = [];
    this.planetariumLights = [];
    this.twinklers = [];
    this.landingRing = null;
    this.dockRing = null;
    this.dockBeacon = null;
    this.tvScreen = null;
    this.tvBeacon = null;
    this.lighthouseBeam = null;
    this.lighthouseColumn = null;
    this.lighthouseStar = null;
    this.pondWater = null;
    this.bridge = null;
    this.rewardBloom = null;
    this.swayers = []; // {mesh, phase, amp}
  }

  build() {
    const P = this.planet;

    P.placeOnSurface(shade(buildHome()), dirOf(LAYOUT.home), { yaw: LAYOUT.home.yaw });
    P.placeOnSurface(shade(buildWorkshop()), dirOf(LAYOUT.workshop), { yaw: LAYOUT.workshop.yaw });

    const obs = buildObservatory(this.observatoryLights);
    P.placeOnSurface(shade(obs), dirOf(LAYOUT.observatory), { lift: 0, yaw: LAYOUT.observatory.yaw });

    const planetarium = buildPlanetarium(this.planetariumLights);
    P.placeOnSurface(shade(planetarium), dirOf(LAYOUT.planetarium), { yaw: LAYOUT.planetarium.yaw });
    this._collectTwinkles(planetarium);

    P.placeOnSurface(shade(buildCafe()), dirOf(LAYOUT.cafe), { yaw: LAYOUT.cafe.yaw });

    const arcade = buildArcade();
    const arcadeDir = dirOf(LAYOUT.arcade);
    P.placeOnSurface(shade(arcade), arcadeDir);
    surfaceQuaternion(
      arcadeDir,
      tangentToward(arcadeDir, dirOf(LAYOUT.arcadeDoor)),
      arcade.quaternion
    );
    P.placeOnSurface(shade(buildLibrary()), dirOf(LAYOUT.library), { yaw: LAYOUT.library.yaw });
    P.placeOnSurface(shade(buildWindmill()), dirOf(LAYOUT.windmill), { yaw: LAYOUT.windmill.yaw });
    P.placeOnSurface(shade(buildWell()), dirOf(LAYOUT.well), { yaw: LAYOUT.well.yaw });
    P.placeOnSurface(shade(buildPicnic()), dirOf(LAYOUT.picnic), { yaw: LAYOUT.picnic.yaw });

    const pond = buildPond();
    this.pondWater = pond.userData.water;
    P.placeOnSurface(shade(pond, false, true), dirOf(LAYOUT.pond));

    const sand = buildSandIsland(2.15);
    P.placeOnSurface(shade(sand, false, true), dirOf(LAYOUT.lighthouseIsland));

    const meadow = buildMeadowIsland();
    P.placeOnSurface(shade(meadow, false, true), dirOf(LAYOUT.meadowIsland));

    const pad = buildLandingPad();
    this.landingRing = pad.userData.ring;
    this.landingBeacon = pad.userData.beacon;
    P.placeOnSurface(shade(pad), dirOf(LAYOUT.landing));

    const lighthouse = buildLighthouse();
    this.tvScreen = lighthouse.userData.screen;
    this.tvBeacon = lighthouse.userData.beacon;
    this.lighthouseBeam = lighthouse.userData.beam;
    this.lighthouseColumn = lighthouse.userData.column;
    this.lighthouseStar = lighthouse.userData.star;
    const lhDir = dirOf(LAYOUT.lighthouse);
    P.placeOnSurface(shade(lighthouse), lhDir);
    // door (+Z) faces the dock so walking off the pier meets the entrance
    surfaceQuaternion(
      lhDir,
      tangentToward(lhDir, dirOf(LAYOUT.lighthousePad)),
      lighthouse.quaternion
    );
    lighthouse.traverse((o) => {
      if (o.userData.keepBright) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });

    const dock = buildLighthouseDock();
    this.dockRing = dock.userData.ring;
    this.dockBeacon = dock.userData.beacon;
    const padDir = dirOf(LAYOUT.lighthousePad);
    P.placeOnSurface(shade(dock), padDir);
    // +Z of the pier faces the lighthouse so the planks read as a walkway
    surfaceQuaternion(
      padDir,
      tangentToward(padDir, dirOf(LAYOUT.lighthouse)),
      dock.quaternion
    );

    for (const spot of LAYOUT.lighthouseSigns ?? []) {
      const signDir = dirOf(spot);
      const sign = shade(buildLighthouseSign());
      P.placeOnSurface(sign, signDir);
      surfaceQuaternion(
        signDir,
        tangentToward(signDir, dirOf(LAYOUT.lighthouse)),
        sign.quaternion
      );
    }

    for (const step of LAYOUT.lighthousePath ?? []) {
      const lamp = buildLantern(step.lon);
      P.placeOnSurface(shade(lamp), dirOf(step), { yaw: step.lon });
      this._collectTwinkles(lamp);
    }

    // nature
    for (const t of LAYOUT.trees) {
      const tree = buildTree(t.lon);
      P.placeOnSurface(shade(tree), dirOf(t), { yaw: t.lon });
      this._collectSway(tree);
    }
    for (const r of LAYOUT.rocks) {
      P.placeOnSurface(shade(buildRock(r.lon)), dirOf(r), { yaw: r.lon });
    }
    for (const r of LAYOUT.seaRocks ?? []) {
      P.placeOnSurface(shade(buildRock(r.lon + 11)), dirOf(r), { yaw: r.lon });
    }
    for (const f of LAYOUT.flowers) {
      const fl = buildFlower(f.lon);
      P.placeOnSurface(shade(fl), dirOf(f), { yaw: f.lon });
      this._collectSway(fl);
    }
    for (const l of LAYOUT.lanterns) {
      const lantern = buildLantern(l.lon);
      P.placeOnSurface(shade(lantern), dirOf(l), { yaw: l.lon });
      this._collectTwinkles(lantern);
    }
    for (const m of LAYOUT.mushrooms) {
      P.placeOnSurface(shade(buildMushrooms(m.lon)), dirOf(m), { yaw: m.lon });
    }
    for (const b of LAYOUT.benches) {
      P.placeOnSurface(shade(buildBench()), dirOf(b), { yaw: b.yaw });
    }
    for (const s of LAYOUT.starStones) {
      P.placeOnSurface(shade(buildStarStone(s.lon), true, true), dirOf(s), { yaw: s.lon });
    }
    for (const m of LAYOUT.mailboxes) {
      P.placeOnSurface(shade(buildMailbox(m.lon)), dirOf(m), { yaw: m.yaw });
    }
    for (const s of LAYOUT.signposts) {
      P.placeOnSurface(shade(buildSignpost()), dirOf(s), { yaw: s.yaw });
    }
    for (const c of LAYOUT.crystals) {
      const crystals = buildCrystals(c.lon);
      P.placeOnSurface(shade(crystals), dirOf(c), { yaw: c.lon });
      this._collectTwinkles(crystals);
    }

    // reward pieces, hidden until earned
    this.bridge = shade(buildBridge());
    this.bridge.visible = false;
    P.placeOnSurface(this.bridge, dirOf(LAYOUT.bridge), { yaw: LAYOUT.bridge.yaw });

    this.rewardBloom = shade(buildRewardBloom());
    this.rewardBloom.visible = false;
    this.rewardBloom.scale.setScalar(0.001);
    P.placeOnSurface(this.rewardBloom, dirOf(LAYOUT.rewardBloom));

    return this;
  }

  _collectSway(group) {
    group.traverse((o) => {
      if (o.userData.sway) {
        this.swayers.push({ mesh: o, phase: Math.random() * Math.PI * 2, amp: o.userData.sway });
      }
    });
  }

  _collectTwinkles(group) {
    group.traverse((o) => {
      if (o.userData.twinkle && o.material) {
        this.twinklers.push({ mesh: o, phase: Math.random() * Math.PI * 2, amp: o.userData.twinkle });
      }
    });
  }

  setObservatoryLit(on) {
    for (const m of this.observatoryLights) {
      m.emissiveIntensity = on ? 1 : 0;
    }
  }

  revealBridge() {
    this.bridge.visible = true;
  }

  revealBloom() {
    this.rewardBloom.visible = true;
    this.rewardBloom.userData.grow = 0; // animate scale up
  }

  update(dt) {
    this.t += dt;
    const t = this.t;

    // gentle grass/flower sway
    for (const s of this.swayers) {
      s.mesh.rotation.z = Math.sin(t * 1.6 + s.phase) * s.amp;
    }

    // pond ripples — the open ocean animates on the planet mesh
    if (this.pondWater) {
      const geo = this.pondWater.geometry;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const r = Math.sqrt(x * x + y * y);
        pos.setZ(i, Math.sin(r * 3.4 - t * 2.2) * 0.045 * Math.min(1, r));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    if (this.tvBeacon) {
      const p = (Math.sin(t * 3.1) + 1) * 0.5;
      this.tvBeacon.material.emissiveIntensity = 0.9 + p * 1.1;
    }
    if (this.lighthouseBeam) this.lighthouseBeam.rotation.y += dt * 0.85;
    if (this.lighthouseColumn) {
      const pulse = 0.55 + (Math.sin(t * 1.6) + 1) * 0.16;
      this.lighthouseColumn.material.opacity = pulse;
    }
    if (this.lighthouseStar) {
      const s = 1 + Math.sin(t * 2.4) * 0.14;
      this.lighthouseStar.scale.setScalar(s);
    }

    // landing beacon pulse
    if (this.landingBeacon) {
      const p = (Math.sin(t * 2.0) + 1) * 0.5;
      this.landingBeacon.material.emissiveIntensity = 0.4 + p * 1.1;
      this.landingBeacon.scale.setScalar(0.9 + p * 0.18);
    }
    if (this.landingRing) this.landingRing.rotation.z += dt * 0.6;
    if (this.dockRing) this.dockRing.rotation.z += dt * 0.6;
    if (this.dockBeacon) {
      const p = (Math.sin(t * 2.0) + 1) * 0.5;
      this.dockBeacon.material.emissiveIntensity = 0.55 + p * 1.15;
      this.dockBeacon.scale.setScalar(0.9 + p * 0.18);
    }

    for (const tw of this.twinklers) {
      const p = (Math.sin(t * 2.4 + tw.phase) + 1) * 0.5;
      tw.mesh.material.emissiveIntensity = 0.25 + p * tw.amp;
      tw.mesh.scale.setScalar(0.92 + p * 0.18);
    }

    // reward bloom pop-in
    const rb = this.rewardBloom;
    if (rb && rb.visible && rb.userData.grow < 1) {
      rb.userData.grow = Math.min(1, rb.userData.grow + dt * 1.4);
      const e = easeOutBack(rb.userData.grow);
      rb.scale.setScalar(e);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Structure builders — primitives only, clay palette                  */
/* ------------------------------------------------------------------ */

function buildHome() {
  const g = new THREE.Group();
  const body = box(2.2, 1.7, 2.0, clay(0xfff0d2));
  body.position.y = 0.85;
  g.add(body);

  const roof = cone(1.9, 1.3, clay(0xe08a6b), 4);
  roof.position.y = 2.35;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const door = box(0.6, 0.95, 0.1, clay(0xb06a45));
  door.position.set(0, 0.48, 1.02);
  g.add(door);
  const knob = ball(0.06, clay(0xffe28a, { emissive: 0xffce5a, emissiveIntensity: 0.3 }));
  knob.position.set(0.16, 0.5, 1.08);
  g.add(knob);

  const win = ball(0.28, clay(0xbfe0ff, { emissive: 0x8fc7ff, emissiveIntensity: 0.15 }));
  win.scale.set(1, 1, 0.25);
  win.position.set(-0.65, 1.05, 1.02);
  g.add(win);

  const chimney = box(0.35, 0.7, 0.35, clay(0xc06a48));
  chimney.position.set(0.7, 2.3, -0.2);
  g.add(chimney);

  return g;
}

function buildWorkshop() {
  const g = new THREE.Group();
  const body = box(2.0, 1.4, 1.7, clay(0xcaa06a));
  body.position.y = 0.7;
  g.add(body);

  // planks
  for (let i = 0; i < 3; i++) {
    const plank = box(2.02, 0.06, 1.72, clay(0xb98a55));
    plank.position.y = 0.35 + i * 0.45;
    g.add(plank);
  }

  const roof = box(2.3, 0.28, 2.0, clay(0x5bb0a0));
  roof.position.y = 1.5;
  roof.rotation.z = 0.12;
  g.add(roof);

  const crate = box(0.6, 0.6, 0.6, clay(0xb98a55));
  crate.position.set(1.35, 0.3, 0.4);
  crate.rotation.y = 0.4;
  g.add(crate);

  // grinding wheel
  const wheel = cyl(0.35, 0.35, 0.12, clay(0x9aa0a6), 20);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(-1.25, 0.55, 0.3);
  g.add(wheel);
  const post = box(0.12, 0.5, 0.12, clay(0x8a6a45));
  post.position.set(-1.25, 0.25, 0.3);
  g.add(post);

  return g;
}

function buildObservatory(lightRefs) {
  const g = new THREE.Group();

  // raised grassy hill
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    clay(0x83c268, { roughness: 1 })
  );
  hill.scale.y = 0.5;
  g.add(hill);

  const base = cyl(1.0, 1.15, 1.2, clay(0xcfc6b4), 24);
  base.position.y = 1.05;
  g.add(base);

  // windows that will glow on reward
  for (let i = 0; i < 4; i++) {
    const m = clay(0xffd98a, { emissive: 0xffbe4d, emissiveIntensity: 0 });
    lightRefs.push(m);
    const w = box(0.28, 0.4, 0.12, m);
    const a = (i / 4) * Math.PI * 2;
    w.position.set(Math.cos(a) * 1.0, 1.05, Math.sin(a) * 1.0);
    w.lookAt(w.position.clone().multiplyScalar(2));
    g.add(w);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    clay(0xdfe6ef)
  );
  dome.position.y = 1.65;
  g.add(dome);

  // telescope poking out
  const scope = cyl(0.14, 0.2, 1.1, clay(0x6b7280), 16);
  scope.position.set(0.2, 2.05, 0.2);
  scope.rotation.set(-0.7, 0, -0.5);
  g.add(scope);

  return g;
}

function buildPlanetarium(lightRefs) {
  const g = new THREE.Group();

  const base = cyl(1.35, 1.55, 0.65, clay(0x7b8fb5), 24);
  base.position.y = 0.33;
  g.add(base);

  const floor = cyl(1.65, 1.75, 0.16, clay(0xe9e2cf), 24);
  floor.position.y = 0.08;
  g.add(floor);

  const domeMat = clay(0x25324d, {
    emissive: 0x111a33,
    emissiveIntensity: 0.45,
    roughness: 0.55,
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.32, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat
  );
  dome.position.y = 0.65;
  g.add(dome);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 10, 32), clay(0xf5d06f));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.66;
  g.add(rim);

  const door = box(0.5, 0.42, 0.08, clay(0xfff0c7, { emissive: 0xffd889, emissiveIntensity: 0.28 }));
  door.position.set(0, 0.28, 1.52);
  g.add(door);

  const starMat = clay(0xfff3a6, { emissive: 0xffdc5a, emissiveIntensity: 0.75 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const h = 0.97 + (i % 3) * 0.22;
    const star = ball(0.055 + (i % 2) * 0.02, starMat, 8);
    star.position.set(Math.cos(a) * 0.82, h, Math.sin(a) * 0.82);
    star.userData.twinkle = 0.8;
    g.add(star);
    lightRefs.push(starMat);
  }

  const projector = cyl(0.18, 0.26, 0.34, clay(0x3f4b66), 14);
  projector.position.set(0, 0.84, 0);
  g.add(projector);

  const beam = cone(
    0.55,
    1.05,
    clay(0x9fd7ff, {
      emissive: 0x72bfff,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.36,
    }),
    18
  );
  beam.position.y = 1.25;
  beam.rotation.x = Math.PI;
  g.add(beam);

  return g;
}

function arcadeSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const paint = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5a3d86";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff6ea";
    ctx.font = "700 36px Fredoka, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ARCADE", 128, 34);
  };
  paint();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      paint();
      tex.needsUpdate = true;
    });
  }
  return tex;
}

/** Enterable cabinet. Local +Z is the door, aimed at the approach spot. */
function buildArcade() {
  const g = new THREE.Group();

  const slab = cyl(1.35, 1.45, 0.12, clay(0x6b4c9a), 8);
  slab.position.y = 0.06;
  g.add(slab);

  const body = box(1.55, 1.35, 1.05, clay(0x7b5ea7));
  body.position.y = 0.8;
  g.add(body);

  const screen = box(0.92, 0.58, 0.05, new THREE.MeshBasicMaterial({ color: 0x7ee7ff }));
  screen.position.set(0.12, 1.05, 0.56);
  g.add(screen);

  const bezel = box(1.05, 0.7, 0.04, clay(0x3d3158));
  bezel.position.set(0.12, 1.05, 0.53);
  g.add(bezel);

  const stick = ball(0.07, clay(0xf26f6f), 10);
  stick.position.set(0.48, 0.62, 0.58);
  g.add(stick);
  const stickPost = cyl(0.025, 0.03, 0.1, clay(0xfff0c7), 8);
  stickPost.position.set(0.48, 0.52, 0.56);
  g.add(stickPost);

  const door = box(0.36, 0.62, 0.06, clay(0xffc7a3));
  door.position.set(-0.42, 0.4, 0.56);
  g.add(door);
  const knob = ball(0.04, clay(0xf5d06f), 8);
  knob.position.set(-0.3, 0.38, 0.6);
  g.add(knob);

  for (let i = 0; i < 6; i++) {
    const stripe = box(0.24, 0.1, 0.36, i % 2 ? clay(0xf26f6f) : clay(0xfff0c7));
    stripe.position.set(-0.6 + i * 0.24, 1.52, 0.62);
    stripe.rotation.x = -0.4;
    g.add(stripe);
  }

  const marquee = box(1.45, 0.38, 0.08, new THREE.MeshBasicMaterial({
    map: arcadeSignTexture(),
    color: 0xffffff,
  }));
  marquee.position.set(0, 1.78, 0.64);
  g.add(marquee);

  const signPost = cyl(0.05, 0.07, 1.2, clay(0x8f6548), 8);
  signPost.position.set(0.95, 0.6, 1.35);
  g.add(signPost);
  const yardSign = box(1.45, 0.48, 0.08, new THREE.MeshBasicMaterial({
    map: arcadeSignTexture(),
    color: 0xffffff,
  }));
  yardSign.position.set(0.95, 1.22, 1.35);
  g.add(yardSign);

  const roof = box(1.7, 0.14, 1.2, clay(0x5a3d86));
  roof.position.y = 1.58;
  g.add(roof);

  for (let i = 0; i < 5; i++) {
    const bulb = ball(0.055, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xfff3a0 : 0xff9a76 }), 8);
    bulb.position.set(-0.5 + i * 0.25, 1.92, 0.42);
    g.add(bulb);
  }

  return g;
}

function buildCafe() {
  const g = new THREE.Group();

  const patio = cyl(1.5, 1.6, 0.12, clay(0xe7d6bd), 18);
  patio.position.y = 0.06;
  g.add(patio);

  const kiosk = box(1.45, 1.1, 1.05, clay(0xffc7a3));
  kiosk.position.set(-0.15, 0.62, 0);
  g.add(kiosk);

  const counter = box(1.15, 0.36, 0.18, clay(0x8f6548));
  counter.position.set(-0.15, 0.52, 0.61);
  g.add(counter);

  const roof = cone(1.22, 0.68, clay(0x5bb0a0), 4);
  roof.position.set(-0.15, 1.48, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const cup = cyl(0.16, 0.13, 0.24, clay(0xfff3d6), 14);
  cup.position.set(0.58, 0.83, 0.66);
  g.add(cup);
  const steamMat = clay(0xffffff, { transparent: true, opacity: 0.7 });
  for (let i = 0; i < 3; i++) {
    const steam = new THREE.Mesh(new THREE.TorusGeometry(0.06 + i * 0.015, 0.01, 6, 16, Math.PI * 1.25), steamMat);
    steam.position.set(0.5 + i * 0.06, 1.05 + i * 0.13, 0.67);
    steam.rotation.set(1.2, 0.2, 0.4);
    g.add(steam);
  }

  const awningMat = clay(0xfff0c7);
  for (let i = 0; i < 5; i++) {
    const stripe = box(0.24, 0.12, 0.42, i % 2 ? clay(0xf26f6f) : awningMat);
    stripe.position.set(-0.63 + i * 0.24, 1.1, 0.68);
    stripe.rotation.x = -0.28;
    g.add(stripe);
  }

  const table = cyl(0.35, 0.35, 0.08, clay(0xfff0c7), 18);
  table.position.set(0.85, 0.44, -0.42);
  g.add(table);
  const leg = cyl(0.06, 0.08, 0.38, clay(0x8f6548), 10);
  leg.position.set(0.85, 0.23, -0.42);
  g.add(leg);

  for (const sx of [-1, 1]) {
    const stool = cyl(0.18, 0.2, 0.16, clay(0xf5d06f), 12);
    stool.position.set(0.85 + sx * 0.5, 0.2, -0.42);
    g.add(stool);
  }

  const signPost = cyl(0.04, 0.05, 0.72, clay(0x8f6548), 8);
  signPost.position.set(-1.14, 0.42, 0.72);
  g.add(signPost);
  const sign = box(0.62, 0.32, 0.08, clay(0xfff0c7));
  sign.position.set(-1.14, 0.82, 0.72);
  g.add(sign);
  const bean = ball(0.08, clay(0x6a4a35));
  bean.scale.set(0.65, 1, 0.28);
  bean.position.set(-1.14, 0.82, 0.78);
  bean.rotation.z = 0.5;
  g.add(bean);

  return g;
}

function buildLibrary() {
  const g = new THREE.Group();
  const body = box(1.55, 1.12, 1.05, clay(0xa8c7e8));
  body.position.y = 0.64;
  g.add(body);

  const roof = cone(1.22, 0.72, clay(0x7b5ea7), 4);
  roof.position.y = 1.52;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const door = box(0.42, 0.72, 0.08, clay(0x6a4a35));
  door.position.set(0, 0.38, 0.57);
  g.add(door);

  const sign = box(0.82, 0.18, 0.08, clay(0xfff0c7));
  sign.position.set(0, 1.12, 0.6);
  g.add(sign);
  for (let i = 0; i < 3; i++) {
    const book = box(0.12, 0.28 + i * 0.04, 0.08, clay([0xf26f6f, 0xf5d06f, 0x5bb0a0][i]));
    book.position.set(-0.18 + i * 0.18, 1.12, 0.66);
    g.add(book);
  }

  for (const sx of [-1, 1]) {
    const shelf = box(0.38, 0.34, 0.08, clay(0xfff0c7, { emissive: 0xffd889, emissiveIntensity: 0.18 }));
    shelf.position.set(sx * 0.48, 0.73, 0.57);
    g.add(shelf);
  }

  const stack = new THREE.Group();
  stack.position.set(0.96, 0.1, 0.4);
  for (let i = 0; i < 4; i++) {
    const book = box(0.42, 0.08, 0.28, clay([0xf26f6f, 0x5bb0a0, 0xffd166, 0xb9a6ff][i]));
    book.position.y = i * 0.085;
    book.rotation.y = i * 0.16;
    stack.add(book);
  }
  g.add(stack);

  return g;
}

function buildWindmill() {
  const g = new THREE.Group();
  const tower = cyl(0.42, 0.68, 1.65, clay(0xfff0d2), 8);
  tower.position.y = 0.82;
  g.add(tower);

  const cap = cone(0.62, 0.56, clay(0xe08a6b), 12);
  cap.position.y = 1.92;
  g.add(cap);

  const hub = ball(0.16, clay(0xf5d06f), 12);
  hub.position.set(0, 1.48, 0.58);
  g.add(hub);

  const bladeMat = clay(0xfff0c7);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.16, 0.76, 0.055, bladeMat);
    blade.position.set(0, 1.48, 0.64);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    blade.translateY(0.42);
    g.add(blade);
  }

  const door = box(0.26, 0.44, 0.07, clay(0x8f6548));
  door.position.set(0, 0.28, 0.58);
  g.add(door);

  return g;
}

function buildWell() {
  const g = new THREE.Group();
  const ring = cyl(0.58, 0.64, 0.44, clay(0x9aa0a6), 18);
  ring.position.y = 0.22;
  g.add(ring);

  const water = cyl(0.42, 0.42, 0.04, clay(0x5bb6db, { emissive: 0x2b7fb0, emissiveIntensity: 0.2 }), 18);
  water.position.y = 0.46;
  g.add(water);

  for (const sx of [-1, 1]) {
    const post = cyl(0.055, 0.07, 0.92, clay(0x8f6548), 8);
    post.position.set(sx * 0.55, 0.75, 0);
    g.add(post);
  }

  const roof = cone(0.76, 0.5, clay(0x5bb0a0), 4);
  roof.position.y = 1.34;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const bucket = cyl(0.14, 0.16, 0.22, clay(0xb98a55), 10);
  bucket.position.set(0, 0.72, 0.12);
  g.add(bucket);

  return g;
}

function buildPicnic() {
  const g = new THREE.Group();
  const blanket = box(1.25, 0.04, 0.92, clay(0xf26f6f));
  blanket.position.y = 0.03;
  g.add(blanket);

  for (const sx of [-1, 1]) {
    const stripe = box(0.18, 0.045, 0.94, clay(0xfff0c7));
    stripe.position.set(sx * 0.28, 0.055, 0);
    g.add(stripe);
  }
  for (const z of [-0.22, 0.22]) {
    const stripe = box(1.27, 0.046, 0.14, clay(0xfff0c7));
    stripe.position.set(0, 0.06, z);
    g.add(stripe);
  }

  const basket = box(0.42, 0.28, 0.3, clay(0xb98a55));
  basket.position.set(0.3, 0.22, 0.16);
  g.add(basket);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 18, Math.PI), clay(0x8f6548));
  handle.position.set(0.3, 0.42, 0.16);
  handle.rotation.z = Math.PI;
  g.add(handle);

  for (let i = 0; i < 3; i++) {
    const snack = ball(0.09, clay([0xffd166, 0xff9a76, 0x8ccf78][i]), 10);
    snack.position.set(-0.32 + i * 0.2, 0.14, -0.14 + i * 0.08);
    g.add(snack);
  }

  return g;
}

function buildSandIsland(radius) {
  const g = new THREE.Group();
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    clay(0xe6d09a, { roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.09;
  g.add(sand);

  const rng = mulberry32(119);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = 0.16 + rng() * 0.14;
    const stone = blob(s, clay(0x9aa0a6), 1);
    stone.position.set(Math.cos(a) * (radius * 0.92), 0.08, Math.sin(a) * (radius * 0.92));
    stone.scale.y = 0.65;
    g.add(stone);
  }
  return g;
}

function buildMeadowIsland() {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 28),
    clay(0x86c56a, { roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.08;
  g.add(grass);
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(4.15, 4.7, 28),
    clay(0xe6d09a, { roughness: 1 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.07;
  g.add(rim);
  return g;
}

function buildPond() {
  const g = new THREE.Group();

  const basin = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 28),
    clay(0x6a4a35, { roughness: 1 })
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.02;
  g.add(basin);

  const waterGeo = new THREE.CircleGeometry(1.42, 40);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: 0x5bb6db,
      roughness: 0.25,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
      emissive: 0x2b7fb0,
      emissiveIntensity: 0.12,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.09;
  g.add(water);
  g.userData.water = water;

  // ring of stones
  const rng = mulberry32(77);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const s = 0.16 + rng() * 0.14;
    const stone = blob(s, clay(0x9aa0a6), 1);
    stone.position.set(Math.cos(a) * 1.55, 0.08, Math.sin(a) * 1.55);
    stone.scale.y = 0.7;
    g.add(stone);
  }

  // a lily pad
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), clay(0x6fae5a));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0.4, 0.11, -0.3);
  g.add(pad);

  return g;
}

function buildLighthouse() {
  const g = new THREE.Group();
  const cream = clay(0xfff6ea);
  const red = clay(0xf26f6f);
  const stone = clay(0xd8d2c4, { roughness: 1 });

  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(2.05, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    clay(0x9aa0a6, { roughness: 1 })
  );
  hill.scale.y = 0.42;
  g.add(hill);

  const plaza = cyl(1.55, 1.68, 0.18, stone, 16);
  plaza.position.y = 0.2;
  g.add(plaza);

  // tall candy-stripe shaft — reads as a lighthouse from the air
  const bands = 6;
  const bandH = 0.92;
  let y = 0.28;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const rBot = 1.12 - t0 * 0.32;
    const rTop = 1.12 - t1 * 0.32;
    const band = cyl(rTop, rBot, bandH, i % 2 === 0 ? red : cream, 18);
    band.position.y = y + bandH / 2;
    g.add(band);
    y += bandH;
  }

  const door = box(0.48, 0.88, 0.12, clay(0xfff0c7, { emissive: 0xffd889, emissiveIntensity: 0.45 }));
  door.position.set(0, 0.72, 1.12);
  g.add(door);
  const knob = ball(0.05, clay(0xf5d06f, { emissive: 0xffd166, emissiveIntensity: 0.4 }), 8);
  knob.position.set(0.14, 0.7, 1.2);
  g.add(knob);

  // a couple of glowing windows so it reads as inhabited, not a mast
  for (const [wy, wa] of [[1.85, 0.55], [2.85, -0.7], [3.85, 2.2]]) {
    const win = box(0.28, 0.38, 0.08, clay(0xfff3a6, { emissive: 0xffdc5a, emissiveIntensity: 0.7 }));
    win.position.set(Math.sin(wa) * 0.98, wy, Math.cos(wa) * 0.98);
    win.lookAt(win.position.x * 2, wy, win.position.z * 2);
    g.add(win);
  }

  const gallery = cyl(1.02, 1.02, 0.12, clay(0xfff0c7), 16);
  gallery.position.y = y + 0.04;
  g.add(gallery);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.045, 8, 22), clay(0xf5d06f));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = y + 0.28;
  g.add(rail);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const post = cyl(0.03, 0.03, 0.28, clay(0xfff0c7), 6);
    post.position.set(Math.cos(a) * 0.98, y + 0.2, Math.sin(a) * 0.98);
    g.add(post);
  }

  const screenMat = clay(0xffffff, {
    emissive: 0xffffff,
    emissiveIntensity: 0.9,
    roughness: 0.28,
  });
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.95, 22, 1, true),
    screenMat
  );
  lantern.position.y = y + 0.72;
  lantern.userData.keepBright = true;
  g.add(lantern);
  g.userData.screen = lantern;

  for (const a of [0, Math.PI * 0.72, Math.PI * 1.28]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.36, 18), screenMat);
    hole.position.set(Math.sin(a) * 0.86, y - 0.55, Math.cos(a) * 0.86);
    hole.lookAt(hole.position.x * 3, hole.position.y, hole.position.z * 3);
    hole.userData.keepBright = true;
    g.add(hole);
  }

  const glow = ball(0.36, clay(0xfff3a6, { emissive: 0xffdc5a, emissiveIntensity: 1.5 }), 14);
  glow.position.y = y + 0.72;
  glow.userData.keepBright = true;
  g.add(glow);
  g.userData.beacon = glow;

  const cap = cone(0.72, 0.55, red, 12);
  cap.position.y = y + 1.38;
  g.add(cap);
  const tip = ball(0.12, clay(0xffe27a, { emissive: 0xffd166, emissiveIntensity: 1.0 }), 10);
  tip.position.y = y + 1.72;
  tip.userData.keepBright = true;
  g.add(tip);

  const beamGroup = new THREE.Group();
  beamGroup.position.y = y + 0.72;
  const beamMat = clay(0xfff3a6, {
    emissive: 0xffe08a,
    emissiveIntensity: 1.25,
    transparent: true,
    opacity: 0.48,
  });
  for (const sx of [1, -1]) {
    const beam = cone(0.2, 9.4, beamMat, 18);
    beam.rotation.z = Math.PI / 2;
    beam.position.x = sx * 4.5;
    beam.userData.keepBright = true;
    beamGroup.add(beam);
  }
  g.add(beamGroup);
  g.userData.beam = beamGroup;

  const lamp = new THREE.PointLight(0xffe08a, 2.4, 18, 1.15);
  lamp.position.y = y + 0.72;
  g.add(lamp);

  // A column tall enough to clear the planet's curve. From the north-pole
  // spawn the tower itself is over the horizon; the upper shaft is not.
  const columnH = 64;
  const columnMat = new THREE.MeshBasicMaterial({
    color: 0xffd56a,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 0.7, columnH, 20, 1, true),
    columnMat
  );
  column.position.y = y + 0.9 + columnH / 2;
  column.userData.keepBright = true;
  column.renderOrder = 2;
  g.add(column);
  g.userData.column = column;

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c8,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 0.28, columnH, 12, 1, true),
    coreMat
  );
  core.position.y = column.position.y;
  core.userData.keepBright = true;
  core.renderOrder = 2;
  g.add(core);

  const star = ball(2.15, new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), 16);
  star.position.y = y + 0.9 + columnH;
  star.userData.keepBright = true;
  g.add(star);
  g.userData.star = star;

  return g;
}

function lighthouseSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  const paint = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff6ea";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e07a55";
    ctx.font = "700 30px Fredoka, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Lighthouse", 128, 38);
  };
  paint();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      paint();
      tex.needsUpdate = true;
    });
  }
  return tex;
}

function buildLighthouseSign() {
  const g = new THREE.Group();
  const post = cyl(0.05, 0.07, 0.92, clay(0x8f6548), 8);
  post.position.y = 0.46;
  g.add(post);

  const plank = box(1.2, 0.38, 0.07, new THREE.MeshBasicMaterial({
    map: lighthouseSignTexture(),
    color: 0xffffff,
  }));
  plank.position.y = 0.98;
  g.add(plank);

  const tip = cone(0.16, 0.32, clay(0xf26f6f), 4);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.98, 0.46);
  g.add(tip);
  return g;
}

function buildLandingPad() {
  const g = new THREE.Group();

  const pad = cyl(1.35, 1.5, 0.18, clay(0xd8d2c4), 8);
  pad.position.y = 0.09;
  g.add(pad);

  const inner = cyl(1.0, 1.0, 0.06, clay(0xeef3f7), 8);
  inner.position.y = 0.19;
  g.add(inner);

  // glowing ring (spins) — where visitors will arrive
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x8fd7ff,
    emissive: 0x66c6ff,
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 12, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.24;
  g.add(ring);
  g.userData.ring = ring;

  // central beacon
  const beacon = ball(
    0.22,
    new THREE.MeshStandardMaterial({
      color: 0xbfe9ff,
      emissive: 0x8fd7ff,
      emissiveIntensity: 1.0,
      roughness: 0.3,
    })
  );
  beacon.position.y = 0.5;
  g.add(beacon);
  g.userData.beacon = beacon;

  return g;
}

function buildLighthouseDock() {
  const g = new THREE.Group();
  const wood = clay(0xb98a55);
  const plank = clay(0xc8a06a);

  const deck = cyl(1.55, 1.68, 0.16, plank, 10);
  deck.position.y = 0.1;
  g.add(deck);
  const inner = cyl(1.12, 1.12, 0.06, clay(0xfff0c7), 10);
  inner.position.y = 0.2;
  g.add(inner);

  const walk = box(1.2, 0.12, 1.85, plank);
  walk.position.set(0, 0.12, 1.85);
  g.add(walk);
  for (let i = 0; i < 4; i++) {
    const board = box(0.22, 0.05, 2.15, wood);
    board.position.set(-0.45 + i * 0.3, 0.18, 1.55);
    g.add(board);
  }
  for (const sx of [-0.7, 0.7]) {
    const post = cyl(0.06, 0.07, 0.55, wood, 8);
    post.position.set(sx, 0.32, 2.45);
    g.add(post);
  }

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x8fd7ff,
    emissive: 0x66c6ff,
    emissiveIntensity: 1.15,
    roughness: 0.4,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.055, 12, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.24;
  g.add(ring);
  g.userData.ring = ring;

  const beacon = ball(
    0.2,
    new THREE.MeshStandardMaterial({
      color: 0xbfe9ff,
      emissive: 0x8fd7ff,
      emissiveIntensity: 1.05,
      roughness: 0.3,
    })
  );
  beacon.position.y = 0.48;
  g.add(beacon);
  g.userData.beacon = beacon;

  return g;
}

function buildMailbox(seed = 0) {
  const g = new THREE.Group();
  const post = cyl(0.04, 0.06, 0.48, clay(0x8f6548), 8);
  post.position.y = 0.24;
  g.add(post);

  const boxBody = box(0.42, 0.26, 0.32, clay(0xff9a76));
  boxBody.position.y = 0.6;
  g.add(boxBody);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    clay(0xf26f6f)
  );
  top.scale.z = 0.76;
  top.position.y = 0.73;
  top.rotation.y = Math.PI / 2;
  g.add(top);

  const flag = box(0.06, 0.24, 0.04, clay(0xf5d06f));
  flag.position.set(0.26, 0.78, 0.02);
  g.add(flag);
  const face = box(0.34, 0.05, 0.04, clay(0xfff0c7));
  face.position.set(0, 0.6, 0.18);
  g.add(face);

  return g;
}

function buildSignpost() {
  const g = new THREE.Group();
  const post = cyl(0.04, 0.055, 0.78, clay(0x8f6548), 8);
  post.position.y = 0.39;
  g.add(post);
  const arrows = [
    { y: 0.72, x: 0.18, rot: 0.06, color: 0xfff0c7 },
    { y: 0.52, x: -0.18, rot: -0.08, color: 0xf5d06f },
  ];
  for (const a of arrows) {
    const plank = box(0.62, 0.16, 0.07, clay(a.color));
    plank.position.set(a.x, a.y, 0);
    plank.rotation.z = a.rot;
    g.add(plank);
    const tip = cone(0.11, 0.18, clay(a.color), 3);
    tip.position.set(a.x + Math.sign(a.x || 1) * 0.36, a.y, 0);
    tip.rotation.z = -Math.sign(a.x || 1) * Math.PI / 2;
    tip.rotation.y = Math.PI / 2;
    g.add(tip);
  }
  return g;
}

function buildCrystals(seed = 0) {
  const g = new THREE.Group();
  const rng = mulberry32(Math.floor(seed * 73) + 47);
  const colors = [0x9ad0ff, 0xb9a6ff, 0xffd166];
  for (let i = 0; i < 4; i++) {
    const h = 0.32 + rng() * 0.38;
    const crystal = cone(0.12 + rng() * 0.04, h, clay(colors[i % colors.length], {
      emissive: colors[i % colors.length],
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.86,
    }), 5);
    crystal.position.set((rng() - 0.5) * 0.6, h / 2, (rng() - 0.5) * 0.6);
    crystal.rotation.y = rng() * Math.PI;
    crystal.userData.twinkle = 0.45;
    g.add(crystal);
  }
  return g;
}

function buildLantern(seed = 0) {
  const g = new THREE.Group();
  const post = cyl(0.045, 0.06, 0.72, clay(0x7d6547), 8);
  post.position.y = 0.36;
  g.add(post);

  const cap = cone(0.18, 0.18, clay(0x5bb0a0), 4);
  cap.position.y = 0.87;
  cap.rotation.y = Math.PI / 4;
  g.add(cap);

  const light = ball(0.16, clay(0xffeaa0, { emissive: 0xffc95a, emissiveIntensity: 0.8 }), 12);
  light.position.y = 0.7;
  light.userData.twinkle = 0.75;
  g.add(light);

  return g;
}

function buildMushrooms(seed = 0) {
  const g = new THREE.Group();
  const rng = mulberry32(Math.floor(seed * 109) + 31);
  for (let i = 0; i < 3; i++) {
    const x = (rng() - 0.5) * 0.56;
    const z = (rng() - 0.5) * 0.46;
    const h = 0.18 + rng() * 0.18;
    const stem = cyl(0.045, 0.055, h, clay(0xfff0d2), 8);
    stem.position.set(x, h / 2, z);
    g.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.14 + rng() * 0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      clay(rng() > 0.5 ? 0xf26f6f : 0xb9a6ff)
    );
    cap.scale.y = 0.62;
    cap.position.set(x, h, z);
    g.add(cap);
  }
  return g;
}

function buildBench() {
  const g = new THREE.Group();
  const wood = clay(0xb98a55);
  const seat = box(1.0, 0.12, 0.34, wood);
  seat.position.y = 0.38;
  g.add(seat);
  const back = box(1.0, 0.1, 0.12, wood);
  back.position.set(0, 0.62, -0.2);
  back.rotation.x = -0.18;
  g.add(back);
  for (const sx of [-1, 1]) {
    const leg = box(0.09, 0.36, 0.09, clay(0x7d6547));
    leg.position.set(sx * 0.36, 0.18, 0.06);
    g.add(leg);
  }
  return g;
}

function buildStarStone(seed = 0) {
  const g = new THREE.Group();
  const stone = cyl(0.28, 0.32, 0.08, clay(0xd8d2c4), 5);
  stone.position.y = 0.04;
  stone.rotation.y = seed;
  g.add(stone);
  const star = cone(0.09, 0.06, clay(0xffeaa0, { emissive: 0xffc95a, emissiveIntensity: 0.2 }), 5);
  star.scale.set(1.4, 0.4, 1.4);
  star.position.y = 0.11;
  star.rotation.y = Math.PI / 5;
  g.add(star);
  return g;
}

// Shared clay palette so every tree stays in the diorama and we don't
// allocate a new material per leaf.
const WOOD = clay(0xc48955);
const WOOD_DARK = clay(0x8d5a32);
const LEAF_BRIGHT = clay(0x58c244);
const LEAF_HI = clay(0x96e56a);
const LEAF_DEEP = clay(0x348f30);
const LEAF_LIME = clay(0xc6de55);
const LEAF_LIME_MID = clay(0xa4c83c);
const LEAF_LIME_DEEP = clay(0x6ea832);
const GRASS = clay(0x4caf45);
const GRASS_LT = clay(0x86d25a);
const _UP = new THREE.Vector3(0, 1, 0);
const _LIMB = new THREE.Vector3();

/** A tapered branch from `from` to `to` in the parent's local space. */
function addLimb(parent, from, to, rBase, rTip, mat) {
  _LIMB.subVectors(to, from);
  const len = _LIMB.length();
  if (len < 1e-4) return null;
  const limb = cyl(Math.max(rTip, 0.025), Math.max(rBase, 0.025), len, mat, 7);
  limb.position.copy(from).add(to).multiplyScalar(0.5);
  _LIMB.multiplyScalar(1 / len);
  limb.quaternion.setFromUnitVectors(_UP, _LIMB);
  parent.add(limb);
  return limb;
}

function addRoots(parent, rng, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.35;
    const from = new THREE.Vector3(Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1);
    const to = new THREE.Vector3(Math.cos(a) * (0.38 + rng() * 0.16), 0.02, Math.sin(a) * (0.38 + rng() * 0.16));
    addLimb(parent, from, to, 0.13, 0.045, WOOD_DARK);
  }
}

function addGrass(parent, rng, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = 0.18 + rng() * 0.4;
    const tuft = cone(0.04 + rng() * 0.02, 0.14 + rng() * 0.12, rng() > 0.45 ? GRASS_LT : GRASS, 4);
    tuft.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d);
    tuft.rotation.z = (rng() - 0.5) * 0.55;
    tuft.rotation.x = (rng() - 0.5) * 0.4;
    parent.add(tuft);
  }
}

/** Big rounded canopy with smaller clay bumps, like a hand-sculpted cloud. */
function puffCluster(r, rng) {
  const g = new THREE.Group();
  const main = blob(r, LEAF_BRIGHT, 1);
  main.scale.set(1.06, 0.86, 1.02);
  g.add(main);
  const bumps = 6;
  for (let i = 0; i < bumps; i++) {
    const a = rng() * Math.PI * 2;
    const elev = 0.15 + rng() * 1.15;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev)).normalize();
    const bump = blob(r * (0.26 + rng() * 0.16), dir.y > 0.45 ? LEAF_HI : dir.y < 0.05 ? LEAF_DEEP : LEAF_BRIGHT, 0);
    bump.position.copy(dir).multiplyScalar(r * 0.76);
    g.add(bump);
  }
  return g;
}

/** Layered yellow-green clay leaves sitting on a solid canopy. */
function leafBall(r, rng) {
  const g = new THREE.Group();
  const core = blob(r * 0.8, LEAF_LIME_MID, 1);
  core.scale.set(1.08, 0.7, 1.02);
  g.add(core);
  const layers = [
    { y: r * 0.02, rad: r * 0.7, n: 8, size: 0.32, tilt: 0.35 },
    { y: r * 0.32, rad: r * 0.58, n: 7, size: 0.3, tilt: 0.85 },
    { y: r * 0.58, rad: r * 0.32, n: 5, size: 0.26, tilt: 1.35 },
  ];
  for (const layer of layers) {
    const spin = rng() * Math.PI;
    for (let i = 0; i < layer.n; i++) {
      const a = spin + (i / layer.n) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), layer.tilt, Math.sin(a)).normalize();
      const mat = i % 2 === 0 ? LEAF_LIME : layer.y > r * 0.4 ? LEAF_LIME : LEAF_LIME_DEEP;
      const leaf = blob(r * layer.size, mat, 0);
      leaf.scale.set(1.55, 0.4, 1.05);
      leaf.position.set(Math.cos(a) * layer.rad, layer.y, Math.sin(a) * layer.rad);
      leaf.quaternion.setFromUnitVectors(_UP, dir);
      leaf.rotateY(rng() * 0.4);
      g.add(leaf);
    }
  }
  return g;
}

/**
 * Chunky cloud tree: twisted trunk, root flares, and several puffy
 * bright-green clusters (reference 1).
 */
function treeCloud(rng) {
  const g = new THREE.Group();
  const mid = new THREE.Vector3((rng() - 0.5) * 0.16, 0.52, (rng() - 0.5) * 0.16);
  const top = new THREE.Vector3((rng() - 0.5) * 0.22, 1.02, (rng() - 0.5) * 0.14);
  addLimb(g, new THREE.Vector3(0, 0.02, 0), mid, 0.34, 0.24, WOOD);
  addLimb(g, mid, top, 0.22, 0.16, WOOD);
  addRoots(g, rng, 4 + Math.floor(rng() * 2));

  const crown = new THREE.Group();
  crown.position.copy(top);
  const clusters = 5;
  for (let i = 0; i < clusters; i++) {
    const a = (i / clusters) * Math.PI * 2 + rng() * 0.4;
    const tip = new THREE.Vector3(Math.cos(a) * (0.28 + rng() * 0.32), 0.42 + rng() * 0.48, Math.sin(a) * (0.28 + rng() * 0.32));
    addLimb(crown, new THREE.Vector3(0, 0.06, 0), tip, 0.13, 0.08, WOOD);
    const puff = puffCluster(0.42 + rng() * 0.12, rng);
    puff.position.copy(tip);
    crown.add(puff);
  }
  const crest = new THREE.Vector3((rng() - 0.5) * 0.16, 0.95 + rng() * 0.15, (rng() - 0.5) * 0.16);
  addLimb(crown, new THREE.Vector3(0, 0.2, 0), crest, 0.11, 0.07, WOOD);
  const topPuff = puffCluster(0.5 + rng() * 0.08, rng);
  topPuff.position.copy(crest);
  crown.add(topPuff);
  crown.userData.sway = 0.035;
  g.add(crown);
  addGrass(g, rng, 7);
  return g;
}

/**
 * Leaning tree: a curved trunk, one side branch, and layered
 * yellow-green leaf clusters (reference 2).
 */
function treeLean(rng) {
  const g = new THREE.Group();
  const lean = rng() > 0.5 ? 1 : -1;
  const zSign = rng() > 0.5 ? 1 : -1;
  const segs = 6;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(
      lean * (0.08 * t + 0.95 * t * t),
      0.04 + t * 1.45,
      zSign * Math.sin(t * Math.PI) * 0.16,
    ));
  }
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    addLimb(g, pts[i], pts[i + 1], 0.3 * (1 - t0 * 0.62), 0.3 * (1 - t1 * 0.62), WOOD);
  }

  const from = pts[2];
  const sideTip = from.clone().add(new THREE.Vector3(-lean * 0.58, 0.18, zSign * 0.16));
  addLimb(g, from, sideTip, 0.1, 0.06, WOOD);
  const side = new THREE.Group();
  side.position.copy(sideTip);
  side.add(leafBall(0.34, rng));
  side.userData.sway = 0.05;
  g.add(side);

  const crown = new THREE.Group();
  const end = pts[segs];
  crown.position.set(end.x + lean * 0.12, end.y + 0.18, end.z);
  crown.add(leafBall(0.72 + rng() * 0.08, rng));
  crown.userData.sway = 0.03;
  g.add(crown);
  addGrass(g, rng, 5);
  addRoots(g, rng, 3);
  return g;
}

/** A shorter fork: two thick arms, each ending in one big puff. */
function treeFork(rng) {
  const g = new THREE.Group();
  const top = new THREE.Vector3((rng() - 0.5) * 0.08, 0.62, (rng() - 0.5) * 0.08);
  addLimb(g, new THREE.Vector3(0, 0.02, 0), top, 0.32, 0.2, WOOD);
  addRoots(g, rng, 4);

  const crown = new THREE.Group();
  crown.position.copy(top);
  const arms = [
    new THREE.Vector3(-0.48, 0.72, 0.08),
    new THREE.Vector3(0.5, 0.64, -0.06),
    new THREE.Vector3(0.05, 0.95, 0.28),
  ];
  arms.forEach((tip, i) => {
    const wobble = tip.clone();
    wobble.x += (rng() - 0.5) * 0.12;
    wobble.z += (rng() - 0.5) * 0.12;
    addLimb(crown, new THREE.Vector3(0, 0.05, 0), wobble, i === 2 ? 0.09 : 0.14, 0.07, WOOD);
    const puff = puffCluster(i === 2 ? 0.36 : 0.5 + rng() * 0.06, rng);
    puff.position.copy(wobble);
    crown.add(puff);
  });
  crown.userData.sway = 0.04;
  g.add(crown);
  addGrass(g, rng, 6);
  return g;
}

function buildTree(seed = 0) {
  const rng = mulberry32(Math.floor(seed * 97) + 3);
  const kind = Math.floor(rng() * 3);
  const model = kind === 0 ? treeCloud(rng) : kind === 1 ? treeLean(rng) : treeFork(rng);
  const g = new THREE.Group();
  model.rotation.y = rng() * Math.PI * 2;
  model.scale.setScalar(0.84 + rng() * 0.32);
  g.add(model);
  return g;
}

function buildRock(seed = 0) {
  const g = new THREE.Group();
  const rng = mulberry32(Math.floor(seed * 53) + 9);
  const r = 0.45 + rng() * 0.4;
  const rock = blob(r, clay(0x9aa0a6, { flat: true }), 1);
  rock.scale.set(1, 0.7 + rng() * 0.2, 1);
  rock.position.y = r * 0.5;
  rock.rotation.y = rng() * Math.PI;
  g.add(rock);
  if (rng() > 0.5) {
    const small = blob(r * 0.5, clay(0xb0b6bb, { flat: true }), 1);
    small.position.set(r * 0.8, r * 0.3, 0);
    g.add(small);
  }
  return g;
}

function buildFlower(seed = 0) {
  const g = new THREE.Group();
  const rng = mulberry32(Math.floor(seed * 131) + 5);
  const palette = [0xf2a6c2, 0xf6d365, 0xffffff, 0xb9a6ff, 0xff9a76];
  const color = palette[Math.floor(rng() * palette.length)];
  const h = 0.5 + rng() * 0.4;

  const swayGroup = new THREE.Group();
  const stem = cyl(0.03, 0.04, h, clay(0x6fae5a), 6);
  stem.position.y = h / 2;
  swayGroup.add(stem);

  const head = new THREE.Group();
  head.position.y = h;
  const center = ball(0.09, clay(0xffd98a), 10);
  head.add(center);
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const petal = ball(0.09, clay(color));
    petal.scale.set(1, 0.4, 0.6);
    petal.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13);
    head.add(petal);
  }
  swayGroup.add(head);
  swayGroup.userData.sway = 0.12;
  g.add(swayGroup);

  const leaf = ball(0.1, clay(0x6fae5a));
  leaf.scale.set(1, 0.3, 0.5);
  leaf.position.set(0.1, h * 0.4, 0);
  g.add(leaf);

  return g;
}

function buildBridge() {
  const g = new THREE.Group();
  const plankMat = clay(0xb98a55);
  const arch = 0.5;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const plank = box(0.5, 0.08, 0.34, plankMat);
    plank.position.set((f - 0.5) * 2.2, Math.sin(f * Math.PI) * arch + 0.2, 0);
    plank.rotation.z = Math.cos(f * Math.PI) * 0.5;
    g.add(plank);
  }
  // rope rails
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const post = cyl(0.03, 0.03, 0.3, clay(0x8a6a45), 6);
      post.position.set((f - 0.5) * 2.2, Math.sin(f * Math.PI) * arch + 0.4, side * 0.2);
      g.add(post);
    }
  }
  return g;
}

function buildRewardBloom() {
  // a big celebratory flower that appears in the empty meadow
  const g = new THREE.Group();
  const h = 1.4;
  const stem = cyl(0.08, 0.12, h, clay(0x5fae55), 10);
  stem.position.y = h / 2;
  g.add(stem);
  const head = new THREE.Group();
  head.position.y = h;
  const center = ball(
    0.3,
    clay(0xffd166, { emissive: 0xffb23e, emissiveIntensity: 0.4 })
  );
  head.add(center);
  const petals = 10;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const petal = ball(0.26, clay(0xff9ec4));
    petal.scale.set(1, 0.35, 0.7);
    petal.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
    petal.lookAt(0, 0, 0);
    head.add(petal);
  }
  g.add(head);
  return g;
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
