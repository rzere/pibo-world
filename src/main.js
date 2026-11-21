import { Game } from "./core/Game.js";
import { UI } from "./ui/UI.js";
import { Lobby } from "./ui/Lobby.js";
import { Multiplayer } from "./net/Multiplayer.js";

/**
 * Pibo — Pocket Planet prototype.
 * Boots the UI overlay and the game, then starts the loop.
 */
const canvas = document.getElementById("scene");
const ui = new UI();
const game = new Game(canvas, ui);
canvas.addEventListener("pointerdown", () => canvas.focus());

// Play fills the screen. Block scroll, bounce, pinch, and double-tap zoom.
const scrollable = "input, textarea, select, .map-card, .collection, .arcade-log, .panel, .fact, .lobby-card, .world-people, .chat-log, .chat-quick, .npc-card, .npc-log, .npc-chips";
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1 || !e.target.closest(scrollable)) e.preventDefault();
}, { passive: false });
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
const qr = document.getElementById("qr-overlay");
const setQr = (open) => qr.classList.toggle("hidden", !open);
document.getElementById("qr-btn").addEventListener("click", () => setQr(true));
for (const close of qr.querySelectorAll("[data-qr-close]")) close.addEventListener("click", () => setQr(false));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !qr.classList.contains("hidden")) setQr(false);
});

await game.preload();
game.start();

const lobby = new Lobby();
game.lobby = lobby;
game.multiplayer = new Multiplayer(game, lobby);

// handy for tinkering in the console
window.pibo = game;
