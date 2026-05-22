const crypto = require("crypto");
const admin = require("firebase-admin");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

function setCors(req, res) {
  const allowedOrigins = ["https://quaora.com.tr", "https://www.quaora.com.tr"];
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes(origin) ? origin : "https://www.quaora.com.tr");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanEnv(value) {
  return String(value || "").trim();
}

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }
  return null;
}

function getDb() {
  if (!admin.apps.length) {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) throw new Error("Firebase Admin env eksik.");
    const normalizedServiceAccount = {
      projectId: serviceAccount.projectId || serviceAccount.project_id,
      clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
      privateKey: String(serviceAccount.privateKey || serviceAccount.private_key || "").replace(/\\n/g, "\n")
    };
    admin.initializeApp({
      credential: admin.credential.cert(normalizedServiceAccount),
      projectId: normalizedServiceAccount.projectId
    });
  }
  return admin.firestore();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ status: "failed", reason: "method_not_allowed" });

  try {
    const merchantId = cleanEnv(process.env.PAYTR_MERCHANT_ID);
    const merchantKey = cleanEnv(process.env.PAYTR_MERCHANT_KEY);
    const merchantSalt = cleanEnv(process.env.PAYTR_MERCHANT_SALT);
    if (!merchantId || !merchantKey || !merchantSalt) {
      return res.status(500).json({ status: "failed", reason: "PayTR environment variables eksik." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const order = body.order || {};
    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const total = Number(order.total || 0);
    const email = String(customer.email || order.userEmail || "");

    if (!isEmail(email) || !customer.name || !customer.phone || !customer.address || items.length === 0 || total <= 0) {
      return res.status(400).json({ status: "failed", reason: "Eksik veya gecersiz misafir siparis bilgisi." });
    }

    const db = getDb();
    const orderRef = await db.collection("orders").add({
      ...order,
      userId: "",
      userEmail: email,
      isGuest: true,
      status: "PayTR odeme baslatildi",
      paytrTokenCreated: false,
      createdBy: "guest-checkout",
      updatedAt: Date.now()
    });

    const paymentAmount = String(Math.round(Number(body.payment_amount || total * 100)));
    const basketRaw = Array.isArray(body.basket) && body.basket.length
      ? body.basket
      : items.map(item => ({
        name: item.productName || item.name || "Quaora urun",
        price: Number(item.price || 0),
        qty: Number(item.qty || 1)
      }));
    const userBasket = Buffer.from(JSON.stringify(basketRaw.map(item => [
      String(item.name || item[0] || "Quaora urun"),
      String(Number(item.price || item[1] || 0).toFixed(2)),
      Number(item.qty || item[2] || 1)
    ]))).toString("base64");

    const userIp = getClientIp(req);
    const noInstallment = "0";
    const maxInstallment = "0";
    const currency = "TL";
    const testMode = cleanEnv(process.env.PAYTR_TEST_MODE || "0");
    const debugOn = cleanEnv(process.env.PAYTR_DEBUG_ON || "1");
    const merchantOkUrl = "https://www.quaora.com.tr/odeme-basarili.html";
    const merchantFailUrl = "https://www.quaora.com.tr/odeme-hata.html";
    const hashStr = merchantId + userIp + orderRef.id + email + paymentAmount + userBasket + noInstallment + maxInstallment + currency + testMode + merchantSalt;
    const paytrToken = crypto.createHmac("sha256", merchantKey).update(hashStr).digest("base64");

    const params = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: orderRef.id,
      email,
      payment_amount: paymentAmount,
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: debugOn,
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: String(customer.name),
      user_address: String(customer.address),
      user_phone: String(customer.phone),
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr"
    });

    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const text = await paytrRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text ? text.slice(0, 240) : "bos cevap";
      data = { status: "failed", reason: `PayTR cevap parse edilemedi. HTTP ${paytrRes.status}: ${preview}` };
    }

    if (data.status !== "success") {
      await orderRef.update({ status: "PayTR baslatma hatasi", paytrError: data.reason || "PayTR token alinamadi.", updatedAt: Date.now() }).catch(() => {});
      return res.status(400).json({ status: "failed", reason: data.reason || "PayTR token alinamadi." });
    }

    if (order.promoCode) {
      await db.collection("discount_codes").doc(String(order.promoCode)).set({
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: Date.now()
      }, { merge: true }).catch(() => {});
    }
    await orderRef.update({ paytrTokenCreated: true, updatedAt: Date.now() }).catch(() => {});
    return res.status(200).json({ status: "success", token: data.token, orderId: orderRef.id });
  } catch (error) {
    console.error("Guest checkout hata:", error);
    return res.status(500).json({ status: "failed", reason: error.message || "Sunucu hatasi" });
  }
};
