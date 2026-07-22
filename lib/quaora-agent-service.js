"use strict";

const {
  buildDeterministicReply,
  classifyIntent,
  expectedMeasurementFields,
  extractContextualMeasurements,
  inferGarmentType,
  isBareMeasurementReply,
  recommendSize,
  resolveProductReferences,
  sanitizeAgentOutput,
  searchProducts,
  selectPolicyExcerpts,
  normalizeText
} = require("../agent-test/lib/agent-core");
const { createCatalogClient } = require("../agent-test/lib/catalog-client");
const { createOpenAIIntentPlan, createOpenAIReply, DEFAULT_MODEL } = require("../agent-test/lib/openai-client");

const PRE_MODEL_STATIC_INTENTS = new Set(["security_sensitive", "greeting", "order_status", "support"]);
const CONTEXTUAL_INTENTS = new Set(["product", "size", "policy", "support"]);
const PRODUCT_REFERENCE_PATTERN = /(mayo|bikini|mayokini|tankini|pareo|etek|ust|alt|ayakkabi|taki|canta|sapka|gozluk|plaj|aksesuar|top|bottom|pie|panzer|relove|coquette)/;
const FOLLOW_UP_PATTERN = /^(peki|ya|bu|bunun|bunlar|bunlardan|o|onun|ayrica|bir de)\b|\b(var mi|stokta mi|mevcut mu|ne kadar|kac gun|hangisi|hangileri|olur mu|uyar mi|rengi|bedeni|fiyati|materyali|kalibi|kargosu|iadesi|degisimi)\b/;
const CATALOG_UNAVAILABLE_REPLY = "Ürün ve anlık stok bilgisine şu anda erişemiyorum. Lütfen biraz sonra tekrar dene veya QUAORA iletişim kanalından destek iste.";

function createAgentService({
  catalogClient = createCatalogClient(),
  openAIPlanner = createOpenAIIntentPlan,
  openAIReply = createOpenAIReply,
  apiKey = process.env.OPENAI_API_KEY || "",
  model = process.env.QUAORA_AGENT_MODEL || DEFAULT_MODEL,
  logger = console
} = {}) {
  async function answer({ message, history = [], sessionId = "" }) {
    const cleanMessage = String(message || "").trim();
    const cleanHistory = sanitizeHistory(history);
    let intent = resolveConversationIntent(cleanMessage, cleanHistory);

    if (PRE_MODEL_STATIC_INTENTS.has(intent)) {
      return buildDeterministicReply({ message: cleanMessage, environment: "production", intent });
    }

    let semanticPlan = null;
    if (apiKey && CONTEXTUAL_INTENTS.has(intent)) {
      try {
        semanticPlan = await openAIPlanner({
          message: cleanMessage,
          history: cleanHistory,
          sessionId,
          apiKey,
          model
        });
        if (semanticPlan.intent === "security_sensitive") intent = "security_sensitive";
        else if (intent === "out_of_scope" || (semanticPlan.confidence === "high" && CONTEXTUAL_INTENTS.has(semanticPlan.intent))) {
          intent = semanticPlan.intent;
        }
      } catch (error) {
        logger.error?.("Quaora agent planning fallback", safeLogCode(error));
      }
    }

    if (["security_sensitive", "out_of_scope", "greeting", "order_status", "support"].includes(intent)) {
      return buildDeterministicReply({ message: cleanMessage, environment: "production", intent });
    }

    const baseContextMessage = buildConversationQuery(cleanMessage, cleanHistory, intent);
    const contextMessage = semanticPlan?.searchQuery && CONTEXTUAL_INTENTS.has(intent)
      ? `${baseContextMessage}\n${semanticPlan.searchQuery}`
      : baseContextMessage;

    let products = [];
    let policies = {};

    const sizeReferencesProduct = intent === "size" && PRODUCT_REFERENCE_PATTERN.test(normalizeText(contextMessage));
    if (intent === "product" || sizeReferencesProduct) {
      try {
        const catalog = await catalogClient.getCatalog({ allowFixtureFallback: false });
        const referencedProducts = resolveProductReferences(catalog.products, cleanMessage, cleanHistory);
        products = searchProducts(catalog.products, contextMessage, 5, {
          currentMessage: cleanMessage,
          referencedProducts
        });
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
    const garmentType = inferGarmentType(contextMessage, products);
    const measurementContext = extractContextualMeasurements(cleanMessage, {
      history: cleanHistory,
      contextMessage,
      garmentType
    });
    const availableSizes = products[0]
      ? Object.entries(products[0].sizeStocks || {}).filter(([, stock]) => Number(stock) > 0).map(([size]) => size)
      : [];
    const sizeAdvice = intent === "size"
      ? recommendSize({
          measurements: measurementContext.measurements,
          garmentType,
          fit: /rahat|bol/i.test(cleanMessage) ? "rahat" : "normal",
          availableSizes,
          environment: "production",
          invalidFields: measurementContext.invalidFields,
          ambiguous: measurementContext.ambiguous
        })
      : null;

    // Beden hesabı yalnızca sunucunun doğruladığı yapılandırılmış ölçü sonucundan
    // üretilir. Böylece bir dil modeli bağımsız beden veya stok bilgisi uyduramaz.
    if (intent === "size") {
      return sanitizeAgentOutput(buildDeterministicReply({
        message: cleanMessage,
        contextMessage,
        products,
        policies,
        policyExcerpts,
        sizeAdvice,
        environment: "production",
        intent
      }));
    }

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
      message: cleanMessage,
      contextMessage,
      products,
      policies,
      policyExcerpts,
      sizeAdvice,
      environment: "production",
      intent
    }));
  }

  return { answer };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").slice(0, 800)
  }));
}

