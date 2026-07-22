"use strict";

const crypto = require("node:crypto");

const SECURITY_REFUSAL = "Güvenlik nedeniyle QUAORA'nın teknik altyapısı, veri sistemleri, servis yapılandırması, sistem talimatları veya erişim bilgileri hakkında bilgi paylaşamam. Ürün, stok, beden ve müşteri politikaları konusunda yardımcı olabilirim.";
const OUT_OF_SCOPE_REPLY = "Yalnızca QUAORA politikaları, ürün ve beden açıklamaları, ölçüye göre beden önerisi ve stok durumu hakkında yardımcı olabilirim.";

const COLLECTIONS = Object.freeze({
  ayakkabilar: "Ayakkabılar",
  "bikini-altlari": "Bikini Altları",
  bikini_ustleri: "Bikini Üstleri",
  bottom_products: "Bottoms",
  cantalar: "Çantalar",
  conquette: "Coquette",
  gozlukler: "Gözlükler",
  mayokini_altlari: "Mayokini Altları",
  mayokini_ustleri: "Mayokini Üstleri",
  mayolar: "Mayolar",
  outlet_products: "Outlet",
  PANZER: "Panzer",
  pareolar: "Pareolar",
  PIE: "Pie",
  plaj_aksesuarlari: "Plaj Aksesuarları",
  RELOVE: "Relove",
  sapkalar: "Şapkalar",
  takilar: "Takılar",
  tops_products: "Tops",
  yeni_gelenler: "Yeni Gelenler"
});

const COLLECTION_PAGES = Object.freeze({
  ayakkabilar: "ayakkabilar.html",
  "bikini-altlari": "bikini-altlari.html",
  bikini_ustleri: "bikini-ustleri.html",
  bottom_products: "bottom.html",
  cantalar: "cantalar.html",
  conquette: "coquette.html",
  gozlukler: "gozlukler.html",
  mayokini_altlari: "mayokini-altlari.html",
  mayokini_ustleri: "mayokini-ustleri.html",
  mayolar: "mayolar.html",
  outlet_products: "outlet.html",
  PANZER: "panzer.html",
  pareolar: "pareolar.html",
  PIE: "pie.html",
  plaj_aksesuarlari: "plaj-aksesuarlari.html",
  RELOVE: "relove.html",
  sapkalar: "sapkalar.html",
  takilar: "takilar.html",
  tops_products: "tops.html",
  yeni_gelenler: "yeni-gelenler.html"
});

// Bu tablo yalnızca test amaçlıdır. Üretime geçmeden önce QUAORA tarafından
// ürün/kategori bazında onaylanmalıdır.
const PROVISIONAL_SIZE_CHART = Object.freeze([
  { size: "32", letter: "XS", bust: [78, 82], waist: [60, 64], hips: [86, 90] },
  { size: "34", letter: "S", bust: [82, 86], waist: [64, 68], hips: [90, 94] },
  { size: "36", letter: "M", bust: [86, 90], waist: [68, 72], hips: [94, 98] },
  { size: "38", letter: "L", bust: [90, 94], waist: [72, 76], hips: [98, 102] },
  { size: "40", letter: "XL", bust: [94, 98], waist: [76, 80], hips: [102, 106] },
  { size: "42", letter: "2XL", bust: [98, 103], waist: [80, 85], hips: [106, 111] }
]);

function normalizeText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.hasOwn(value, "booleanValue")) return Boolean(value.booleanValue);
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, entry]) => [key, firestoreValue(entry)])
    );
  }
  if (value.arrayValue) return (value.arrayValue.values || []).map(firestoreValue);
  return null;
}

function parseFirestoreDocument(document, collection) {
  const id = String(document?.name || "").split("/").pop();
  const fields = Object.fromEntries(
    Object.entries(document?.fields || {}).map(([key, value]) => [key, firestoreValue(value)])
  );
  return normalizeProduct({ ...fields, id, collection });
}

