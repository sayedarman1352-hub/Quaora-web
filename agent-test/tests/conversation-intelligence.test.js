"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const policies = require("../data/policies.json");
const {
  buildDeterministicReply,
  classifyIntent,
  extractProductConstraints,
  normalizeProduct,
  resolveProductReferences,
  searchProducts
} = require("../lib/agent-core");
const { createAgentService, resolveConversationIntent } = require("../../lib/quaora-agent-service");

const naturalIntentCases = [
  ["bana tatilde giyilecek rahat bir şey lazım", "product"],
  ["çok açık olmasın ama şık dursun", "product"],
  ["siyah olsun 2000 lirayı geçmesin", "product"],
  ["daha ucuzu yok mu", "product"],
  ["bunun 36'sı kaldı mı", "product"],
  ["36 kaldı mı", "product"],
  ["ben normalde M giyiyorum, hangisini alayım", "size"],
  ["boy 165 kilo 58, ne almalıyım", "size"],
  ["alt için soruyorum; bel 70 kalça 96", "size"],
  ["üstüm 88 altım 96", "size"],
  ["beden önersi alabilir miyim", "size"],
  ["bu dar mı gelir", "size"],
  ["etiketi çıkardım, yine de geri gönderebilir miyim", "policy"],
  ["denedim olmadı, değiştirebilir miyim", "policy"],
  ["ne zaman elimde olur", "policy"],
  ["kapıda ödeme var mı", "policy"],
  ["karttan iki kere çekilmiş", "support"],
  ["aynısının kırmızısı var mı", "product"],
  ["plajda kombin yapacağım, buna ne gider", "product"],
  ["hangisi daha toparlayıcı", "product"],
  ["göğsü küçük gösteren model var mı", "product"],
  ["stok gelince haber verir misiniz", "product"],
  ["İzmir'de mağazanız var mı", "support"],
  ["canlı biriyle görüşebilir miyim", "support"],
  ["sağ ol, peki iade", "policy"],
  ["güneşlenirken iz yapmayacak bir şey arıyorum", "product"],
  ["karın bölgemi kapatsın", "product"],
  ["askıları ayarlanıyor mu", "product"],
  ["denizde çıkar mı", "product"],
  ["takım olarak mı geliyor", "product"],
  ["sadece üst mü satılıyor", "product"],
  ["astarı var mı", "product"],
  ["cup var mı", "product"],
  ["destekli mi", "product"],
  ["iç gösterir mi", "product"],
  ["kuruyunca çeker mi", "product"],
  ["yanlış beden aldım", "policy"],
  ["adresimi yanlış yazdım", "policy"],
  ["hediye paketi yapıyor musunuz", "policy"],
  ["yurtdışına gönderiyor musunuz", "policy"],
  ["siparişi iptal etmek istiyorum", "policy"],
  ["para ne zaman kartıma yatar", "policy"],
  ["indirim kodum çalışmıyor", "support"],
  ["ödeme reddedildi", "support"],
  ["şifremi unuttum", "support"],
  ["mail gelmedi", "support"],
  ["paketim hâlâ gelmedi", "order_status"]
];

const catalog = [
  normalizeProduct({ id: "black-fit", collection: "mayolar", name: "Siyah toparlayıcı mayo", color: "Siyah", description: "Toparlayıcı kalıp", salePrice: 1890, sizeStocks: { 36: 2 } }),
  normalizeProduct({ id: "black-budget", collection: "mayolar", name: "Siyah ekonomik mayo", color: "Siyah", description: "Yumuşak dokulu", salePrice: 1490, sizeStocks: { 36: 1 } }),
  normalizeProduct({ id: "black-expensive", collection: "mayolar", name: "Siyah premium mayo", color: "Siyah", salePrice: 2390, sizeStocks: { 36: 2 } }),
  normalizeProduct({ id: "black-sold", collection: "mayolar", name: "Siyah outlet mayo", color: "Siyah", salePrice: 990, sizeStocks: { 36: 0 } }),
  normalizeProduct({ id: "red-fit", collection: "mayolar", name: "Kırmızı toparlayıcı mayo", color: "Kırmızı", description: "Toparlayıcı kalıp", salePrice: 1790, sizeStocks: { 36: 2 } })
];

test("Doğal müşteri cümlelerini dar anahtar kelime kalıplarına mahkûm etmez", () => {
  for (const [message, expected] of naturalIntentCases) assert.equal(classifyIntent(message), expected, message);
  assert.equal(classifyIntent("Bugün hava nasıl?"), "out_of_scope");
});

