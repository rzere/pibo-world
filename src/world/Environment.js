import * as THREE from "three";

/**
 * Soft daytime lighting for the diorama: a warm key sun with gentle shadows,
 * a sky/ground hemisphere fill, and a faint rim. A very slow breathing motion
 * keeps the light feeling alive without ever reading as "night".
 */
export class Environment {
  constructor(scene, planetRadius = 10) {
    this.t = 0;

    const hemi = new THREE.HemisphereLight(0xfff3dd, 0x6aa8a0, 0.85);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1cf, 1.55);
    sun.position.set(18, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = planetRadius * 1.6;
    const cam = sun.shadow.camera;
    cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
    cam.near = 1; cam.far = 100;
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 4; // soft PCF edges
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // cool rim from the opposite side to round out silhouettes
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.35);
    rim.position.set(-16, 8, -14);
    scene.add(rim);

    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);
  }

  update(dt) {
    this.t += dt;
    // barely-there drift so shadows subtly shift, like slow afternoon light
    const a = this.t * 0.05;
    this.sun.position.set(
      18 * Math.cos(a) + 4,
      26,
      12 * Math.sin(a) + 6
    );
    this.sun.intensity = 1.45 + Math.sin(this.t * 0.2) * 0.12;
  }
}
