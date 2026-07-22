"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const {
  buildDeterministicReply,
  extractContextualMeasurements,
  inferGarmentType,
  recommendSize,
  resolveProductReferences,
  sanitizeAgentOutput,
  SECURITY_REFUSAL,
  searchProducts,
  selectPolicyExcerpts
} = require("./lib/agent-core");
const { createCatalogClient } = require("./lib/catalog-client");
const { createOpenAIReply, DEFAULT_MODEL } = require("./lib/openai-client");
const {
  buildConversationQuery,
  buildCustomerServiceContext,
  preservesCustomerServiceContract,
  resolveConversationIntent,
  sanitizeHistory
} = require("../lib/quaora-agent-service");

loadLocalEnv(path.join(__dirname, ".env.agent-test.local"));

const publicDir = path.join(__dirname, "public");
const rateBuckets = new Map();

function createServer(options = {}) {
  const catalogClient = options.catalogClient || createCatalogClient();
  const mode = options.mode || process.env.QUAORA_AGENT_MODE || "mock";
  const model = options.model || process.env.QUAORA_AGENT_MODEL || DEFAULT_MODEL;
  const openAIReply = options.openAIReply || createOpenAIReply;

  return http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        return sendJson(res, 200, {
          ok: true,
          testEnvironment: true,
          productionIntegrated: false
        });
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
          return sendJson(res, 415, { error: "İstek biçimi desteklenmiyor." });
        }
        if (!consumeRateLimit(req.socket.remoteAddress || "local")) {
          return sendJson(res, 429, { error: "Çok fazla test isteği gönderildi. Bir dakika sonra tekrar dene." });
        }
        const body = await readJson(req, 32_000);
        const message = String(body.message || "").trim();
        if (!message) return sendJson(res, 400, { error: "Mesaj boş olamaz." });
        if (message.length > 1200) return sendJson(res, 400, { error: "Mesaj en fazla 1200 karakter olabilir." });
        const history = sanitizeHistory(body.history);
        const intent = resolveConversationIntent(message, history);
        const contextMessage = buildConversationQuery(message, history, intent);
        if (["security_sensitive", "out_of_scope"].includes(intent)) {
          return sendJson(res, 200, {
            reply: buildDeterministicReply({ message, intent }),
            test: true
          });
        }
        const serviceContext = buildCustomerServiceContext(message, history, intent);
        if (["greeting", "order_status", "support"].includes(intent)) {
          const approvedAnswer = buildDeterministicReply({ message, intent, serviceContext });
          if (mode === "openai") {
            const result = await openAIReply({
              message,
              history,
              serviceContext,
              approvedAnswer,
              sessionId: body.sessionId,
              model
            });
            const modelReply = sanitizeAgentOutput(result.text);
            const reply = modelReply === SECURITY_REFUSAL || preservesCustomerServiceContract(modelReply, approvedAnswer)
              ? modelReply
              : approvedAnswer;
            return sendJson(res, 200, { reply, test: true });
          }
          return sendJson(res, 200, { reply: approvedAnswer, test: true });
        }
        const [catalog, policyData] = await Promise.all([catalogClient.getCatalog(), catalogClient.getPolicies()]);
        const referencedProducts = resolveProductReferences(catalog.products, message, history);
        const products = searchProducts(catalog.products, contextMessage, 5, { currentMessage: message, referencedProducts });
        const policyExcerpts = selectPolicyExcerpts(policyData.policies, contextMessage, 5);
        const garmentType = inferGarmentType(contextMessage, products);
        const measurementContext = extractContextualMeasurements(message, { history, contextMessage, garmentType });
        const availableSizes = products[0]
          ? Object.entries(products[0].sizeStocks || {}).filter(([, stock]) => Number(stock) > 0).map(([size]) => size)
          : [];
        const sizeAdvice = intent === "size"
          ? recommendSize({
              measurements: measurementContext.measurements,
              garmentType,
              fit: /rahat|bol/i.test(message) ? "rahat" : "normal",
              availableSizes,
              invalidFields: measurementContext.invalidFields,
              ambiguous: measurementContext.ambiguous
            })
          : null;

        const approvedAnswer = buildDeterministicReply({
          message,
          contextMessage,
          products,
          policies: policyData.policies,
          policyExcerpts,
          sizeAdvice,
          serviceContext,
          intent
        });

        if (mode === "openai" && intent !== "size") {
          const result = await openAIReply({
            message,
            history,
            products,
            policyExcerpts,
            sizeAdvice,
            serviceContext,
            approvedAnswer,
            sessionId: body.sessionId,
            model
          });
          const modelReply = sanitizeAgentOutput(result.text);
          return sendJson(res, 200, {
            reply: modelReply === SECURITY_REFUSAL || preservesCustomerServiceContract(modelReply, approvedAnswer)
              ? modelReply
              : sanitizeAgentOutput(approvedAnswer),
            test: true
          });
        }

        return sendJson(res, 200, {
          reply: sanitizeAgentOutput(approvedAnswer),
          test: true
        });
      }

      if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "API yolu bulunamadı." });
      if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "Yönteme izin verilmiyor." });
      return serveStatic(url.pathname, req.method, res);
    } catch (error) {
      const status = error.code === "INVALID_JSON" ? 400 : error.code === "PAYLOAD_TOO_LARGE" ? 413 : 502;
      if (status >= 500) console.error("Agent request failed", String(error?.message || "unknown").slice(0, 180));
      return sendJson(res, status, { error: safeError(error, status) });
    }
  });
}

function serveStatic(pathname, method, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDir, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(`${publicDir}${path.sep}`)) return sendJson(res, 403, { error: "Geçersiz dosya yolu." });
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendJson(res, 404, { error: "Sayfa bulunamadı." });
  const extension = path.extname(filePath).toLowerCase();
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, { "Content-Type": types[extension] || "application/octet-stream", "Cache-Control": "no-store" });
  if (method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) {
        const error = new Error("İstek gövdesi çok büyük.");
        error.code = "PAYLOAD_TOO_LARGE";
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch {
        const error = new Error("Geçersiz JSON.");
        error.code = "INVALID_JSON";
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function consumeRateLimit(key) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 30;
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(payload);
}

function safeError(error, status = 500) {
  if (status >= 500) return "Şu anda yanıt oluşturulamıyor. Lütfen daha sonra tekrar dene.";
  const message = String(error?.message || "Bilinmeyen hata");
  if (/api[_ -]?key|authorization|bearer|firebase|firestore|openai|vercel/i.test(message)) return "İstek işlenemedi.";
  return message.slice(0, 300);
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

if (require.main === module) {
  const port = Number(process.env.QUAORA_AGENT_PORT || 4173);
  const host = "127.0.0.1";
  createServer().listen(port, host, () => {
    console.log(`QUAORA agent test ortamı: http://${host}:${port}`);
    console.log(`Mod: ${process.env.QUAORA_AGENT_MODE || "mock"} | Canlı site entegrasyonu: HAYIR`);
  });
}

module.exports = { createServer, loadLocalEnv, readJson, safeError };