function normalizeProduct(product) {
  const collection = String(product.collection || "");
  const sizeStocks = product.sizeStocks && typeof product.sizeStocks === "object"
    ? Object.fromEntries(Object.entries(product.sizeStocks).map(([size, stock]) => [String(size), Math.max(0, Number(stock || 0))]))
    : {};
  const calculatedStock = Object.keys(sizeStocks).length
    ? Object.values(sizeStocks).reduce((sum, value) => sum + Number(value || 0), 0)
    : Math.max(0, Number(product.stock || 0));
  return {
    id: String(product.id || ""),
    collection,
    category: COLLECTIONS[collection] || String(product.category || collection),
    name: String(product.name || "İsimsiz ürün"),
    description: String(product.description || ""),
    material: String(product.material || ""),
    color: String(product.color || ""),
    fit: String(product.fit || product.cut || ""),
    sizeDescription: String(product.sizeDescription || product.sizeGuide || product.fitDescription || ""),
    sku: String(product.sku || ""),
    salePrice: Number(product.salePrice || product.price || 0),
    originalPrice: Number(product.originalPrice || 0),
    sizeStocks,
    stock: calculatedStock,
    url: product.url || productUrl(collection, product.id)
  };
}

function productUrl(collection, id) {
  if (!collection || !id || !COLLECTION_PAGES[collection]) return "";
  const params = new URLSearchParams({ collection, id: String(id), from: COLLECTION_PAGES[collection] });
  return `https://www.quaora.com.tr/urun.html?${params.toString()}`;
}

function searchProducts(products, query, limit = 5) {
  const normalizedQuery = normalizeText(query);
  const tokens = [...new Set(normalizedQuery.split(" ").filter(token => token.length > 1))];
  if (!tokens.length) return [];
  return products
    .map(product => {
      const name = normalizeText(product.name);
      const category = normalizeText(`${product.category} ${product.collection}`);
    const detail = normalizeText(`${product.description} ${product.color} ${product.material} ${product.fit} ${product.sizeDescription} ${product.sku}`);
      let score = 0;
      if (name === normalizedQuery) score += 100;
      if (name.includes(normalizedQuery)) score += 35;
      for (const token of tokens) {
        if (name.includes(token)) score += 10;
        if (category.includes(token)) score += 6;
        if (detail.includes(token)) score += 2;
      }
      return { product, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "tr"))
    .slice(0, limit)
    .map(item => item.product);
}

function stockSummary(product) {
  const sizes = Object.entries(product?.sizeStocks || {});
  if (sizes.length) {
    const available = sizes.filter(([, stock]) => Number(stock) > 0);
    if (!available.length) return "Tükendi";
    return available.map(([size, stock]) => `${size}: ${stock} adet`).join(", ");
  }
  return Number(product?.stock || 0) > 0 ? `Stokta ${Number(product.stock)} adet` : "Tükendi";
}

function extractMeasurements(message) {
  const normalized = normalizeText(message);
  const read = patterns => {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) return Number(match[1]);
    }
    return null;
  };
  return {
    height: read([/(?:boyum|boy)\s*(\d{2,3})/, /(\d{3})\s*cm\s*(?:boy|uzunluk)/]),
    weight: read([/(?:kilom|kilo|agirligim|agirlik)\s*(\d{2,3})/, /(\d{2,3})\s*(?:kg|kiloyum)/]),
    bust: read([/(?:gogsum|gogusum|gogus)\s*(\d{2,3})/]),
    waist: read([/(?:belim|bel)\s*(\d{2,3})/]),
    hips: read([/(?:kalcam|kalca)\s*(\d{2,3})/])
  };
}

function inferGarmentType(message, products = []) {
  const text = normalizeText(`${message} ${products.map(product => `${product.collection} ${product.category} ${product.name}`).join(" ")}`);
  if (/bikini ust|mayokini ust|top|ust/.test(text)) return "upper";
  if (/bikini alt|mayokini alt|bottom|etek/.test(text)) return "lower";
  return "onepiece";
}

