/**
 * Writes the placeholder SVG set in assets/placeholders/.
 * Run: node tools/paint-placeholders.mjs
 *
 * These are stand-ins in the target palette. Paria replaces the files
 * (or the paths in src/data/assets.js). See ASSETS.md.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { LAND, GROUND_BOUNDS } from "../src/world/layout.js";

const OUT = new URL("../assets/placeholders/", import.meta.url);
const INK = "#5a4638";
const CREAM = "#f6ead6";
const CREAM_SIDE = "#e7d4b8";
const ROOF = "#e4834e";
const ROOF_DARK = "#c85d38";
const TEAL = "#5eae9a";
const TEAL_DARK = "#3d8f7e";
const WOOD = "#c4925a";
const WOOD_DARK = "#a87840";
const LEAF = "#7fbf62";
const LEAF_DARK = "#5fa84a";
const POT = "#f6d15a";
const POT_DARK = "#e3b63e";
const SKY = "#d7f1fb";
const WATER = "#8fd0e8";

const svg = (w, h, body, viewW = w, viewH = h) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${viewW} ${viewH}" fill="none">\n${body}\n</svg>\n`;

const files = new Map();
const put = (name, text) => files.set(name, text);

function house({
  wall = CREAM,
  side = CREAM_SIDE,
  roof = ROOF,
  roofDark = ROOF_DARK,
  door = WOOD,
  chimney = true,
  roundWindow = false,
  planks = false,
}) {
  const plankLines = planks
    ? [110, 140, 170, 210, 240].map((x) => `<path d="M${x} 230 V352" stroke="${WOOD_DARK}" stroke-width="3" opacity="0.45"/>`).join("")
    : "";
  return `
  <ellipse cx="200" cy="392" rx="130" ry="16" fill="#8fb56a" opacity="0.5"/>
  <path d="M262 214 L338 176 L338 330 L262 362 Z" fill="${side}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M64 214 H262 V362 H64 Z" fill="${wall}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  ${plankLines}
  <path d="M250 108 L360 164 L338 176 L262 132 Z" fill="${roofDark}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M40 220 L168 78 L292 220 Z" fill="${roof}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M78 196 L168 118 L258 196" stroke="${roofDark}" stroke-width="4" opacity="0.7"/>
  <path d="M96 214 L168 150 L240 214" stroke="${roofDark}" stroke-width="4" opacity="0.55"/>
  ${chimney ? `
  <path d="M206 132 L206 86 H246 L246 154" fill="#f0d0bc" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="198" y="74" width="56" height="16" rx="3" fill="#e8c4ae" stroke="${INK}" stroke-width="5"/>` : ""}
  <path d="M146 362 L146 286 Q146 252 176 252 Q206 252 206 286 L206 362 Z" fill="${door}" stroke="${INK}" stroke-width="5"/>
  <circle cx="196" cy="322" r="4.5" fill="#f6e7bf" stroke="${INK}" stroke-width="2"/>
  <rect x="88" y="248" width="48" height="44" rx="6" fill="#c5e6f2" stroke="${INK}" stroke-width="5"/>
  <path d="M112 248 V292 M88 270 H136" stroke="${INK}" stroke-width="3"/>
  ${roundWindow
    ? `<circle cx="168" cy="156" r="16" fill="#f7e7c4" stroke="${INK}" stroke-width="5"/>`
    : `<rect x="150" y="142" width="36" height="28" rx="5" fill="#f7e7c4" stroke="${INK}" stroke-width="5"/>`}
  <ellipse cx="58" cy="352" rx="26" ry="16" fill="${LEAF}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="318" cy="348" rx="20" ry="13" fill="${LEAF_DARK}" stroke="${INK}" stroke-width="5"/>
  <circle cx="48" cy="340" r="5" fill="#f4b4c4" stroke="${INK}" stroke-width="2"/>
  <circle cx="70" cy="344" r="4" fill="#fff4b8" stroke="${INK}" stroke-width="2"/>
`;
}

put("cottage.svg", svg(512, 540, house({ chimney: true, roundWindow: true }), 400, 430));

put("teal-house.svg", svg(512, 480, `
  <ellipse cx="210" cy="360" rx="140" ry="16" fill="#8fb56a" opacity="0.5"/>
  <path d="M250 200 L340 160 L340 300 L250 336 Z" fill="${CREAM_SIDE}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 168 H270 V336 H70 Z" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
  <path d="M248 112 L356 168 L340 160 L250 118 Z" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M48 176 L170 78 L292 176 Z" fill="${TEAL}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M86 160 L170 112 L254 160" stroke="${TEAL_DARK}" stroke-width="4"/>
  <path d="M150 336 V268 Q150 240 176 240 Q202 240 202 268 V336" fill="${WOOD}" stroke="${INK}" stroke-width="5"/>
  <circle cx="192" cy="300" r="4" fill="#f6e7bf" stroke="${INK}" stroke-width="2"/>
  <rect x="90" y="214" width="52" height="40" rx="8" fill="#c5e6f2" stroke="${INK}" stroke-width="5"/>
  <path d="M116 214 V254 M90 234 H142" stroke="${INK}" stroke-width="3"/>
  <rect x="214" y="214" width="36" height="36" rx="8" fill="#c5e6f2" stroke="${INK}" stroke-width="5"/>
  <path d="M232 214 V250 M214 232 H250" stroke="${INK}" stroke-width="3"/>
  <rect x="78" y="300" width="70" height="14" rx="4" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>
  <circle cx="92" cy="296" r="6" fill="#f4b4c4" stroke="${INK}" stroke-width="2"/>
  <circle cx="110" cy="294" r="6" fill="#fff4b8" stroke="${INK}" stroke-width="2"/>
  <circle cx="128" cy="297" r="5" fill="#f7a0b4" stroke="${INK}" stroke-width="2"/>
`, 400, 390));

put("shed.svg", svg(420, 400, `
  <ellipse cx="180" cy="300" rx="110" ry="14" fill="#8fb56a" opacity="0.45"/>
  <path d="M230 150 L310 118 L310 250 L230 278 Z" fill="${WOOD_DARK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M50 150 H230 V278 H50 Z" fill="${WOOD}" stroke="${INK}" stroke-width="6"/>
  ${[80, 110, 140, 170, 200].map((x) => `<path d="M${x} 156 V272" stroke="${WOOD_DARK}" stroke-width="3" opacity="0.4"/>`).join("")}
  <path d="M220 96 L330 140 L310 118 L230 86 Z" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M28 156 L140 70 L252 156 Z" fill="${TEAL}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 142 L140 100 L210 142" stroke="${TEAL_DARK}" stroke-width="4"/>
  <path d="M118 278 V214 Q118 196 140 196 Q162 196 162 214 V278" fill="#8d6238" stroke="${INK}" stroke-width="5"/>
  <rect x="70" y="190" width="32" height="26" rx="3" fill="#d7eef5" stroke="${INK}" stroke-width="4"/>
`, 360, 330));

put("crate.svg", svg(256, 256, `
  <ellipse cx="128" cy="210" rx="70" ry="12" fill="#8fb56a" opacity="0.45"/>
  <path d="M150 120 L210 96 L210 176 L150 200 Z" fill="${WOOD_DARK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M46 120 H150 V200 H46 Z" fill="${WOOD}" stroke="${INK}" stroke-width="6"/>
  <path d="M46 148 H150 M46 172 H150" stroke="${WOOD_DARK}" stroke-width="5"/>
  <path d="M78 120 V200 M118 120 V200" stroke="${WOOD_DARK}" stroke-width="5"/>
  <path d="M150 148 L210 124 M150 172 L210 148" stroke="#8d6234" stroke-width="4"/>
`, 256, 240));

put("picnic.svg", svg(420, 320, `
  <ellipse cx="210" cy="210" rx="150" ry="22" fill="#8fb56a" opacity="0.35"/>
  <path d="M40 150 L250 110 L370 170 L150 214 Z" fill="#f06458" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 156 L250 124 L340 168 L150 204" fill="none" stroke="#fff7f2" stroke-width="10" opacity="0.9"/>
  <path d="M96 162 L236 136" stroke="#fff7f2" stroke-width="10"/>
  <path d="M118 176 L250 150" stroke="#fff7f2" stroke-width="10"/>
  <path d="M40 150 L250 110 L370 170 L150 214 Z" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M168 78 L210 70 L230 118 L186 128 Z" fill="${WOOD}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M176 92 H222" stroke="${WOOD_DARK}" stroke-width="3"/>
  <ellipse cx="300" cy="150" rx="16" ry="8" fill="#f6e7bf" stroke="${INK}" stroke-width="4"/>
  <circle cx="292" cy="146" r="5" fill="#f28b8b" stroke="${INK}" stroke-width="2"/>
  <circle cx="306" cy="148" r="4" fill="#8ec86e" stroke="${INK}" stroke-width="2"/>
`, 420, 250));

put("patio.svg", svg(420, 320, `
  <ellipse cx="200" cy="230" rx="120" ry="16" fill="#c4a574" opacity="0.45"/>
  <ellipse cx="200" cy="214" rx="108" ry="28" fill="#f0d7a8" stroke="${INK}" stroke-width="6"/>
  <path d="M120 200 V150" stroke="${WOOD}" stroke-width="8" stroke-linecap="round"/>
  <path d="M280 200 V150" stroke="${WOOD}" stroke-width="8" stroke-linecap="round"/>
  <path d="M150 168 V130" stroke="${WOOD}" stroke-width="8" stroke-linecap="round"/>
  <path d="M250 168 V130" stroke="${WOOD}" stroke-width="8" stroke-linecap="round"/>
  <ellipse cx="200" cy="128" rx="92" ry="26" fill="#f7e2b8" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="150" cy="122" rx="18" ry="8" fill="#fffaf2" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="230" cy="118" rx="16" ry="7" fill="#fffaf2" stroke="${INK}" stroke-width="4"/>
  <circle cx="188" cy="116" r="7" fill="#f28b8b" stroke="${INK}" stroke-width="3"/>
  <path d="M250 108 Q270 90 258 78" stroke="${TEAL}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="262" cy="74" rx="10" ry="6" fill="${TEAL}" stroke="${INK}" stroke-width="3"/>
`, 400, 280));

function treeSvg(scaleNote = "") {
  return `
  <ellipse cx="180" cy="340" rx="70" ry="14" fill="#7ea85a" opacity="0.4"/>
  <path d="M166 250 Q160 300 150 332 H210 Q198 300 194 250 Z" fill="#b8834e" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <ellipse cx="150" cy="230" rx="78" ry="58" fill="${LEAF}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="214" cy="214" rx="70" ry="54" fill="#95cc74" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="178" cy="176" rx="64" ry="50" fill="#b6de8e" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="196" cy="150" rx="18" ry="10" fill="#e7f6cf" opacity="0.8"/>
  ${scaleNote}
`;
}
put("tree.svg", svg(420, 460, treeSvg(), 360, 380));
put("tree-small.svg", svg(360, 400, `
  <ellipse cx="160" cy="300" rx="58" ry="12" fill="#7ea85a" opacity="0.4"/>
  <path d="M148 220 Q144 260 136 292 H184 Q174 260 170 220 Z" fill="#b8834e" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="132" cy="200" rx="62" ry="46" fill="${LEAF}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="188" cy="188" rx="54" ry="42" fill="#95cc74" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="156" cy="150" rx="50" ry="40" fill="#b6de8e" stroke="${INK}" stroke-width="6"/>
`, 320, 340));

put("bush.svg", svg(256, 200, `
  <ellipse cx="128" cy="150" rx="80" ry="14" fill="#7ea85a" opacity="0.35"/>
  <ellipse cx="88" cy="112" rx="48" ry="36" fill="${LEAF}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="150" cy="104" rx="52" ry="38" fill="#95cc74" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="120" cy="86" rx="36" ry="26" fill="#b6de8e" stroke="${INK}" stroke-width="5"/>
  <circle cx="100" cy="100" r="6" fill="#f4b4c4" stroke="${INK}" stroke-width="2"/>
  <circle cx="156" cy="96" r="5" fill="#fff4b8" stroke="${INK}" stroke-width="2"/>
`, 256, 180));

function flowers(colors) {
  const blooms = [
    [70, 120, colors[0]],
    [120, 100, colors[1]],
    [168, 124, colors[2]],
    [100, 78, colors[0]],
    [150, 70, colors[1]],
  ];
  const heads = blooms.map(([x, y, c]) => `
    <path d="M${x} ${y + 40} Q${x - 6} ${y + 10} ${x} ${y}" stroke="${LEAF_DARK}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y}" r="14" fill="${c}" stroke="${INK}" stroke-width="4"/>
    <circle cx="${x}" cy="${y}" r="5" fill="#fff4b8" stroke="${INK}" stroke-width="2"/>
  `).join("");
  return `
    <ellipse cx="120" cy="168" rx="70" ry="12" fill="#7ea85a" opacity="0.35"/>
    ${heads}
  `;
}
put("flowers.svg", svg(256, 220, flowers(["#f28b8b", "#fff4b8", "#f4b4c4"]), 240, 200));
put("flowers-pink.svg", svg(256, 220, flowers(["#f4b4c4", "#d7c4f5", "#f7a0b4"]), 240, 200));

put("lamp.svg", svg(220, 420, `
  <ellipse cx="110" cy="360" rx="36" ry="10" fill="#7ea85a" opacity="0.4"/>
  <path d="M96 340 H124 L132 168 H88 Z" fill="#6f645c" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="78" y="150" width="64" height="28" rx="6" fill="#3d4a55" stroke="${INK}" stroke-width="6"/>
  <path d="M86 150 L110 118 L134 150" fill="#f6e27a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="110" cy="132" rx="28" ry="16" fill="#ffe9a0" opacity="0.55"/>
  <circle cx="110" cy="164" r="4" fill="#f6e27a"/>
`, 220, 400));

put("rock.svg", svg(280, 200, `
  <ellipse cx="140" cy="150" rx="90" ry="16" fill="#b7a48e" opacity="0.35"/>
  <path d="M36 132 Q40 70 110 62 Q180 40 230 88 Q260 120 240 146 Q180 170 80 160 Q30 156 36 132 Z" fill="#d9cbb8" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 100 Q120 86 170 108" stroke="#c4b29e" stroke-width="5" stroke-linecap="round"/>
  <path d="M96 124 Q140 112 186 130" stroke="#c4b29e" stroke-width="4" stroke-linecap="round"/>
`, 280, 190));

put("rock-small.svg", svg(200, 160, `
  <ellipse cx="100" cy="120" rx="60" ry="12" fill="#b7a48e" opacity="0.35"/>
  <path d="M30 108 Q40 58 96 54 Q150 46 168 90 Q176 118 150 128 Q90 142 36 124 Q22 118 30 108 Z" fill="#e4d7c6" stroke="${INK}" stroke-width="6"/>
`, 200, 150));

put("lighthouse.svg", svg(360, 640, `
  <ellipse cx="180" cy="560" rx="100" ry="18" fill="#b7a48e" opacity="0.45"/>
  <path d="M70 500 Q90 430 180 420 Q270 430 290 500 Q250 540 180 546 Q110 540 70 500 Z" fill="#d2c3b0" stroke="${INK}" stroke-width="6"/>
  <path d="M118 430 L148 168 H212 L242 430 Z" fill="#f7f1e6" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M132 360 H228 M138 300 H222 M144 240 H216" stroke="#d8c7b0" stroke-width="6"/>
  <rect x="156" y="250" width="28" height="22" rx="3" fill="#c5e6f2" stroke="${INK}" stroke-width="4"/>
  <path d="M150 430 V390 Q150 374 170 374 H190 Q210 374 210 390 V430" fill="${WOOD}" stroke="${INK}" stroke-width="5"/>
  <path d="M136 168 H224 L236 120 H124 Z" fill="${TEAL}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M148 120 H212 L200 78 H160 Z" fill="#f4f7f8" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="168" y="92" width="24" height="18" rx="2" fill="#fff4c4" stroke="${INK}" stroke-width="3"/>
  <path d="M132 78 H228 L214 52 H146 Z" fill="#e07a55" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="180" cy="46" r="8" fill="#f6e27a" stroke="${INK}" stroke-width="4"/>
`, 360, 600));

put("lighthouse-beam.svg", svg(640, 280, `
  <defs>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffd56a" stop-opacity="0.96"/>
      <stop offset="0.28" stop-color="#ffe7a3" stop-opacity="0.78"/>
      <stop offset="0.62" stop-color="#fff1c4" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#fff6dc" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <polygon points="0,140 640,16 640,264" fill="url(#beam)"/>
  <polygon points="0,140 480,62 480,218" fill="#ffe08a" opacity="0.42"/>
`, 640, 280));

put("arcade.svg", svg(420, 460, `
  <ellipse cx="190" cy="390" rx="120" ry="16" fill="#b7a48e" opacity="0.4"/>
  <path d="M70 360 H250 L270 390 H90 Z" fill="#cbbba6" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M250 250 L320 220 L320 340 L250 372 Z" fill="#6a4cb8" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 168 H270 V360 H70 Z" fill="#8b6ad4" stroke="${INK}" stroke-width="6"/>
  <path d="M48 180 H292 L270 120 H70 Z" fill="#f0c14e" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M86 158 H250" stroke="#fff6d4" stroke-width="8" stroke-linecap="round"/>
  <circle cx="110" cy="148" r="6" fill="#f28b8b" stroke="${INK}" stroke-width="2"/>
  <circle cx="140" cy="148" r="6" fill="#7ec8e3" stroke="${INK}" stroke-width="2"/>
  <circle cx="170" cy="148" r="6" fill="#b6de8e" stroke="${INK}" stroke-width="2"/>
  <rect x="108" y="210" width="110" height="78" rx="10" fill="#2b2148" stroke="${INK}" stroke-width="6"/>
  <rect x="118" y="220" width="90" height="52" rx="6" fill="#6ec8e0"/>
  <path d="M132 246 H196" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
  <path d="M150 360 V300 Q150 284 176 284 Q202 284 202 300 V360" fill="#5b3d86" stroke="${INK}" stroke-width="5"/>
  <circle cx="190" cy="328" r="4" fill="#f6e27a"/>
  <path d="M300 250 Q332 230 328 200" stroke="#f0c14e" stroke-width="6" stroke-linecap="round"/>
  <circle cx="330" cy="190" r="10" fill="#f28b8b" stroke="${INK}" stroke-width="4"/>
`, 400, 430));

put("bloom.svg", svg(320, 320, `
  <ellipse cx="160" cy="250" rx="70" ry="14" fill="#7ea85a" opacity="0.4"/>
  <path d="M160 240 Q150 180 160 120" stroke="${LEAF_DARK}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="132" cy="180" rx="22" ry="10" fill="${LEAF}" stroke="${INK}" stroke-width="4" transform="rotate(-30 132 180)"/>
  <ellipse cx="190" cy="168" rx="22" ry="10" fill="${LEAF}" stroke="${INK}" stroke-width="4" transform="rotate(28 190 168)"/>
  ${[0, 60, 120, 180, 240, 300].map((a) => {
    const r = 28;
    const x = 160 + Math.cos((a * Math.PI) / 180) * r;
    const y = 100 + Math.sin((a * Math.PI) / 180) * r;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="16" ry="8" fill="#f4b4c4" stroke="${INK}" stroke-width="3" transform="rotate(${a} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join("")}
  <circle cx="160" cy="100" r="14" fill="#fff4b8" stroke="${INK}" stroke-width="4"/>
`, 320, 280));

put("bridge.svg", svg(420, 220, `
  <path d="M30 140 Q210 40 390 140" fill="none" stroke="${WOOD}" stroke-width="22" stroke-linecap="round"/>
  <path d="M30 140 Q210 40 390 140" fill="none" stroke="${INK}" stroke-width="6"/>
  <path d="M70 150 V110 M140 118 V78 M210 96 V58 M280 118 V78 M350 150 V110" stroke="${WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M40 150 Q210 60 380 150" fill="none" stroke="#e7c48a" stroke-width="4"/>
`, 420, 200));

put("cloud.svg", svg(420, 220, `
  <ellipse cx="150" cy="120" rx="80" ry="42" fill="#ffffff"/>
  <ellipse cx="230" cy="108" rx="96" ry="50" fill="#ffffff"/>
  <ellipse cx="300" cy="124" rx="70" ry="36" fill="#ffffff"/>
  <ellipse cx="210" cy="132" rx="120" ry="36" fill="#ffffff"/>
`, 420, 200));

function potBody({ leg = 0, squash = 1, arm = 0, blink = false }) {
  const y = 118 + (1 - squash) * 16;
  const h = 78 * squash;
  const eyeH = blink ? 2 : 8;
  const leftLeg = -10 + leg * 16;
  const rightLeg = 10 - leg * 16;
  return `
  <ellipse cx="100" cy="228" rx="46" ry="10" fill="#7ea85a" opacity="0.45"/>
  <ellipse cx="${78 + leftLeg}" cy="214" rx="12" ry="7" fill="${POT_DARK}" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="${122 + rightLeg}" cy="214" rx="12" ry="7" fill="${POT_DARK}" stroke="${INK}" stroke-width="4"/>
  <path d="M62 ${y} Q54 ${y + h} 70 ${y + h} H130 Q146 ${y + h} 138 ${y}" fill="${POT}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <ellipse cx="100" cy="${y}" rx="40" ry="10" fill="${POT_DARK}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="100" cy="${y + 4}" rx="28" ry="7" fill="#6b4a32"/>
  <ellipse cx="78" cy="${y + 36}" rx="7" ry="4" fill="#f7b7b0" opacity="0.9"/>
  <ellipse cx="122" cy="${y + 36}" rx="7" ry="4" fill="#f7b7b0" opacity="0.9"/>
  <ellipse cx="86" cy="${y + 28}" rx="5" ry="${eyeH}" fill="${INK}"/>
  <ellipse cx="114" cy="${y + 28}" rx="5" ry="${eyeH}" fill="${INK}"/>
  <path d="M92 ${y + 44} Q100 ${y + 52} 108 ${y + 44}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M${46 - arm} ${y + 30} Q${28 - arm * 2} ${y + 10} ${40 - arm} ${y - 4}" stroke="${POT}" stroke-width="10" stroke-linecap="round"/>
  <path d="M${154 + arm} ${y + 30} Q${172 + arm * 2} ${y + 10} ${160 + arm} ${y - 4}" stroke="${POT}" stroke-width="10" stroke-linecap="round"/>
  <path d="M${46 - arm} ${y + 30} Q${28 - arm * 2} ${y + 10} ${40 - arm} ${y - 4}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M${154 + arm} ${y + 30} Q${172 + arm * 2} ${y + 10} ${160 + arm} ${y - 4}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M92 ${y - 2} Q78 ${y - 50} 88 ${y - 78}" stroke="${LEAF_DARK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M108 ${y - 2} Q122 ${y - 54} 112 ${y - 86}" stroke="${LEAF}" stroke-width="7" stroke-linecap="round"/>
  <path d="M100 ${y - 4} Q100 ${y - 60} 100 ${y - 92}" stroke="#8ed06c" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="86" cy="${y - 78}" rx="12" ry="6" fill="${LEAF}" stroke="${INK}" stroke-width="3" transform="rotate(-30 86 ${y - 78})"/>
  <ellipse cx="114" cy="${y - 86}" rx="12" ry="6" fill="${LEAF_DARK}" stroke="${INK}" stroke-width="3" transform="rotate(24 114 ${y - 86})"/>
  <ellipse cx="100" cy="${y - 94}" rx="11" ry="6" fill="#b6de8e" stroke="${INK}" stroke-width="3"/>
`;
}

put("pibo-idle.svg", svg(200, 260, potBody({ leg: 0, squash: 1, arm: 0 })));
put("pibo-walk-1.svg", svg(200, 260, potBody({ leg: 1, squash: 0.96, arm: 0.6 })));
put("pibo-walk-2.svg", svg(200, 260, potBody({ leg: 0.2, squash: 1.06, arm: -0.2 })));
put("pibo-walk-3.svg", svg(200, 260, potBody({ leg: -1, squash: 0.96, arm: 0.6 })));
put("pibo-walk-4.svg", svg(200, 260, potBody({ leg: -0.2, squash: 1.05, arm: -0.2 })));

function swimFrame(phase) {
  // Face-down, seen from above. The pot lies horizontal.
  // phase 0 reach forward, 1 arms sweep out, 2 pull back + frog kick, 3 recovery.
  const arms = [
    { ax: 58, ay: 168, rot: -70, len: 34 },
    { ax: 78, ay: 150, rot: -20, len: 46 },
    { ax: 118, ay: 168, rot: 55, len: 40 },
    { ax: 70, ay: 162, rot: -50, len: 36 },
  ][phase];
  const kick = [6, 8, 28, 10][phase];
  const mirror = (rot) => -rot;
  const arm = (x, y, rot) => `
    <ellipse cx="${x}" cy="${y}" rx="${arms.len / 2}" ry="7" fill="${POT}" stroke="${INK}" stroke-width="4"
      transform="rotate(${rot} ${x} ${y})"/>`;
  return `
  <ellipse cx="100" cy="228" rx="86" ry="14" fill="#ffffff" opacity="0.45"/>
  <ellipse cx="100" cy="222" rx="70" ry="10" fill="#9fd4ea" opacity="0.7"/>
  ${arm(arms.ax, arms.ay, arms.rot)}
  ${arm(200 - arms.ax, 400 - arms.ay - 176, mirror(arms.rot))}
  <ellipse cx="108" cy="196" rx="62" ry="24" fill="${POT}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="108" cy="184" rx="28" ry="9" fill="#6b4a32" stroke="${INK}" stroke-width="3"/>
  <path d="M96 186 Q86 162 92 150" stroke="${LEAF_DARK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M118 184 Q128 158 122 146" stroke="${LEAF}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="90" cy="150" rx="11" ry="5" fill="${LEAF}" stroke="${INK}" stroke-width="3" transform="rotate(-20 90 150)"/>
  <ellipse cx="124" cy="146" rx="11" ry="5" fill="#b6de8e" stroke="${INK}" stroke-width="3" transform="rotate(18 124 146)"/>
  <ellipse cx="52" cy="196" rx="16" ry="14" fill="${POT_DARK}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="46" cy="194" rx="3.5" ry="3" fill="${INK}"/>
  <ellipse cx="56" cy="194" rx="3.5" ry="3" fill="${INK}"/>
  <path d="M44 202 Q40 210 48 208" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  <path d="M158 190 Q${176 + kick} ${176 - kick} ${184 + kick} 198" stroke="${POT}" stroke-width="9" stroke-linecap="round"/>
  <path d="M158 204 Q${176 + kick} ${214 + kick * 0.3} ${182 + kick} 196" stroke="${POT_DARK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M158 190 Q${176 + kick} ${176 - kick} ${184 + kick} 198" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M158 204 Q${176 + kick} ${214 + kick * 0.3} ${182 + kick} 196" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
`;
}
// pibo-swim-1..4.svg are hand-tuned face-down breaststroke frames.
// They are not regenerated here, so a rerun does not flatten the stroke.

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    const hit = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

const B = GROUND_BOUNDS;
const TW = 1500;
const TH = 1100;
const toSvg = (x, z) => {
  const u = (x - B.minX) / (B.maxX - B.minX);
  const v = (B.maxZ - z) / (B.maxZ - B.minZ);
  return [u * TW, v * TH];
};
const poly = LAND.home.map(([x, z]) => toSvg(x, z).map((n) => n.toFixed(1)).join(",")).join(" ");

let tufts = "";
let n = 0;
for (let x = -8; x <= 7; x += 0.85) {
  for (let z = -6; z <= 5.6; z += 0.85) {
    n++;
    if (!pointInPoly(x, z, LAND.home)) continue;
    if ((n * 17) % 5 === 0) continue;
    const [sx, sy] = toSvg(x, z);
    const shade = (n % 3 === 0) ? "#a9d27c" : (n % 3 === 1) ? "#c3e59a" : "#b7dc8c";
    const rx = 18 + (n % 4) * 6;
    const ry = 10 + (n % 3) * 3;
    tufts += `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${shade}" opacity="0.55"/>`;
  }
}

const dots = [];
let seed = 99;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed & 0xfffffff) / 0xfffffff;
};
for (let i = 0; i < 70; i++) {
  const x = -8 + rand() * 16;
  const z = -6 + rand() * 12;
  if (!pointInPoly(x + 0.4, z + 0.3, LAND.home)) continue;
  const [sx, sy] = toSvg(x, z);
  const color = ["#f4b4c4", "#fff4b8", "#ffffff", "#f7a0b4"][i % 4];
  dots.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${3 + (i % 3)}" fill="${color}" stroke="${INK}" stroke-width="2"/>`);
}

const pathPts = [
  [-5.2, -0.7],
  [-3.4, 0.35],
  [-1.5, 0.15],
  [-0.2, -1.5],
  [1.15, -2.0],
  [2.5, -0.7],
  [4.3, -0.15],
  [3.5, 1.3],
  [2.7, 2.9],
];
const pathD = pathPts.map((p, i) => {
  const [sx, sy] = toSvg(p[0], p[1]);
  return `${i === 0 ? "M" : "L"}${sx.toFixed(1)} ${sy.toFixed(1)}`;
}).join(" ");
const branch = [[-0.4, 0.2], [0.15, 1.05]].map((p, i) => {
  const [sx, sy] = toSvg(p[0], p[1]);
  return `${i === 0 ? "M" : "L"}${sx.toFixed(1)} ${sy.toFixed(1)}`;
}).join(" ");

put("island-top.svg", svg(TW, TH, `
  <polygon points="${poly}" fill="#c5e4a0"/>
  ${tufts}
  <polygon points="${poly}" fill="none" stroke="#f0d7a8" stroke-width="46" stroke-linejoin="round"/>
  <polygon points="${poly}" fill="none" stroke="#e7d3b4" stroke-width="18" stroke-linejoin="round" opacity="0.0"/>
  <path d="${pathD}" stroke="#e7c98a" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${pathD}" stroke="#f3ddb0" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${branch}" stroke="#f3ddb0" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots.join("")}
  <polygon points="${poly}" fill="none" stroke="#6d5346" stroke-width="6" stroke-linejoin="round"/>
`));

put("grass-tile.svg", svg(256, 256, `
  <rect width="256" height="256" fill="#b7dc8c"/>
  <ellipse cx="40" cy="50" rx="28" ry="14" fill="#c6e7a2" opacity="0.8"/>
  <ellipse cx="150" cy="80" rx="36" ry="16" fill="#a8d27c" opacity="0.7"/>
  <ellipse cx="80" cy="160" rx="30" ry="14" fill="#c6e7a2"/>
  <ellipse cx="190" cy="180" rx="34" ry="15" fill="#9ccc74" opacity="0.65"/>
  <ellipse cx="120" cy="220" rx="26" ry="12" fill="#d3eeb0"/>
  <circle cx="60" cy="120" r="4" fill="#fff" opacity="0.8"/>
  <circle cx="170" cy="140" r="3" fill="#f4b4c4"/>
  <circle cx="200" cy="60" r="3" fill="#fff4b8"/>
`));

put("cliff.svg", svg(512, 256, `
  <rect width="512" height="256" fill="#c9b6a2"/>
  <path d="M0 28 H512" stroke="#6d8a52" stroke-width="16"/>
  <path d="M0 40 H512" stroke="#e7d3b4" stroke-width="8"/>
  <path d="M0 70 Q80 60 140 78 T280 70 T420 82 T512 68" stroke="#b7a28e" stroke-width="10" fill="none"/>
  <path d="M0 110 Q100 96 180 116 T340 104 T512 118" stroke="#ddcfc0" stroke-width="12" fill="none"/>
  <path d="M0 150 Q90 140 160 158 T320 146 T512 160" stroke="#b7a28e" stroke-width="9" fill="none"/>
  <path d="M0 190 Q70 180 150 198 T300 184 T512 196" stroke="#d5c6b4" stroke-width="11" fill="none"/>
  <path d="M0 226 Q120 214 220 230 T400 220 T512 232" stroke="#aa987e" stroke-width="8" fill="none"/>
  <path d="M40 90 l18 22 M200 130 l14 18 M360 86 l16 20 M120 200 l12 16" stroke="#a89078" stroke-width="4" stroke-linecap="round"/>
`));

put("ocean.svg", svg(1024, 1024, `
  <defs>
    <radialGradient id="sea" cx="48%" cy="46%" r="62%">
      <stop offset="0" stop-color="#b7e4f4"/>
      <stop offset="0.45" stop-color="#8fd0e8"/>
      <stop offset="0.78" stop-color="#6ebcde"/>
      <stop offset="1" stop-color="#6ebcde" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#sea)"/>
  <g fill="none" stroke="#ffffff" stroke-linecap="round" opacity="0.45">
    <path d="M120 240 Q220 220 300 244" stroke-width="6"/>
    <path d="M180 250 Q260 236 330 252" stroke-width="4"/>
    <path d="M640 320 Q760 300 860 330" stroke-width="6"/>
    <path d="M700 340 Q800 328 880 346" stroke-width="4"/>
    <path d="M200 620 Q320 600 420 626" stroke-width="6"/>
    <path d="M260 640 Q360 628 440 646" stroke-width="4"/>
    <path d="M560 760 Q700 740 820 770" stroke-width="6"/>
    <path d="M140 800 Q240 784 320 806" stroke-width="5"/>
  </g>
  <g fill="#ffffff" opacity="0.35">
    <circle cx="240" cy="300" r="3"/><circle cx="780" cy="380" r="2.5"/>
    <circle cx="360" cy="700" r="3"/><circle cx="640" cy="640" r="2"/>
  </g>
`));

put("sky.svg", svg(1024, 512, `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9f2fc"/>
      <stop offset="0.55" stop-color="#c5e8f7"/>
      <stop offset="1" stop-color="#b7e0f3"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="512" fill="url(#sky)"/>
  <g fill="#ffffff">
    <ellipse cx="180" cy="150" rx="90" ry="36"/>
    <ellipse cx="260" cy="140" rx="100" ry="42"/>
    <ellipse cx="330" cy="156" rx="70" ry="30"/>
    <ellipse cx="620" cy="120" rx="110" ry="40"/>
    <ellipse cx="730" cy="130" rx="90" ry="36"/>
    <ellipse cx="860" cy="180" rx="80" ry="28"/>
    <ellipse cx="480" cy="200" rx="70" ry="24" opacity="0.85"/>
  </g>
`));

await mkdir(OUT, { recursive: true });
for (const [name, text] of files) {
  await writeFile(new URL(name, OUT), text);
}
console.log(`wrote ${files.size} placeholders`);
