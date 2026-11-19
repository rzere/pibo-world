# Replacing art on Pibo Island

The island is one bright picture, shown flat to the camera. Pibo is a separate layer on top of it, with his own shadow. Buildings and trees stay inside that picture so they cannot clip through each other. Nothing in the picture has words or signs. The Go to lighthouse, Go to Arcade, Go to Library, and Map buttons are HTML in `index.html` and `styles.css`.

The list of images lives in [`src/data/assets.js`](src/data/assets.js) and [`src/data/layers.js`](src/data/layers.js). Where Pibo starts, and where each door is, lives in `layers.js` (re-exported from [`src/data/painted.js`](src/data/painted.js)). The walls he slides along are the `HOUSES` and `CIRCLES` in that same file.

## What to draw

Bold, saturated, flat color, thick outlines, and very little detail. No letters anywhere in the picture. No human characters. Outdoor animals are not part of the island picture.

Replace the plate and refresh. Doors and walls stay in `src/data/layers.js`. The clean outdoor picture is `assets/painted/sources/island-outdoor.png` (1280 × 720, no animals, no edge pad). `python3 tools/build-layers.py` copies it to the plate at 2560 × 1440. It does not cut the painting apart.

### Ground

- **Plate** (`assets/painted/plate.png`) — the whole outdoor island: sky, sea, islets, grass, paths, cliffs, flowers, buildings, and trees. Outdoor animals and butterflies are not in this file. 2560 × 1440, which is the 32 × 18 play area. Do not pad it by stretching the edge rows.
- **Animal mascots** (`assets/critters/<name>/`) — her cat, dog, bunny, panda, frog, penguin, unicorn, and fox. Each folder has eight walk drawings from her cycle sheet: front, three-quarter, side, and back-three-quarter, for both sides. They are smaller than Pibo, who is the only pot. Rebuild with `python3 tools/cut-critter-walk.py`. The purple names on the sheet are not part of the sprites.
- **Walk mask** (`assets/painted/walk-mask.png`) — red where Pibo may walk, blue for open sea (he flies there), green for the top sky edge. 640 × 360.

### Library room

The book-stack library, cottage, market, mushroom house, arcade, and lighthouse are painted into the plate. Their walls are `HOUSES` in `src/data/layers.js`. The two big canopies are in the plate too. Trunk keep-outs are `CIRCLES`.

| Layer | File |
| --- | --- |
| Library raccoon | `assets/painted/layers/raccoon.png` |

The library hangout background, with the raccoon removed, is `assets/painted/layers/library-hangout.png`.

- **Art room** (`assets/painted/art-room.jpg`) — the cottage studio behind the cottage door, in the same cel-shaded palette as the island. Pibo is drawn on top of the rug, not painted in. The preview keeps the whole silhouette, including outline, feet, hair, and hats, inside the frame.
- **Pibo** (`assets/pibo/pibo.png`) — Paria's left-facing pot, 645 × 838, feet at the bottom edge. No leaves in this file. The body, feet, outline, eyes, smile, and blush are opaque, with only a thin soft edge, so the island does not show through. Bead eyes, the smile, the orange blush, and the black outline stay when the body and feet recolor. Hair and hats are separate sprites; a hat replaces whichever hair is on. `pibo-face-right.png` and `pibo-face-front.png` are the other two drawings. Walk and flight swap those three pictures: screen-left uses the left drawing, screen-right uses the right drawing, and up or down the island uses the front drawing. Stopping keeps the last facing. The game draws the soft shadow.
- **Hair** (`assets/pibo/hair/`) — succulent, fern, sunflower, clover, and palm. Each file is a transparent PNG of any size, with no pot, rim, or soil in it. The original big tuft is not one of these files. It is the green layer already in `pibo.png`. `tuft-icon.png` is only the picker picture for that tuft.
- **Hats** (`assets/pibo/hats/`) — beanie, strawhat, wizard, crown, cap, and pirate. Same rules: transparent PNG, any size, no pot pixels. A hat hides whichever hair is selected.
- Placement for each id is `anchorPx`, `offset`, and `scale` on that entry in `HAIRS` or `HATS` in `src/entities/piboLook.js`. `anchorPx` is the pixel in the file (x from the left, y from the top) that sits on the middle of the pot rim's top. `scale` 1 means one image pixel per sprite pixel. `offset` is sprite pixels, x to the right and y downward. To use a new painting, overwrite the PNG, update `anchorPx` if the crop changed, and refresh.

`x` grows to the right of the picture. `z` grows down the picture.

## How to swap the island or Pibo

1. Export a PNG. The island can be opaque. Pibo needs a transparent background.
2. Overwrite `assets/painted/plate.png` or `assets/pibo/pibo.png`.
3. Refresh the game. There is no build step.

The old cutouts in `assets/painted/sprites/` are not drawn. Outdoor buildings are not separate stickers. Footprints are `HOUSES` and `CIRCLES` in `src/data/layers.js`. If a new painting moves a building, move that polygon so Pibo still slides along the wall.

Doors are points in `src/data/layers.js`:

- `libraryDoor` opens the story room.
- `cottageDoor` opens the art room.
- `lighthousePad` opens the studio. `lighthouse` is the tower he looks at.
- `arcadeDoor` opens the arcade.

Stand on the grass just in front of the door, on the red part of the walk mask. Blue is open sea, and Pibo flies there instead of swimming.
