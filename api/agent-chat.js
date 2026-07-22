"use strict";

const crypto = require("node:crypto");
const { createAgentService } = require("../lib/quaora-agent-service");

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_BODY_BYTES = 32_000;
const rateBuckets = new Map();

function createAgentHandler({ service = createAgentService(), now = () => Date.now() } = {}) {
  return async function handler(req, res) {
    setResponseHeaders(res);

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Yönteme izin verilmiyor." });
    }

    if (!isSameOrigin(req)) return res.status(403).json({ error: "İstek kaynağına izin verilmiyor." });
    if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
      return res.status(415).json({ error: "İstek biçimi desteklenmiyor." });
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_BODY_BYTES) return res.status(413).json({ error: "İstek çok büyük." });

    const clientKey = getClientKey(req);
    if (!consumeRateLimit(clientKey, now())) {
      return res.status(429).json({ error: "Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar dene." });
    }

    try {
      const body = parseBody(req.body);
      if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
        return res.status(413).json({ error: "İstek çok büyük." });
      }

      const message = String(body.message || "").trim();
      if (!message) return res.status(400).json({ error: "Mesaj boş olamaz." });
      if (message.length > 1200) return res.status(400).json({ error: "Mesaj en fazla 1200 karakter olabilir." });

      const reply = await service.answer({
        message,
        history: Array.isArray(body.history) ? body.history.slice(-20) : [],
        sessionId: String(body.sessionId || "").slice(0, 100)
      });
      return res.status(200).json({ reply });
    } catch (error) {
      console.error("Quaora agent request failed", safeErrorCode(error));
      return res.status(502).json({ error: "Şu anda yanıt oluşturulamıyor. Lütfen daha sonra tekrar dene." });
    }
  };
}

function parseBody(body) {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString("utf8") || "{}");
  return JSON.parse(String(body || "{}"));
}

function isSameOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers.host || "");
  } catch {
    return false;
  }
}

function getClientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.socket?.remoteAddress || "unknown";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function consumeRateLimit(key, timestamp) {
  if (rateBuckets.size > 5_000) rateBuckets.clear();
  const current = rateBuckets.get(key);
  if (!current || timestamp - current.startedAt >= WINDOW_MS) {
    rateBuckets.set(key, { startedAt: timestamp, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

function setResponseHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function safeErrorCode(error) {
  return error instanceof SyntaxError ? "invalid_json" : "request_failed";
}

const handler = createAgentHandler();
module.exports = handler;
module.exports.createAgentHandler = createAgentHandler;
module.exports.consumeRateLimit = consumeRateLimit;
module.exports.isSameOrigin = isSameOrigin;
module.exports.parseBody = parseBody;
