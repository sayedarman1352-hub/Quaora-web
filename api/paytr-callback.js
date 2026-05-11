const crypto = require("crypto");
const { PAYTR } = require("./paytr-config");

let adminApp = null;

const getAdmin = () => {
  if (adminApp) return adminApp;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;

  const admin = require("firebase-admin");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  adminApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return adminApp;
};

const parseBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  return Object.fromEntries(new URLSearchParams(String(req.body || "")));
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("");
    return;
  }

  try {
    const post = parseBody(req);
    const hashString = `${post.merchant_oid || ""}${PAYTR.merchantSalt}${post.status || ""}${post.total_amount || ""}`;
    const expectedHash = crypto
      .createHmac("sha256", PAYTR.merchantKey)
      .update(hashString)
      .digest("base64");

    if (expectedHash !== post.hash) {
      res.status(403).send("PAYTR notification failed: bad hash");
      return;
    }

    const app = getAdmin();
    const merchantOid = String(post.merchant_oid || "").replace(/[^A-Za-z0-9]/g, "");

    if (app && merchantOid) {
      const admin = require("firebase-admin");
      const db = admin.firestore();
      const status = post.status === "success" ? "Odeme onaylandi" : "Odeme basarisiz";

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
  } catch (error) {
    console.error(error);
    res.status(200).send("OK");
  }
};
