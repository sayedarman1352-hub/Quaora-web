# PayTR Vercel Kurulumu

Bu site PayTR iFrame API'yi Vercel Serverless Function ile kullanir.

## Vercel Environment Variables

Vercel panelinde ilgili proje icin `Settings > Environment Variables` alanina sunlari ekle:

```text
PAYTR_MERCHANT_ID=PayTR Magaza No
PAYTR_MERCHANT_KEY=PayTR Magaza Parola
PAYTR_MERCHANT_SALT=PayTR Magaza Gizli Anahtar
SITE_URL=https://quaora-web.vercel.app
PAYTR_TEST_MODE=0
PAYTR_DEBUG_ON=1
```

Env ekledikten sonra mutlaka Production redeploy yap.

## Kontrol URL'i

Deploydan sonra su URL'i ac:

```text
https://quaora-web.vercel.app/api/create-payment
```

Beklenen cevap:

```json
{"ok":true,"missing":[]}
```

`missing` dolu gelirse Vercel env eksiktir veya redeploy yapilmamistir.

## PayTR Paneli

Bildirim URL:

```text
https://quaora-web.vercel.app/api/paytr-callback
```

Basarili ve basarisiz donus sayfalari kod tarafindan PayTR'ye su sekilde gonderilir:

```text
https://quaora-web.vercel.app/paytr/success.html
https://quaora-web.vercel.app/paytr/fail.html
```
