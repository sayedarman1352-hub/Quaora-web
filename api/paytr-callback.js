const crypto = require("crypto");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("");

  try {
    const rawBody = await readRawBody(req);
    const post = Object.fromEntries(new URLSearchParams(rawBody));

    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
    if (!merchantKey || !merchantSalt) return res.status(500).send("PAYTR config error");

    const merchantOid = post.merchant_oid || "";
    const status = post.status || "";
    const totalAmount = post.total_amount || "";
    const paytrHash = post.hash || "";

    const calculatedHash = crypto
      .createHmac("sha256", merchantKey)
      .update(merchantOid + merchantSalt + status + totalAmount)
      .digest("base64");

    if (calculatedHash !== paytrHash) return res.status(403).send("PAYTR notification failed: bad hash");

    console.log("PAYTR callback OK", { merchantOid, status, totalAmount });
    return res.status(200).send("OK");
  } catch (error) {
    console.error("PAYTR callback hata:", error);
    return res.status(500).send("error");
  }
};
