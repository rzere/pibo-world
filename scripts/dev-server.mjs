/**
 * Static site plus the /api routes. The island is plain ES modules;
 * `python -m http.server` still opens the pictures, but sign-in needs this.
 *
 *   node scripts/dev-server.mjs
 *   open http://localhost:8000
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
};

const routes = new Map([
  ["/api/auth", () => import("../api/auth.js")],
  ["/api/class", () => import("../api/class.js")],
  ["/api/npc", () => import("../api/npc.js")],
  ["/api/scene", () => import("../api/scene.js")],
  ["/api/arcade", () => import("../api/arcade.js")],
]);

function safeFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/teacher") rel = "/teacher/index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const full = path.normalize(path.join(root, rel));
  const fromRoot = path.relative(root, full);
  if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return full;
}

async function serveStatic(req, res, url) {
  const file = safeFile(url.pathname);
  if (!file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      res.writeHead(302, { location: `${url.pathname.replace(/\/$/, "")}/` });
      res.end();
      return;
    }
    const body = await readFile(file);
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function serveApi(req, res, url) {
  const load = routes.get(url.pathname);
  const mod = await load();
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }
  let settled = false;
  const nodeRes = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      if (settled) return;
      settled = true;
      res.writeHead(this.statusCode, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...this.headers,
      });
      res.end(JSON.stringify(obj));
    },
  };
  await mod.default({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body,
    query: Object.fromEntries(url.searchParams),
  }, nodeRes);
  if (!settled) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "No response" }));
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (routes.has(url.pathname)) await serveApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(err?.message || err));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Pibo World http://localhost:${port}`);
});
