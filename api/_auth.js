/**
 * Teacher and student passwords. scrypt with a unique salt per account.
 * Sessions live in the class store and travel in an HttpOnly cookie.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
export const COOKIE = "pibo_session";

export function hashPassword(password) {
  const passSalt = randomBytes(16).toString("hex");
  const passHash = scryptSync(String(password), passSalt, 32, SCRYPT).toString("hex");
  return { passSalt, passHash };
}

export function verifyPassword(password, passSalt, passHash) {
  if (!passSalt || !passHash) return false;
  let prev;
  try {
    prev = Buffer.from(String(passHash), "hex");
  } catch {
    return false;
  }
  const next = scryptSync(String(password), String(passSalt), 32, SCRYPT);
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export function readCookie(req, name = COOKIE) {
  const raw = req?.headers?.cookie || req?.headers?.Cookie || "";
  const parts = String(raw).split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) return decodeURIComponent(part.slice(name.length + 1));
  }
  return "";
}

export function sessionCookie(token, maxAgeSec) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.VERCEL) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie() {
  const parts = [`${COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (process.env.VERCEL) parts.push("Secure");
  return parts.join("; ");
}

export function passwordProblem(password) {
  const value = String(password ?? "");
  if (value.length < 6) return "Use at least 6 characters.";
  if (value.length > 72) return "Use a password of 72 characters or fewer.";
  if (!value.trim()) return "Use at least 6 characters.";
  return "";
}
