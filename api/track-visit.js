const admin = require("firebase-admin");

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

function cleanPageKey(value) {
  return String(value || "_home").replace(/[^a-z0-9]/gi, "_").slice(0, 80) || "_home";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const db = getDb();
    const now = Date.now();
    const dateParts = getIstanbulDateParts(now);
    const pageKey = cleanPageKey(body.pageKey || body.path);
    const path = String(body.path || "/").slice(0, 200);
    const isUniqueToday = body.isUniqueToday === true;
    const ref = db.collection("site_visits").doc(dateParts.dateKey);

    await ref.set({
      dateKey: dateParts.dateKey,
      monthKey: dateParts.monthKey,
      totalViews: admin.firestore.FieldValue.increment(1),
      uniqueVisitors: admin.firestore.FieldValue.increment(isUniqueToday ? 1 : 0),
      [`pageViews.${pageKey}`]: admin.firestore.FieldValue.increment(1),
      [`pageLabels.${pageKey}`]: path,
      lastPath: path,
      updatedAt: now
    }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("track visit hata:", error);
    return res.status(200).json({ ok: false });
  }
};
