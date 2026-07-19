# QUAORA Vercel + PayTR Notu

Bu pakette Vercel API endpointleri hazırdır:

- Token: `https://www.quaora.com.tr/api/paytr-create-token`
- PayTR Bildirim URL: `https://www.quaora.com.tr/api/paytr-callback`

Vercel Environment Variables içinde Production için şu 3 değer olmalı:

- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`

İsteğe bağlı:

- `PAYTR_TEST_MODE=1` test için, canlı için `0`
- `PAYTR_DEBUG_ON=1`
- `PAYTR_OK_URL=https://www.quaora.com.tr/odeme-basarili.html`
- `PAYTR_FAIL_URL=https://www.quaora.com.tr/odeme-hata.html`

Ödeme onayı ve fatura e-postaları için Production ortamında ayrıca şunlar bulunmalı:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE=false` (587 portu kullanılıyorsa)
- `MAIL_FROM` (örnek: `"QUAORA" <quaoratr@gmail.com>`)

PayTR başarılı callback'i müşteriye otomatik ödeme onayı gönderir. GİB veya muhasebe
sisteminden alınan gerçek PDF fatura, admin sipariş detayındaki "Faturayı E-postala"
alanından müşterinin satın alırken verdiği e-posta adresine gönderilir.

Deploy:

```powershell
cd C:\Users\Armanm\Desktop\quaoratr
npx vercel --prod
```
