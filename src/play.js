import { Game } from "./core/Game.js";
import { UI } from "./ui/UI.js";
import { Lobby } from "./ui/Lobby.js";
import { Multiplayer } from "./net/Multiplayer.js";
import { startClassPulse } from "./class/report.js";

/**
 * Starts the island after a student has signed in.
 * `entry` is the class they belong to, plus the character they picked.
 */
export async function startGame(entry) {
  const canvas = document.getElementById("scene");
  const ui = new UI();
  const game = new Game(canvas, ui);
  canvas.addEventListener("pointerdown", () => canvas.focus());

  const scrollable = "input, textarea, select, #gate, .gate-card, .map-card, .collection, .arcade-log, .panel, .fact, .lobby-card, .world-people, .chat-log, .chat-quick, .npc-card, .npc-log, .npc-chips";
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
  if (entry?.pack) ui.setClassLesson(entry.pack);
  lobby.enter({
    world: entry.worldCode,
    name: entry.nickname,
    char: entry.char || "pibo",
    title: entry.worldTitle,
  });
  startClassPulse();
  document.documentElement.classList.add("playing");
  window.pibo = game;
}
