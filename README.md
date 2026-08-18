# Pibo · Pocket Planet

A tiny, charming, social **Pocket Planet** prototype for [pibo.world](https://pibo.world) — the
first playable sample of an educational MMORPG made of small personal planets.

The goal of this build is one feeling, not a feature list:

> **"I own this tiny world, it feels alive, and I want to keep shaping it."**

You wake up on a handcrafted **cozy learning garden planet**. Walk around it, plant three
things in the garden, watch them grow, learn a little about each, and your world quietly
changes in return.

## Run it

The project uses native ES modules, so it needs to be served over HTTP (opening
`index.html` from the file system won't load the modules). No build step, no install.

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, a Live Server extension, …).

Three.js is loaded from a CDN via the import map in `index.html`, so you need an internet
connection the first time.

## Play

- **WASD** / **arrow keys** — walk around your planet (Pibo turns to face where it's going)
- **E** / **Enter** — interact (plant, then later inspect what you grew)
- **1 / 2 / 3** — choose a plant
- **Esc** — step back from a panel
- **🪴** (top-right) — see the things you've grown
- **Phone / tablet** — a little joystick (bottom-left) steers Pibo; tap **E** (bottom-right) to interact. On-screen prompts and plant cards are tappable too.

Walk to the three planter beds in the garden, plant a seed in each, wait a few seconds for
them to grow, and inspect them to learn a tiny fact. Grow all three and watch what happens
to the rest of the planet.

## Architecture

Everything is a small, self-contained module so the world can grow later without a rewrite.

```
src/
  core/
    Game.js         orchestrator: renderer, loop, camera, interaction wiring
    Input.js        keyboard + analog stick (held movement vs. one-shot actions)
    SphereMath.js   living on a sphere: placement, movement, orientation
  world/
    Planet.js       the Pocket Planet sphere + surface placement
    Environment.js  soft daytime lighting + shadows
    Props.js        handcrafted structures & nature (home, workshop, observatory, …)
    Ambient.js      clouds, butterflies — life while you stand still
    materials.js    shared "clay toy" materials & primitives
    layout.js       the handcrafted lat/lon layout of this planet
  entities/
    Pibo.js         the player creature (walks, idles, faces movement)
  systems/
    GardenSystem.js the plant → grow → inspect → reward loop
  data/
    plants.js       the three plants + their one-line facts
  ui/
    UI.js           minimal overlay: prompt, plant panel, facts, collection
    Joystick.js     on-screen analog stick for phones and tablets
```

### Designed to extend

The seams are already in place for the real game, but intentionally not built yet:

- **Multiple Pocket Planets** — a `Planet` is a self-contained group built from a `layout`.
  Instantiate more and place them in the sky.
- **Ownership / visitors** — the landing pad is where future visitors arrive; the planet is
  a discrete unit ready to carry an owner id and guests.
- **Placeable buildings** — `Props` builders are pure factories; a placement system can reuse
  `planet.placeOnSurface`.
- **More educational systems** — `GardenSystem` is one system among future ones; `data/`
  holds content separate from mechanics.
- **Inventory / NPCs / world events** — slot in as new `systems/` + `entities/`, wired
  through `Game`.
