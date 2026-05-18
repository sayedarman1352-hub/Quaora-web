const nodemailer = require("nodemailer");

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "failed", reason: "method_not_allowed" });
  }

  try {
    const body = req.body || {};
    if (body._honey) return res.status(200).json({ status: "success" });

    const name = clean(body.name, 120);
    const phone = clean(body.telefon || body.phone, 80);
    const email = clean(body.email, 180);
    const message = clean(body.message || body.mesaj, 4000);

    if (!name || !phone || !email || !message || !isEmail(email)) {
      return res.status(400).json({ status: "failed", reason: "Eksik veya gecersiz iletisim bilgisi." });
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.CONTACT_TO_EMAIL || "quaoratr@gmail.com";
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "false" ? false : port === 465;

    if (!host || !user || !pass) {
      return res.status(500).json({ status: "failed", reason: "SMTP ayarlari eksik." });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    const subject = clean(body._subject, 180) || "Quaora Iletisim Formu";
    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message);
    const text = [
      "Quaora iletisim formu",
      "",
      `Ad Soyad: ${name}`,
      `Telefon: ${phone}`,
      `E-posta: ${email}`,
      "",
      "Mesaj:",
      message
    ].join("\n");

    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"QUAORA" <${user}>`,
      to,
      replyTo: `"${name.replace(/"/g, "'")}" <${email}>`,
      subject,
      text,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#222">
          <h2>Quaora iletisim formu</h2>
          <p><strong>Ad Soyad:</strong> ${safeName}</p>
          <p><strong>Telefon:</strong> ${safePhone}</p>
          <p><strong>E-posta:</strong> ${safeEmail}</p>
          <p><strong>Mesaj:</strong></p>
          <p style="white-space:pre-line">${safeMessage}</p>
        </div>
      `
    });

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Contact form hata:", error);
    return res.status(500).json({ status: "failed", reason: error.message || "Sunucu hatasi" });
  }
};
