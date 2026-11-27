/**
 * One JSON document for teachers, students, worlds, and sessions.
 *
 * Locally (and in `node scripts/dev-server.mjs`) it is data/class-store.json.
 * On Vercel, set BLOB_READ_WRITE_TOKEN (Vercel Blob) so writes survive
 * between requests. Without that token the committed demo file is readable,
 * and writes fall back to /tmp, which disappears when the function sleeps.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoSeed } from "./_seed.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOB_PATH = "pibo-class-store.json";

let cache = null;
let mode = "file";
let chain = Promise.resolve();

function storePath() {
  return process.env.PIBO_STORE_PATH || path.join(ROOT, "data", "class-store.json");
}

function enqueue(job) {
  const run = chain.then(job, job);
  chain = run.then(() => {}, () => {});
  return run;
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function readBlob() {
  const token = blobToken();
  if (!token) return null;
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(BLOB_PATH, { access: "private", token, useCache: false });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    const name = err?.name || "";
    if (name === "BlobNotFoundError") return null;
    throw err;
  }
}

async function writeBlob(data) {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
    token: blobToken(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function readFileStore() {
  try {
    const text = await readFile(storePath(), "utf8");
    const data = JSON.parse(text);
    if (data && Array.isArray(data.teachers) && Array.isArray(data.worlds)) return data;
  } catch {
    // missing or unreadable
  }
  try {
    const text = await readFile("/tmp/pibo-class-store.json", "utf8");
    const data = JSON.parse(text);
    if (data && Array.isArray(data.teachers)) return data;
  } catch {
    // no temp copy
  }
  return null;
}

async function writeFileStore(data) {
  const file = storePath();
  const body = JSON.stringify(data, null, 2);
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    mode = blobToken() ? "blob" : "file";
    return;
  } catch {
    // The Vercel bundle is read-only outside /tmp.
  }
  await writeFile("/tmp/pibo-class-store.json", body);
  mode = "ephemeral";
}

function normalize(data) {
  data.teachers ||= [];
  data.students ||= [];
  data.worlds ||= [];
  data.lessons ||= [];
  data.sessions ||= [];
  data.version = 1;
  return data;
}

async function load() {
  if (cache) return cache;
  if (blobToken()) {
    try {
      const fromBlob = await readBlob();
      if (fromBlob) {
        cache = normalize(fromBlob);
        mode = "blob";
        return cache;
      }
    } catch {
      // Blob is configured but unreachable. Fall through to the file.
    }
  }
  const fromFile = await readFileStore();
  if (fromFile) {
    cache = normalize(fromFile);
    if (!blobToken()) mode = "file";
    return cache;
  }
  cache = normalize(demoSeed());
  await writeFileStore(cache);
  if (blobToken()) {
    try {
      await writeBlob(cache);
      mode = "blob";
    } catch {
      mode = "ephemeral";
    }
  }
  return cache;
}

async function persist(data) {
  cache = normalize(data);
  if (blobToken()) {
    try {
      await writeBlob(cache);
      mode = "blob";
      return;
    } catch {
      // Keep a local copy too when Blob fails.
    }
  }
  await writeFileStore(cache);
}

export function persistenceMode() {
  return mode;
}

export function update(mutator) {
  return enqueue(async () => {
    const data = await load();
    const result = await mutator(data);
    const next = result || data;
    await persist(next);
    return next;
  });
}

export async function readStore() {
  return enqueue(async () => load());
}

export function newId(prefix) {
  return `${prefix}_${randomHex(8)}`;
}

function randomHex(bytes) {
  return Array.from({ length: bytes }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
}
