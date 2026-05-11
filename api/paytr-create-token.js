const crypto = require("crypto");
const { PAYTR } = require("./paytr-config");

const cleanText = (value, maxLength) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength);

const clientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim().slice(0, 39);
};

const paytrToken = (hashString) => crypto
  .createHmac("sha256", PAYTR.merchantKey)
  .update(hashString + PAYTR.merchantSalt)
  .digest("base64");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ status: "failed", reason: "Method not allowed" });
    return;
  }

  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
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

    const postValues = new URLSearchParams({
      merchant_id: PAYTR.merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(amount),
      paytr_token: paytrToken(hashString),
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
    res.status(paytrResponse.ok ? 200 : 502);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(text);
  } catch (error) {
    res.status(500).json({ status: "failed", reason: error.message || "PayTR token hatasi" });
  }
};
