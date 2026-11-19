/**
 * Guided start for an arcade game. The child keeps the decisions (idea,
 * hiding place, English clue). This module only offers chips and stitches
 * them into a treasure-hunt spec.
 *
 * Default wording is template-driven and stays inside the lesson frame.
 * Pass another stitcher to plug in an LLM later, same idea as
 * createIdeaGenerator({ stitch }):
 *
 *   stitch(lesson, answers) => spec | Promise<spec>
 *
 * The stitcher must return a treasure-hunt spec (see gameSpec.js), not code.
 * Art it invents should be marked author "ai". Child answers stay "child".
 */
import { FOOD_LIKES_LESSON } from "../data/lessons/foodLikes.js";
import { HIDE_SPOTS, hideSpot } from "../data/arcadeStickers.js";
import { buildTreasureSpec, ghostCastleTemplate, normalizeSpec } from "./gameSpec.js";

const KEY_SPOTS = ["door", "bed", "tree"];

function stance(lesson, polarity) {
  return lesson.pools.stance.find((item) => item.polarity === polarity) || lesson.pools.stance[0];
}

function food(lesson, id, fallbackIndex) {
  return lesson.pools.object.find((item) => item.id === id) || lesson.pools.object[fallbackIndex] || lesson.pools.object[0];
}

function clueLine(lesson, polarity, foodId, phrase, lead) {
  const voice = stance(lesson, polarity);
  const snack = food(lesson, foodId, polarity === "like" ? 0 : 3);
  return `${voice.grammar} ${snack.label}. ${lead} ${phrase}.`;
}

export function assistantQuestions(lesson = FOOD_LIKES_LESSON, answers = {}) {
  const key = hideSpot(answers.keyPlace || "door");
  const treasureChoices = HIDE_SPOTS.filter((spot) => spot.id !== key.id && spot.id !== "chest").slice(0, 3);
  const treasure = treasureChoices[0] || hideSpot("bed");
  return [
    {
      id: "idea",
      prompt: "Describe your game idea",
      hint: "You choose the story. The arcade only draws it.",
      placeholder: "Or type your own idea",
      chips: [
        { id: "ghost", label: "A ghost lost a treasure in a castle" },
        { id: "cat", label: "A cat hid a snack in a garden" },
      ],
    },
    {
      id: "keyPlace",
      prompt: "Where should the ghost look for the key?",
      hint: "This is the first obstacle.",
      placeholder: "Or type your own place",
      chips: KEY_SPOTS.map((id) => {
        const spot = hideSpot(id);
        const label = id === "door" ? "Behind a door" : id === "bed" ? "Under a bed" : "Next to a tree";
        return { id, label, place: spot.id };
      }),
    },
    {
      id: "clue",
      prompt: `Write a clue in English. Use “${lesson.grammar.frame}”.`,
      hint: "The words are yours. They tell a friend where to look.",
      placeholder: "Or type your own clue",
      chips: [
        {
          id: "like-key",
          label: clueLine(lesson, "like", "apples", key.phrase, "Look"),
          text: clueLine(lesson, "like", "apples", key.phrase, "Look"),
          place: key.id,
        },
        {
          id: "dislike-treasure",
          label: clueLine(lesson, "dislike", "spicy-food", treasure.phrase, "The treasure is"),
          text: clueLine(lesson, "dislike", "spicy-food", treasure.phrase, "The treasure is"),
          place: treasure.id,
        },
      ],
    },
  ];
}

/**
 * Turn answers into a spec. Pictures and positions stay template-authored.
 * Idea, key place, and clue text stay child-authored when the child supplied them.
 */
export function templateArcadeStitch(lesson, answers = {}) {
  const idea = String(answers.idea || "").trim();
  const key = hideSpot(answers.keyPlace || "door");
  const fromClue = answers.treasurePlace ? hideSpot(answers.treasurePlace) : null;
  let treasure = fromClue && fromClue.id !== key.id ? fromClue : HIDE_SPOTS.find((spot) => spot.id !== key.id && spot.id !== "chest");
  if (!treasure || treasure.id === key.id) treasure = hideSpot(key.id === "bed" ? "tree" : "bed");
  const garden = /garden|cat|snack/i.test(idea);
  const clue = String(answers.clue || "").trim();
  const like = stance(lesson, "like");
  const snack = food(lesson, "apples", 0);
  const dislike = stance(lesson, "dislike");
  const spicy = food(lesson, "spicy-food", 3);
  return buildTreasureSpec({
    title: idea || "The ghost's lost treasure",
    titleAuthor: idea ? "child" : "template",
    lessonId: lesson.id,
    goal: idea || "Help the ghost find the treasure",
    goalAuthor: idea ? "child" : "template",
    background: garden ? "garden" : "castle",
    backgroundAuthor: "template",
    hero: garden ? "cat" : "ghost",
    heroAuthor: "template",
    keyId: key.id,
    keyAuthor: answers.keyPlace ? "child" : "template",
    treasureId: treasure.id,
    treasureAuthor: answers.treasurePlace ? "child" : "template",
    clueText: clue || `${like.grammar} ${snack.label}. Look ${key.phrase}.`,
    clueAuthor: clue ? "child" : "template",
    clue2: `${dislike.grammar} ${spicy.label}. The treasure is ${treasure.phrase}.`,
    clue2Author: answers.treasurePlace ? "child" : "template",
    stepsAuthor: "template",
  });
}

export function createArcadeAssistant({ lesson = FOOD_LIKES_LESSON, stitch = templateArcadeStitch } = {}) {
  return {
    lesson,
    questions(answers) {
      return assistantQuestions(lesson, answers);
    },
    async finish(answers) {
      const drafted = await stitch(lesson, answers);
      return normalizeSpec(drafted, lesson);
    },
    template() {
      return ghostCastleTemplate(lesson);
    },
  };
}
