"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDeterministicReply, normalizeProduct } = require("../lib/agent-core");
const {
  buildCustomerServiceContext,
  CATALOG_UNAVAILABLE_REPEAT_REPLY,
  createAgentService,
  preservesCustomerServiceContract,
  resolveConversationIntent,
  sanitizeHistory
} = require("../../lib/quaora-agent-service");

const silentLogger = { error() {} };

test("Çözülmeyen sipariş sorununu önceki bağlama bağlar ve doğrudan insan desteğine taşır", () => {
  const history = [
    { role: "user", content: "Kargom nerede, paketim gelmedi" },
    { role: "assistant", content: "Sipariş durumu için destek ekibine ulaşabilirsin." }
  ];
  const message = "Hâlâ çözülmedi, kaç kere yazacağım?";
  const intent = resolveConversationIntent(message, history);
  const context = buildCustomerServiceContext(message, history, intent);
  const reply = buildDeterministicReply({ message, intent, serviceContext: context, environment: "production" });

  assert.equal(intent, "order_status");
  assert.equal(context.sentiment, "frustrated");
  assert.equal(context.repeatedIssue, true);
  assert.equal(context.responseMode, "handoff");
  assert.match(reply, /aynı bilgileri tekrar/i);
  assert.match(reply, /iletisim\.html/);
  assert.match(reply, /yalnızca resmi formda/i);
});

test("Genel memnuniyetsizlik mesajını son ürün amacından koparmaz", () => {
  const history = [
    { role: "user", content: "Siyah, 2000 TL altı bir mayo öner" },
    { role: "assistant", content: "İki seçenek buldum." }
  ];
  assert.equal(resolveConversationIntent("Bu cevap olmadı, işe yaramadı", history), "product");
  assert.equal(resolveConversationIntent("Fark etmez, sen seç", history), "product");
});

test("Ödeme sorununu tek tip destek metnine düşürmeden güvenli ve konuya özel yanıtlar", () => {
  const message = "Karttan iki kere çekilmiş";
  const context = buildCustomerServiceContext(message, [], "support");
  const reply = buildDeterministicReply({ message, intent: "support", serviceContext: context, environment: "production" });
  assert.equal(context.issue, "duplicate_payment");
  assert.match(reply, /iki kez görünmesi/i);
  assert.match(reply, /kişisel ya da ödeme bilgisi/i);
  assert.match(reply, /CVV/i);
  assert.match(reply, /iletisim\.html/);
});

test("Model yanıtına müşteri ihtiyacını ve güvenli çözüm tabanını birlikte verir", async () => {
  let captured;
  let catalogCalls = 0;
  let plannerCalls = 0;
  const service = createAgentService({
    catalogClient: {
      getCatalog: async () => { catalogCalls += 1; return { products: [] }; },
      getPolicies: async () => { catalogCalls += 1; return { policies: {} }; }
    },
    apiKey: "test-key",
    openAIPlanner: async () => { plannerCalls += 1; throw new Error("Doğrudan destek niyetinde ikinci model çağrısı yapılmamalı"); },
    openAIReply: async args => {
      captured = args;
      return { text: "Aynı ödemenin iki kez görünmesi can sıkıcı. Seni destek ekibine yönlendireyim: https://www.quaora.com.tr/iletisim.html" };
    },
    logger: silentLogger
  });

  const reply = await service.answer({ message: "Karttan iki kere çekilmiş, biriyle görüşmek istiyorum" });
  assert.equal(catalogCalls, 0);
  assert.equal(plannerCalls, 0);
  assert.equal(captured.serviceContext.issue, "duplicate_payment");
  assert.equal(captured.serviceContext.responseMode, "handoff");
  assert.match(captured.approvedAnswer, /kişisel ya da ödeme bilgisi/i);
  assert.match(reply, /destek ekibine/i);
});

test("Anahtar kelimeye sığmayan alışveriş niyetini semantik planla ürün desteğine çevirir", async () => {
  let capturedProducts = [];
  const giftProduct = normalizeProduct({
    id: "gift-pareo",
    collection: "pareolar",
    name: "Siyah zarif pareo",
    color: "Siyah",
    salePrice: 1200,
    sizeStocks: { STD: 2 }
  });
  const service = createAgentService({
    catalogClient: {
      getCatalog: async () => ({ products: [giftProduct] }),
      getPolicies: async () => ({ policies: {} })
    },
    apiKey: "test-key",
    openAIPlanner: async () => ({
      intent: "product",
      searchQuery: "siyah zarif pareo hediye",
      confidence: "high",
      customerNeed: "Şık bir hediye seçmek",
      sentiment: "neutral",
      responseMode: "answer",
      wantsHuman: false
    }),
    openAIReply: async args => {
      capturedProducts = args.products;
      return { text: `Hediye için bu pareoya bakabilirsin: ${giftProduct.url}` };
    },
    logger: silentLogger
  });

  const reply = await service.answer({ message: "Yakın bir arkadaşım için zarif bir hediye arıyorum" });
  assert.equal(capturedProducts[0].name, "Siyah zarif pareo");
  assert.match(reply, /pareoya/i);
});

test("Model resmi yönlendirmeyi atar veya yapılmamış işlem sözü verirse güvenli tabanı korur", () => {
  const baseline = "Destek ekibine ulaş: https://www.quaora.com.tr/iletisim.html";
  assert.equal(preservesCustomerServiceContract("Destek ekibine haber verdim.", baseline), false);
  assert.equal(preservesCustomerServiceContract("Siparişinizi iptal ettim. https://www.quaora.com.tr/iletisim.html", baseline), false);
  assert.equal(preservesCustomerServiceContract(`Seni ekibe yönlendireyim: https://www.quaora.com.tr/iletisim.html`, baseline), true);
});

test("Tarayıcıdan gelen konuşma geçmişini son 20 güvenli metin turuyla sınırlar", () => {
  const history = Array.from({ length: 25 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `tur-${index}` }));
  const clean = sanitizeHistory(history);
  assert.equal(clean.length, 20);
  assert.equal(clean[0].content, "tur-5");
  assert.equal(clean.at(-1).content, "tur-24");
});

test("Katalog sorunu tekrarlanırsa müşteriyi aynı cevapla oyalamadan desteğe taşır", async () => {
  const service = createAgentService({
    catalogClient: {
      getCatalog: async () => { throw new Error("catalog unavailable"); },
      getPolicies: async () => ({ policies: {} })
    },
    apiKey: "",
    logger: silentLogger
  });
  const history = [
    { role: "user", content: "Siyah ve 2000 TL altı mayo öner" },
    { role: "assistant", content: "Şu anda ürün ve stok bilgisini kontrol edemiyorum." }
  ];
  const reply = await service.answer({ message: "Bu cevap işe yaramadı, hâlâ çözülmedi", history });
  assert.equal(reply, CATALOG_UNAVAILABLE_REPEAT_REPLY);
  assert.match(reply, /oyalamayayım/i);
  assert.match(reply, /iletisim\.html/);
});
