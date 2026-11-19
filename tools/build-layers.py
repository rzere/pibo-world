"""
Rebuild the outdoor island as one painting.

The plate is the clean outdoor picture (assets/painted/sources/island-outdoor.png):
the concept painting with the creatures already gone, buildings and trees still
in the paint. This script does not cut, pad, or inpaint. Stretching the edge
rows smeared the cliff, and painting over grab-cut holes left blotches.

    python3 tools/build-layers.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "painted" / "sources" / "island-outdoor.png"
LAYER_DIR = ROOT / "assets" / "painted" / "layers"
W, H = 1280, 720

# These files were cut-out stickers. The game no longer draws them.
RETIRED = [
    "fox", "pink-friend", "white-cat", "bird", "chick", "snail", "wing-cat",
    "tree-green", "tree-pink", "cottage", "library", "market", "mushroom-house",
    "arcade", "lighthouse", "picnic",
]


def is_air_pixel(r, g, b):
    r, g, b = int(r), int(g), int(b)
    return b > 150 and b > r + 25 and b >= g - 12 and g > r - 8


def air_mask(rgb):
    air = np.zeros((H, W), np.uint8)
    q = deque()
    for y in range(H):
        for x in range(W):
            if is_air_pixel(*rgb[y, x]):
                air[y, x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= W or ny >= H or air[ny, nx]:
                continue
            r, g, b = (int(v) for v in rgb[ny, nx])
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if is_air_pixel(r, g, b) or (lum > 214 and max(r, g, b) - min(r, g, b) < 48):
                air[ny, nx] = 1
                q.append((nx, ny))
    return air


def write_layers():
    text = """/**
 * Island layout. The outdoor picture is one painting (assets/painted/plate.png).
 * Buildings and trees stay in that painting so they cannot clip through each other.
 * Outdoor animals and butterflies are not drawn. The library room still has its own files.
 * The anchor of a future outdoor sprite is the bottom center.
 */
export const PAINTED_SPRITES = [];

export const LAYOUT = {
  start: { x: -0.5, z: 1.75 },
  home: { x: 3.9, z: -1.525 },
  tealHouse: { x: -3.675, z: 3.075 },
  lighthouse: { x: 13.288, z: -5.475 },
  lighthousePad: { x: 13.275, z: -3.7 },
  arcade: { x: -12.625, z: -4.3 },
  arcadeDoor: { x: -12.625, z: -1.8 },
  library: { x: -2.713, z: -2.612 },
  libraryDoor: { x: -2.725, z: 0.4 },
  cottageDoor: { x: 3.9, z: 1.85 },
  companion: { x: -11.5, z: 1.5 },
  pino: { x: -10.5, z: 2.5 },
};

export const HOUSES = {
  "arcade": [[-14.425, -7.2], [-10.825, -7.2], [-10.825, -3.5], [-14.425, -3.5]],
  "lighthouse": [[12.525, -6.9], [14.05, -6.9], [14.05, -4.85], [12.525, -4.85]],
  "mushroom-house": [[-5.35, 0.9], [-2, 0.9], [-2, 4.1], [-5.35, 4.1]],
  "library": [[-5.55, -5.375], [0.125, -5.375], [0.125, -1.075], [-5.55, -1.075]],
  "cottage": [[0.625, -4.65], [7.175, -4.65], [7.175, 0.225], [0.625, 0.225]],
  "market": [[7.875, -2.375], [11.825, -2.375], [11.825, 1.3], [7.875, 1.3]],
};

export const CIRCLES = [
  { id: "tree-green", x: -3.75, z: -2.6, radius: 0.46, role: "trunk" },
  { id: "tree-pink", x: 8.012, z: -4.3, radius: 0.46, role: "trunk" },
];

export const LIBRARY_MASCOT = {
  src: "assets/painted/layers/raccoon.png",
  background: "assets/painted/layers/library-hangout.png",
  left: "43.2%",
  top: "36.11%",
  width: "20.08%",
};
"""
    path = ROOT / "src" / "data" / "layers.js"
    path.write_text(text)
    print("wrote", path)


def main():
    im = Image.open(SRC).convert("RGB")
    if im.size != (W, H):
        raise SystemExit(f"expected {W}x{H} clean painting at {SRC}, got {im.size}")
    rgb = np.asarray(im)
    plate = Image.fromarray(rgb).resize((W * 2, H * 2), Image.Resampling.LANCZOS)
    plate_path = ROOT / "assets" / "painted" / "plate.png"
    plate.save(plate_path, optimize=True)
    print("plate", plate.size, plate_path)

    air = air_mask(rgb)
    mask_im = Image.new("RGB", (W // 2, H // 2), (255, 0, 0))
    mp = mask_im.load()
    for y in range(H // 2):
        for x in range(W // 2):
            votes = (
                int(air[y * 2, x * 2])
                + int(air[y * 2, x * 2 + 1])
                + int(air[y * 2 + 1, x * 2])
                + int(air[y * 2 + 1, x * 2 + 1])
            )
            mp[x, y] = (0, 0, 255) if votes >= 2 else (255, 0, 0)
    for x in range(mask_im.width):
        mp[x, 0] = (0, 255, 0)
        mp[x, 1] = (0, 255, 0)
    mask_im.save(ROOT / "assets" / "painted" / "walk-mask.png")

    for name in RETIRED:
        path = LAYER_DIR / f"{name}.png"
        if path.exists():
            path.unlink()
            print("retired", path.name)
    write_layers()


if __name__ == "__main__":
    main()