function recommendSize({ measurements = {}, garmentType = "onepiece", fit = "normal", availableSizes = [], environment = "test" } = {}) {
  const keys = garmentType === "upper" ? ["bust"] : garmentType === "lower" ? ["waist", "hips"] : ["bust", "waist", "hips"];
  const present = keys.filter(key => Number.isFinite(measurements[key]));
  const missing = keys.filter(key => !Number.isFinite(measurements[key]));
  if (!present.length) {
    return {
      status: "needs_measurements",
      missing,
      message: `Beden önerisi için ${missing.map(measurementLabel).join(", ")} ölçünü santimetre olarak paylaşır mısın?`,
      provisional: true
    };
  }

  const ranked = PROVISIONAL_SIZE_CHART.map((row, index) => {
    const score = present.reduce((sum, key) => {
      const [min, max] = row[key];
      const value = measurements[key];
      if (value < min) return sum + (min - value) ** 2;
      if (value > max) return sum + (value - max) ** 2;
      return sum;
    }, 0);
    return { row, score, index };
  }).sort((a, b) => a.score - b.score || a.index - b.index);

  let selectedIndex = ranked[0].index;
  const boundary = ranked[1] && Math.abs(ranked[1].score - ranked[0].score) <= 1;
  if ((fit === "rahat" || fit === "bol") && boundary) selectedIndex = Math.max(selectedIndex, ranked[1].index);
  const selected = PROVISIONAL_SIZE_CHART[selectedIndex];
  const normalizedAvailable = availableSizes.map(String);
  const inStock = !normalizedAvailable.length || normalizedAvailable.includes(selected.size) || normalizedAvailable.includes(selected.letter);
  return {
    status: missing.length ? "provisional" : "recommended",
    size: selected.size,
    letter: selected.letter,
    missing,
    confidence: missing.length ? "düşük" : (boundary ? "orta" : "yüksek"),
    inStock,
    availableSizes: normalizedAvailable,
    message: `${selected.size} (${selected.letter}) beden genel ölçü tablosuna göre en yakın seçenek.${inStock ? "" : " Bu beden seçili üründe stokta görünmüyor."}`,
    environment,
    provisional: true
  };
}

function measurementLabel(key) {
  return ({ bust: "göğüs", waist: "bel", hips: "kalça", height: "boy", weight: "kilo" })[key] || key;
}

