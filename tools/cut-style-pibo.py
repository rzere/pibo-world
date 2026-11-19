"""Cut the approved side-facing Pibo into a transparent game sprite.

Reads assets/pibo/sources/pibo-side-smile-v1.jpg. Drops the flat blue
background and the painted ground shadow (the game draws its own). Feet sit
on the bottom edge so the existing anchor still works. The black bead eyes
and the thin smile stay in the picture. No walk or flight frames: the game
bobs this one picture.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "pibo" / "sources" / "pibo-side-smile-v1.jpg"
OUT = ROOT / "assets" / "pibo" / "pibo.png"
OUT_W, OUT_H = 645, 838


def flood_background(rgb):
    height, width = rgb.shape[:2]
    bg = rgb[0, 0].astype(np.int16)
    seen = np.zeros((height, width), np.uint8)
    queue = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or seen[y, x]:
            continue
        if np.abs(rgb[y, x].astype(np.int16) - bg).sum() > 42:
            continue
        seen[y, x] = 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return seen, bg


def main():
    rgb = np.array(Image.open(SRC).convert("RGB"))
    height, width = rgb.shape[:2]
    seen, bg = flood_background(rgb)
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    peak = np.maximum(np.maximum(red, green), blue)
    chroma = peak - np.minimum(np.minimum(red, green), blue)
    yellow = (red > 150) & (red > blue + 40) & (green > 70) & (blue < 130)
    foreground = seen == 0
    feet_y = int(np.where((yellow & foreground).any(1))[0].max())
    shadow = (chroma < 32) & (peak < 205) & (peak > 20) & (np.arange(height)[:, None] > feet_y - 10)
    pale_blue = (blue > 190) & (blue > red + 10) & (green > 170)
    character = foreground & ~shadow & ~pale_blue

    ys, xs = np.where(character)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    edge = character.copy()
    background = ~character
    dilated = background.copy()
    dilated[1:] |= background[:-1]
    dilated[:-1] |= background[1:]
    dilated[:, 1:] |= background[:, :-1]
    dilated[:, :-1] |= background[:, 1:]
    edge = character & dilated

    rgba = np.zeros((height, width, 4), np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = np.where(character, 255, 0).astype(np.uint8)
    bgf = bg.astype(np.float32)
    ey, ex = np.where(edge)
    for y, x in zip(ey, ex):
        pixel = rgb[y, x].astype(np.float32)
        dist = np.abs(pixel - bgf).sum()
        alpha = float(np.clip((dist - 30) / 160, 0.2, 1))
        color = np.clip((pixel - bgf * (1 - alpha)) / alpha, 0, 255)
        rgba[y, x, :3] = color.astype(np.uint8)
        rgba[y, x, 3] = int(alpha * 255)

    crop = rgba[y0:y1 + 1, x0:x1 + 1]
    ch, cw = crop.shape[:2]
    scale = min((OUT_W - 12) / cw, (OUT_H - 8) / ch)
    nw, nh = int(round(cw * scale)), int(round(ch * scale))
    sprite = Image.fromarray(crop, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    ox = (OUT_W - nw) // 2
    oy = OUT_H - nh - 2
    canvas.paste(sprite, (ox, oy), sprite)
    out = np.array(canvas)
    out[:, :, 3] = np.where(out[:, :, 3] < 16, 0, out[:, :, 3])
    red = out[:, :, 0].astype(np.int16)
    green = out[:, :, 1].astype(np.int16)
    blue = out[:, :, 2].astype(np.int16)
    alpha = out[:, :, 3]
    # Blue halo left where the flat background mixed into the outline.
    halo = (alpha > 0) & (blue > red + 12) & (blue > green + 8) & (blue > 110)
    out[halo, 3] = 0
    # The concept's ground shadow is not part of the sprite. The game draws one.
    # Neutral dark pixels under the belly are that shadow, including the gap
    # between the two feet. Brown foot pixels stay (they are chromatic).
    red = out[:, :, 0].astype(np.int16)
    green = out[:, :, 1].astype(np.int16)
    blue = out[:, :, 2].astype(np.int16)
    alpha = out[:, :, 3]
    peak = np.maximum(np.maximum(red, green), blue)
    chroma = peak - np.minimum(np.minimum(red, green), blue)
    rows = np.arange(out.shape[0])[:, None]
    opaque = alpha > 30
    yellow = opaque & (red > 150) & (green > 80) & (blue < 100) & (red > blue + 30)
    solid = np.where(yellow.sum(1) >= 30)[0]
    foot_line = int(solid.max()) if len(solid) else out.shape[0] - 8
    out[foot_line + 6:, :, 3] = 0
    alpha = out[:, :, 3]
    # Only the gap under the belly. The smile and bead eyes are higher and must stay.
    shadow = (alpha > 0) & (chroma < 26) & (peak < 120) & (rows > foot_line - 28)
    out[shadow, 3] = 0
    Image.fromarray(out, "RGBA").save(OUT)
    print(f"wrote {OUT} {OUT_W}x{OUT_H} from crop {cw}x{ch} scale {scale:.3f} at {ox},{oy}")


if __name__ == "__main__":
    main()
