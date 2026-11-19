"""
Cut the concept painting into a ground plate, depth sprites, and a walk mask.

The plate keeps the island, sea, cliffs, foam, path, and flowers. Tall objects
are copied out with transparency so Pibo can sort in front of and behind them.
Run: python3 tools/cut-concept.py
"""
import json
import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_JPG = Path("/home/ubuntu/.cursor/projects/workspace/uploads/0795e3ea422336996db3a5a661f411e0e8a55facac09ba89e3166ac54b34dc1d_db64.jpg")
RAW = Path("/tmp/plate/src.raw")
OUT = ROOT / "assets" / "painted"
W, H = 1280, 720
WORLD_W, WORLD_H = 32.0, 18.0

# name, x0, y0, x1, y1, footprint as a fraction of sprite width (0 = none)
RECTS = [
    ("tree-west", 40, 150, 230, 470, 0.16),
    ("cottage", 200, 140, 520, 470, 0.28),
    ("tree-back", 430, 120, 620, 360, 0.14),
    ("teal-house", 500, 130, 790, 420, 0.26),
    ("tree-north", 700, 90, 900, 320, 0.14),
    ("patio", 600, 260, 840, 450, 0.22),
    ("lamp-patio", 760, 280, 880, 500, 0.1),
    ("shed", 800, 190, 1060, 500, 0.26),
    ("crate", 740, 380, 880, 520, 0.35),
    ("tree-shed", 960, 180, 1160, 460, 0.14),
    ("lamp-path", 620, 420, 760, 600, 0.1),
    ("lighthouse", 930, 40, 1080, 310, 0.22),
    ("arcade", 1060, 350, 1276, 640, 0.22),
]

# UI buttons painted into the sky. Covered so the real HTML buttons are the only ones.
BUTTONS = [(36, 8, 430, 78), (1100, 8, 1272, 78)]
# The painted pot is removed by tools/cut-pibo.py. The old box sat below
# the real pot and left it in the picture.


