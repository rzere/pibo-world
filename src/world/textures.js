import * as THREE from "three";

/**
 * Rasterize an SVG or PNG to a texture. SVGs have no intrinsic pixel size in
 * every browser, so callers pass the size from the asset manifest.
 */
export function loadTexture(url, pixelWidth = 512, pixelHeight = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, pixelWidth, pixelHeight);
      ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      tex.userData = { url };
      resolve(tex);
    };
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

export async function loadTextureSet(sources, sizes) {
  const map = new Map();
  await Promise.all(sources.map(async (url) => {
    const size = sizes.get(url) || { w: 512, h: 512 };
    try {
      map.set(url, await loadTexture(url, size.w, size.h));
    } catch (err) {
      console.warn(err);
      const data = new Uint8Array([246, 234, 214, 255]);
      const tex = new THREE.DataTexture(data, 1, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      map.set(url, tex);
    }
  }));
  return map;
}

export function textureSizes(assets) {
  const sizes = new Map();
  const add = (url, entry) => {
    if (!url) return;
    sizes.set(url, {
      w: entry.pixelWidth || 512,
      h: entry.pixelHeight || 512,
    });
  };
  for (const entry of Object.values(assets)) {
    add(entry.src, entry);
    if (entry.faces) {
      for (const url of Object.values(entry.faces)) add(url, entry);
    }
    if (entry.states) {
      for (const frames of Object.values(entry.states)) {
        for (const url of frames) add(url, entry);
      }
    }
  }
  return sizes;
}
