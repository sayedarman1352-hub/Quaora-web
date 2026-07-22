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
  SECURITY_REFUSAL,
  searchProducts,
  selectPolicyExcerpts,
  normalizeText
} = require("../agent-test/lib/agent-core");
const { createCatalogClient } = require("../agent-test/lib/catalog-client");
const { createOpenAIIntentPlan, createOpenAIReply, DEFAULT_MODEL } = require("../agent-test/lib/openai-client");

const PRE_MODEL_STATIC_INTENTS = new Set(["security_sensitive"]);
const CONTEXTUAL_INTENTS = new Set(["product", "size", "policy", "support", "order_status", "greeting"]);
const PLANNER_REQUIRED_INTENTS = new Set(["product", "size", "policy"]);
const REPLY_MODEL_INTENTS = new Set(["product", "policy", "support", "order_status", "greeting"]);
const PRODUCT_REFERENCE_PATTERN = /(mayo|bikini|mayokini|tankini|pareo|etek|ust|alt|ayakkabi|taki|canta|sapka|gozluk|plaj|aksesuar|top|bottom|pie|panzer|relove|coquette)/;
const FOLLOW_UP_PATTERN = /^(peki|ya|bu|bunun|bunlar|bunlardan|o|onun|ayrica|bir de)\b|\b(var mi|stokta mi|mevcut mu|ne kadar|kac gun|hangisi|hangileri|olur mu|uyar mi|rengi|bedeni|fiyati|materyali|kalibi|kargosu|iadesi|degisimi)\b/;
const CLEARLY_OUT_OF_SCOPE_PATTERN = /(hava durumu|bugun hava|futbol|mac sonucu|borsa|kripto|siyaset|secim|yemek tarifi|python|javascript|kod yaz|siir yaz|hikaye yaz|matematik|ceviri yap)/;
const CATALOG_UNAVAILABLE_REPLY = "Şu anda ürün ve anlık stok bilgisini kontrol edemiyorum; yanlış bilgi vermek istemem. Biraz sonra yeniden deneyebilir veya destek ekibine ulaşabilirsin: https://www.quaora.com.tr/iletisim.html";
const CATALOG_UNAVAILABLE_REPEAT_REPLY = "Sorunun devam ettiğini anladım; seni aynı cevabı tekrarlayarak oyalamayayım. Ürün ve stok kontrolü şu anda kullanılamıyor. Destek ekibine buradan ulaşabilirsin: https://www.quaora.com.tr/iletisim.html";

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
    const mayNeedSemanticRescue = intent === "out_of_scope" && !CLEARLY_OUT_OF_SCOPE_PATTERN.test(normalizeText(cleanMessage));
    if (apiKey && (PLANNER_REQUIRED_INTENTS.has(intent) || mayNeedSemanticRescue)) {
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

    if (["security_sensitive", "out_of_scope"].includes(intent)) {
      return buildDeterministicReply({ message: cleanMessage, environment: "production", intent });
    }

    const serviceContext = buildCustomerServiceContext(cleanMessage, cleanHistory, intent, semanticPlan);

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
        if (intent === "product") return serviceContext.repeatedIssue ? CATALOG_UNAVAILABLE_REPEAT_REPLY : CATALOG_UNAVAILABLE_REPLY;
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
    const approvedAnswer = buildDeterministicReply({
      message: cleanMessage,
      contextMessage,
      products,
      policies,
      policyExcerpts,
      sizeAdvice,
      serviceContext,
      environment: "production",
      intent
    });

    if (intent === "size") return sanitizeAgentOutput(approvedAnswer);

    if (apiKey && REPLY_MODEL_INTENTS.has(intent)) {
      try {
        const result = await openAIReply({
          message: cleanMessage,
          history: cleanHistory,
          products,
          policyExcerpts,
          sizeAdvice,
          serviceContext,
          approvedAnswer,
          sessionId,
          apiKey,
          model,
          environment: "production"
        });
        const modelReply = sanitizeAgentOutput(result.text);
        if (modelReply === SECURITY_REFUSAL) return modelReply;
        return preservesCustomerServiceContract(modelReply, approvedAnswer) ? modelReply : sanitizeAgentOutput(approvedAnswer);
      } catch (error) {
        logger.error?.("Quaora agent response fallback", safeLogCode(error));
      }
    }

    return sanitizeAgentOutput(approvedAnswer);
  }

  return { answer };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-20).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").slice(0, 800)
  }));
}

