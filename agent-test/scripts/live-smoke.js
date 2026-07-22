"use strict";

const assert = require("node:assert/strict");
const { createCatalogClient } = require("../lib/catalog-client");
const { stockSummary } = require("../lib/agent-core");

async function main() {
  const client = createCatalogClient({ cacheTtlMs: 0 });
  const [catalog, policyData] = await Promise.all([
    client.getCatalog({ allowFixtureFallback: false, forceRefresh: true }),
    client.getPolicies({ allowFallback: true, forceRefresh: true })
  ]);
  assert.equal(catalog.source, "firestore");
  assert.ok(catalog.products.length > 0, "Canlı katalogda ürün bulunamadı.");
  assert.equal(Object.keys(policyData.policies).length, 4);
  assert.ok(catalog.products.every(product => Number.isFinite(product.stock) && product.stock >= 0));
  const sample = catalog.products.slice(0, 5).map(product => ({
    name: product.name,
    collection: product.collection,
    stock: stockSummary(product)
  }));
  console.log(JSON.stringify({
    ok: true,
    access: "read-only",
    catalogSource: catalog.source,
    productCount: catalog.products.length,
    policySource: policyData.source,
    policyCount: Object.keys(policyData.policies).length,
    policyFallbackReason: policyData.error,
    sample
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
