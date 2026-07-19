const crypto = require("crypto");
const admin = require("firebase-admin");
const { sendPaymentConfirmationOnce } = require("../lib/order-mail");

const PRODUCT_COLLECTIONS = [
  "ayakkabilar",
  "bikini-altlari",
  "bikini_ustleri",
  "bottom_products",
  "cantalar",
  "conquette",
  "gozlukler",
  "mayokini_altlari",
  "mayokini_ustleri",
  "mayolar",
  "outlet_products",
  "PANZER",
  "pareolar",
  "PIE",
  "plaj_aksesuarlari",
  "RELOVE",
  "sapkalar",
  "takilar",
  "tops_products"
];

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

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
    if (serviceAccount) {
      const normalizedServiceAccount = {
        projectId: serviceAccount.projectId || serviceAccount.project_id,
        clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
        privateKey: String(serviceAccount.privateKey || serviceAccount.private_key || "").replace(/\\n/g, "\n")
      };

      admin.initializeApp({
        credential: admin.credential.cert(normalizedServiceAccount),
        projectId: normalizedServiceAccount.projectId
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else {
      throw new Error("Firebase Admin env eksik. FIREBASE_SERVICE_ACCOUNT_JSON veya FIREBASE_SERVICE_ACCOUNT_BASE64 eklenmeli.");
    }
  }

  return admin.firestore();
}

function normalizeQty(value) {
  const qty = Number(value || 1);
  return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
}

function getIstanbulDateParts(timestamp = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    monthKey: `${parts.year}-${parts.month}`
  };
}

function paymentTimeFields(timestamp = Date.now()) {
  const parts = getIstanbulDateParts(timestamp);
  return {
    paidAt: timestamp,
    paidAtIso: new Date(timestamp).toISOString(),
    paidDateKey: parts.dateKey,
    paidMonthKey: parts.monthKey
  };
}

async function resolveProductRef(db, item) {
  const productId = String(item.productId || item.id || "").trim();
  if (!productId) return null;

  const collectionName = String(item.collectionName || "").trim();
  if (collectionName && PRODUCT_COLLECTIONS.includes(collectionName)) {
    return db.collection(collectionName).doc(productId);
  }

  for (const name of PRODUCT_COLLECTIONS) {
    const ref = db.collection(name).doc(productId);
    const snap = await ref.get();
    if (snap.exists) return ref;
  }

  return null;
}

async function confirmOrderAndDecreaseStock(merchantOid, paytrStatus, totalAmount, failedReasonCode = "", failedReasonMsg = "") {
  const db = getDb();
  const orderRef = db.collection("orders").doc(merchantOid);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    console.warn("PAYTR callback order not found", { merchantOid });
    return;
  }

  if (paytrStatus !== "success") {
    await orderRef.update({
      status: "Ödeme başarısız",
      paymentStatus: paytrStatus,
      paytrTotalAmount: Number(totalAmount || 0),
      paytrFailReasonCode: failedReasonCode,
      paytrFailReasonMsg: failedReasonMsg,
      updatedAt: Date.now()
    });
    return;
  }

  const order = orderSnap.data() || {};
  if (order.stockProcessed === true) {
    const paidFields = order.paidAt ? {} : paymentTimeFields();
    await orderRef.update({
      status: "Ödeme onaylandı",
      paymentStatus: "success",
      paytrTotalAmount: Number(totalAmount || 0),
      ...paidFields,
      updatedAt: Date.now()
    });
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const resolvedItems = [];

  for (const item of items) {
    const ref = await resolveProductRef(db, item);
    if (!ref) {
      console.warn("PAYTR callback product not found", {
        merchantOid,
        productId: item.productId || item.id || "",
        collectionName: item.collectionName || ""
      });
      continue;
    }
    resolvedItems.push({ item, ref });
  }

  await db.runTransaction(async (transaction) => {
    const freshOrder = await transaction.get(orderRef);
    if (!freshOrder.exists) throw new Error("order_not_found");

    const freshOrderData = freshOrder.data() || {};
    if (freshOrderData.stockProcessed === true) {
      const paidFields = freshOrderData.paidAt ? {} : paymentTimeFields();
      transaction.update(orderRef, {
        status: "Ödeme onaylandı",
        paymentStatus: "success",
        paytrTotalAmount: Number(totalAmount || 0),
        ...paidFields,
        updatedAt: Date.now()
      });
      return;
    }

    const productSnaps = [];
    for (const { item, ref } of resolvedItems) {
      const productSnap = await transaction.get(ref);
      productSnaps.push({ item, ref, productSnap });
    }

    for (const { item, ref, productSnap } of productSnaps) {
      if (!productSnap.exists) continue;
      const product = productSnap.data() || {};
      const size = String(item.size || "").trim();
      const qty = normalizeQty(item.qty);
      const sizeStocks = product.sizeStocks || {};
      const storedTotalStock = Number(product.stock);
      const currentTotalStock = Number.isFinite(storedTotalStock)
        ? storedTotalStock
        : Object.values(sizeStocks).reduce((sum, value) => sum + Number(value || 0), 0);
      const nextTotalStock = Math.max(0, currentTotalStock - qty);

      if (size) {
        const currentSizeStock = Number(sizeStocks[size] || 0);
        const nextSizeStock = Math.max(0, currentSizeStock - qty);
        transaction.update(
          ref,
          new admin.firestore.FieldPath("sizeStocks", size),
          nextSizeStock,
          "stock",
          nextTotalStock,
          "updatedAt",
          Date.now()
        );
      } else {
        transaction.update(ref, {
          stock: nextTotalStock,
          updatedAt: Date.now()
        });
      }
    }

    const paidAt = Date.now();
    transaction.update(orderRef, {
      status: "Ödeme onaylandı",
      paymentStatus: "success",
      paytrTotalAmount: Number(totalAmount || 0),
      stockProcessed: true,
      stockProcessedAt: paidAt,
      ...paymentTimeFields(paidAt),
      updatedAt: paidAt
    });
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
    const failedReasonCode = post.failed_reason_code || post.reason_code || "";
    const failedReasonMsg = post.failed_reason_msg || post.failed_reason || post.reason || "";

    const calculatedHash = crypto
      .createHmac("sha256", merchantKey)
      .update(merchantOid + merchantSalt + status + totalAmount)
      .digest("base64");

    if (calculatedHash !== paytrHash) return res.status(403).send("PAYTR notification failed: bad hash");

    await confirmOrderAndDecreaseStock(merchantOid, status, totalAmount, failedReasonCode, failedReasonMsg);
    if (status === "success") {
      const db = getDb();
      const orderRef = db.collection("orders").doc(merchantOid);
      await sendPaymentConfirmationOnce(db, orderRef, merchantOid).catch((emailError) => {
        console.error("PAYTR ödeme onay e-postası gönderilemedi:", {
          merchantOid,
          message: emailError.message || String(emailError)
        });
      });
    }
    console.log("PAYTR callback OK", { merchantOid, status, totalAmount, failedReasonCode, failedReasonMsg });
    return res.status(200).send("OK");
  } catch (error) {
    console.error("PAYTR callback hata:", error);
    return res.status(500).send("error");
  }
};