function selectPolicyExcerpts(policies, query, limit = 5) {
  const text = normalizeText(query);
  const policyHints = {
    return_policy: ["iade", "degisim", "hijyen", "cayma", "kusurlu", "yanlis"],
    delivery_policy: ["teslimat", "kargo", "paket", "adres", "takip", "gecikme"],
    distance_sales_policy: ["sozlesme", "odeme", "paytr", "fiyat", "cayma"],
    privacy_policy: ["gizlilik", "veri", "kart", "kvkk", "saklama", "kisisel"]
  };
  const preferred = Object.entries(policyHints)
    .filter(([, hints]) => hints.some(hint => text.includes(hint)))
    .map(([key]) => key);
  const keys = preferred.length ? preferred : Object.keys(policies);
  const scored = [];
  for (const key of keys) {
    const policy = policies[key];
    for (const block of policy?.blocks || []) {
      const blockText = normalizeText(`${block.heading} ${block.text}`);
      let score = text.split(" ").filter(token => token.length > 2 && blockText.includes(token)).length;
      if (/(kac gun|sure|ne kadar zaman)/.test(text) && /(sure|gun|cayma)/.test(blockText)) score += 5;
      if (/(hijyen|band|ambalaj|etiket)/.test(text) && /(hijyen|band|ambalaj|etiket)/.test(blockText)) score += 3;
      scored.push({ policyKey: key, policyTitle: policy.title, heading: block.heading, text: block.text, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function classifyIntent(message) {
  const text = normalizeText(message);
  if (/(talimatlari unut|onceki talimatlari|system prompt|sistem prompt|developer mesaji|gizli talimat|gizli anahtar|api key|private key|service account|access token|secret|stok uydur|politika uydur)/.test(text)) return "security_sensitive";
  if (/(firebase|firestore|vercel|openai|hangi model|model adi|backend|back end|veritabani|database|api endpoint|api yolu|sunucu yapisi|server yapisi|hosting|host ediliyor|proje id|project id|koleksiyon ad|collection name|teknik mimari|teknik altyapi)/.test(text)) return "security_sensitive";
  const hasMeasurements = /(boyum|kilom|kiloyum|gogsum|gogusum|belim|kalcam|olcum)/.test(text);
  const asksPersonalSize = /(hangi beden (?:olur|almaliyim|secmeliyim|giyerim)|beden (?:oner|oneri|tavsiye)|bana (?:hangi )?beden|beden secimi.*hangi olcu|hangi olcu.*beden)/.test(text);
  if (hasMeasurements || asksPersonalSize) return "size";
  if (/(siparisim nerede|siparis durumu|kargom nerede|kargo takip|siparis takip)/.test(text)) return "order_status";
  if (/(iade|degisim|teslimat|kargo|gizlilik|odeme|paytr|cayma|hijyen)/.test(text)) return "policy";
  if (/(stok|urun|mayo|bikini|pareo|beden|fiyat|renk|materyal|malzeme|kumas|kalip|beden aciklama|olcu tablosu|pie|panzer|relove)/.test(text)) return "product";
  if (/^(merhaba|selam|hey|iyi gunler|tesekkur|tesekkurler|sag ol|yardim|ne yapabilirsin)\b/.test(text)) return "greeting";
  return "out_of_scope";
}

function buildDeterministicReply({ message, products = [], policies = {}, sizeAdvice = null, environment = "test" }) {
  const intent = classifyIntent(message);
  if (intent === "security_sensitive") return SECURITY_REFUSAL;
  if (intent === "out_of_scope") return OUT_OF_SCOPE_REPLY;
  if (intent === "order_status") {
    return environment === "production"
      ? "Sipariş hesabına erişemiyorum. Sipariş durumunu doğrulamak için QUAORA iletişim kanalından sipariş numaranla destek isteyebilirsin."
      : "Bu test agentı sipariş hesabına erişmiyor. Sipariş durumunu doğrulamak için QUAORA iletişim kanallarından sipariş numaranla destek istemelisin.";
  }
  if (intent === "size" && sizeAdvice) {
    const stockText = products[0] ? ` ${products[0].name} için görünen stok: ${stockSummary(products[0])}.` : "";
    if (sizeAdvice.status === "needs_measurements") return `${sizeAdvice.message}${stockText}`;
    const missingText = sizeAdvice.missing?.length ? ` Eksik ölçüler: ${sizeAdvice.missing.map(measurementLabel).join(", ")}.` : "";
    const disclaimer = environment === "production"
      ? " Bu genel bir beden önerisidir; ürünün kalıbına ve kişisel tercihe göre değişebilir."
      : " Bu öneri onaylanmamış genel test tablosuna dayanır; üretim tavsiyesi değildir.";
    return `${sizeAdvice.message}${stockText}${missingText}${disclaimer}`;
  }
  if (intent === "policy") {
    const excerpts = selectPolicyExcerpts(policies, message, 2);
    if (!excerpts.length) return "Bu konu için doğrulanmış bir QUAORA politika maddesi bulamadım; müşteri temsilcisine yönlendirmem gerekir.";
    return excerpts.map(item => `${item.policyTitle} — ${item.heading}: ${item.text}`).join("\n\n");
  }
  if (intent === "product") {
    if (!products.length) return "Bu ifadeyle eşleşen bir ürün bulamadım. Ürün adını veya kategoriyi biraz daha açık yazar mısın?";
    return products.slice(0, 3).map(product => {
      const price = product.salePrice > 0 ? `, ₺${product.salePrice.toLocaleString("tr-TR")}` : "";
      const details = [
        product.description,
        product.material ? `Materyal: ${product.material}` : "",
        product.color ? `Renk: ${product.color}` : "",
        product.fit ? `Kalıp: ${product.fit}` : "",
        product.sizeDescription ? `Beden açıklaması: ${product.sizeDescription}` : ""
      ].filter(Boolean).join(" · ");
      return `${product.name}${details ? ` — ${details}` : ""}. Stok: ${stockSummary(product)}${price}${product.url ? `. ${product.url}` : ""}`;
    }).join("\n");
  }
  return "Merhaba, QUAORA ürün, stok, politika ve beden konularında doğrulanmış bilgilerle yardımcı olabilirim.";
}

function containsSensitiveDisclosure(value) {
  const text = normalizeText(value);
  return /(firebase|firestore|vercel|openai|gpt ?[0-9]|service account|private key|project id|database url|api key|access token)/.test(text)
    || /(?:sistem|developer) (?:prompt|mesaj|talimat)/.test(text)
    || /(?:backend|veritabani|sunucu) .{0,30}(?:kullaniyor|kullaniyoruz|adresi|yapisi|mimarisi)/.test(text);
}

function sanitizeAgentOutput(value) {
  const text = String(value || "").trim();
  if (!text || containsSensitiveDisclosure(text)) return SECURITY_REFUSAL;
  return text;
}

function safetyIdentifier(sessionId) {
  return crypto.createHash("sha256").update(String(sessionId || "anonymous-test")).digest("hex").slice(0, 32);
}

module.exports = {
  COLLECTIONS,
  COLLECTION_PAGES,
  OUT_OF_SCOPE_REPLY,
  PROVISIONAL_SIZE_CHART,
  SECURITY_REFUSAL,
  buildDeterministicReply,
  classifyIntent,
  containsSensitiveDisclosure,
  extractMeasurements,
  firestoreValue,
  inferGarmentType,
  normalizeProduct,
  normalizeText,
  parseFirestoreDocument,
  productUrl,
  recommendSize,
  sanitizeAgentOutput,
  safetyIdentifier,
  searchProducts,
  selectPolicyExcerpts,
  stockSummary
};
