/**
 * Demo class for screenshots and the thesis walkthrough.
 * Every person here is fictional. Passwords are scrypt hashes, never plain text.
 * The shared demo password is demo-class (see README).
 */
import { hashPassword } from "./_auth.js";
import { countTargets, lessonTargets } from "./_mistakes.js";

function tally(student, lessons) {
  const targets = lessonTargets(lessons);
  student.wordCounts = {};
  student.grammarCounts = {};
  const texts = [
    ...(student.lines || []).map((line) => line.text),
    ...(student.creations || []).map((item) => item.text),
  ];
  for (const text of texts) {
    const found = countTargets(text, targets);
    for (const [word, n] of Object.entries(found.words)) {
      student.wordCounts[word] = (student.wordCounts[word] || 0) + n;
    }
    for (const [phrase, n] of Object.entries(found.structures)) {
      student.grammarCounts[phrase] = (student.grammarCounts[phrase] || 0) + n;
    }
  }
  for (const mistake of student.mistakes || []) {
    if (mistake.kind !== "spelling") continue;
    const word = String(mistake.suggestion || "").trim();
    if (!word || /\s/.test(word)) continue;
    if (!targets.vocabulary.some((item) => item.toLowerCase() === word.toLowerCase())) continue;
    student.wordCounts[word] = (student.wordCounts[word] || 0) + 1;
  }
}

