# Quaora PayTR Vercel Deploy

PayTR backend artik Firebase Functions degil, Vercel `/api` serverless route'lari ile calisir.

## Vercel API adresleri

- Token: `https://quaora.com.tr/api/paytr-create-token`
- PayTR Bildirim URL: `https://quaora.com.tr/api/paytr-callback`

## Vercel ortam degiskenleri

Vercel Dashboard > Project > Settings > Environment Variables alanina eklenebilir:

```text
PAYTR_MERCHANT_ID=700559
PAYTR_MERCHANT_KEY=...
PAYTR_MERCHANT_SALT=...
SITE_URL=https://quaora.com.tr
```

Siparis durumunu PayTR callback ile Firestore'da guncellemek istersen:

```text
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

`FIREBASE_SERVICE_ACCOUNT` yoksa callback hash kontrolunu yapip PayTR'a `OK` doner, ama Firestore siparis durumunu sunucudan guncellemez.

## Deploy

Vercel'e GitHub repo import ederek deploy edebilirsin. Framework preset olarak `Other` secilebilir.

CLI ile deploy icin:

```powershell
npm install
npx vercel --prod
```
