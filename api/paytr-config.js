const PAYTR = {
  merchantId: process.env.PAYTR_MERCHANT_ID || "700559",
  merchantKey: process.env.PAYTR_MERCHANT_KEY || "kLdLxbUbj4a7CxeW",
  merchantSalt: process.env.PAYTR_MERCHANT_SALT || "WdCrimu9J6jKG3AU",
  baseUrl: process.env.SITE_URL || "https://quaora.com.tr",
  testMode: process.env.PAYTR_TEST_MODE || "0",
  debugOn: process.env.PAYTR_DEBUG_ON || "1",
  noInstallment: process.env.PAYTR_NO_INSTALLMENT || "0",
  maxInstallment: process.env.PAYTR_MAX_INSTALLMENT || "0",
  currency: "TL",
  timeoutLimit: "30"
};

module.exports = { PAYTR };
