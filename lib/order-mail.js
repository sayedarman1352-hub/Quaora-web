const nodemailer = require("nodemailer");

const PAYMENT_EMAIL_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(Number(value || 0));
}

function orderNumber(orderId) {
  return clean(orderId, 120).toUpperCase();
}

function getCustomer(order) {
  const customer = order?.customer || {};
  return {
    name: clean(customer.name || order?.userName || order?.name || "Quaora müşterisi", 160),
    email: clean(customer.email || order?.userEmail, 180),
    phone: clean(customer.phone || order?.userPhone || order?.phone, 80),
    address: clean(customer.address || order?.shippingAddress || order?.address, 500)
  };
}

function getItems(order) {
  if (Array.isArray(order?.items) && order.items.length) return order.items;
  return [{
    productName: order?.productName || order?.name || "Quaora ürünü",
    size: order?.size || "",
    qty: order?.qty || 1,
    price: order?.price || order?.total || 0
  }];
}

function getTotal(order) {
  const itemsTotal = getItems(order).reduce(
    (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.qty || 1)),
    0
  );
  return Number(order?.total ?? Math.max(0, itemsTotal - Number(order?.discount || 0)));
}

function createTransporter() {
  const host = clean(process.env.SMTP_HOST, 255);
  const port = Number(process.env.SMTP_PORT || 465);
  const user = clean(process.env.SMTP_USER, 255);
  const pass = String(process.env.SMTP_PASS || "");
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "false" ? false : port === 465;
  if (!host || !user || !pass) throw new Error("SMTP ayarları eksik.");

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000
    }),
    from: process.env.MAIL_FROM || `"QUAORA" <${user}>`
  };
}

function renderItemsText(order) {
  return getItems(order).map((item) => {
    const qty = Math.max(1, Number(item.qty || 1));
    const size = clean(item.size || item.selectedSize, 80);
    return `- ${clean(item.productName || item.name || "Ürün", 220)}${size ? ` / Beden: ${size}` : ""} / Adet: ${qty} / ${money(Number(item.price || 0) * qty)}`;
  }).join("\n");
}

function renderItemsHtml(order) {
  return getItems(order).map((item) => {
    const qty = Math.max(1, Number(item.qty || 1));
    const size = clean(item.size || item.selectedSize, 80);
    return `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #e7e1d8"><strong>${escapeHtml(clean(item.productName || item.name || "Ürün", 220))}</strong>${size ? `<br><span style="color:#6f655c;font-size:12px">Beden: ${escapeHtml(size)}</span>` : ""}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e7e1d8;text-align:center">${qty}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e7e1d8;text-align:right;font-weight:700">${escapeHtml(money(Number(item.price || 0) * qty))}</td>
      </tr>`;
  }).join("");
}

function buildPaymentConfirmationMessage(orderId, order) {
  const customer = getCustomer(order);
  const number = orderNumber(orderId);
  const total = money(getTotal(order));
  const preorderNote = order?.containsPreorder
    ? "Siparişinizde önsipariş ürünü bulunuyor; ürün sayfasında belirtilen tahmini teslim tarihi geçerlidir."
    : "Siparişiniz hazırlanmaya alınacak ve yakın zamanda teslimat süreci başlayacaktır.";

  const text = [
    `Merhaba ${customer.name},`,
    "",
    "Ödemeniz başarıyla alınmış ve siparişiniz onaylanmıştır.",
    preorderNote,
    "Faturanız için bu e-posta adresi kaydedildi. GİB/e-Arşiv faturanız ayrıca bu adrese gönderilecektir.",
    "",
    `Sipariş No: ${number}`,
    `Toplam: ${total}`,
    "",
    renderItemsText(order),
    "",
    "Teşekkür ederiz.",
    "QUAORA"
  ].join("\n");

  const html = `
    <div style="margin:0;padding:28px 16px;background:#f4efe7;font-family:Arial,sans-serif;color:#171717">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ddd5c9">
        <div style="padding:24px 28px;background:#111111;color:#ffffff">
          <div style="font-family:Georgia,serif;font-size:26px;letter-spacing:5px">QUAORA</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#d8c7ac">ÖDEME ONAYLANDI</div>
        </div>
        <div style="padding:28px">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:30px;font-weight:500">Teşekkürler, ${escapeHtml(customer.name)}.</h1>
          <p style="margin:0 0 12px;line-height:1.7">Ödemeniz başarıyla alınmış ve siparişiniz onaylanmıştır.</p>
          <p style="margin:0 0 12px;line-height:1.7">${escapeHtml(preorderNote)}</p>
          <p style="margin:0 0 22px;line-height:1.7">Faturanız için bu e-posta adresi kaydedildi. GİB/e-Arşiv faturanız ayrıca bu adrese gönderilecektir.</p>
          <div style="padding:16px;background:#faf7f2;border:1px solid #e7e1d8">
            <div style="font-size:12px;color:#6f655c">Sipariş No</div>
            <div style="margin-top:4px;font-weight:700">${escapeHtml(number)}</div>
          </div>
          <table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:14px">
            <thead><tr><th style="padding:8px;text-align:left">Ürün</th><th style="padding:8px;text-align:center">Adet</th><th style="padding:8px;text-align:right">Tutar</th></tr></thead>
            <tbody>${renderItemsHtml(order)}</tbody>
          </table>
          <div style="margin-top:18px;text-align:right;font-size:19px;font-weight:700">Toplam: ${escapeHtml(total)}</div>
        </div>
      </div>
    </div>`;

  return {
    subject: `Ödemeniz alındı - Quaora sipariş ${number}`,
    text,
    html
  };
}

