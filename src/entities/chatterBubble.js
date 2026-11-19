import * as THREE from "three";

/**
 * A soft empty bubble. No letters, dots, or signs.
 * One shared picture, a separate material per character so each can fade.
 */
let bubbleMap = null;

function bubbleTexture() {
  if (bubbleMap) return bubbleMap;
  const w = 128;
  const h = 96;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255, 250, 242, 0.94)";
  ctx.strokeStyle = "rgba(92, 64, 48, 0.55)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(64, 40, 46, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(46, 74, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  bubbleMap = new THREE.CanvasTexture(canvas);
  bubbleMap.colorSpace = THREE.SRGBColorSpace;
  bubbleMap.needsUpdate = true;
  return bubbleMap;
}

export function createChatterBubble(width) {
  const material = new THREE.MeshBasicMaterial({
    map: bubbleTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, width * 0.58), material);
  mesh.position.set(width * 0.22, 0, 0.03);
  mesh.renderOrder = 4;
  mesh.visible = false;
  return mesh;
}

export function setChatterBubble(mesh, on, dt, time, height) {
  if (!mesh) return;
  mesh.position.y = height * 0.98;
  const target = on ? 0.9 : 0;
  mesh.material.opacity += (target - mesh.material.opacity) * Math.min(1, dt * 7);
  mesh.visible = mesh.material.opacity > 0.05;
  const s = on ? 0.94 + Math.sin(time * 5.5) * 0.05 : 0.8;
  mesh.scale.set(s, s, 1);
}

export function nearSomeone(self, others, reach) {
  for (const other of others) {
    if (!other || other === self) continue;
    if (Math.hypot(self.x - other.x, self.z - other.z) < reach) return true;
  }
  return false;
}
