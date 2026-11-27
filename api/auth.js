/**
 * POST /api/auth  { action, username, password, name?, code?, nickname? }
 * GET  /api/auth  current session, or { role: null }
 *
 * Teachers sign themselves up. Students sign up with a class code.
 * No email is collected.
 */
import { readBody } from "./_claude.js";
import {
  SESSION_MS,
  clearCookie,
  hashPassword,
  newToken,
  passwordProblem,
  readCookie,
  sessionCookie,
  verifyPassword,
} from "./_auth.js";
import { newId, readStore, update } from "./_store.js";
import { packFromLesson } from "../src/class/lessonPack.js";
import { cleanCode, cleanDisplayName, cleanUsername, validUsername } from "../src/class/codes.js";

function send(res, status, body, cookie) {
  res.setHeader("Cache-Control", "no-store");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.status(status).json(body);
}

export function clientSession(data, session) {
  if (!session) return { role: null };
  if (session.role === "teacher") {
    const teacher = data.teachers.find((item) => item.id === session.accountId);
    if (!teacher) return { role: null };
    return {
      role: "teacher",
      username: teacher.username,
      name: teacher.name,
      demo: !!teacher.demo,
    };
  }
  const student = data.students.find((item) => item.id === session.accountId);
  if (!student) return { role: null };
  const world = data.worlds.find((item) => item.id === student.worldId) || null;
  const lessons = data.lessons
    .filter((item) => item.worldId === student.worldId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const active = lessons.find((item) => item.active) || lessons[0] || null;
  return {
    role: "student",
    username: student.username,
    nickname: student.nickname,
    demo: !!student.demo,
    world: world
      ? {
          id: world.id,
          code: world.code,
          name: world.name,
          level: world.level || "",
          description: world.description || "",
        }
      : null,
    pack: active ? packFromLesson(active, world || {}) : null,
    lessonTitle: active?.title || "",
  };
}

export async function sessionFromRequest(req) {
  const token = readCookie(req);
  if (!token) return null;
  const data = await readStore();
  const now = Date.now();
  return (data.sessions || []).find((item) => item.token === token && item.expiresAt > now) || null;
}

function usernameTaken(data, username) {
  return data.teachers.some((item) => item.username === username)
    || data.students.some((item) => item.username === username);
}

function openSession(data, role, accountId) {
  const now = Date.now();
  data.sessions = (data.sessions || []).filter((item) => item.expiresAt > now);
  const token = newToken();
  data.sessions.push({ token, role, accountId, expiresAt: now + SESSION_MS });
  return token;
}

export default async function handler(req, res) {
  try {
    await route(req, res);
  } catch {
    send(res, 500, { error: "Sign-in could not be saved." });
  }
}

async function route(req, res) {
  if (req.method === "GET") {
    const data = await readStore();
    const session = await sessionFromRequest(req);
    send(res, 200, clientSession(data, session));
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "POST only" });
    return;
  }
  const body = readBody(req);
  const action = String(body.action || "");

  if (action === "signout") {
    const token = readCookie(req);
    await update((data) => {
      data.sessions = (data.sessions || []).filter((item) => item.token !== token);
    });
    send(res, 200, { ok: true }, clearCookie());
    return;
  }

  const username = cleanUsername(body.username);
  if (!validUsername(username)) {
    send(res, 400, { error: "Usernames are 3–16 letters, numbers, or hyphens." });
    return;
  }
  if (action === "teacher-signup" || action === "student-signup") {
    const passwordError = passwordProblem(body.password);
    if (passwordError) {
      send(res, 400, { error: passwordError });
      return;
    }
  } else if (!String(body.password ?? "").length) {
    send(res, 400, { error: "Username or password is wrong." });
    return;
  }

  if (action === "teacher-signup" || action === "student-signup") {
    let created = null;
    let error = "";
    await update((data) => {
      if (usernameTaken(data, username)) {
        error = "That username is taken. Try another.";
        return;
      }
      if (action === "teacher-signup") {
        const name = cleanDisplayName(body.name, 32);
        if (name.length < 2) {
          error = "Add the name students will see.";
          return;
        }
        const teacher = {
          id: newId("t"),
          username,
          name,
          ...hashPassword(body.password),
          demo: false,
          createdAt: new Date().toISOString(),
        };
        data.teachers.push(teacher);
        const token = openSession(data, "teacher", teacher.id);
        created = { token, session: clientSession(data, { role: "teacher", accountId: teacher.id, expiresAt: Date.now() + SESSION_MS }) };
        return;
      }
      const code = cleanCode(body.code);
      const world = data.worlds.find((item) => item.code === code);
      if (!world) {
        error = "That class code was not found. Ask your teacher.";
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
        lastSeenAt: new Date().toISOString(),
        activeMs: 0,
        sessions: 0,
        wordCounts: {},
        grammarCounts: {},
        lines: [],
        creations: [],
        mistakes: [],
      };
      data.students.push(student);
      const token = openSession(data, "student", student.id);
      created = { token, session: clientSession(data, { role: "student", accountId: student.id, expiresAt: Date.now() + SESSION_MS }) };
    });
    if (error) {
      send(res, error.includes("taken") ? 409 : 400, { error });
      return;
    }
    send(res, 200, created.session, sessionCookie(created.token, Math.floor(SESSION_MS / 1000)));
    return;
  }

  if (action === "teacher-signin" || action === "student-signin") {
    const expected = action === "teacher-signin" ? "teacher" : "student";
    const data = await readStore();
    const teacher = data.teachers.find((item) => item.username === username);
    const student = data.students.find((item) => item.username === username);
    const account = teacher || student;
    const role = teacher ? "teacher" : student ? "student" : "";
    if (!account || !verifyPassword(body.password, account.passSalt, account.passHash)) {
      send(res, 401, { error: "Username or password is wrong." });
      return;
    }
    if (role !== expected) {
      send(res, 403, {
        error: role === "student"
          ? "That username is a student. Choose I am a student."
          : "That username is a teacher. Choose I am a teacher.",
      });
      return;
    }
    let token = "";
    await update((fresh) => {
      token = openSession(fresh, role, account.id);
    });
    const fresh = await readStore();
    send(res, 200, clientSession(fresh, { role, accountId: account.id, expiresAt: Date.now() + SESSION_MS }), sessionCookie(token, Math.floor(SESSION_MS / 1000)));
    return;
  }

  send(res, 400, { error: "Unknown action" });
}
