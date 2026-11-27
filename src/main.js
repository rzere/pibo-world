import { openGate } from "./gate/Gate.js";

/**
 * The island stays behind the door until a student signs in.
 * Teachers leave for the teacher desk.
 */
const entry = await openGate();
if (entry?.role === "student") {
  const { startGame } = await import("./play.js");
  await startGame(entry);
}
