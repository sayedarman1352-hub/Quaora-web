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
const CONTEXTUAL_INTENTS = new Set(["product", "size", "policy"]);
const PRODUCT_REFERENCE_PATTERN = /(mayo|bikini|mayokini|tankini|pareo|etek|ust|alt|ayakkabi|taki|canta|sapka|gozluk|plaj|aksesuar|top|bottom|pie|panzer|relove|coquette)/;
const FOLLOW_UP_PATTERN = /^(peki|ya|bu|bunun|bunlar|bunlardan|o|onun|ayrica|bir de)\b|\b(var mi|stokta mi|mevcut mu|ne kadar|kac gun|hangisi|hangileri|olur mu|uyar mi|rengi|bedeni|fiyati|materyali|kalibi|kargosu|iadesi|degisimi)\b/;
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
    const cleanHistory = sanitizeHistory(history);
    const intent = resolveConversationIntent(cleanMessage, cleanHistory);
    const contextMessage = buildConversationQuery(cleanMessage, cleanHistory, intent);

    if (STATIC_INTENTS.has(intent)) {
      return buildDeterministicReply({ message: cleanMessage, environment: "production", intent });
    }

    let products = [];
    let policies = {};

    const sizeReferencesProduct = intent === "size" && PRODUCT_REFERENCE_PATTERN.test(normalizeText(contextMessage));
    if (intent === "product" || sizeReferencesProduct) {
      try {
        const catalog = await catalogClient.getCatalog({ allowFixtureFallback: false });
        products = searchProducts(catalog.products, contextMessage, 5);
      } catch (error) {
        logger.error?.("Quaora agent catalog unavailable", safeLogCode(error));
        if (intent === "product") return CATALOG_UNAVAILABLE_REPLY;
      }
    }

    if (intent === "policy") {
      const policyData = await catalogClient.getPolicies({ allowFallback: true });
      policies = policyData.policies;
    }

    const policyExcerpts = intent === "policy" ? selectPolicyExcerpts(policies, contextMessage, 5) : [];
    const measurements = extractMeasurements(contextMessage);
    const garmentType = inferGarmentType(contextMessage, products);
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
          history: cleanHistory,
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
      message: contextMessage,
      products,
      policies,
      sizeAdvice,
      environment: "production",
      intent
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

function resolveConversationIntent(message, history = []) {
  const directIntent = classifyIntent(message);
  if (directIntent !== "out_of_scope") return directIntent;
  const normalized = normalizeText(message);
  if (!normalized || normalized.length > 120 || !FOLLOW_UP_PATTERN.test(normalized)) return directIntent;
  const previousCustomerTurn = [...history].reverse().find(item => item.role === "user" && String(item.content || "").trim());
  if (!previousCustomerTurn) return directIntent;
  const previousIntent = classifyIntent(previousCustomerTurn.content);
  return CONTEXTUAL_INTENTS.has(previousIntent) ? previousIntent : directIntent;
}

function buildConversationQuery(message, history = [], intent = classifyIntent(message)) {
  if (!CONTEXTUAL_INTENTS.has(intent)) return String(message || "").trim();
  const allowedPreviousIntents = intent === "size" ? new Set(["size", "product"]) : new Set([intent]);
  const previousTurns = history
    .filter(item => item.role === "user" && allowedPreviousIntents.has(classifyIntent(item.content)))
    .slice(-3)
    .map(item => String(item.content || "").trim())
    .filter(Boolean);
  return [...previousTurns, String(message || "").trim()].join("\n");
}

function safeLogCode(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  return status >= 400 && status <= 599 ? `status_${status}` : "request_failed";
}

module.exports = {
  CATALOG_UNAVAILABLE_REPLY,
  buildConversationQuery,
  createAgentService,
  resolveConversationIntent,
  sanitizeHistory,
  safeLogCode
};