function resolveConversationIntent(message, history = []) {
  const directIntent = classifyIntent(message);
  const normalized = normalizeText(message);
  const genericProblemFollowUp = /(hala|yine|tekrar|cozulmedi|devam ediyor|ise yaramadi|olmadi|bu cevap degil|anlamadin|kac kere|memnun degilim)/.test(normalized);
  const explicitlyRequestsHuman = /(musteri temsilcisi|yetkili|canli (?:biri|destek)|bir insanla)/.test(normalized);
  if (genericProblemFollowUp && !explicitlyRequestsHuman) {
    const recentIntent = [...history].reverse()
      .filter(item => item.role === "user")
      .map(item => classifyIntent(item.content))
      .find(candidate => ["product", "size", "policy", "support", "order_status"].includes(candidate));
    if (recentIntent) return recentIntent;
  }
  if (directIntent !== "out_of_scope") return directIntent;
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
  if (/^(ikisi de|fark etmez|farketmez|sen sec|hangisi uygunsa|ise yaramadi|olmadi|anlamadin)\b/.test(normalizedMessage)) return true;
  return /^(peki|ya|bu|bunun|bunda|buna|bunlar|o|onun|ayni|aynisi|aynisinin|daha|evet|hayir|siyah|beyaz|kirmizi|mavi|yesil|pembe|mor|sari)\b/.test(normalizedMessage)
    || /\b(olsun|olmasin|gecmesin|tercih ederim|seviyorum|istemiyorum|kaldı mi|kaldi mi|uyar mi|olur mu)\b/.test(normalizedMessage);
}

function buildConversationQuery(message, history = [], intent = classifyIntent(message)) {
  if (!CONTEXTUAL_INTENTS.has(intent)) return String(message || "").trim();
  const allowedPreviousIntents = intent === "size" ? new Set(["size", "product"]) : new Set([intent]);
  const previousTurns = history
    .filter(item => item.role === "user" && allowedPreviousIntents.has(classifyIntent(item.content)))
    .slice(-5)
    .map(item => String(item.content || "").trim())
    .filter(Boolean);
  return [...previousTurns, String(message || "").trim()].join("\n");
}

function detectCustomerIssue(value, fallbackIntent = "") {
  const text = normalizeText(value);
  if (/(karttan iki kere|fazla cekil|mukerrer|cift cekim)/.test(text)) return "duplicate_payment";
  if (/(odeme redded|odeme gecm|kart.*kabul|odeme yapam)/.test(text)) return "payment_failed";
  if (/(indirim kod|kupon).*(calism|olm|gecersiz)/.test(text)) return "discount_code";
  if (/(sifre|giris|uye ol|hesab).*(unutt|yapam|acilm|gelm)/.test(text)) return "account_access";
  if (/(siparis|kargo|paket).*(nerede|gelmedi|gecik|takip|ulasmadi)/.test(text)) return "order_delay";
  if (/(hasarli|kusurlu|yanlis urun|eksik urun|yirtik|lekeli)/.test(text)) return "damaged_or_wrong_item";
  if (/(iade|degisim|geri gonder|geri ver|yanlis beden)/.test(text)) return "return_or_exchange";
  if (/(musteri temsilcisi|yetkili|canli (?:biri|destek)|bir insanla|biriyle (?:gorus|konus))/.test(text)) return "human_support";
  if (fallbackIntent === "size") return "size_help";
  if (fallbackIntent === "product") return "product_selection";
  if (fallbackIntent === "policy") return "policy_question";
  if (fallbackIntent === "order_status") return "order_delay";
  return "general_support";
}