def ensure_raw():
    RAW.parent.mkdir(parents=True, exist_ok=True)
    if RAW.exists() and RAW.stat().st_size == W * H * 3:
        return
    subprocess.check_call([
        "ffmpeg", "-y", "-i", str(SRC_JPG),
        "-f", "rawvideo", "-pix_fmt", "rgb24", str(RAW),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def write_png(path, w, h, rgba):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    rows = []
    stride = w * 4
    for y in range(h):
        rows.append(b"\x00" + rgba[y * stride:(y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows), 6))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def lum(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def is_ink(r, g, b):
    return lum(r, g, b) < 102


def cut_sprite(rgb, x0, y0, x1, y1):
    x0 = max(0, x0); y0 = max(0, y0)
    x1 = min(W, x1); y1 = min(H, y1)
    bw, bh = x1 - x0, y1 - y0

    def at(x, y):
        i = ((y0 + y) * W + (x0 + x)) * 3
        return rgb[i], rgb[i + 1], rgb[i + 2]

    # Dark outlines are a wall. Thicken them so small JPEG gaps stay closed,
    # then flood the background in from the edges. Whatever the flood cannot
    # reach is the object (roof, walls, leaves, trunk).
    wall = bytearray(bw * bh)
    for y in range(bh):
        for x in range(bw):
            if is_ink(*at(x, y)):
                wall[y * bw + x] = 1
    thick = bytearray(wall)
    for y in range(bh):
        for x in range(bw):
            if not wall[y * bw + x]:
                continue
            for dy in range(-2, 3):
                yy = y + dy
                if yy < 0 or yy >= bh:
                    continue
                for dx in range(-2, 3):
                    xx = x + dx
                    if 0 <= xx < bw:
                        thick[yy * bw + xx] = 1
    bg = bytearray(bw * bh)
    stack = []
    for x in range(bw):
        stack.append((x, 0))
        stack.append((x, bh - 1))
    for y in range(1, bh - 1):
        stack.append((0, y))
        stack.append((bw - 1, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= bw or y >= bh:
            continue
        k = y * bw + x
        if bg[k] or thick[k]:
            continue
        bg[k] = 1
        stack.append((x + 1, y))
        stack.append((x - 1, y))
        stack.append((x, y + 1))
        stack.append((x, y - 1))
    # Keep the foreground blob nearest the middle, plus blobs that touch it.
    # Drop little enclosed pebbles of grass far from that blob.
    fg = bytearray(bw * bh)
    for i in range(bw * bh):
        if not bg[i]:
            fg[i] = 1
    cx, cy = bw // 2, bh // 2
    # If the center itself was flooded, search outward for foreground.
    if not fg[cy * bw + cx]:
        found = None
        for rad in range(1, max(bw, bh)):
            for y in range(max(0, cy - rad), min(bh, cy + rad + 1)):
                for x in range(max(0, cx - rad), min(bw, cx + rad + 1)):
                    if fg[y * bw + x]:
                        found = (x, y)
                        break
                if found:
                    break
            if found:
                break
        if not found:
            return None
        cx, cy = found
    keep = bytearray(bw * bh)
    stack = [(cx, cy)]
    keep[cy * bw + cx] = 1
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= bw or ny >= bh:
                continue
            k = ny * bw + nx
            if keep[k] or not fg[k]:
                continue
            keep[k] = 1
            stack.append((nx, ny))
    bg = bytearray(bw * bh)
    for i in range(bw * bh):
        if not keep[i]:
            bg[i] = 1
    rgba = bytearray(bw * bh * 4)
    opaque = 0
    minx, miny, maxx, maxy = bw, bh, 0, 0
    for y in range(bh):
        for x in range(bw):
            k = y * bw + x
            si = ((y0 + y) * W + (x0 + x)) * 3
            o = k * 4
            rgba[o] = rgb[si]
            rgba[o + 1] = rgb[si + 1]
            rgba[o + 2] = rgb[si + 2]
            if bg[k]:
                rgba[o + 3] = 0
            else:
                rgba[o + 3] = 255
                opaque += 1
                if x < minx: minx = x
                if y < miny: miny = y
                if x > maxx: maxx = x
                if y > maxy: maxy = y
    if opaque == 0:
        return None
    # Crop to the opaque pixels, with a 1px pad.
    minx = max(0, minx - 1); miny = max(0, miny - 1)
    maxx = min(bw - 1, maxx + 1); maxy = min(bh - 1, maxy + 1)
    cw, ch = maxx - minx + 1, maxy - miny + 1
    cropped = bytearray(cw * ch * 4)
    for y in range(ch):
        src = ((miny + y) * bw + minx) * 4
        dst = y * cw * 4
        cropped[dst:dst + cw * 4] = rgba[src:src + cw * 4]
    return {
        "rgba": cropped,
        "w": cw,
        "h": ch,
        "x0": x0 + minx,
        "y0": y0 + miny,
        "x1": x0 + maxx + 1,
        "y1": y0 + maxy + 1,
        "opaque": opaque,
        "area": bw * bh,
    }


def inpaint(rgb, holes):
    """Nearest filled pixel, searched in expanding rings. holes is a bool list."""
    filled = rgb[:]
    w, h = W, H
    for y in range(h):
        row = y * w
        for x in range(w):
            if not holes[row + x]:
                continue
            found = None
            for rad in range(1, 48):
                y0 = max(0, y - rad); y1 = min(h - 1, y + rad)
                x0 = max(0, x - rad); x1 = min(w - 1, x + rad)
                for yy in (y0, y1):
                    for xx in range(x0, x1 + 1):
                        if not holes[yy * w + xx]:
                            found = (xx, yy)
                            break
                    if found:
                        break
                if found:
                    break
                for xx in (x0, x1):
                    for yy in range(y0 + 1, y1):
                        if not holes[yy * w + xx]:
                            found = (xx, yy)
                            break
                    if found:
                        break
                if found:
                    break
            if not found:
                continue
            si = (found[1] * w + found[0]) * 3
            di = (y * w + x) * 3
            filled[di:di + 3] = rgb[si:si + 3]
    return filled


def is_water(r, g, b, y):
    if y < 150:
        return False
    # Cyan sea. Sky is paler and sits above the horizon.
    return b > r + 10 and b + 6 >= g and g + 8 >= r and b > 100 and lum(r, g, b) < 215


def is_walk(r, g, b):
    L = lum(r, g, b)
    # Grass and leafy ground.
    if g > r + 6 and g + 4 >= b and 55 < g < 210 and r < 200 and b < 190:
        return True
    # Sandy path and warm stone lip of the grass.
    if r > 165 and g > 130 and 70 < b < 200 and r + 8 >= g and g > b + 8 and L > 120:
        return True
    return False


def build_mask(rgb):
    """R=walk, G=cliff/blocked, B=water. Half resolution."""
    mw, mh = W // 2, H // 2
    mask = bytearray(mw * mh * 4)
    for y in range(mh):
        for x in range(mw):
            # Majority of the 2x2 block.
            votes = [0, 0, 0]  # walk, water, other
            for dy in (0, 1):
                for dx in (0, 1):
                    sx, sy = x * 2 + dx, y * 2 + dy
                    i = (sy * W + sx) * 3
                    r, g, b = rgb[i], rgb[i + 1], rgb[i + 2]
                    if is_water(r, g, b, sy):
                        votes[1] += 1
                    elif is_walk(r, g, b):
                        votes[0] += 1
                    else:
                        votes[2] += 1
            kind = votes.index(max(votes))
            o = (y * mw + x) * 4
            if kind == 0:
                mask[o:o + 4] = b"\xff\x00\x00\xff"
            elif kind == 1:
                mask[o:o + 4] = b"\x00\x00\xff\xff"
            else:
                mask[o:o + 4] = b"\x00\xff\x00\xff"
    return mask, mw, mh


def main():
    ensure_raw()
    rgb = bytearray(RAW.read_bytes())
    holes = [False] * (W * H)
    for x0, y0, x1, y1 in BUTTONS:
        for y in range(y0, y1):
            row = y * W
            for x in range(x0, x1):
                holes[row + x] = True
    plate = inpaint(rgb, holes)
    plate_rgba = bytearray(W * H * 4)
    for i in range(W * H):
        plate_rgba[i * 4:i * 4 + 3] = plate[i * 3:i * 3 + 3]
        plate_rgba[i * 4 + 3] = 255
    # Pad sky above and sea below so 1280x800 still covers the frame.
    pad = 48
    padded_h = H + pad * 2
    padded = bytearray(W * padded_h * 4)
    sky = plate[0:3]
    sea_i = (H - 4) * W * 3
    sea = plate[sea_i:sea_i + 3]
    for y in range(pad):
        row = y * W * 4
        for x in range(W):
            padded[row + x * 4:row + x * 4 + 3] = sky
            padded[row + x * 4 + 3] = 255
    for y in range(H):
        dst = (y + pad) * W * 4
        src = y * W * 4
        padded[dst:dst + W * 4] = plate_rgba[src:src + W * 4]
    for y in range(pad):
        row = (pad + H + y) * W * 4
        for x in range(W):
            padded[row + x * 4:row + x * 4 + 3] = sea
            padded[row + x * 4 + 3] = 255

    OUT.mkdir(parents=True, exist_ok=True)
    write_png(OUT / "plate.png", W, padded_h, padded)

    sprites = []
    sprite_dir = OUT / "sprites"
    for name, x0, y0, x1, y1, foot in RECTS:
        cut = cut_sprite(rgb, x0, y0, x1, y1)
        if not cut:
            print("empty", name)
            continue
        rel = f"assets/painted/sprites/{name}.png"
        write_png(sprite_dir / f"{name}.png", cut["w"], cut["h"], cut["rgba"])
        # Anchor is the bottom center of the crop, in original pixels.
        ax = (cut["x0"] + cut["x1"]) / 2
        ay = cut["y1"]
        width = (cut["x1"] - cut["x0"]) / W * WORLD_W
        height = (cut["y1"] - cut["y0"]) / H * WORLD_H
        x = (ax / W - 0.5) * WORLD_W
        z = (ay / H - 0.5) * WORLD_H
        ratio = cut["opaque"] / max(1, cut["area"])
        sprites.append({
            "id": name,
            "src": rel,
            "pixelWidth": cut["w"],
            "pixelHeight": cut["h"],
            "width": round(width, 3),
            "height": round(height, 3),
            "anchor": {"x": 0.5, "y": 0.0},
            "footprint": None if foot <= 0 else {"radius": round(max(0.18, width * foot), 3)},
            "x": round(x, 3),
            "z": round(z, 3),
            "opaqueRatio": round(ratio, 3),
        })
        print(f"{name:12} {cut['w']:4}x{cut['h']:<4} opaque {ratio:.2f} at ({x:.2f},{z:.2f})")

    mask, mw, mh = build_mask(plate)
    write_png(OUT / "walk-mask.png", mw, mh, mask)

    def point(px, py):
        return {
            "x": round((px / W - 0.5) * WORLD_W, 3),
            "z": round((py / H - 0.5) * WORLD_H, 3),
        }

    # Feet of the live pot sit where the painted pot stood.
    layout = {
        "start": point(560, 575),
        "home": point(360, 360),
        "tealHouse": point(640, 300),
        "lighthouse": point(1005, 200),
        "lighthousePad": point(990, 270),
        "arcade": point(1180, 480),
        "arcadeDoor": point(1165, 560),
        "companion": point(80, 400),
        "pino": point(100, 430),
    }
    data = {
        "plate": {
            "pixelWidth": W,
            "pixelHeight": padded_h,
            "worldW": WORLD_W,
            "worldH": round(WORLD_H * padded_h / H, 3),
            "pad": pad,
        },
        "sprites": sprites,
        "layout": layout,
    }
    (OUT / "cut.json").write_text(json.dumps(data, indent=2))
    print("wrote", OUT)
    subprocess.check_call([sys.executable, str(Path(__file__).with_name("cut-pibo.py"))])


if __name__ == "__main__":
    main()
