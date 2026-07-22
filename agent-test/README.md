# QUAORA Agent — Test Ortamı ve Üretim Entegrasyonu

Bu klasör, QUAORA müşteri danışmanının izole testlerini ve yerel üretim önizlemesini içerir. Üretim arayüzü yalnızca ana sayfaya, üretim API'si ise `/api/agent-chat` yoluna bağlanmıştır. Entegrasyon kaynak kodda hazırdır; canlı siteye deploy edilmemiştir.

## Kapsam

- Firestore ürün koleksiyonlarını yalnızca okur.
- Firestore'daki güncel politika sayfalarını yalnızca okur; erişim olmazsa repodaki doğrulanmış metinlere döner.
- İade/değişim, teslimat/kargo, ödeme ve gizlilik gibi müşteriye açık politikaları açıklar.
- Ürün açıklaması, materyal, renk, kalıp, beden açıklaması, fiyat ve beden bazlı stok bilgisi verir.
- Ölçü tabanlı beden tavsiyesini geçici test tablosuyla üretir ve mutlaka uyarı gösterir.
- Selamlaşma dışında konu dışı soruları cevaplamaz; yalnızca destek kapsamını belirtir.
- Varsayılan `mock` modunda API ücreti doğurmaz.
- `openai` modunda anahtar yalnızca yerel sunucuda tutulur; tarayıcıya gönderilmez.
- Backend, veri sistemi, servis sağlayıcısı, model, sistem promptu, API yolu ve erişim bilgisi soruları model çağrısından önce reddedilir.
- Müşteri API'si model, veri kaynağı, anahtar durumu veya hata ayrıntısı döndürmez.
- Tarayıcıdan gelen sohbet geçmişi güvenilir model rolü olarak kullanılmaz.
- Üretim katalog okuması API anahtarı kullanmaz; yalnızca herkese açık ürün belgelerini salt-okunur okur.

## Çalıştırma

PowerShell'de:

```powershell
npm.cmd run agent:test
npm.cmd run agent:serve
npm.cmd run agent:preview
```

İzole test arayüzü `http://127.0.0.1:4173`, üretim ana sayfa önizlemesi `http://127.0.0.1:4180` adresindedir.

## Gerçek OpenAI testi

`agent-test/.env.agent-test.local` adlı, git tarafından yok sayılan bir dosya oluşturun:

```text
OPENAI_API_KEY=...
QUAORA_AGENT_MODE=openai
QUAORA_AGENT_MODEL=gpt-5.6-sol
```

Sunucuyu yeniden başlatın. Sağlık kartında yanıt modu `OpenAI` görünmelidir. API anahtarını HTML veya tarayıcı JavaScript dosyasına koymayın.

## Canlı katalog smoke testi

```powershell
npm.cmd run agent:smoke
```

Bu komut yalnızca public Firestore ürün ve politika belgelerini okur; hiçbir belge yazmaz veya silmez.

## Canlı yayın öncesi zorunlu koşullar

1. QUAORA'nın kategori veya ürün bazlı gerçek beden tablosu onaylanmalı.
2. OpenAI modunda politika, stok, beden ve saldırı senaryoları elle kabul testinden geçmeli.
3. Mevcut süreç-içi hız limitine ek olarak Vercel üzerinde dağıtık hız limiti/WAF ve maliyet alarmı yapılandırılmalı.
4. `OPENAI_API_KEY` yalnızca Vercel sunucu ortam değişkeni olarak eklenmeli; eklenmezse agent güvenli deterministik cevaplarla çalışır.
5. Deploy öncesi seçili değişiklikler gözden geçirilip canlı yayın için ayrıca onaylanmalı.

Ayrıntılı tehdit modeli ve üretim kontrol listesi için `SECURITY.md` dosyasına bakın.
