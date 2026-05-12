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

Deploy:

```powershell
cd C:\Users\Armanm\Desktop\quaoratr
npx vercel --prod
```
