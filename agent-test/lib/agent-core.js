"use strict";

const crypto = require("node:crypto");

const SECURITY_REFUSAL = "Güvenlik nedeniyle QUAORA'nın teknik altyapısı, veri sistemleri, servis yapılandırması, sistem talimatları veya erişim bilgileri hakkında bilgi paylaşamam. Ürün, stok, beden ve müşteri politikaları konusunda yardımcı olabilirim.";
const OUT_OF_SCOPE_REPLY = "QUAORA ürünleri, fiyatlar, renk ve materyal bilgileri, bakım, beden önerisi, stok, teslimat, ödeme, iade ve diğer müşteri politikaları hakkında yardımcı olabilirim.";

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

// Bu tablo genel bir sayısal beden referansıdır. QUAORA'ya ait doğrulanmış bir
// ölçü tablosu olmadığı için harf beden eşlemesi yapılmaz ve her müşteri
// yanıtında önerinin ürün kalıbına göre değişebileceği açıkça belirtilir.
const PROVISIONAL_SIZE_CHART = Object.freeze([
  { size: "32", bust: [78, 82], waist: [60, 64], hips: [86, 90] },
  { size: "34", bust: [82, 86], waist: [64, 68], hips: [90, 94] },
  { size: "36", bust: [86, 90], waist: [68, 72], hips: [94, 98] },
  { size: "38", bust: [90, 94], waist: [72, 76], hips: [98, 102] },
  { size: "40", bust: [94, 98], waist: [76, 80], hips: [102, 106] },
  { size: "42", bust: [98, 103], waist: [80, 85], hips: [106, 111] },
  { size: "44", bust: [103, 108], waist: [85, 90], hips: [111, 116] }
]);

const MEASUREMENT_RANGES = Object.freeze({
  height: [130, 220],
  weight: [35, 250],
  bust: [55, 160],
  waist: [45, 150],
  hips: [65, 180]
});

const PRODUCT_COLORS = Object.freeze({
  siyah: ["siyah", "black"],
  beyaz: ["beyaz", "ekru", "krem", "white"],
  kirmizi: ["kirmizi", "bordo", "kizil", "red"],
  mavi: ["mavi", "lacivert", "turkuaz", "blue"],
  yesil: ["yesil", "haki", "mint", "green"],
  pembe: ["pembe", "fuşya", "fusya", "pink"],
  sari: ["sari", "yellow"],
  mor: ["mor", "lila", "purple"],
  kahverengi: ["kahverengi", "taba", "bej", "brown"]
});

// A specific garment request is a hard constraint, not merely a search-score hint.
// This prevents a query such as "mayo sortu" from returning a t-shirt mayo just
// because both products contain the broader word "mayo".
const PRODUCT_TYPE_RULES = Object.freeze([
  { id: "swim_short", query: /\b(?:mayo\s+)?sort(?:u|lari)?\b/, product: /\bsort(?:u|lari)?\b/ },
  { id: "tshirt", query: /\b(?:t\s*shirt|tisort)(?:\s+mayo)?\b/, product: /\b(?:t\s*shirt|tisort)\b/ },
  { id: "bikini_bottom", query: /\bbikini\s+alt(?:i|lari)?\b/, product: /\bbikini\s+alt(?:i|lari)?\b/ },
  { id: "bikini_top", query: /\bbikini\s+ust(?:u|leri)?\b/, product: /\bbikini\s+ust(?:u|leri)?\b/ },
  { id: "mayokini_bottom", query: /\bmayokini\s+alt(?:i|lari)?\b/, product: /\bmayokini\s+alt(?:i|lari)?\b/ },
  { id: "mayokini_top", query: /\bmayokini\s+ust(?:u|leri)?\b/, product: /\bmayokini\s+ust(?:u|leri)?\b/ },
  { id: "pareo", query: /\bpareo(?:lar)?\b/, product: /\bpareo(?:lar)?\b/ },
  { id: "bag", query: /\bcanta(?:lar)?\b/, product: /\bcanta(?:lar)?\b/ },
  { id: "shoe", query: /\bayakkabi(?:lar)?\b/, product: /\bayakkabi(?:lar)?\b/ },
  { id: "glasses", query: /\bgozluk(?:ler)?\b/, product: /\bgozluk(?:ler)?\b/ },
  { id: "hat", query: /\bsapka(?:lar)?\b/, product: /\bsapka(?:lar)?\b/ },
  { id: "jewelry", query: /\btaki(?:lar)?\b/, product: /\btaki(?:lar)?\b/ },
  { id: "skirt", query: /\betek(?:ler)?\b/, product: /\betek(?:ler)?\b/ }
]);

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "acaba", "almak", "altinda", "alti", "ama", "bana", "ben", "bi", "bir", "bunun", "bunu", "bu",
  "cok", "daha", "de", "diye", "en", "fiyat", "gecmesin", "gibi", "icin", "istiyorum", "kadar", "lira",
  "lazim", "mi", "mu", "miyim", "nedir", "ne", "olsun", "oner", "onerir", "oneririsin", "peki", "sey",
  "tl", "urun", "var", "ve", "ya", "yok"
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

