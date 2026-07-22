"use strict";

const {
  buildDeterministicReply,
  classifyIntent,
  extractMeasurements,
  inferGarmentType,
  recommendSize,
  sanitizeAgentOutput,
  searchProducts,
  selectPolicyExcerpts,
  normalizeText
} = require("../agent-test/lib/agent-core");
const { createCatalogClient } = require("../agent-test/lib/catalog-client");
const { createOpenAIReply, DEFAULT_MODEL } = require("../agent-test/lib/openai-client");

const STATIC_INTENTS = new Set(["security_sensitive", "out_of_scope", "greeting", "order_status"]);
const CATALOG_UNAVAILABLE_REPLY = "Ürün ve anlık stok bilgisine şu anda erişemiyorum. Lütfen biraz sonra tekrar dene veya QUAORA iletişim kanalından destek iste.";

function createAgentService({
  catalogClient = createCatalogClient(),
  openAIReply = createOpenAIReply,
  apiKey = process.env.OPENAI_API_KEY || "",
  model = process.env.QUAORA_AGENT_MODEL || DEFAULT_MODEL,
  logger = console
} = {}) {
  async function answer({ message, history = [], sessionId = "" }) {
    const cleanMessage = String(message || "").trim();
    const intent = classifyIntent(cleanMessage);

    if (STATIC_INTENTS.has(intent)) {
      return buildDeterministicReply({ message: cleanMessage, environment: "production" });
    }

    let products = [];
    let policies = {};

    const sizeReferencesProduct = intent === "size" && /(mayo|bikini|mayokini|pareo|etek|ust|alt|pie|panzer|relove|coquette)/.test(normalizeText(cleanMessage));
    if (intent === "product" || sizeReferencesProduct) {
      try {
        const catalog = await catalogClient.getCatalog({ allowFixtureFallback: false });
        products = searchProducts(catalog.products, cleanMessage, 5);
      } catch (error) {
        logger.error?.("Quaora agent catalog unavailable", safeLogCode(error));
        if (intent === "product") return CATALOG_UNAVAILABLE_REPLY;
      }
    }

    if (intent === "policy") {
      const policyData = await catalogClient.getPolicies({ allowFallback: true });
      policies = policyData.policies;
    }

    const policyExcerpts = intent === "policy" ? selectPolicyExcerpts(policies, cleanMessage, 5) : [];
    const measurements = extractMeasurements(cleanMessage);
    const garmentType = inferGarmentType(cleanMessage, products);
    const availableSizes = products[0]
      ? Object.entries(products[0].sizeStocks || {}).filter(([, stock]) => Number(stock) > 0).map(([size]) => size)
      : [];
    const sizeAdvice = intent === "size"
      ? recommendSize({
          measurements,
          garmentType,
          fit: /rahat|bol/i.test(cleanMessage) ? "rahat" : "normal",
          availableSizes,
          environment: "production"
        })
      : null;

    if (apiKey) {
      try {
        const result = await openAIReply({
          message: cleanMessage,
          history: sanitizeHistory(history),
          products,
          policyExcerpts,
          sizeAdvice,
          sessionId,
          apiKey,
          model,
          environment: "production"
        });
        return sanitizeAgentOutput(result.text);
      } catch (error) {
        logger.error?.("Quaora agent response fallback", safeLogCode(error));
      }
    }

    return sanitizeAgentOutput(buildDeterministicReply({
      message: cleanMessage,
      products,
      policies,
      sizeAdvice,
      environment: "production"
    }));
  }

  return { answer };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-6).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").slice(0, 800)
  }));
}

function safeLogCode(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  return status >= 400 && status <= 599 ? `status_${status}` : "request_failed";
}

module.exports = {
  CATALOG_UNAVAILABLE_REPLY,
  createAgentService,
  sanitizeHistory,
  safeLogCode
};
