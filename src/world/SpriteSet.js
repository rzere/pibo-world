import * as THREE from "three";
import { ASSETS } from "../data/assets.js";
import { PLACEMENTS } from "./layout.js";
import { placeOnPlate } from "./iso.js";

/**
 * Optional cards on the painting. The island itself is one picture.
 * A card here would be a single swappable sprite with its feet on the ground.
 */
export class IsoSprite {
  constructor(asset, texture) {
    this.asset = asset;
    const geo = new THREE.PlaneGeometry(asset.width, asset.height);
    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    // Same layer as Pibo so the closer feet win and he can pass behind.
    this.mesh.renderOrder = 3;
    const ax = (asset.anchor?.x ?? 0.5) - 0.5;
    const ay = (asset.anchor?.y ?? 0) - 0.5;
    this.mesh.position.set(-ax * asset.width, -ay * asset.height, 0);
    this.baseLocalY = this.mesh.position.y;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
  }

  place(x, z, bias = 0) {
    placeOnPlate(this.group, x, z, bias);
  }

  setVisible(v) {
    this.group.visible = v;
  }
}

export class SpriteSet {
  constructor(scene, textures) {
    this.scene = scene;
    this.items = new Map();
    this.group = new THREE.Group();
    this.group.name = "sprites";
    scene.add(this.group);

    for (const place of PLACEMENTS) {
      const asset = ASSETS[place.asset];
      if (!asset?.src || asset.width < 0.4) continue;
      const tex = textures.get(asset.src);
      const sprite = new IsoSprite(asset, tex);
      sprite.place(place.x, place.z, place.depthBias || 0);
      sprite.id = place.id;
      if (place.hidden) sprite.setVisible(false);
      this.group.add(sprite.group);
      this.items.set(place.id, sprite);
    }
  }

  show(id) {
    this.items.get(id)?.setVisible(true);
  }

  update() {}
}