function extractProductConstraints(query) {
  const normalizedQuery = normalizeText(query);
  const priceMatches = [...normalizedQuery.matchAll(/\b(\d{3,6})\s*(?:tl|try|lira)?\b/g)].map(match => Number(match[1]));
  const hasUpperPriceLanguage = /(butce|en fazla|max|gecmesin|altinda|alti|kadar|civar)/.test(normalizedQuery);
  const colors = Object.entries(PRODUCT_COLORS)
    .filter(([, aliases]) => aliases.some(alias => new RegExp(`\\b${normalizeText(alias)}(?:i|si|sini|ini)?\\b`).test(normalizedQuery)))
    .map(([color]) => color);
  const sizeMatch = normalizedQuery.match(/\b(2xl|xl|xs|s|m|l|32|34|36|38|40|42|44)\b/);
  return {
    colors,
    productTypes: PRODUCT_TYPE_RULES.filter(rule => rule.query.test(normalizedQuery)).map(rule => rule.id),
    maxPrice: hasUpperPriceLanguage && priceMatches.length ? Math.max(...priceMatches) : null,
    requestedSize: sizeMatch ? sizeMatch[1].toUpperCase() : "",
    wantsCheaper: /(daha ucuz|en ucuz|uygun fiyat|butce dostu|hesapli)/.test(normalizedQuery),
    wantsStock: /(stok|kaldi mi|kalmis mi|mevcut)/.test(normalizedQuery)
      || (Boolean(sizeMatch) && /(var mi|bulunuyor mu)/.test(normalizedQuery))
      || /^(?:2xl|xl|xs|s|m|l|32|34|36|38|40|42|44)$/.test(normalizedQuery),
    wantsAlternative: /(aynisi|aynisinin|benzeri|alternatif|baska|farkli renk)/.test(normalizedQuery),
    wantsComparison: /(karsilastir|hangisi daha|hangisini|aralarindaki fark)/.test(normalizedQuery),
    asksRecommendation: /(oner|tavsiye|bakiyorum|lazim|istiyorum|hangisini al)/.test(normalizedQuery)
  };
}

function productMatchesColor(product, color) {
  const aliases = PRODUCT_COLORS[color] || [color];
  const haystack = normalizeText(`${product.name} ${product.color} ${product.description}`);
  return aliases.some(alias => new RegExp(`\\b${normalizeText(alias)}\\b`).test(haystack));
}

function mergeProductConstraints(base, current) {
  return {
    ...base,
    colors: current.colors.length ? current.colors : base.colors,
    productTypes: current.productTypes.length ? current.productTypes : base.productTypes,
    maxPrice: current.maxPrice || base.maxPrice,
    requestedSize: current.requestedSize || base.requestedSize,
    wantsCheaper: current.wantsCheaper,
    wantsStock: current.wantsStock,
    wantsAlternative: current.wantsAlternative,
    wantsComparison: current.wantsComparison,
    asksRecommendation: current.asksRecommendation || base.asksRecommendation
  };
}

