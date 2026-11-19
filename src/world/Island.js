import * as THREE from "three";
import { ASSETS } from "../data/assets.js";

/**
 * The concept painting, faced straight at the camera so the coastline,
 * cliffs, foam, and path stay exactly as painted.
 */
export class Island {
  constructor(scene, textures) {
    this.group = new THREE.Group();
    this.group.name = "island";
    scene.add(this.group);

    const asset = ASSETS.plate;
    const tex = textures.get(asset.src);
    const geo = new THREE.PlaneGeometry(asset.width, asset.height);
    const mat = new THREE.MeshBasicMaterial({
      map: tex || null,
      color: tex ? 0xffffff : 0xc5d6d8,
      depthWrite: false,
    });
    const plate = new THREE.Mesh(geo, mat);
    plate.position.set(0, 0, -8);
    plate.renderOrder = -20;
    this.group.add(plate);
    // A sideways phone is wider than the painting. Continue the left and
    // right edges so the sea and sky reach the screen instead of leaving bars.
    this._addEdge(tex, asset.height, -1);
    this._addEdge(tex, asset.height, 1);
  }

  _addEdge(texture, height, side) {
    const img = texture?.image;
    if (!img || !img.width) return;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    const sx = side < 0 ? 0 : Math.max(0, img.width - 2);
    ctx.drawImage(img, sx, 0, 2, img.height, 0, 0, canvas.width, canvas.height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = texture.colorSpace;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearFilter;
    const width = 18;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map, depthWrite: false }),
    );
    // Overlap the plate by a hair so the seam does not show the page behind it.
    mesh.position.set(side * (16 + width / 2 - 0.04), 0, -8.02);
    mesh.renderOrder = -21;
    this.group.add(mesh);
  }

  update() {}
}
