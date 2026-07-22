"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const agentHandler = require("../api/agent-chat");

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.QUAORA_PREVIEW_PORT || 4180);
const host = "127.0.0.1";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === "/api/agent-chat") {
    attachVercelResponseHelpers(res);
    try {
      req.body = await readJsonBody(req, 32_000);
    } catch {
      return res.status(400).json({ error: "Geçersiz istek." });
    }
    return agentHandler(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "Yönteme izin verilmiyor.");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(rootDir, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(`${rootDir}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendText(res, 404, "Bulunamadı.");
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
  };
  res.writeHead(200, { "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
});

function attachVercelResponseHelpers(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value));
    return res;
  };
}

function sendText(res, status, value) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(value);
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > maxBytes) reject(new Error("too_large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

server.listen(port, host, () => console.log(`QUAORA production preview: http://${host}:${port}`));
