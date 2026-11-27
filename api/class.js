/**
 * Class worlds, teacher material, and student records.
 *
 * GET  /api/class?code=mint-garden   public name check for sign-up
 * POST /api/class  { action, ... }   teacher or student, from the session cookie
 */
import { readBody } from "./_claude.js";
import { sessionFromRequest } from "./auth.js";
import { hashPassword, passwordProblem } from "./_auth.js";
import { countTargets, detectMistakes, lessonTargets } from "./_mistakes.js";
import { summarize } from "./_summary.js";
import { newId, persistenceMode, readStore, update } from "./_store.js";
import { cleanCode, cleanDisplayName, cleanUsername, makeCode, validUsername } from "../src/class/codes.js";

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function queryOf(req) {
  if (req.query && typeof req.query === "object" && Object.keys(req.query).length) return req.query;
  try {
    return Object.fromEntries(new URL(req.url || "/", "http://localhost").searchParams);
  } catch {
    return {};
  }
}

function lessonsFor(data, worldId) {
  return data.lessons
    .filter((item) => item.worldId === worldId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function studentsFor(data, worldId) {
  return data.students.filter((item) => item.worldId === worldId);
}

function viewStudent(student) {
  return {
    id: student.id,
    worldId: student.worldId,
    username: student.username,
    nickname: student.nickname,
    demo: !!student.demo,
    createdAt: student.createdAt,
    lastSeenAt: student.lastSeenAt || "",
    activeMs: student.activeMs || 0,
    sessions: student.sessions || 0,
    wordCounts: student.wordCounts || {},
    grammarCounts: student.grammarCounts || {},
    lines: [...(student.lines || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))),
    creations: [...(student.creations || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))),
    mistakes: [...(student.mistakes || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}

function viewWorld(data, world) {
  const lessons = lessonsFor(data, world.id);
  const students = studentsFor(data, world.id);
  const active = lessons.find((item) => item.active) || null;
  return {
    id: world.id,
    name: world.name,
    description: world.description || "",
    level: world.level || "",
    code: world.code,
    demo: !!world.demo,
    createdAt: world.createdAt,
    students: students.length,
    lessons: lessons.length,
    activeLesson: active?.title || "",
  };
}

function listLines(raw, { max = 20, itemMax = 40, commas = false } = {}) {
  const source = Array.isArray(raw) ? raw : String(raw || "").split(commas ? /[\n,]/ : /\n/);
  const out = [];
  for (const item of source) {
    const clean = String(item || "").trim().replace(/\s+/g, " ").slice(0, itemMax);
    if (!clean) continue;
    if (out.some((line) => line.toLowerCase() === clean.toLowerCase())) continue;
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function addCounts(student, text, targets) {
  const found = countTargets(text, targets);
  student.wordCounts ||= {};
  student.grammarCounts ||= {};
  for (const [word, n] of Object.entries(found.words)) {
    student.wordCounts[word] = (student.wordCounts[word] || 0) + n;
  }
  for (const [phrase, n] of Object.entries(found.structures)) {
    student.grammarCounts[phrase] = (student.grammarCounts[phrase] || 0) + n;
  }
}

function pushCap(list, item, max) {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const code = cleanCode(queryOf(req).code);
      if (!code) {
        send(res, 400, { error: "Add a class code." });
        return;
      }
      const data = await readStore();
      const world = data.worlds.find((item) => item.code === code);
      if (!world) {
        send(res, 404, { error: "That class code was not found." });
        return;
      }
      send(res, 200, { code: world.code, name: world.name, level: world.level || "" });
      return;
    }
    if (req.method !== "POST") {
      send(res, 405, { error: "POST only" });
      return;
    }

    const body = readBody(req);
    const action = String(body.action || "");
    const session = await sessionFromRequest(req);
    if (!session) {
      send(res, 401, { error: "Sign in first." });
      return;
    }

    if (session.role === "student") {
      await studentAction(res, session, action, body);
      return;
    }
    if (session.role !== "teacher") {
      send(res, 403, { error: "Teachers only." });
      return;
    }
    await teacherAction(res, session, action, body);
  } catch (err) {
    send(res, 500, { error: "The class record could not be saved." });
  }
}

async function teacherAction(res, session, action, body) {
  let payload = null;
  let status = 200;

  await update((data) => {
    const teacher = data.teachers.find((item) => item.id === session.accountId);
    if (!teacher) {
      status = 401;
      payload = { error: "Sign in first." };
      return;
    }
    const own = (worldId) => data.worlds.find((item) => item.id === worldId && item.teacherId === teacher.id);

    if (action === "list") {
      payload = {
        persistence: persistenceMode(),
        worlds: data.worlds.filter((item) => item.teacherId === teacher.id).map((item) => viewWorld(data, item)),
      };
      return;
    }

    if (action === "createWorld") {
      const name = cleanDisplayName(body.name, 40);
      if (name.length < 2) {
        status = 400;
        payload = { error: "Give the class world a name." };
        return;
      }
      const world = {
        id: newId("w"),
        teacherId: teacher.id,
        name,
        description: cleanDisplayName(body.description, 280),
        level: cleanDisplayName(body.level, 40),
        code: makeCode(new Set(data.worlds.map((item) => item.code))),
        demo: false,
        createdAt: new Date().toISOString(),
      };
      data.worlds.push(world);
      payload = { world: viewWorld(data, world), persistence: persistenceMode() };
      return;
    }

    if (action === "detail" || action === "updateWorld" || action === "deleteWorld" || action === "saveLesson" || action === "deleteLesson" || action === "createStudent") {
      const world = own(String(body.worldId || ""));
      if (!world) {
        status = 404;
        payload = { error: "That class world was not found." };
        return;
      }

      if (action === "updateWorld") {
        const name = cleanDisplayName(body.name, 40);
        if (name.length < 2) {
          status = 400;
          payload = { error: "Give the class world a name." };
          return;
        }
        world.name = name;
        world.description = cleanDisplayName(body.description, 280);
        world.level = cleanDisplayName(body.level, 40);
      }

      if (action === "deleteWorld") {
        const ids = new Set(studentsFor(data, world.id).map((item) => item.id));
        data.lessons = data.lessons.filter((item) => item.worldId !== world.id);
        data.students = data.students.filter((item) => item.worldId !== world.id);
        data.sessions = data.sessions.filter((item) => !ids.has(item.accountId));
        data.worlds = data.worlds.filter((item) => item.id !== world.id);
        payload = { ok: true };
        return;
      }

      if (action === "saveLesson") {
        const title = cleanDisplayName(body.title, 60);
        if (title.length < 2) {
          status = 400;
          payload = { error: "Give the unit a title." };
          return;
        }
        const vocabulary = listLines(body.vocabulary, { max: 40, itemMax: 32, commas: true });
        const grammar = listLines(body.grammar, { max: 8, itemMax: 80 });
        const text = cleanDisplayName(body.text, 600);
        const topic = cleanDisplayName(body.topic, 40);
        let lesson = data.lessons.find((item) => item.id === body.id && item.worldId === world.id);
        if (!lesson) {
          lesson = {
            id: newId("les"),
            worldId: world.id,
            order: lessonsFor(data, world.id).length + 1,
            active: lessonsFor(data, world.id).length === 0,
          };
          data.lessons.push(lesson);
        }
        lesson.title = title;
        lesson.topic = topic;
        lesson.vocabulary = vocabulary;
        lesson.grammar = grammar;
        lesson.text = text;
        if (body.active) {
          for (const item of lessonsFor(data, world.id)) item.active = item.id === lesson.id;
        }
      }

      if (action === "deleteLesson") {
        const before = lessonsFor(data, world.id);
        const target = before.find((item) => item.id === body.id);
        if (!target) {
          status = 404;
          payload = { error: "That unit was not found." };
          return;
        }
        data.lessons = data.lessons.filter((item) => item.id !== target.id);
        const left = lessonsFor(data, world.id);
        if (target.active && left[0]) left[0].active = true;
      }

      if (action === "createStudent") {
        const username = cleanUsername(body.username);
        if (!validUsername(username)) {
          status = 400;
          payload = { error: "Usernames are 3–16 letters, numbers, or hyphens." };
          return;
        }
        const passwordError = passwordProblem(body.password);
        if (passwordError) {
          status = 400;
          payload = { error: passwordError };
          return;
        }
        const taken = data.teachers.some((item) => item.username === username)
          || data.students.some((item) => item.username === username);
        if (taken) {
          status = 409;
          payload = { error: "That username is taken. Try another." };
          return;
        }
        const nickname = cleanDisplayName(body.nickname, 16) || username.slice(0, 1).toUpperCase() + username.slice(1);
        const student = {
          id: newId("s"),
          worldId: world.id,
          username,
          nickname,
          ...hashPassword(body.password),
          demo: false,
          createdAt: new Date().toISOString(),
          lastSeenAt: "",
          activeMs: 0,
          sessions: 0,
          wordCounts: {},
          grammarCounts: {},
          lines: [],
          creations: [],
          mistakes: [],
        };
        data.students.push(student);
      }

      if (status !== 200) return;
      const units = lessonsFor(data, world.id);
      if (units.length && !units.some((item) => item.active)) units[0].active = true;
      const lessons = lessonsFor(data, world.id);
      const students = studentsFor(data, world.id).map(viewStudent);
      payload = {
        persistence: persistenceMode(),
        world: viewWorld(data, world),
        lessons,
        students,
        summary: summarize(lessons, studentsFor(data, world.id)),
      };
      return;
    }

    status = 400;
    payload = { error: "Unknown action" };
  });

  send(res, status, payload || { error: "Nothing to show." });
}

async function studentAction(res, session, action, body) {
  if (action !== "pulse" && action !== "logEnglish" && action !== "logCreation") {
    send(res, 403, { error: "Students use the island, not the teacher desk." });
    return;
  }

  let status = 200;
  let payload = { ok: true };
  const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, action === "logCreation" ? 2000 : 400);

  let detected = { mistakes: [], source: "rules" };
  if (action === "logEnglish" && text) {
    const data = await readStore();
    const student = data.students.find((item) => item.id === session.accountId);
    const lessons = student ? lessonsFor(data, student.worldId) : [];
    detected = await detectMistakes(text, lessonTargets(lessons));
  }

  await update((data) => {
    const student = data.students.find((item) => item.id === session.accountId);
    if (!student) {
      status = 401;
      payload = { error: "Sign in first." };
      return;
    }
    const now = new Date().toISOString();
    student.lastSeenAt = now;
    const lessons = lessonsFor(data, student.worldId);
    const targets = lessonTargets(lessons);

    if (action === "pulse") {
      const seconds = Math.max(0, Math.min(30, Number(body.seconds) || 0));
      if (body.start) student.sessions = (student.sessions || 0) + 1;
      student.activeMs = (student.activeMs || 0) + seconds * 1000;
      return;
    }

    if (!text) {
      status = 400;
      payload = { error: "Add a sentence first." };
      return;
    }

    if (action === "logEnglish") {
      const source = String(body.source || "practice").slice(0, 24);
      addCounts(student, text, targets);
      student.lines ||= [];
      pushCap(student.lines, { at: now, source, text }, 40);
      for (const mistake of detected.mistakes) {
        student.mistakes ||= [];
        pushCap(student.mistakes, {
          id: newId("m"),
          at: now,
          source,
          kind: mistake.kind,
          pattern: mistake.pattern,
          excerpt: mistake.excerpt,
          detail: mistake.detail,
          suggestion: mistake.suggestion,
          detector: detected.source,
        }, 80);
      }
      payload = { ok: true, mistakes: detected.mistakes.length };
      return;
    }

    const kind = ["story", "idea", "show", "arcade"].includes(body.kind) ? body.kind : "story";
    addCounts(student, text, targets);
    student.creations ||= [];
    pushCap(student.creations, {
      id: newId("c"),
      at: now,
      kind,
      title: cleanDisplayName(body.title, 80),
      text,
    }, 40);
  });

  send(res, status, payload);
}