function buildCustomerServiceContext(message, history = [], intent = classifyIntent(message), semanticPlan = null) {
  const text = normalizeText(message);
  const issue = detectCustomerIssue(message, intent);
  const priorCustomerTurns = history.filter(item => item.role === "user").slice(-10);
  const priorIssues = priorCustomerTurns.map(item => detectCustomerIssue(item.content, classifyIntent(item.content)));
  const explicitlyRepeated = /(hala|yine|tekrar|cozulmedi|devam ediyor|ise yaramadi|kac kere|memnun degilim)/.test(text);
  const wantsHuman = Boolean(semanticPlan?.wantsHuman) || /(musteri temsilcisi|yetkili|canli (?:biri|destek)|bir insanla|biriyle (?:gorus|konus)|telefonla gorus)/.test(text);
  let sentiment = "neutral";
  if (/(acil|hemen|bugun lazim|simdi lazim)/.test(text)) sentiment = "urgent";
  else if (/(sinir|rezalet|sacma|berbat|biktim|kac kere|memnun degilim|hala|cozulmedi|ise yaramadi|anlamadin)/.test(text)) sentiment = "frustrated";
  else if (/(anlamadim|kafam karisti|emin degilim|kararsizim|nasil yani)/.test(text)) sentiment = "confused";
  else if (/(tesekkur|sag ol|harika|super)/.test(text)) sentiment = "positive";
  if (semanticPlan?.sentiment && semanticPlan.sentiment !== "neutral") sentiment = semanticPlan.sentiment;
  const repeatedIssue = explicitlyRepeated && priorIssues.includes(issue);
  let responseMode = intent === "support" ? "troubleshoot" : "answer";
  if (semanticPlan?.responseMode) responseMode = semanticPlan.responseMode;
  if (wantsHuman || repeatedIssue || (sentiment === "frustrated" && ["support", "order_status"].includes(intent))) responseMode = "handoff";
  return {
    issue,
    sentiment,
    responseMode,
    wantsHuman,
    repeatedIssue,
    customerNeed: String(semanticPlan?.customerNeed || "").trim().slice(0, 240)
  };
}

function safeLogCode(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  return status >= 400 && status <= 599 ? `status_${status}` : "request_failed";
}

function preservesCustomerServiceContract(reply, approvedAnswer) {
  const safeReply = String(reply || "").trim();
  const baseline = String(approvedAnswer || "").trim();
  if (!safeReply) return false;
  const baselineUrls = baseline.match(/https:\/\/www\.quaora\.com\.tr\/[A-Za-z0-9?&=._%/-]+/g) || [];
  const replyUrls = safeReply.match(/https:\/\/www\.quaora\.com\.tr\/[A-Za-z0-9?&=._%/-]+/g) || [];
  if (replyUrls.some(url => !baselineUrls.includes(url))) return false;
  const requiredContactUrls = baselineUrls.filter(url => /\/iletisim\.html(?:[?#]|$)/i.test(url));
  if (requiredContactUrls.some(url => !safeReply.includes(url))) return false;
  const normalized = normalizeText(safeReply);
  if (/(iadenizi baslattim|iadeyi baslattim|siparisinizi iptal ettim|siparisi iptal ettim|odemenizi iade ettim|kargo adresini degistirdim|hesabinizi actim)/.test(normalized)) return false;
  return true;
}

module.exports = {
  CATALOG_UNAVAILABLE_REPLY,
  CATALOG_UNAVAILABLE_REPEAT_REPLY,
  buildCustomerServiceContext,
  buildConversationQuery,
  createAgentService,
  preservesCustomerServiceContract,
  resolveConversationIntent,
  sanitizeHistory,
  safeLogCode
};
