/**
 * Demo lesson: food vocabulary inside the "I like / I don't like" frame.
 * The idea generator may only roll these pools — it does not invent snacks,
 * characters, or grammar outside this pack.
 *
 * Swap or extend the pools to configure another class. Slot objects need an
 * `id` and a `label`. Extra fields (emoji, article, goal, …) are copied onto
 * the rolled idea so a later whiteboard can read them.
 */
export const FOOD_LIKES_LESSON = {
  id: "food-likes",
  title: "Food likes",
  theme: "food",
  themeLabel: "Food",
  level: "beginner",
  tone: "friendly",
  grammar: {
    id: "like-dont-like",
    frame: "I like / I don't like",
  },
  pools: {
    subject: [
      { id: "boy", label: "shy boy", article: "A shy boy", who: "the boy", emoji: "👦" },
      { id: "girl", label: "curious girl", article: "A curious girl", who: "the girl", emoji: "👧" },
      { id: "dragon", label: "shy dragon", article: "A shy dragon", who: "the dragon", emoji: "🐉" },
      { id: "robot", label: "little robot", article: "A little robot", who: "the robot", emoji: "🤖" },
      { id: "cat", label: "picky cat", article: "A picky cat", who: "the cat", emoji: "🐱" },
      { id: "bird", label: "hungry bird", article: "A hungry bird", who: "the bird", emoji: "🐦" },
    ],
    stance: [
      {
        id: "like",
        label: "likes",
        verb: "likes",
        grammar: "I like",
        polarity: "like",
        goal: "share a favorite snack",
        emoji: "💛",
      },
      {
        id: "dislike",
        label: "doesn't like",
        verb: "doesn't like",
        grammar: "I don't like",
        polarity: "dislike",
        goal: "choose safe snacks",
        emoji: "🙅",
      },
    ],
    object: [
      { id: "apples", label: "apples", emoji: "🍎" },
      { id: "bananas", label: "bananas", emoji: "🍌" },
      { id: "spicy-noodles", label: "spicy noodles", emoji: "🍜" },
      { id: "spicy-food", label: "spicy food", emoji: "🌶️" },
      { id: "ice-cream", label: "ice cream", emoji: "🍦" },
      { id: "carrots", label: "carrots", emoji: "🥕" },
      { id: "rice", label: "rice", emoji: "🍚" },
      { id: "soup", label: "soup", emoji: "🍲" },
      { id: "cookies", label: "cookies", emoji: "🍪" },
      { id: "strawberries", label: "strawberries", emoji: "🍓" },
      { id: "milk", label: "milk", emoji: "🥛" },
    ],
    twist: [
      { id: "picnic", label: "at a picnic", kind: "place", clause: " at a picnic", emoji: "🧺" },
      { id: "cafe", label: "in the café", kind: "place", clause: " in the café", emoji: "☕" },
      { id: "garden", label: "in the garden", kind: "place", clause: " in the garden", emoji: "🌿" },
      { id: "friend", label: "with a friend", kind: "friend", clause: " with a friend", emoji: "🤝" },
      { id: "problem", label: "a tricky plate", kind: "problem", clause: " when the plate looks tricky", emoji: "🍽️" },
      { id: "none", label: "no extra twist", kind: "none", clause: "", emoji: "✨" },
    ],
  },
};