test("Renk, bütçe ve stok kısıtlarını birlikte uygular", () => {
  const query = "Siyah, toparlayıcı ve 2000 lira altı bir mayo önerir misin?";
  const constraints = extractProductConstraints(query);
  assert.deepEqual(constraints.colors, ["siyah"]);
  assert.equal(constraints.maxPrice, 2000);
  const matches = searchProducts(catalog, query, 5, { currentMessage: query });
  assert.deepEqual(matches.map(product => product.name), ["Siyah toparlayıcı mayo", "Siyah ekonomik mayo"]);
  assert.ok(matches.every(product => product.salePrice <= 2000 && product.stock > 0));
});

test("Ürün özelliğindeki 'var mı' ifadesini stok sorusu sanmaz", () => {
  assert.equal(extractProductConstraints("Cup var mı?").wantsStock, false);
  assert.equal(extractProductConstraints("36 beden var mı?").wantsStock, true);
});

test("Görünen doğrulanmış ürün adlarından bu, ikinci ve renk alternatifi referanslarını çözer", () => {
  const visibleReply = buildDeterministicReply({
    message: "Siyah mayo öner",
    products: [catalog[0], catalog[1]],
    intent: "product"
  });
  const history = [{ role: "assistant", content: visibleReply }];
  const references = resolveProductReferences(catalog, "aynısının kırmızısı var mı", history);
  assert.deepEqual(references.map(product => product.name), ["Siyah toparlayıcı mayo", "Siyah ekonomik mayo"]);
  const red = searchProducts(catalog, "siyah mayo\naynısının kırmızısı var mı", 5, {
    currentMessage: "aynısının kırmızısı var mı",
    referencedProducts: references
  });
  assert.deepEqual(red.map(product => product.name), ["Kırmızı toparlayıcı mayo"]);
  const second = searchProducts(catalog, "ikincisinin 36 bedeni kaldı mı", 5, {
    currentMessage: "ikincisinin 36 bedeni kaldı mı",
    referencedProducts: references
  });
  assert.equal(second[0].name, "Siyah ekonomik mayo");
});

test("Ürün bağlamındaki tek beden sayısını stok takibi olarak sürdürür", () => {
  assert.equal(resolveConversationIntent("36", [{ role: "user", content: "Siyah mayoları göster" }]), "product");
  assert.equal(resolveConversationIntent("36", [{ role: "user", content: "Bedenimi bul" }]), "size");
});

test("Etiketi çıkarılmış ürün sorusunu ilgili doğrulanmış iade koşuluyla yanıtlar", async () => {
  const service = createAgentService({
    catalogClient: {
      getCatalog: async () => ({ products: catalog }),
      getPolicies: async () => ({ policies })
    },
    apiKey: "",
    logger: { error() {} }
  });
  const reply = await service.answer({ message: "Etiketi çıkardım; yine de geri gönderebilir miyim?" });
  assert.match(reply, /etiketi.*çıkarılmamış|etiket.*çıkarılmış/i);
  assert.doesNotMatch(reply, /Gizlilik Sözleşmesi/);
});

test("Belgelenmemiş hediye paketi veya kapıda ödeme politikasını uydurmaz", async () => {
  const service = createAgentService({
    catalogClient: {
      getCatalog: async () => ({ products: catalog }),
      getPolicies: async () => ({ policies })
    },
    apiKey: "",
    logger: { error() {} }
  });
  const giftReply = await service.answer({ message: "Hediye paketi yapıyor musunuz?" });
  assert.match(giftReply, /doğrulanmış.*bulamadım/i);
  assert.doesNotMatch(giftReply, /hasarlı paket|teslim alırken/i);
  const cashReply = await service.answer({ message: "Kapıda ödeme var mı?" });
  assert.match(cashReply, /doğrulanmış.*bulamadım/i);
  assert.doesNotMatch(cashReply, /vardır|yapabilirsiniz/i);
});

test("Hesap ve ödeme sorunu için kişisel bilgi istemeden insan desteğine yönlendirir", () => {
  const reply = buildDeterministicReply({ message: "Karttan iki kere çekilmiş", intent: "support", environment: "production" });
  assert.match(reply, /iletisim\.html/);
  assert.match(reply, /kişisel ya da ödeme bilgisi paylaşmadan/i);
});
