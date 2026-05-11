const crypto = require("crypto");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

admin.initializeApp();

const PAYTR = {
  merchantId: process.env.PAYTR_MERCHANT_ID || "700559",
  merchantKey: process.env.PAYTR_MERCHANT_KEY || "kLdLxbUbj4a7CxeW",
  merchantSalt: process.env.PAYTR_MERCHANT_SALT || "WdCrimu9J6jKG3AU",
  baseUrl: "https://quaora.com.tr",
  testMode: "0",
  debugOn: "1",
  noInstallment: "0",
  maxInstallment: "0",
  currency: "TL",
  timeoutLimit: "30"
};

const cleanText = (value, maxLength) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength);

const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.ip || "127.0.0.1").split(",")[0].trim().slice(0, 39);
};

const createToken = (hashString) => crypto
  .createHmac("sha256", PAYTR.merchantKey)
  .update(hashString + PAYTR.merchantSalt)
  .digest("base64");

const parseCallbackBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.body || "");
  return Object.fromEntries(new URLSearchParams(raw));
};

exports.createPaytrToken = onRequest({ region: "europe-west1", cors: false }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ status: "failed", reason: "Method not allowed" });
    return;
  }

  try {
    const payload = typeof req.body === "object" && req.body ? req.body : {};
    const merchantOid = String(payload.merchant_oid || "").replace(/[^A-Za-z0-9]/g, "");
    const email = cleanText(payload.email, 100);
    const amount = Number.parseInt(payload.payment_amount, 10);
    const basket = Array.isArray(payload.basket) ? payload.basket : [];

    if (!merchantOid || merchantOid.length > 64 || !email.includes("@") || amount <= 0 || basket.length === 0) {
      res.status(422).json({ status: "failed", reason: "Eksik veya gecersiz odeme bilgisi" });
      return;
    }

    const basketRows = basket.slice(0, 50).map((item) => [
      cleanText(item.name || "Quaora urun", 120),
      Math.max(0, Number(item.price || 0)).toFixed(2),
      Math.max(1, Number.parseInt(item.qty || 1, 10))
    ]);

    const userBasket = Buffer.from(JSON.stringify(basketRows), "utf8").toString("base64");
    const userIp = clientIp(req);
    const hashString = PAYTR.merchantId + userIp + merchantOid + email + amount + userBasket + PAYTR.noInstallment + PAYTR.maxInstallment + PAYTR.currency + PAYTR.testMode;
    const paytrToken = createToken(hashString);

    const postValues = new URLSearchParams({
      merchant_id: PAYTR.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(amount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: PAYTR.debugOn,
      no_installment: PAYTR.noInstallment,
      max_installment: PAYTR.maxInstallment,
      user_name: cleanText(payload.user_name || "Quaora Musterisi", 60),
      user_address: cleanText(payload.user_address || "Quaora online siparis", 400),
      user_phone: cleanText(payload.user_phone || "0000000000", 20),
      merchant_ok_url: `${PAYTR.baseUrl}/odeme-basarili.html`,
      merchant_fail_url: `${PAYTR.baseUrl}/odeme-hata.html`,
      timeout_limit: PAYTR.timeoutLimit,
      currency: PAYTR.currency,
      test_mode: PAYTR.testMode,
      lang: "tr"
    });

    const paytrResponse = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postValues
    });
    const text = await paytrResponse.text();
    res.status(paytrResponse.ok ? 200 : 502).type("application/json").send(text);
  } catch (error) {
    res.status(500).json({ status: "failed", reason: error.message || "PayTR token hatasi" });
  }
});

exports.paytrCallback = onRequest({ region: "europe-west1", cors: false }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("");
    return;
  }

  const post = parseCallbackBody(req);
  const hashString = `${post.merchant_oid || ""}${PAYTR.merchantSalt}${post.status || ""}${post.total_amount || ""}`;
  const expectedHash = crypto
    .createHmac("sha256", PAYTR.merchantKey)
    .update(hashString)
    .digest("base64");

  if (expectedHash !== post.hash) {
    res.status(403).send("PAYTR notification failed: bad hash");
    return;
  }

  const db = admin.firestore();
  const merchantOid = String(post.merchant_oid || "").replace(/[^A-Za-z0-9]/g, "");
  const status = post.status === "success" ? "Odeme onaylandi" : "Odeme basarisiz";

  if (merchantOid) {
    await db.collection("orders").doc(merchantOid).set({
      status,
      paytrStatus: post.status || "",
      paytrTotalAmount: Number(post.total_amount || 0),
      paytrFailedReasonCode: post.failed_reason_code || "",
      paytrFailedReasonMsg: post.failed_reason_msg || "",
      paytrCallbackAt: Date.now()
    }, { merge: true });

    await db.collection("paytr_notifications").add({
      merchantOid,
      status: post.status || "",
      totalAmount: post.total_amount || "",
      payload: post,
      createdAt: Date.now()
    });
  }

  res.status(200).send("OK");
});