function searchProducts(products, query, limit = 5, options = {}) {
  const normalizedQuery = normalizeText(query);
  const currentMessage = normalizeText(options.currentMessage || query);
  const baseConstraints = extractProductConstraints(query);
  const currentConstraints = extractProductConstraints(options.currentMessage || query);
  const constraints = mergeProductConstraints(baseConstraints, currentConstraints);
  const referencedProducts = Array.isArray(options.referencedProducts) ? options.referencedProducts.filter(Boolean) : [];
  const tokens = [...new Set(normalizedQuery.split(" ").filter(token => token.length > 1 && !PRODUCT_SEARCH_STOPWORDS.has(token) && !/^\d+$/.test(token)))];
  const ordinalMatch = currentMessage.match(/\b(?:ikinci(?:si|sinin)?|2 nci|2 inci)\b/)
    ? 1
    : currentMessage.match(/\b(?:ucuncu(?:su|sunun)?|3 uncu|3uncu)\b/) ? 2 : currentMessage.match(/\b(?:ilk|birinci(?:si|sinin)?|1 inci)\b/) ? 0 : -1;
  if (ordinalMatch >= 0 && referencedProducts[ordinalMatch]) return [referencedProducts[ordinalMatch]];

  const isReferenceFollowUp = referencedProducts.length && (/(bu|bunun|bunda|buna|aynisi|aynisinin|kaldı|kaldi|fiyati|bedeni|rengi|materyali|kalibi|daha ucuz)/.test(currentMessage)
    || (currentConstraints.wantsStock && Boolean(currentConstraints.requestedSize)));
  if (isReferenceFollowUp && !currentConstraints.wantsCheaper && !currentConstraints.wantsAlternative && !currentConstraints.colors.length) {
    if (/\b(?:bu|bunun|bunda|buna)\b/.test(currentMessage)) return [referencedProducts[0]];
    return referencedProducts.slice(0, limit);
  }

  const referenceCategories = new Set(referencedProducts.map(product => normalizeText(`${product.category} ${product.collection}`)));
  const referencePrice = referencedProducts.find(product => Number(product.salePrice) > 0)?.salePrice || null;
  const shouldRequireStock = constraints.asksRecommendation && !constraints.wantsStock;
  const scored = products
    .map(product => {
      const name = normalizeText(product.name);
      const category = normalizeText(`${product.category} ${product.collection}`);
      const detail = normalizeText(`${product.description} ${product.color} ${product.material} ${product.fit} ${product.sizeDescription} ${product.sku}`);
      const fullText = `${name} ${category} ${detail}`;
      let score = 0;
      if (name === normalizedQuery) score += 100;
      if (name.includes(normalizedQuery)) score += 35;
      for (const token of tokens) {
        if (name.includes(token)) score += 10;
        if (category.includes(token)) score += 7;
        if (detail.includes(token)) score += 3;
      }
      if (constraints.colors.length && constraints.colors.some(color => productMatchesColor(product, color))) score += 30;
      if (referenceCategories.has(category)) score += 18;
      if (currentConstraints.wantsCheaper) score += Math.max(0, 12 - Number(product.salePrice || 0) / 500);
      return { product, score, fullText, category };
    })
    .filter(item => {
      const product = item.product;
      if (constraints.maxPrice && (!product.salePrice || product.salePrice > constraints.maxPrice)) return false;
      if (constraints.colors.length && !constraints.colors.some(color => productMatchesColor(product, color))) return false;
      if (constraints.productTypes.length) {
        const matchesRequestedType = constraints.productTypes.some(type => {
          const rule = PRODUCT_TYPE_RULES.find(candidate => candidate.id === type);
          return rule ? rule.product.test(item.fullText) : false;
        });
        if (!matchesRequestedType) return false;
      }
      if (currentConstraints.wantsCheaper && referencePrice && (!product.salePrice || product.salePrice >= referencePrice)) return false;
      if ((currentConstraints.wantsCheaper || currentConstraints.wantsAlternative) && referenceCategories.size && !referenceCategories.has(item.category)) return false;
      if (shouldRequireStock && Number(product.stock || 0) <= 0) return false;
      if (constraints.requestedSize && constraints.asksRecommendation) {
        if (Number(product.sizeStocks?.[constraints.requestedSize] || 0) <= 0) return false;
      }
      return item.score > 0 || (constraints.asksRecommendation && (constraints.colors.length || constraints.maxPrice));
    })
    .sort((a, b) => {
      if (currentConstraints.wantsCheaper) return Number(a.product.salePrice || Infinity) - Number(b.product.salePrice || Infinity) || b.score - a.score;
      return b.score - a.score || Number(a.product.salePrice || Infinity) - Number(b.product.salePrice || Infinity) || a.product.name.localeCompare(b.product.name, "tr");
    });
  return scored.slice(0, limit).map(item => item.product);
}

