import { Game } from "./core/Game.js";
import { UI } from "./ui/UI.js";

/**
 * Pibo — Pocket Planet prototype.
 * Boots the UI overlay and the game, then starts the loop.
 */
const canvas = document.getElementById("scene");
const ui = new UI();
const game = new Game(canvas, ui);
canvas.addEventListener("pointerdown", () => canvas.focus());

// Play fills the screen. Block scroll, bounce, pinch, and double-tap zoom.
const scrollable = "input, textarea, select, .map-card, .collection, .arcade-log, .panel, .fact";
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1 || !e.target.closest(scrollable)) e.preventDefault();
}, { passive: false });
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
await game.preload();
game.start();
canvas.focus();

// handy for tinkering in the console
window.pibo = game;
