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
{"ok":true,"missing":[],"merchantIdFormatOk":true}
```

`missing` dolu gelirse Vercel env eksiktir veya redeploy yapilmamistir.
`merchantIdFormatOk` false gelirse `PAYTR_MERCHANT_ID` alanina PayTR panelindeki sadece rakamlardan olusan Magaza No girilmelidir. Magaza Parola veya Gizli Anahtar bu alana girilmemelidir.
`merchantKeyInfo` veya `merchantSaltInfo` icinde `changedByCleanup`, `hasInternalWhitespace` ya da `looksLikePlaceholder` true gelirse Vercel'deki ilgili env degeri PayTR panelinden temiz sekilde tekrar kopyalanmalidir.

## PayTR Token Hatasi

`PayTR token hatasi: Gecersiz istek veya magaza aktif degil` cevabi PayTR tarafindan doner. PayTR hata kodu aciklamasina gore bu cevap genelde `merchant_id` bilgisinin hatali/eksik olmasi veya magaza hesabinin aktif olmamasi anlamina gelir.
`PayTR token hatasi: paytr_token gonderilmedi veya gecersiz (get-token)` cevabi genelde `PAYTR_MERCHANT_KEY` veya `PAYTR_MERCHANT_SALT` degerinin hatali ya da birbiriyle karismis olmasi anlamina gelir.

Kontrol listesi:

1. `PAYTR_MERCHANT_ID` = PayTR panelindeki `Magaza No`
2. `PAYTR_MERCHANT_KEY` = PayTR panelindeki `Magaza Parola`
3. `PAYTR_MERCHANT_SALT` = PayTR panelindeki `Magaza Gizli Anahtar`
4. Degerlerde tirnak, bosluk veya etiket metni olmamali.
5. PayTR panelinde magaza aktif/onayli olmali.
6. Vercel env degisikliginden sonra Production redeploy yapilmali.

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
