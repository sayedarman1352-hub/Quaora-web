# QUAORA PayTR iFrame OpenCart Modulu

Bu paket OpenCart 3.x icin PayTR iFrame API odeme moduludur.

## Kurulum

1. `upload` klasorunun icindeki dosyalari OpenCart kurulum kokune yukleyin.
2. OpenCart admin panelinde `Eklentiler > Eklentiler > Odeme Metotlari` ekranina gidin.
3. `PayTR iFrame API` modulunu kurun ve duzenleyin.
4. PayTR panelindeki `Magaza No`, `Magaza Parola`, `Magaza Gizli Anahtar` bilgilerini girin.
5. PayTR panelinde Bildirim URL olarak su rotayi tanimlayin:

```text
https://site-adresiniz.com/index.php?route=extension/payment/paytr_iframe/callback
```

## Notlar

- Kart bilgileri QUAORA veya OpenCart sunucusunda tutulmaz; PayTR iFrame uzerinden alinir.
- `Test Modu` acikken gercek tahsilat yapmayin.
- OpenCart urunleri ve stoklari OpenCart tarafinda tutulmalidir. Mevcut statik HTML sepeti dogrudan OpenCart sepetine aktarmaz.
