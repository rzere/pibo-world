"""Make Paria's pot ink opaque.

Her cut came off a black sheet, so the black outline, rim, eyes, and smile
were left around alpha 160 and the island showed through. Yellow fill was
already solid.

Pixels with alpha >= 40 become opaque and keep their color. A thin rim of
coverage, colored from the pot rather than the black sheet, softens the
silhouette. Run this once on the soft cut. A second run would thicken the rim.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "assets/pibo/pibo.png",
    ROOT / "assets/pibo/pibo-face-right.png",
    ROOT / "assets/pibo/pibo-face-front.png",
    ROOT / "assets/pibo/hair/tuft-icon.png",
]


def _blur(mask, passes):
    soft = mask.astype(np.float32)
    kernel = np.array([1, 2, 1], np.float32) / 4

    def horizontal(src):
        padded = np.pad(src, ((0, 0), (1, 1)), mode="constant")
        return padded[:, 0:-2] * kernel[0] + padded[:, 1:-1] * kernel[1] + padded[:, 2:] * kernel[2]

    for _ in range(passes):
        soft = horizontal(soft)
        soft = horizontal(soft.T).T
    return soft


def harden(rgba, thresh=40, passes=2):
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    core = alpha >= thresh
    color = rgb.copy()
    filled = core.copy()
    for _ in range(4):
        total = np.zeros((*core.shape, 3), np.float32)
        count = np.zeros(core.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                shifted = np.zeros_like(filled)
                shifted_color = np.zeros_like(color, np.float32)
                y0, y1 = max(0, dy), filled.shape[0] + min(0, dy)
                x0, x1 = max(0, dx), filled.shape[1] + min(0, dx)
                shifted[y0:y1, x0:x1] = filled[y0 - dy : y1 - dy, x0 - dx : x1 - dx]
                shifted_color[y0:y1, x0:x1] = color[y0 - dy : y1 - dy, x0 - dx : x1 - dx]
                total += shifted_color * shifted[:, :, None]
                count += shifted
        grow = (~filled) & (count > 0)
        if not grow.any():
            break
        color[grow] = np.rint(total[grow] / count[grow, None]).astype(np.uint8)
        filled |= grow

    soft = _blur(core.astype(np.float32), passes)
    out = np.zeros_like(rgba)
    out[:, :, :3] = color
    hardened = np.zeros(core.shape, np.uint8)
    hardened[core] = 255
    fringe = (~core) & (soft >= 0.12)
    hardened[fringe] = np.clip(np.rint(soft[fringe] * 255), 1, 200).astype(np.uint8)
    out[:, :, 3] = hardened
    out[hardened == 0, :3] = 0
    return out


def main():
    for path in FILES:
        src = np.array(Image.open(path).convert("RGBA"))
        out = harden(src)
        Image.fromarray(out).save(path)
        partial = int(((out[:, :, 3] > 0) & (out[:, :, 3] < 255)).sum())
        opaque = int((out[:, :, 3] == 255).sum())
        print(f"{path.relative_to(ROOT)} opaque {opaque} edge {partial}")


if __name__ == "__main__":
    main()
