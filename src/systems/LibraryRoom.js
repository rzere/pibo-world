import * as THREE from "three";
import { clay, box } from "../world/materials.js";

/**
 * Interior you step into from the library door, same idea as the arcade room:
 * a separate scene and a close camera. The story maker sits in the HTML overlay.
 */
export class LibraryRoom {
  constructor() {
    this.active = false;
    this.t = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6efe2);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.08, 40);
    this._build();
    this.resize(window.innerWidth, window.innerHeight);
  }

  enter() {
    this.active = true;
    this.t = 0;
  }

  leave() {
    this.active = false;
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this._placeCamera();
  }

  update(dt) {
    this.t += dt;
    if (this.lamp) this.lamp.intensity = 1.15 + Math.sin(this.t * 1.4) * 0.06;
  }

  _placeCamera() {
    const aspect = Math.max(0.2, this.camera.aspect || 1);
    this.camera.position.set(0, 1.35, aspect < 1 ? 6.4 : 5.6);
    this.camera.lookAt(0, 1.15, 0);
  }

  _build() {
    this.scene.add(new THREE.AmbientLight(0xfff4e4, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 0.7);
    sun.position.set(-2, 4, 3);
    this.scene.add(sun);
    this.lamp = new THREE.PointLight(0xffd7a1, 1.15, 8);
    this.lamp.position.set(0.2, 2.2, 1.2);
    this.scene.add(this.lamp);

    const floor = box(8, 0.12, 6, clay(0xd8b98a));
    floor.position.set(0, 0, 0);
    this.scene.add(floor);

    const rug = box(2.4, 0.04, 1.5, clay(0xe7b7b0));
    rug.position.set(0, 0.08, 0.7);
    this.scene.add(rug);

    const wall = box(8, 3.2, 0.16, clay(0xf4e6cf));
    wall.position.set(0, 1.6, -2.4);
    this.scene.add(wall);

    const sideL = box(0.16, 3.2, 6, clay(0xf7ead6));
    sideL.position.set(-3.9, 1.6, 0);
    this.scene.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = 3.9;
    this.scene.add(sideR);

    this._shelf(-2.15);
    this._shelf(2.15);
    this._window();

    const table = box(1.3, 0.08, 0.7, clay(0xc48a58));
    table.position.set(0, 0.72, 0.85);
    this.scene.add(table);
    for (const x of [-0.5, 0.5]) {
      const leg = box(0.08, 0.64, 0.08, clay(0xa87448));
      leg.position.set(x, 0.38, 0.85);
      this.scene.add(leg);
    }
    const book = box(0.46, 0.06, 0.32, clay(0xf7f1e4));
    book.position.set(-0.15, 0.8, 0.85);
    this.scene.add(book);
  }

  _shelf(x) {
    const wood = clay(0xc4895a);
    const frame = box(1.5, 2.3, 0.28, wood);
    frame.position.set(x, 1.35, -2.15);
    this.scene.add(frame);
    const colors = [0xe07a6a, 0xf2d16b, 0x8fbf88, 0x7eb0d4, 0xd7a4c8, 0xf0c9a0];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const spine = box(0.22, 0.42, 0.08, clay(colors[(row + col) % colors.length]));
        spine.position.set(x - 0.48 + col * 0.32, 0.7 + row * 0.62, -2.0);
        this.scene.add(spine);
      }
    }
  }

  _window() {
    const frame = box(1.3, 1.1, 0.08, clay(0xf7f3ea));
    frame.position.set(0, 1.9, -2.28);
    this.scene.add(frame);
    const glass = box(1.0, 0.8, 0.05, clay(0xc9e4ef, { emissive: 0x9fd0e4, emissiveIntensity: 0.35 }));
    glass.position.set(0, 1.9, -2.24);
    this.scene.add(glass);
  }
}
