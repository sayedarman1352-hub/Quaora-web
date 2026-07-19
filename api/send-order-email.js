const admin = require("firebase-admin");
const {
  getCustomer,
  sendInvoiceEmail,
  sendPaymentConfirmation
} = require("../lib/order-mail");

const ADMIN_EMAILS = new Set([
  "quaoratr@gmail.com",
  "sayedarman1352@gmail.com",
  "250508501@st.atlas.edu.tr"
]);
const MAX_PDF_BYTES = 3 * 1024 * 1024;

function setCors(req, res) {
  const allowedOrigins = ["https://quaora.com.tr", "https://www.quaora.com.tr"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
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

function initializeAdmin() {
  if (admin.apps.length) return;
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) throw new Error("Firebase Admin env eksik.");
  const normalized = {
    projectId: serviceAccount.projectId || serviceAccount.project_id,
    clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
    privateKey: String(serviceAccount.privateKey || serviceAccount.private_key || "").replace(/\\n/g, "\n")
  };
  admin.initializeApp({
    credential: admin.credential.cert(normalized),
    projectId: normalized.projectId
  });
}

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function requireAdmin(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Admin oturumu bulunamadı."), { statusCode: 401 });
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (error) {
    throw Object.assign(new Error("Admin oturumu geçersiz veya süresi dolmuş."), { statusCode: 401 });
  }
  const email = String(decoded.email || "").toLowerCase();
  if (!ADMIN_EMAILS.has(email)) throw Object.assign(new Error("Bu işlem için admin yetkisi gerekiyor."), { statusCode: 403 });
  return email;
}

function decodePdf(value) {
  const encoded = String(value || "").replace(/^data:application\/pdf;base64,/i, "");
  if (!encoded || !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) throw new Error("Geçerli bir PDF seçmelisiniz.");
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAX_PDF_BYTES) throw new Error("PDF dosyası en fazla 3 MB olabilir.");
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Yüklenen dosya PDF değil.");
  return buffer;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ status: "failed", reason: "method_not_allowed" });

  try {
    initializeAdmin();
    const adminEmail = await requireAdmin(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const orderId = clean(body.orderId, 160);
    const mode = body.mode === "confirmation" ? "confirmation" : "invoice";
    if (!orderId || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
      return res.status(400).json({ status: "failed", reason: "Geçersiz sipariş ID." });
    }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return res.status(404).json({ status: "failed", reason: "Sipariş bulunamadı." });
    const order = snap.data() || {};
    const isPaid = order.paymentStatus === "success" || order.status === "Ödeme onaylandı" || order.stockProcessed === true;
    if (!isPaid) return res.status(409).json({ status: "failed", reason: "Fatura yalnızca ödemesi onaylanan siparişe gönderilebilir." });

    if (mode === "confirmation") {
      const recipient = await sendPaymentConfirmation(orderId, order);
      const sentAt = Date.now();
      await orderRef.update({
        paymentConfirmationEmailSent: true,
        paymentConfirmationEmailStatus: "sent",
        paymentConfirmationEmailSentAt: sentAt,
        paymentConfirmationEmailRecipient: recipient,
        paymentConfirmationEmailResentBy: adminEmail,
        paymentConfirmationEmailError: "",
        updatedAt: sentAt
      });
      return res.status(200).json({ status: "success", recipient, sentAt });
    }

    const pdfBuffer = decodePdf(body.pdfBase64);
    const safeFileName = clean(body.fileName, 180).replace(/[^A-Za-z0-9._-]/g, "_") || `quaora-fatura-${orderId}.pdf`;
    const recipient = await sendInvoiceEmail(orderId, order, pdfBuffer, safeFileName);
    const sentAt = Date.now();
    await orderRef.update({
      invoiceSent: true,
      invoiceEmailStatus: "sent",
      invoiceSentAt: sentAt,
      invoiceSentBy: adminEmail,
      invoiceEmailRecipient: recipient,
      invoiceFileName: safeFileName,
      invoiceFileSize: pdfBuffer.length,
      invoiceEmailError: "",
      updatedAt: sentAt
    });

    return res.status(200).json({ status: "success", recipient, sentAt });
  } catch (error) {
    console.error("Order email hata:", error);
    const statusCode = Number(error.statusCode || 0) || (/PDF|sipariş ID/i.test(error.message || "") ? 400 : 500);
    return res.status(statusCode).json({ status: "failed", reason: error.message || "E-posta gönderilemedi." });
  }
};
