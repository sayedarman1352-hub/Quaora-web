"use strict";

const fixtureProducts = require("../data/products.fixture.json");
const fallbackPolicies = require("../data/policies.json");
const { COLLECTIONS, normalizeProduct, parseFirestoreDocument } = require("./agent-core");

const PROJECT_ID = "quaora-web";
const POLICY_DOCUMENTS = Object.freeze({
  distance_sales_policy: "policy_distance_sales",
  delivery_policy: "policy_delivery",
  return_policy: "policy_return",
  privacy_policy: "policy_privacy"
});

function createCatalogClient({
  fetchImpl = globalThis.fetch,
  apiKey = process.env.FIREBASE_WEB_API_KEY || "",
  cacheTtlMs = 60_000,
  now = () => Date.now()
} = {}) {
  let catalogCache = null;
  let policyCache = null;

  async function getCatalog({ allowFixtureFallback = true, forceRefresh = false } = {}) {
    if (!forceRefresh && catalogCache && now() - catalogCache.loadedAt < cacheTtlMs) return catalogCache;
    try {
      const batches = await Promise.all(Object.keys(COLLECTIONS).map(collection => fetchCollection(fetchImpl, apiKey, collection)));
      const products = batches.flat();
      if (!products.length) throw new Error("Firestore kataloğu boş döndü.");
      catalogCache = { products, source: "firestore", loadedAt: now(), error: null };
    } catch (error) {
      if (!allowFixtureFallback) throw error;
      catalogCache = {
        products: fixtureProducts.map(normalizeProduct),
        source: "fixture",
        loadedAt: now(),
        error: error.message
      };
    }
    return catalogCache;
  }

  async function getPolicies({ allowFallback = true, forceRefresh = false } = {}) {
    if (!forceRefresh && policyCache && now() - policyCache.loadedAt < cacheTtlMs) return policyCache;
    const results = await Promise.all(Object.entries(POLICY_DOCUMENTS).map(async ([key, documentId]) => {
      try {
        const data = await fetchDocument(fetchImpl, apiKey, "page_settings", documentId);
        return { key, policy: normalizePolicy(data, fallbackPolicies[key]), source: "firestore", error: null };
      } catch (error) {
        if (!allowFallback) throw error;
        return { key, policy: fallbackPolicies[key], source: "local-fallback", error: `${documentId}: ${error.message}` };
      }
    }));
    const liveCount = results.filter(result => result.source === "firestore").length;
    policyCache = {
      policies: Object.fromEntries(results.map(result => [result.key, result.policy])),
      source: liveCount === results.length ? "firestore" : (liveCount ? "mixed" : "local-fallback"),
      loadedAt: now(),
      error: results.map(result => result.error).filter(Boolean).join(" | ") || null
    };
    return policyCache;
  }

  return { getCatalog, getPolicies };
}

async function fetchCollection(fetchImpl, apiKey, collection) {
  const url = firestoreUrl(collection, "", apiKey, { pageSize: "100" });
  const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Firestore ${collection} isteği başarısız (${response.status}).`);
  const body = await response.json();
  return (body.documents || []).map(document => parseFirestoreDocument(document, collection));
}

async function fetchDocument(fetchImpl, apiKey, collection, documentId) {
  const response = await fetchImpl(firestoreUrl(collection, documentId, apiKey), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Firestore ${collection}/${documentId} isteği başarısız (${response.status}).`);
  const document = await response.json();
  return Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, require("./agent-core").firestoreValue(value)])
  );
}

function normalizePolicy(data, fallback) {
  const blocks = Array.isArray(data?.blocks)
    ? data.blocks.map(block => ({ heading: String(block?.heading || ""), text: String(block?.text || "") })).filter(block => block.heading || block.text)
    : [];
  return {
    title: String(data?.title || fallback?.title || "Politika"),
    subtitle: String(data?.subtitle || fallback?.subtitle || ""),
    blocks: blocks.length ? blocks : (fallback?.blocks || [])
  };
}

function firestoreUrl(collection, documentId, apiKey, query = {}) {
  const path = [collection, documentId].filter(Boolean).map(encodeURIComponent).join("/");
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`);
  if (apiKey) url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.href;
}

module.exports = {
  POLICY_DOCUMENTS,
  createCatalogClient,
  fetchCollection,
  fetchDocument,
  firestoreUrl,
  normalizePolicy
};