function resolveProductReferences(products, message, history = []) {
  const current = normalizeText(message);
  if (!/(bu|bunun|bunda|buna|aynisi|aynisinin|ilk|birinci|ikinci|ucuncu|daha ucuz|kaldı|kaldi|fiyati|bedeni|rengi|materyali|kalibi)/.test(current)
    && !/^(?:2xl|xl|xs|s|m|l|32|34|36|38|40|42|44)$/.test(current)) return [];
  const lastAssistant = [...history].reverse().find(item => item?.role === "assistant" && String(item.content || "").trim());
  if (!lastAssistant) return [];
  const assistantText = normalizeText(lastAssistant.content);
  return products
    .map(product => ({ product, index: assistantText.indexOf(normalizeText(product.name)) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, 5)
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

function compactText(value, maxLength = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function displayColor(color) {
  return ({ kirmizi: "kırmızı", yesil: "yeşil", sari: "sarı" })[color] || color;
}

function extractMeasurementDetails(message) {
  const normalized = normalizeText(message);
  const invalidFields = [];
  const read = (key, patterns) => {
    let latest = null;
    for (const pattern of patterns) {
      for (const match of normalized.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))) {
        if (!latest || Number(match.index) >= latest.index) latest = { value: Number(match[1]), index: Number(match.index) };
      }
    }
    if (!latest) return null;
    if (!isPlausibleMeasurement(key, latest.value)) {
      invalidFields.push(key);
      return null;
    }
    return latest.value;
  };
  const measurements = {
    height: read("height", [/(?:boyum|boy)\s*(\d{2,3})/, /(\d{3})\s*cm\s*(?:boy|uzunluk)/]),
    weight: read("weight", [/(?:kilom|kilo|agirligim|agirlik)\s*(\d{2,3})/, /(\d{2,3})\s*(?:kg|kiloyum)/]),
    bust: read("bust", [/(?:gogsum|gogusum|gogus)(?:\s*olcum)?\s*(\d{2,3})/]),
    waist: read("waist", [/(?:belim|bel)(?:\s*olcum)?\s*(\d{2,3})/]),
    hips: read("hips", [/(?:kalcam|kalca)(?:\s*olcum)?\s*(\d{2,3})/])
  };
  return { measurements, invalidFields: [...new Set(invalidFields)] };
}

function extractMeasurements(message) {
  return extractMeasurementDetails(message).measurements;
}

function isPlausibleMeasurement(key, value) {
  const range = MEASUREMENT_RANGES[key];
  return Boolean(range) && Number.isFinite(value) && value >= range[0] && value <= range[1];
}

function isBareMeasurementReply(message) {
  const value = String(message || "").toLocaleLowerCase("tr-TR").trim();
  if (!value || value.length > 80) return false;
  const numbers = value.match(/\d{2,3}/g) || [];
  if (!numbers.length || numbers.length > 5) return false;
  return value
    .replace(/\d{2,3}/g, "")
    .replace(/\b(?:cm|kg)\b/g, "")
    .replace(/[\s,;:/|\-]+/g, "") === "";
}

function expectedMeasurementFields(history = []) {
  const lastPrompt = [...history].reverse().find(item => item?.role === "assistant" && String(item.content || "").trim());
  if (!lastPrompt) return [];
  const text = normalizeText(lastPrompt.content);
  if (!/(olcu|santimetre|\bcm\b)/.test(text) || !/(paylas|yaz|girer|belirt|gonder)/.test(text)) return [];
  const positions = [
    ["height", text.search(/\bboy\b/)],
    ["weight", text.search(/\bkilo\b/)],
    ["bust", text.search(/\bgogus\b/)],
    ["waist", text.search(/\bbel\b/)],
    ["hips", text.search(/\bkalca\b/)]
  ].filter(([, index]) => index >= 0);
  return positions.sort((a, b) => a[1] - b[1]).map(([key]) => key);
}

function extractContextualMeasurements(message, { history = [], contextMessage = message, garmentType = "onepiece" } = {}) {
  const base = extractMeasurementDetails(contextMessage);
  const current = extractMeasurementDetails(message);
  const result = {
    measurements: { ...base.measurements },
    invalidFields: current.invalidFields,
    ambiguous: false,
    inferredFields: []
  };
  if (!isBareMeasurementReply(message)) return result;

  const values = (String(message).match(/\d{2,3}/g) || []).map(Number);
  const expected = expectedMeasurementFields(history);
  let fields = [];
  if (expected.length === values.length) fields = expected;
  else if (values.length === 3) fields = ["bust", "waist", "hips"];
  else if (values.length === 2 && garmentType === "lower") fields = ["waist", "hips"];
  else if (values.length === 5) fields = ["height", "weight", "bust", "waist", "hips"];
  else if (values.length === 1 && expected.length === 1) fields = expected;
  else {
    result.ambiguous = true;
    return result;
  }

  const invalidFields = fields.filter((key, index) => !isPlausibleMeasurement(key, values[index]));
  if (invalidFields.length) {
    result.invalidFields = [...new Set([...result.invalidFields, ...invalidFields])];
    return result;
  }
  fields.forEach((key, index) => { result.measurements[key] = values[index]; });
  result.inferredFields = fields;
  return result;
}

function inferGarmentType(message, products = []) {
  const text = normalizeText(`${message} ${products.map(product => `${product.collection} ${product.category} ${product.name}`).join(" ")}`);
  if (/\b(?:ayakkabi|ayakkabilar|canta|cantalar|taki|takilar|sapka|sapkalar|gozluk|gozlukler|aksesuar|aksesuarlari|pareo|pareolar)\b/.test(text)) return "product_specific";
  if (/bikini ust|mayokini ust|\btops?\b|\bust\b/.test(text)) return "upper";
  if (/bikini alt|mayokini alt|\bbottoms?\b/.test(text)) return "lower";
  if (/\bmayolar\b|\bmayo\b/.test(text)) return "onepiece";
  if (/\betek\b/.test(text)) return "lower";
  return "onepiece";
}

function recommendSize({ measurements = {}, garmentType = "onepiece", fit = "normal", availableSizes = [], environment = "test", invalidFields = [], ambiguous = false } = {}) {
  if (garmentType === "product_specific") {
    return {
      status: "product_specific_sizing",
      message: "Bu ürün için vücut ölçülerinden genel sayısal beden hesaplamak doğru olmaz. Ürün adını paylaşırsan mevcut beden seçeneğini ve ürün açıklamasını kontrol edebilirim.",
      availableSizes: availableSizes.map(String),
      provisional: true
    };
  }
  const keys = garmentType === "upper" ? ["bust"] : garmentType === "lower" ? ["waist", "hips"] : ["bust", "waist", "hips"];
  const missing = keys.filter(key => !Number.isFinite(measurements[key]));
  if (invalidFields.length) {
    return {
      status: "invalid_measurements",
      invalidFields,
      message: `Bazı ölçüler beklenen aralığın dışında görünüyor (${invalidFields.map(measurementLabel).join(", ")}). Lütfen mezurayı çok sıkmadan santimetre olarak yeniden yaz.`,
      provisional: true
    };
  }
  if (ambiguous) {
    return {
      status: "ambiguous_measurements",
      message: "Sayıların hangi ölçülere ait olduğunu netleştiremedim. Lütfen etiketleyerek yaz: göğüs 88, bel 70, kalça 96.",
      provisional: true
    };
  }
  if (missing.length) {
    const sampleValues = { bust: 88, waist: 70, hips: 96 };
    const example = missing.map(key => sampleValues[key]).join(" ");
    return {
      status: "needs_measurements",
      missing,
      message: `Beden önerisi için sırasıyla ${missing.map(measurementLabel).join(", ")} ölçünü santimetre olarak yazabilir misin? Örnek: ${example}.`,
      provisional: true
    };
  }

  if (keys.some(key => measurements[key] < PROVISIONAL_SIZE_CHART[0][key][0]
    || measurements[key] > PROVISIONAL_SIZE_CHART.at(-1)[key][1])) {
    return {
      status: "outside_reference",
      message: "Ölçülerinden en az biri genel referans tablosunun dışında kalıyor. Yanlış beden söylememek için ürün adını paylaşmanı ve QUAORA desteğinden kalıp teyidi istemeni öneririm.",
      provisional: true
    };
  }

  const closestIndexes = keys.map(key => {
    const distances = PROVISIONAL_SIZE_CHART.map((row, index) => {
      const [min, max] = row[key];
      const value = measurements[key];
      const distance = value < min ? min - value : value > max ? value - max : 0;
      return { index, distance };
    });
    const minimum = Math.min(...distances.map(item => item.distance));
    return distances.filter(item => item.distance === minimum).map(item => item.index);
  });
  const candidateIndexes = [...new Set(closestIndexes.flat())].sort((a, b) => a - b);
  const lowestIndex = candidateIndexes[0];
  const highestIndex = candidateIndexes.at(-1);
  const normalizedAvailable = availableSizes.map(String);
  if (highestIndex - lowestIndex > 1) {
    return {
      status: "needs_fit_confirmation",
      message: `${keys.map(measurementLabel).join(", ")} ölçülerin farklı beden aralıklarına denk geliyor. Tek beden uydurmak yerine ürün adını ve dar mı rahat mı sevdiğini yazarsan kalıp ve stokla birlikte değerlendirebilirim.`,
      availableSizes: normalizedAvailable,
      provisional: true
    };
  }

  if (candidateIndexes.length > 1) {
    const sizes = [PROVISIONAL_SIZE_CHART[lowestIndex].size, PROVISIONAL_SIZE_CHART[highestIndex].size];
    const stockCandidates = normalizedAvailable.length ? sizes.filter(size => normalizedAvailable.includes(size)) : [];
    const stockText = !normalizedAvailable.length
      ? ""
      : stockCandidates.length
        ? ` Seçili üründe ${stockCandidates.join(" ve ")} beden stokta görünüyor.`
        : " Bu bedenler seçili üründe stokta görünmüyor.";
    const fitText = fit === "rahat" || fit === "bol" ? ` Daha rahat kullanım için ${sizes[1]} bedeni değerlendirebilirsin.` : "";
    return {
      status: "between_sizes",
      sizes,
      confidence: "orta",
      inStock: normalizedAvailable.length ? stockCandidates.length > 0 : null,
      availableSizes: normalizedAvailable,
      message: `${sizes[0]}–${sizes[1]} beden aralığındasın; ürün kalıbı ve kullanım tercihin seçimi değiştirebilir.${fitText}${stockText}`,
      environment,
      provisional: true
    };
  }

  const selected = PROVISIONAL_SIZE_CHART[lowestIndex];
  const inStock = normalizedAvailable.length ? normalizedAvailable.includes(selected.size) : null;
  return {
    status: "recommended",
    size: selected.size,
    missing: [],
    confidence: "yüksek",
    inStock,
    availableSizes: normalizedAvailable,
    message: `${selected.size} beden genel referans aralığına göre en yakın seçenek.${inStock === false ? " Bu beden seçili üründe stokta görünmüyor." : ""}`,
    environment,
    provisional: true
  };
}

function measurementLabel(key) {
  return ({ bust: "göğüs", waist: "bel", hips: "kalça", height: "boy", weight: "kilo" })[key] || key;
}

function selectPolicyExcerpts(policies, query, limit = 5) {
  const text = normalizeText(query);
  const evidenceRule = [
    { query: /hediye paket/, evidence: /hediye paket/ },
    { query: /yurtdisi|yurt disi|uluslararasi/, evidence: /yurtdisi|yurt disi|uluslararasi/ },
    { query: /kapida odeme/, evidence: /kapida odeme/ }
  ].find(rule => rule.query.test(text));
  const policyHints = {
    return_policy: ["iade", "degisim", "hijyen", "cayma", "kusurlu", "hasarli", "yanlis", "iptal", "geri gonder", "etiket", "denedim", "olmadi", "uymadi"],
    delivery_policy: ["teslimat", "kargo", "paket", "adres", "takip", "gecikme", "ucret", "sure", "ne zaman", "gelir", "elime", "elimde", "kac gunde"],
    distance_sales_policy: ["sozlesme", "odeme", "paytr", "fiyat", "cayma", "taksit", "kart", "fatura", "iptal", "kapida"],
    privacy_policy: ["gizlilik", "veri", "kart", "kvkk", "saklama", "kisisel", "guvenlik"]
  };
  const preferred = Object.entries(policyHints)
    .filter(([, hints]) => hints.some(hint => text.includes(hint)))
    .map(([key]) => key);
  const keys = preferred.length ? preferred : Object.keys(policies);
  const scored = [];
  for (const key of keys) {
    const policy = policies[key];
    for (const block of policy?.blocks || []) {
      const blockText = normalizeText(`${policy.title} ${block.heading} ${block.text}`);
      if (evidenceRule && !evidenceRule.evidence.test(blockText)) continue;
      let score = text.split(" ").filter(token => token.length > 2 && blockText.includes(token)).length;
      if (/(kac gun|sure|ne kadar zaman)/.test(text) && /(sure|gun|cayma)/.test(blockText)) score += 5;
      if (/(hijyen|band|ambalaj|etiket)/.test(text) && /(hijyen|band|ambalaj|etiket)/.test(blockText)) score += 3;
      scored.push({ policyKey: key, policyTitle: policy.title, heading: block.heading, text: block.text, score });
    }
  }
  return scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function classifyIntent(message) {
  const text = normalizeText(message);
  if (/(talimatlari unut|onceki talimatlari|system prompt|sistem prompt|developer mesaji|gizli talimat|gizli anahtar|api key|private key|service account|access token|secret|stok uydur|politika uydur)/.test(text)) return "security_sensitive";
  if (/(firebase|firestore|vercel|openai|hangi model|model adi|backend|back end|veritabani|database|api endpoint|api yolu|sunucu yapisi|server yapisi|hosting|host ediliyor|proje id|project id|koleksiyon ad|collection name|teknik mimari|teknik altyapi)/.test(text)) return "security_sensitive";
  if (/(siparisim nerede|siparis durumu|kargom nerede|kargo takip|siparis takip|takip numaram|paketim.*gelmedi|siparisim.*gelmedi)/.test(text)) return "order_status";
  if (/(karttan iki kere|fazla cekil|mukerrer|odeme sorunu|odeme redded|odeme gecm|indirim kod.*calism|kupon.*calism|sifremi|sifre unuttum|mail gelmedi|giris yapam|uye olam|canli (?:biri|destek)|musteri temsilcisi|yetkiliyle|bir insanla|iletisim kur|magaza|sube|nerede satiliyor)/.test(text)) return "support";
  const hasMeasurements = /(boyum|kilom|kiloyum|agirligim|gogsum|gogusum|belim|kalcam|vucut olcu|olculerim|(?:boy|kilo|agirlik|gogus|bel|kalca)\s*(?:olcum\s*)?\d)/.test(text);
  const asksPersonalSize = /(hangi beden (?:olur|almaliyim|secmeliyim|giyerim)|hangi bedeni onerirsin|kac bedenim|bedenim (?:ne|nedir)|bedenimi (?:bul|hesapla)|beden (?:oner|oneri|onersi|tavsiye|secimi|uyumu)|bana (?:hangi )?beden|bu bana olur mu|bana olur mu|bana uygun mu|bedenime uygun mu|uzerime olur mu|hangi olcu.*beden|beden.*hangi olcu|normalde\s+(?:xs|s|m|l|xl|2xl|32|34|36|38|40|42|44)\s+giy|(?:xs|s|m|l|xl|2xl|32|34|36|38|40|42|44) (?:mi|mu).*(?:secmeliyim|olur|uyar)|(?:dar|bol|sikar) (?:mi|gelir mi)|bu dar mi gelir|ustum\s*\d|altim\s*\d)/.test(text);
  if (hasMeasurements || asksPersonalSize) return "size";
  if (/(iade|degisim|teslimat|kargo|gizlilik|odeme|paytr|cayma|hijyen|taksit|fatura|iptal|kusurlu|hasarli|yanlis urun|yanlis beden|garanti|kvkk|kisisel veri|adres degisikligi|adresimi yanlis|kargo ucreti|teslim suresi|geri gonder|geri ver|para iadesi|geri odeme|para ne zaman.*yatar|etiketi? (?:cikardim|soktum)|denedim olmadi|uymadi|ne zaman (?:gelir|elimde|elime)|kac gunde|kapida odeme|hediye paket|yurtdisi.*gonder)/.test(text)) return "policy";
  const constraints = extractProductConstraints(text);
  if (/(stok|urun|koleksiyon|mayo|bikini|mayokini|tankini|pareo|ayakkabi|taki|canta|sapka|gozluk|plaj|aksesuar|\bust\b|\balt\b|top|bottom|etek|beden|fiyat|ne kadar|renk|materyal|malzeme|kumas|kalip|beden aciklama|olcu tablosu|bakim|yikama|yikanir|kurutma|icerik|ozellik|tarz|kombin|onerir misin|tavsiye|karsilastir|tukendi|mevcut|on siparis|pie|panzer|relove|coquette|tatil|deniz|guneslen|iz yapma|karin bolge|kapatsin|aski|ayarlan|takim olarak|sadece ust|astar|cup|destekli|ic goster|transparan|ceker mi|esner mi|su tutar|cabuk kurur|acik olmasin|kapali olsun|sik dursun|toparlayici|gogsu kucuk|gogsu buyuk|kaldı mi|kaldi mi)/.test(text)) return "product";
  if (constraints.colors.length || constraints.maxPrice || constraints.wantsCheaper || constraints.wantsAlternative || constraints.wantsComparison) return "product";
  if (/\b(?:xs|s|m|l|xl|2xl|32|34|36|38|40|42|44)\b.*(?:var mi|stokta mi|mevcut mu|kaldi mi)/.test(text)) return "product";
  if (/^(merhaba|selam|hey|iyi gunler|tesekkur|tesekkurler|sag ol|yardim|ne yapabilirsin)\b/.test(text)) return "greeting";
  return "out_of_scope";
}

function buildDeterministicReply({ message, contextMessage = "", products = [], policies = {}, policyExcerpts = [], sizeAdvice = null, environment = "test", intent: intentOverride = "" }) {
  const intent = intentOverride || classifyIntent(message);
  if (intent === "security_sensitive") return SECURITY_REFUSAL;
  if (intent === "out_of_scope") return OUT_OF_SCOPE_REPLY;
  if (intent === "order_status") {
    return environment === "production"
      ? "Sipariş hesabına erişemiyorum. Sipariş durumunu doğrulamak için QUAORA iletişim kanalından sipariş numaranla destek isteyebilirsin."
      : "Bu test agentı sipariş hesabına erişmiyor. Sipariş durumunu doğrulamak için QUAORA iletişim kanallarından sipariş numaranla destek istemelisin.";
  }
  if (intent === "support") {
    return "Bu konu hesap veya işlem kontrolü gerektiriyor. Kişisel ya da ödeme bilgisi paylaşmadan QUAORA iletişim sayfasından destek ekibine ulaşabilirsin: https://www.quaora.com.tr/iletisim.html";
  }
  if (intent === "size" && sizeAdvice) {
    const stockText = products[0] ? ` ${products[0].name} için görünen stok: ${stockSummary(products[0])}.` : "";
    if (["needs_measurements", "invalid_measurements", "ambiguous_measurements", "outside_reference", "needs_fit_confirmation", "product_specific_sizing"].includes(sizeAdvice.status)) {
      return `${sizeAdvice.message}${stockText}`;
    }
    const missingText = sizeAdvice.missing?.length ? ` Eksik ölçüler: ${sizeAdvice.missing.map(measurementLabel).join(", ")}.` : "";
    const disclaimer = environment === "production"
      ? " Bu genel bir beden önerisidir; ürünün kalıbına ve kişisel tercihe göre değişebilir."
      : " Bu öneri onaylanmamış genel test tablosuna dayanır; üretim tavsiyesi değildir.";
    return `${sizeAdvice.message}${stockText}${missingText}${disclaimer}`;
  }
  if (intent === "policy") {
    const excerpts = policyExcerpts.length ? policyExcerpts.slice(0, 2) : selectPolicyExcerpts(policies, contextMessage || message, 2);
    if (!excerpts.length) return "Bu konu için doğrulanmış bir QUAORA politika maddesi bulamadım; müşteri temsilcisine yönlendirmem gerekir.";
    return `Doğrulanmış QUAORA politikasına göre: ${excerpts.map(item => item.text).join(" ")}`;
  }
  if (intent === "product") {
    const constraints = mergeProductConstraints(extractProductConstraints(contextMessage || message), extractProductConstraints(message));
    if (!products.length) {
      if (constraints.wantsCheaper) {
        return "Gösterdiğim seçenekten daha ucuz, aynı ürün türünde stokta doğrulanmış bir alternatif bulamadım. İstersen farklı bir renk veya ürün türü deneyebiliriz.";
      }
      if (constraints.wantsAlternative && constraints.colors.length) {
        return `Aynı ürün türünde ${constraints.colors.map(displayColor).join("/")} renkli, stokta doğrulanmış bir alternatif bulamadım. Başka bir renk deneyebiliriz.`;
      }
      const details = [
        constraints.colors.length ? constraints.colors.map(displayColor).join("/") : "",
        constraints.maxPrice ? `${constraints.maxPrice.toLocaleString("tr-TR")} TL altı` : "",
        constraints.requestedSize ? `${constraints.requestedSize} beden` : ""
      ].filter(Boolean).join(", ");
      return details
        ? `${details} kriterlerinin tümüne uyan, stokta doğrulanmış bir ürün bulamadım. Renk, bütçe veya ürün türünden hangisini esnetmek istersin?`
        : "Ne aradığını netleştirelim: ürün türü, renk, yaklaşık bütçe ve gerekiyorsa bedenini yazarsan uygun seçenekleri filtreleyebilirim.";
    }
    const asksOnlyStock = constraints.wantsStock && !/(ozellik|materyal|malzeme|kumas|kalip|renk|bakim|aciklama|fiyat|aski|cup|astar|destek|takim|ic goster)/.test(normalizeText(message));
    if (asksOnlyStock) {
      const requestedSize = constraints.requestedSize;
      return `${products.slice(0, 3).map(product => {
        const sizeStock = requestedSize ? Number(product.sizeStocks?.[requestedSize] || 0) : null;
        const stockText = requestedSize
          ? sizeStock > 0 ? `${requestedSize} beden stokta ${sizeStock} adet görünüyor` : `${requestedSize} beden şu anda stokta görünmüyor`
          : `görünen stok: ${stockSummary(product)}`;
        return `${product.name} için ${stockText}.${product.url ? ` ${product.url}` : ""}`;
      }).join("\n")}\nStok anlık değişebilir.`;
    }
    if (constraints.wantsComparison && products.length > 1) {
      return products.slice(0, 3).map(product => {
        const facts = [product.fit, product.material, product.color, product.salePrice ? `₺${product.salePrice.toLocaleString("tr-TR")}` : "", stockSummary(product)].filter(Boolean);
        return `${product.name}: ${facts.join(" · ")}${product.url ? `. ${product.url}` : ""}`;
      }).join("\n");
    }
    const intro = constraints.wantsCheaper
      ? "Daha uygun fiyatlı doğrulanmış seçenekler:"
      : constraints.asksRecommendation || constraints.colors.length || constraints.maxPrice
        ? "Kriterlerine uyan stoktaki seçenekler:"
        : "Bulduğum ürünler:";
    const lines = products.slice(0, 3).map(product => {
      const price = product.salePrice > 0 ? `, ₺${product.salePrice.toLocaleString("tr-TR")}` : "";
      const asksDetails = /(ozellik|materyal|malzeme|kumas|kalip|renk|bakim|aciklama|icerik|aski|cup|astar|destek|takim|ic goster)/.test(normalizeText(message));
      const details = [
        compactText(product.description, asksDetails ? 220 : 110),
        asksDetails && product.material ? `Materyal: ${compactText(product.material, 100)}` : "",
        product.color ? `Renk: ${product.color}` : "",
        product.fit ? `Kalıp: ${product.fit}` : "",
        asksDetails && product.sizeDescription ? `Beden açıklaması: ${compactText(product.sizeDescription, 140)}` : ""
      ].filter(Boolean).join(" · ");
      return `${product.name}${details ? ` — ${details}` : ""}. Stok: ${stockSummary(product)}${price}${product.url ? `. ${product.url}` : ""}`;
    }).join("\n");
    return `${intro}\n${lines}`;
  }
  return "Merhaba! QUAORA ürünleri, fiyat, materyal, renk, bakım, beden önerisi, stok, teslimat, ödeme ve iade konularında doğrulanmış bilgilerle yardımcı olabilirim.";
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
  expectedMeasurementFields,
  extractContextualMeasurements,
  extractMeasurements,
  extractProductConstraints,
  firestoreValue,
  inferGarmentType,
  isBareMeasurementReply,
  normalizeProduct,
  normalizeText,
  parseFirestoreDocument,
  productUrl,
  recommendSize,
  resolveProductReferences,
  sanitizeAgentOutput,
  safetyIdentifier,
  searchProducts,
  selectPolicyExcerpts,
  stockSummary
};