function buildInvoiceMessage(orderId, order) {
  const customer = getCustomer(order);
  const number = orderNumber(orderId);
  const text = [
    `Merhaba ${customer.name},`,
    "",
    "Ödemeniz alınmıştır. Siparişiniz hazırlanıyor ve yakın zamanda teslimat süreci başlayacaktır.",
    "Faturanız bu e-postaya PDF olarak eklenmiştir.",
    "",
    `Sipariş No: ${number}`,
    `Toplam: ${money(getTotal(order))}`,
    "",
    "Teşekkür ederiz.",
    "QUAORA"
  ].join("\n");

  const html = `
    <div style="margin:0;padding:28px 16px;background:#f4efe7;font-family:Arial,sans-serif;color:#171717">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #ddd5c9">
        <div style="padding:24px 28px;background:#111111;color:#ffffff;font-family:Georgia,serif;font-size:26px;letter-spacing:5px">QUAORA</div>
        <div style="padding:28px">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:500">Faturanız hazır.</h1>
          <p style="margin:0 0 12px;line-height:1.7">Merhaba ${escapeHtml(customer.name)}, ödemeniz alınmıştır. Siparişiniz hazırlanıyor ve yakın zamanda teslimat süreci başlayacaktır.</p>
          <p style="margin:0 0 20px;line-height:1.7"><strong>Faturanız bu e-postaya PDF olarak eklenmiştir.</strong></p>
          <div style="padding:16px;background:#faf7f2;border:1px solid #e7e1d8">
            <div style="font-size:12px;color:#6f655c">Sipariş No</div>
            <div style="margin-top:4px;font-weight:700">${escapeHtml(number)}</div>
          </div>
        </div>
      </div>
    </div>`;

  return {
    subject: `Quaora faturanız - Sipariş ${number}`,
    text,
    html
  };
}

async function sendPaymentConfirmationOnce(db, orderRef, orderId) {
  const now = Date.now();
  let claimedOrder = null;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(orderRef);
    if (!snap.exists) throw new Error("Sipariş bulunamadı.");
    const order = snap.data() || {};
    if (order.paymentConfirmationEmailSent === true) return;

    const claimedAt = Number(order.paymentConfirmationEmailClaimedAt || 0);
    if (order.paymentConfirmationEmailStatus === "sending" && now - claimedAt < PAYMENT_EMAIL_CLAIM_TIMEOUT_MS) return;

    const customer = getCustomer(order);
    if (!isEmail(customer.email)) throw new Error("Sipariş e-posta adresi geçersiz.");
    claimedOrder = order;
    transaction.update(orderRef, {
      paymentConfirmationEmailStatus: "sending",
      paymentConfirmationEmailClaimedAt: now,
      paymentConfirmationEmailError: "",
      updatedAt: now
    });
  });

  if (!claimedOrder) return { sent: false, reason: "already_sent_or_sending" };

  const customer = getCustomer(claimedOrder);
  try {
    const { transporter, from } = createTransporter();
    const message = buildPaymentConfirmationMessage(orderId, claimedOrder);
    await transporter.sendMail({ from, to: customer.email, ...message });
    const sentAt = Date.now();
    await orderRef.update({
      paymentConfirmationEmailSent: true,
      paymentConfirmationEmailStatus: "sent",
      paymentConfirmationEmailSentAt: sentAt,
      paymentConfirmationEmailRecipient: customer.email,
      paymentConfirmationEmailError: "",
      updatedAt: sentAt
    });
    return { sent: true };
  } catch (error) {
    await orderRef.update({
      paymentConfirmationEmailStatus: "failed",
      paymentConfirmationEmailClaimedAt: null,
      paymentConfirmationEmailError: clean(error.message || "E-posta gönderilemedi.", 500),
      updatedAt: Date.now()
    }).catch(() => {});
    throw error;
  }
}

async function sendInvoiceEmail(orderId, order, pdfBuffer, fileName) {
  const customer = getCustomer(order);
  if (!isEmail(customer.email)) throw new Error("Sipariş e-posta adresi geçersiz.");
  const { transporter, from } = createTransporter();
  const message = buildInvoiceMessage(orderId, order);
  await transporter.sendMail({
    from,
    to: customer.email,
    ...message,
    attachments: [{
      filename: clean(fileName, 180) || `quaora-fatura-${orderNumber(orderId)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf"
    }]
  });
  return customer.email;
}

async function sendPaymentConfirmation(orderId, order) {
  const customer = getCustomer(order);
  if (!isEmail(customer.email)) throw new Error("Sipariş e-posta adresi geçersiz.");
  const { transporter, from } = createTransporter();
  const message = buildPaymentConfirmationMessage(orderId, order);
  await transporter.sendMail({ from, to: customer.email, ...message });
  return customer.email;
}

module.exports = {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  getCustomer,
  isEmail,
  sendInvoiceEmail,
  sendPaymentConfirmation,
  sendPaymentConfirmationOnce
};
