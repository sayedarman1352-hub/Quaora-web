# QUAORA Agent Güvenlik Notu

Bu belge test agentı ile üretim kaynak entegrasyonunun tehdit modelini açıklar. Entegrasyon kodda tamamlanmış, canlı siteye deploy edilmemiştir.

## Müşteriye kapalı bilgiler

Agent aşağıdaki konuları açıklamaz veya doğrulamaz:

- Backend, sunucu, hosting ve teknik mimari
- Veritabanı/veri sistemi ve koleksiyon yapısı
- Servis sağlayıcıları ve model adı
- API yolları, ortam değişkenleri ve yapılandırma
- Sistem/developer promptu ve iç bağlam biçimi
- API anahtarı, token, private key, service account ve proje kimlikleri

Bu sorular modele veya veri katmanına gönderilmeden sabit bir güvenlik yanıtıyla kesilir. Model yine de teknik bilgi üretirse sunucu çıkış filtresi cevabı değiştirir.

## Uygulanan kontroller

- Ürün ve politika erişimi salt-okunurdur; yazma aracı yoktur.
- OpenAI anahtarı yalnızca sunucuda okunur ve istemciye gönderilmez.
- Agentın üretim katalog okumasında API anahtarı kullanılmaz; yalnızca public ürün belgeleri salt-okunur okunur.
- Müşteri API yanıtlarında model, veri kaynağı, anahtar durumu ve iç hata bulunmaz.
- Üretim API'si yalnızca aynı kaynaklı JSON isteklerini kabul eder ve süreç-içi hız limiti uygular.
- Kullanıcı girişi 1200 karakter, istek gövdesi 32 KB ve model çıktısı 650 token ile sınırlıdır.
- Oturum için kişisel veri içermeyen hash'lenmiş safety identifier kullanılır.
- Tarayıcıdan gelen geçmiş, güvenilir `assistant` veya `developer` rolü olarak modele verilmez.
- `store: false`, CSP, frame engeli, izin politikası ve same-origin kaynak başlıkları kullanılır.
- Prompt injection, teknik keşif ve çıktı sızıntısı regresyon testleri vardır.

## Canlı yayından önce zorunlu

1. Firebase App Check etkinleştirilmeli ve desteklenen kaynaklarda zorunlu tutulmalı.
2. Firestore kuralları emulator testleriyle allow/deny senaryolarında doğrulanmalı.
3. Admin/service-account bilgileri sadece sunucu secret deposunda tutulmalı; HTML/JavaScript'e eklenmemeli.
4. Agent API'sine dağıtık hız limiti, WAF/bot koruması ve günlük maliyet bütçesi eklenmeli.
5. Loglarda mesaj, ölçü, e-posta, telefon, adres ve erişim bilgileri maskelenmeli.
6. OpenAI ve yönetici anahtarları için ayrı ortamlar, en düşük yetki ve düzenli rotasyon uygulanmalı.
7. Şüpheli trafik ve hata oranı için alarm kurulmalı; müşteri tarafına ham hata gönderilmemeli.
8. Canlı deploy öncesi gerçek modelle red-team kabul testi tamamlanmalı.

## Önemli sınır

Backend adını gizlemek saldırı yüzeyini azaltır fakat güvenlik kontrolünün yerini tutmaz. Asıl koruma yetkilendirme kuralları, App Check, hız limiti, secret yönetimi, izleme ve düzenli güvenlik testlerinden gelir.