export function demoSeed() {
  const pass = hashPassword("demo-class");
  const lessons = [
    {
      id: "les_food",
      worldId: "w_mint",
      title: "Food I like",
      topic: "Food",
      vocabulary: ["apples", "bananas", "rice", "soup", "milk", "cookies"],
      grammar: ["I like", "I don't like"],
      text: "At a picnic, tell a friend what you like to eat.",
      active: true,
      order: 1,
    },
    {
      id: "les_garden",
      worldId: "w_mint",
      title: "In the garden",
      topic: "Garden",
      vocabulary: ["flowers", "trees", "birds", "rain", "sun"],
      grammar: ["There is", "There are"],
      text: "Look around the garden and say what you see.",
      active: false,
      order: 2,
    },
  ];

  const students = [
    {
      id: "s_lina",
      worldId: "w_mint",
      username: "lina",
      nickname: "Lina",
      ...pass,
      demo: true,
      createdAt: "2026-11-18T09:00:00.000Z",
      lastSeenAt: "2026-11-26T15:40:00.000Z",
      activeMs: 96 * 60 * 1000,
      sessions: 5,
      lines: [
        { at: "2026-11-24T10:05:00.000Z", source: "practice", text: "I likes apples." },
        { at: "2026-11-24T10:08:00.000Z", source: "practice", text: "I like bananas and milk." },
        { at: "2026-11-25T11:12:00.000Z", source: "practice", text: "I don't likes soup." },
        { at: "2026-11-25T11:14:00.000Z", source: "practice", text: "I like bananna." },
        { at: "2026-11-26T15:20:00.000Z", source: "practice", text: "Hello! I like apples." },
        { at: "2026-11-26T15:32:00.000Z", source: "studio", text: "I like milk." },
      ],
      creations: [
        {
          id: "c_lina_1",
          at: "2026-11-25T11:30:00.000Z",
          kind: "story",
          title: "Picnic",
          text: "Pibo is at a picnic. I like apples. I like bananas. I like milk. I don't like soup. Pibo is happy.",
        },
        {
          id: "c_lina_2",
          at: "2026-11-26T15:36:00.000Z",
          kind: "story",
          title: "Snack book",
          text: "Pibo is at the library. I like rice. I like cookies. I don't like soup. Pibo reads a little book. Pibo is happy.",
        },
        {
          id: "c_lina_3",
          at: "2026-11-24T10:20:00.000Z",
          kind: "idea",
          title: "Food I like",
          text: "A picky cat who likes apples. I like apples.",
        },
      ],
      mistakes: [
        {
          id: "m_lina_1",
          at: "2026-11-24T10:05:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "I likes",
          excerpt: "I likes apples.",
          detail: "After I, use like.",
          suggestion: "I like apples.",
          detector: "demo",
        },
        {
          id: "m_lina_2",
          at: "2026-11-25T11:12:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "I don't likes",
          excerpt: "I don't likes soup.",
          detail: "After don't, use like.",
          suggestion: "I don't like soup.",
          detector: "demo",
        },
        {
          id: "m_lina_3",
          at: "2026-11-25T11:14:00.000Z",
          source: "practice",
          kind: "spelling",
          pattern: "bananna",
          excerpt: "bananna",
          detail: "This looks like the class word “bananas”.",
          suggestion: "bananas",
          detector: "demo",
        },
      ],
    },
    {
      id: "s_omar",
      worldId: "w_mint",
      username: "omar",
      nickname: "Omar",
      ...hashPassword("demo-class"),
      demo: true,
      createdAt: "2026-11-18T09:10:00.000Z",
      lastSeenAt: "2026-11-26T14:10:00.000Z",
      activeMs: 48 * 60 * 1000,
      sessions: 3,
      lines: [
        { at: "2026-11-22T09:40:00.000Z", source: "practice", text: "I like appel." },
        { at: "2026-11-23T13:02:00.000Z", source: "practice", text: "She don't like cookies." },
        { at: "2026-11-23T13:06:00.000Z", source: "practice", text: "I like soda." },
        { at: "2026-11-26T14:02:00.000Z", source: "practice", text: "I likes milk." },
        { at: "2026-11-26T14:08:00.000Z", source: "arcade", text: "I like rice." },
      ],
      creations: [
        {
          id: "c_omar_1",
          at: "2026-11-23T13:20:00.000Z",
          kind: "story",
          title: "Lunch",
          text: "Pibo is at the garden. I like rice. I like milk. I don't like soup. Pibo is happy. Pibo reads the words again.",
        },
      ],
      mistakes: [
        {
          id: "m_omar_1",
          at: "2026-11-22T09:40:00.000Z",
          source: "practice",
          kind: "spelling",
          pattern: "appel",
          excerpt: "appel",
          detail: "This looks like the class word “apples”.",
          suggestion: "apples",
          detector: "demo",
        },
        {
          id: "m_omar_2",
          at: "2026-11-23T13:02:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "She don't",
          excerpt: "She don't like cookies.",
          detail: "After she, use doesn't.",
          suggestion: "She doesn't like cookies.",
          detector: "demo",
        },
        {
          id: "m_omar_3",
          at: "2026-11-23T13:06:00.000Z",
          source: "practice",
          kind: "word",
          pattern: "soda",
          excerpt: "soda",
          detail: "“soda” is not one of this week's words.",
          suggestion: "Try a class word such as milk.",
          detector: "demo",
        },
        {
          id: "m_omar_4",
          at: "2026-11-26T14:02:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "I likes",
          excerpt: "I likes milk.",
          detail: "After I, use like.",
          suggestion: "I like milk.",
          detector: "demo",
        },
      ],
    },
    {
      id: "s_mei",
      worldId: "w_mint",
      username: "mei",
      nickname: "Mei",
      ...hashPassword("demo-class"),
      demo: true,
      createdAt: "2026-11-19T08:30:00.000Z",
      lastSeenAt: "2026-11-25T16:05:00.000Z",
      activeMs: 31 * 60 * 1000,
      sessions: 2,
      lines: [
        { at: "2026-11-21T10:15:00.000Z", source: "practice", text: "Their is milk." },
        { at: "2026-11-21T10:18:00.000Z", source: "practice", text: "I am like cookies." },
        { at: "2026-11-25T16:01:00.000Z", source: "studio", text: "I like cookis." },
        { at: "2026-11-25T16:04:00.000Z", source: "practice", text: "I like milk." },
      ],
      creations: [
        {
          id: "c_mei_1",
          at: "2026-11-25T16:12:00.000Z",
          kind: "story",
          title: "Snack",
          text: "Pibo is at the island. I like milk. I like cookies. I like apples. Pibo is happy. Pibo says the words again.",
        },
      ],
      mistakes: [
        {
          id: "m_mei_1",
          at: "2026-11-21T10:15:00.000Z",
          source: "practice",
          kind: "spelling",
          pattern: "Their is",
          excerpt: "Their is milk.",
          detail: "For a place, write there.",
          suggestion: "There is milk.",
          detector: "demo",
        },
        {
          id: "m_mei_2",
          at: "2026-11-21T10:18:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "I am like",
          excerpt: "I am like cookies.",
          detail: "To talk about a favorite, say I like.",
          suggestion: "I like cookies.",
          detector: "demo",
        },
        {
          id: "m_mei_3",
          at: "2026-11-25T16:01:00.000Z",
          source: "studio",
          kind: "spelling",
          pattern: "cookis",
          excerpt: "cookis",
          detail: "This looks like the class word “cookies”.",
          suggestion: "cookies",
          detector: "demo",
        },
      ],
    },
    {
      id: "s_sam",
      worldId: "w_mint",
      username: "sam",
      nickname: "Sam",
      ...hashPassword("demo-class"),
      demo: true,
      createdAt: "2026-11-20T12:00:00.000Z",
      lastSeenAt: "2026-11-24T09:20:00.000Z",
      activeMs: 9 * 60 * 1000,
      sessions: 1,
      lines: [
        { at: "2026-11-24T09:12:00.000Z", source: "practice", text: "He like bananas." },
        { at: "2026-11-24T09:16:00.000Z", source: "practice", text: "I like rice." },
        { at: "2026-11-24T09:18:00.000Z", source: "practice", text: "Hello!" },
      ],
      creations: [],
      mistakes: [
        {
          id: "m_sam_1",
          at: "2026-11-24T09:12:00.000Z",
          source: "practice",
          kind: "grammar",
          pattern: "He like",
          excerpt: "He like bananas.",
          detail: "After he, use likes.",
          suggestion: "He likes bananas.",
          detector: "demo",
        },
      ],
    },
  ];

  for (const student of students) tally(student, lessons);

  return {
    version: 1,
    teachers: [
      {
        id: "t_demo",
        username: "demo",
        name: "Ms. Demo",
        ...pass,
        demo: true,
        createdAt: "2026-11-18T08:00:00.000Z",
      },
    ],
    worlds: [
      {
        id: "w_mint",
        teacherId: "t_demo",
        name: "Mint Garden",
        description: "Thursday English. Food words, then the garden. Demo class for the thesis — these students are not real children.",
        level: "A1 · ages 9–10",
        code: "mint-garden",
        demo: true,
        createdAt: "2026-11-18T08:30:00.000Z",
      },
    ],
    lessons,
    students,
    sessions: [],
  };
}
