/**
 * Shared 2D play head for a treasure-hunt spec.
 * It only reads data. It does not eval text or run generated code.
 */
import { read } from "./gameSpec.js";

export function createTreasurePlay(spec) {
  const obstacle = spec.obstacles[0];
  const steps = read(spec.steps);
  const keyIn = read(obstacle.keyHidesIn);
  const lockId = read(obstacle.lockId);
  const treasureIn = read(obstacle.treasureHidesIn);
  let index = 0;
  let haveKey = false;
  let lockOpen = false;
  let won = false;

  function clue(about) {
    const found = (spec.clues || []).find((item) => item.about === about && item.text);
    return found?.text || "";
  }

  function click(objectId) {
    if (won) return { won: true, message: "You already found the treasure!" };
    const step = steps[index];
    if (step === "key") {
      if (objectId !== keyIn) {
        if (objectId === lockId) return { message: "It's locked. Find the key first." };
        return { message: "Not here. Read the clue." };
      }
      haveKey = true;
      index += 1;
      return { found: "key", message: clue("key") || "You found the key!" };
    }
    if (step === "lock") {
      if (objectId !== lockId) return { message: "Open the lock next." };
      const keyFirst = steps.indexOf("key") >= 0 && steps.indexOf("key") < steps.indexOf("lock");
      if (keyFirst && !haveKey) return { message: "It's locked. Find the key first." };
      lockOpen = true;
      index += 1;
      if (steps[index] === "treasure" && treasureIn === lockId) {
        won = true;
        index += 1;
        return { won: true, found: "treasure", message: clue("treasure") || "You found the treasure!" };
      }
      return { found: "lock", message: "The lock opens." };
    }
    if (step === "treasure") {
      if (objectId !== treasureIn) return { message: "Keep looking. Follow the clue." };
      won = true;
      index += 1;
      return { won: true, found: "treasure", message: clue("treasure") || "You found the treasure!" };
    }
    return { message: "Try another spot." };
  }

  return {
    click,
    clueForStep() {
      const step = steps[index];
      if (step === "key") return clue("key");
      if (step === "treasure" || step === "lock") return clue("treasure") || clue("key");
      return "";
    },
    get state() {
      return { index, step: steps[index] || "done", haveKey, lockOpen, won, steps };
    },
  };
}
