"""
Cut Paria's animal walk cycles into transparent frames.

Eight rows, eight directions, left to right:
front, three-quarter left, side left, back-three-quarter left,
front, three-quarter right, side right, back-three-quarter right.

The purple name pills on the left are not sprites. Each animal's frames share
one canvas with the feet lined up, so a direction change does not resize them.

    python3 tools/cut-critter-walk.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "critters" / "sources" / "paria-animal-walk-cycles-sheet.png"
OUT = ROOT / "assets" / "critters"
NAMES = ("cat", "dog", "bunny", "panda", "frog", "penguin", "unicorn", "fox")
FRAMES = (
    "front-a",
    "three-left",
    "side-left",
    "back-left",
    "front-b",
    "three-right",
    "side-right",
    "back-right",
)
PAD = 3


def sprites(arr):
    alpha = arr[:, :, 3]
    labels, count = ndimage.label(alpha > 32)
    boxes = []
    for idx in range(1, count + 1):
        ys, xs = np.where(labels == idx)
        if ys.max() - ys.min() < 70:
            continue
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
    boxes.sort(key=lambda b: (b[1], b[0]))
    rows = []
    for box in boxes:
        if not rows or box[1] - rows[-1][0][1] > 40:
            rows.append([box])
        else:
            rows[-1].append(box)
    if len(rows) != 8 or any(len(row) != 8 for row in rows):
        raise SystemExit(f"expected 8x8 frames, got {[len(r) for r in rows]}")
    return rows


def crop_frame(arr, box):
    h, w = arr.shape[:2]
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - PAD)
    y0 = max(0, y0 - PAD)
    x1 = min(w - 1, x1 + PAD)
    y1 = min(h - 1, y1 + PAD)
    crop = arr[y0:y1 + 1, x0:x1 + 1].copy()
    crop[crop[:, :, 3] < 10, 3] = 0
    return crop


def main():
    if not SRC.exists():
        raise SystemExit(f"missing sheet: {SRC}")
    arr = np.array(Image.open(SRC).convert("RGBA"))
    for name, row in zip(NAMES, sprites(arr)):
        frames = [crop_frame(arr, box) for box in sorted(row, key=lambda b: b[0])]
        cw = max(f.shape[1] for f in frames)
        ch = max(f.shape[0] for f in frames)
        folder = OUT / name
        folder.mkdir(parents=True, exist_ok=True)
        for frame_name, frame in zip(FRAMES, frames):
            canvas = np.zeros((ch, cw, 4), np.uint8)
            fh, fw = frame.shape[:2]
            left = (cw - fw) // 2
            top = ch - fh
            canvas[top:top + fh, left:left + fw] = frame
            Image.fromarray(canvas, "RGBA").save(folder / f"{frame_name}.png")
        print(f"{name:8} {cw}x{ch}")


if __name__ == "__main__":
    main()