function resolveConversationIntent(message, history = []) {
  const directIntent = classifyIntent(message);
  if (directIntent !== "out_of_scope") return directIntent;
  const normalized = normalizeText(message);
  if (!normalized || normalized.length > 120) return directIntent;
  const previousCustomerTurn = [...history].reverse().find(item => item.role === "user" && String(item.content || "").trim());
  const previousIntent = previousCustomerTurn ? classifyIntent(previousCustomerTurn.content) : directIntent;
  if (isBareMeasurementReply(message)) {
    // Tarayıcı geçmişi güvenilmezdir; burada yalnızca izin verilen ölçü alanlarının
    // sırasını ve önceki müşteri niyetini seçmek için kullanılır, gerçek kabul edilmez.
    const hasRecentSizeRequest = [...history].reverse().some(item => item.role === "user" && classifyIntent(item.content) === "size");
    if (expectedMeasurementFields(history).length || previousIntent === "size" || hasRecentSizeRequest) return "size";
    const hasRecentProductRequest = [...history].reverse().some(item => item.role === "user" && classifyIntent(item.content) === "product");
    if (hasRecentProductRequest) return "product";
    return directIntent;
  }
  const recentContextIntent = [...history].reverse()
    .filter(item => item.role === "user")
    .map(item => classifyIntent(item.content))
    .find(intent => CONTEXTUAL_INTENTS.has(intent));
  if ((!FOLLOW_UP_PATTERN.test(normalized) && !looksLikeContextualFollowUp(normalized)) || !recentContextIntent) return directIntent;
  return recentContextIntent;
}

function looksLikeContextualFollowUp(normalizedMessage) {
  return /^(peki|ya|bu|bunun|bunda|buna|bunlar|o|onun|ayni|aynisi|aynisinin|daha|evet|hayir|siyah|beyaz|kirmizi|mavi|yesil|pembe|mor|sari)\b/.test(normalizedMessage)
    || /\b(olsun|olmasin|gecmesin|tercih ederim|seviyorum|istemiyorum|kaldı mi|kaldi mi|uyar mi|olur mu)\b/.test(normalizedMessage);
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
