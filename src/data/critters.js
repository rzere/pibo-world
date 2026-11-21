/**
 * Paria's eight animals. Each folder is her walk cycle, eight drawings:
 * front, three-quarter left, side left, back-three-quarter left,
 * front, three-quarter right, side right, back-three-quarter right.
 * Both sides are her drawings. The game does not mirror them.
 * They are smaller than Pibo. Pibo is the only pot.
 */
const UNIT = 0.0076;

// The files named "-left" face screen-right and "-right" face screen-left,
// so each slot loads the drawing that actually faces that way.
export const CRITTER_FRAME_NAMES = [
  "front-a",
  "three-right",
  "side-right",
  "back-right",
  "front-b",
  "three-left",
  "side-left",
  "back-left",
];

/**
 * Island friends you can talk to. `voice` is for the English tutor.
 * `hello` is the first line. `lines` are used when Claude is unavailable.
 */
export const NPCS = {
  cat: {
    name: "Cat",
    emoji: "🐱",
    voice: "a cozy cat who likes naps, yarn, and warm milk. Calm, soft, and a little sleepy.",
    hello: "Hello! I am Cat. I like quiet naps. How are you?",
    lines: [
      "I feel cozy today. Are you happy?",
      "I like warm milk. What food do you like?",
      "The sun is nice for a nap. Do you like the sun?",
    ],
  },
  dog: {
    name: "Dog",
    emoji: "🐶",
    voice: "a friendly dog who likes walks, balls, and saying hello. Cheerful, with short easy sentences.",
    hello: "Hi! I am Dog. I like walks. How are you?",
    lines: [
      "I like to run with friends. Do you like to run?",
      "A red ball is fun. What color do you like?",
      "I am happy to see you. Are you happy too?",
    ],
  },
  bunny: {
    name: "Bunny",
    emoji: "🐰",
    voice: "a gentle bunny who likes carrots, hopping, and soft grass. Quiet and kind.",
    hello: "Hello! I am Bunny. I like carrots. How are you?",
    lines: [
      "Hopping is fun. Can you hop?",
      "I like orange carrots. What food do you like?",
      "The grass is soft. Do you like green?",
    ],
  },
  panda: {
    name: "Panda",
    emoji: "🐼",
    voice: "a slow, kind panda who likes bamboo, snacks, and sitting still. Patient and warm.",
    hello: "Hello. I am Panda. I like bamboo. How are you?",
    lines: [
      "I like to sit and eat. What do you like to eat?",
      "Bamboo is green. What color do you like?",
      "I feel calm today. Are you calm or excited?",
    ],
  },
  frog: {
    name: "Frog",
    emoji: "🐸",
    voice: "a cheerful frog who likes ponds, rain, and jumping. Bouncy but still simple English.",
    hello: "Hello! I am Frog. I like to jump. How are you?",
    lines: [
      "I like the rain. Do you like rain?",
      "The pond is cool. Can you swim?",
      "I can jump high. Can you jump?",
    ],
  },
  penguin: {
    name: "Penguin",
    emoji: "🐧",
    voice: "a polite penguin who likes fish, sliding on ice, and good manners. Gentle and clear.",
    hello: "Hello! I am Penguin. I like fish. How are you?",
    lines: [
      "Please and thank you are kind words. What do you like?",
      "I like to slide. Do you like snow?",
      "Fish is my favorite food. What is your favorite food?",
    ],
  },
  unicorn: {
    name: "Unicorn",
    emoji: "🦄",
    voice: "a dreamy unicorn who likes stars, rainbows, and kind wishes. Soft and wonder-filled.",
    hello: "Hello! I am Unicorn. I like rainbows. How are you?",
    lines: [
      "I like pink and blue. What color do you like?",
      "Stars come out at night. Do you like stars?",
      "A wish can be small. What do you wish for?",
    ],
  },
  fox: {
    name: "Fox",
    emoji: "🦊",
    voice: "a playful fox who likes forests, questions, and little jokes. Curious and kind, never tricky in a mean way.",
    hello: "Hello! I am Fox. I like the forest. How are you?",
    lines: [
      "I like orange leaves. What color do you like?",
      "The forest is quiet. Do you like quiet or loud?",
      "I am curious about you. What do you like to do?",
    ],
  },
};

function critter(id, pixelWidth, pixelHeight, x, z, roam, speed, idle) {
  const frames = CRITTER_FRAME_NAMES.map((name) => `assets/critters/${id}/${name}.png`);
  const who = NPCS[id];
  return {
    id,
    name: who.name,
    emoji: who.emoji,
    hello: who.hello,
    lines: who.lines,
    src: frames[0],
    frames,
    pixelWidth,
    pixelHeight,
    width: Math.round(pixelWidth * UNIT * 1000) / 1000,
    height: Math.round(pixelHeight * UNIT * 1000) / 1000,
    x,
    z,
    roam,
    speed,
    idle,
  };
}

export const CRITTERS = [
  critter("cat", 114, 122, -6.4, 1.65, 0.26, 0.55, 8),
  critter("dog", 130, 106, -6.9, 3.7, 0.26, 0.6, 7),
  critter("bunny", 105, 131, -0.4, 4.75, 0.24, 0.58, 9),
  critter("panda", 109, 120, -6.55, -0.4, 0.22, 0.5, 10),
  critter("frog", 108, 112, 3.45, 5.15, 0.24, 0.62, 6.5),
  critter("penguin", 129, 110, 6.3, 2.45, 0.22, 0.52, 8.5),
  critter("unicorn", 123, 122, -9.35, 1.25, 0.26, 0.54, 9.5),
  critter("fox", 135, 125, -7.7, 5.05, 0.26, 0.6, 7.5),
];
