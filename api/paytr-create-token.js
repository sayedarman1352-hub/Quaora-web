const crypto = require("crypto");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ status: "failed", reason: "method_not_allowed" });

  try {
    const merchantId = process.env.PAYTR_MERCHANT_ID;
    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
    if (!merchantId || !merchantKey || !merchantSalt) {
      return res.status(500).json({ status: "failed", reason: "PayTR environment variables eksik." });
    }

    const body = req.body || {};
    const merchant_oid = String(body.merchant_oid || "");
    const email = String(body.email || "");
    const payment_amount = String(Math.round(Number(body.payment_amount || 0)));
    const user_name = String(body.user_name || "Quaora Musterisi");
    const user_address = String(body.user_address || "Quaora online siparis");
    const user_phone = String(body.user_phone || "0000000000");
    const basketRaw = Array.isArray(body.basket) && body.basket.length ? body.basket : [["Quaora urun", Number(payment_amount) / 100, 1]];
    const user_basket = Buffer.from(JSON.stringify(basketRaw.map(item => [String(item.name || item[0] || "Quaora urun"), String(Number(item.price || item[1] || 0).toFixed(2)), Number(item.qty || item[2] || 1)]))).toString("base64");

    if (!merchant_oid || !email || Number(payment_amount) <= 0) {
      return res.status(400).json({ status: "failed", reason: "Eksik veya gecersiz siparis bilgisi." });
    }

    const user_ip = getClientIp(req);
    const merchant_ok_url = "https://www.quaora.com.tr/odeme-basarili.html";
    const merchant_fail_url = "https://www.quaora.com.tr/odeme-hata.html";
    const no_installment = "0";
    const max_installment = "0";
    const currency = "TL";
    const test_mode = process.env.PAYTR_TEST_MODE || "1";
    const debug_on = process.env.PAYTR_DEBUG_ON || "1";
    const timeout_limit = "30";
    const lang = "tr";

    const hashStr = merchantId + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + merchantSalt;
    const paytr_token = crypto.createHmac("sha256", merchantKey).update(hashStr).digest("base64");

    const params = new URLSearchParams({
      merchant_id: merchantId,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      debug_on,
      no_installment,
      max_installment,
      user_name,
      user_address,
      user_phone,
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit,
      currency,
      test_mode,
      lang
    });

    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const text = await paytrRes.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { status: "failed", reason: text || "PayTR cevap parse edilemedi." }; }

    if (data.status !== "success") {
      return res.status(400).json({ status: "failed", reason: data.reason || "PayTR token alinamadi." });
    }

    return res.status(200).json({ status: "success", token: data.token });
  } catch (error) {
    console.error("PAYTR create token hata:", error);
    return res.status(500).json({ status: "failed", reason: error.message || "Sunucu hatasi" });
  }
};
