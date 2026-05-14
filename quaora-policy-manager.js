import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5vGWkRvVDfBMTCH-zgOioE-8_OsCwUmo",
  authDomain: "quaora-web.firebaseapp.com",
  projectId: "quaora-web",
  storageBucket: "quaora-web.firebasestorage.app",
  messagingSenderId: "69244174750",
  appId: "1:69244174750:web:5c9e82172704bb39a2568f"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = "quaoratr@gmail.com";

const block = (heading, text) => ({ heading, text });

export const QUAORA_POLICY_DEFAULTS = {
  distance_sales_policy: {
    docId: "policy_distance_sales",
    title: "Mesafeli Satış Sözleşmesi",
    subtitle: "Satış ve ön bilgilendirme koşulları",
    blocks: [
      block("Satıcı Bilgileri", "Satıcı: YAĞMUR TOPRAK KOÇ\nMarka: QUAORA\nE-posta: quaoratr@gmail.com\nTelefon: TELEFON_NUMARANIZI_BURAYA_YAZIN\nAdres: ADRES_BILGINIZI_BURAYA_YAZIN\nWeb sitesi: https://www.quaora.com.tr"),
      block("1. Taraflar", "Bu sözleşme, QUAORA internet sitesi üzerinden ürün satın alan alıcı ile satıcı arasında elektronik ortamda kurulmuştur. Alıcı, siparişi onaylamadan önce ürün temel nitelikleri, satış fiyatı, ödeme şekli, teslimat ve cayma hakkı konularında bilgilendirildiğini kabul eder."),
      block("2. Konu", "Sözleşmenin konusu, alıcının QUAORA internet sitesi üzerinden elektronik ortamda sipariş verdiği ürünlerin satışı ve teslimi ile tarafların hak ve yükümlülüklerinin belirlenmesidir."),
      block("3. Ürün, Fiyat ve Ödeme", "Ürünlerin türü, adedi, satış bedeli ve ödeme bilgileri sipariş/ödeme ekranında gösterilir. Siparişin tamamlanmasıyla alıcı, gösterilen toplam bedeli ve bu sözleşme hükümlerini kabul etmiş sayılır."),
      block("4. Teslimat", "Siparişler, stok ve ödeme onayının ardından alıcının bildirdiği teslimat adresine gönderilir. Teslimat süresi ürün hazırlık ve kargo süreçlerine göre değişebilir."),
      block("5. Cayma Hakkı", "Alıcı, mesafeli satışlarda ürünün tesliminden itibaren 14 gün içinde cayma hakkını kullanabilir. Cayma bildirimi e-posta veya yazılı kalıcı veri saklayıcısı yoluyla satıcıya iletilmelidir."),
      block("6. Cayma Hakkının Kullanılamayacağı Durumlar", "Hijyen nedeniyle iadesi uygun olmayan, teslimden sonra ambalajı, etiketi, koruyucu bandı veya hijyen mührü açılmış mayo, bikini, iç giyim niteliğindeki ürünler.\nKullanılmış, yıkanmış, kokusu değişmiş, hasar görmüş veya tekrar satılabilir niteliğini kaybetmiş ürünler.\nAlıcının özel istekleri doğrultusunda hazırlanan kişiselleştirilmiş ürünler."),
      block("7. İade Bedeli", "İade koşullarının sağlanması ve ürünün satıcıya ulaşması sonrasında ödeme, siparişte kullanılan ödeme yöntemine uygun şekilde iade edilir. Banka/ödeme kuruluşu süreçlerinden kaynaklanan gecikmeler satıcının kontrolü dışındadır."),
      block("8. Uyuşmazlık", "Taraflar arasında doğabilecek uyuşmazlıklarda, mevzuatta belirtilen parasal sınırlar dahilinde tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.")
    ]
  },
  delivery_policy: {
    docId: "policy_delivery",
    title: "Teslimat Bilgileri",
    subtitle: "Kargo ve teslimat süreçleri",
    blocks: [
      block("Satıcı Bilgileri", "Satıcı: YAĞMUR TOPRAK KOÇ\nMarka: QUAORA\nE-posta: quaoratr@gmail.com\nTelefon: TELEFON_NUMARANIZI_BURAYA_YAZIN\nAdres: ADRES_BILGINIZI_BURAYA_YAZIN\nWeb sitesi: https://www.quaora.com.tr"),
      block("Sipariş Hazırlama", "Siparişler ödeme onayı sonrası hazırlanır. Stok, kampanya ve yoğunluk durumuna göre hazırlık süresi değişebilir."),
      block("Kargo ve Teslimat", "Ürünler alıcının sipariş sırasında belirttiği adrese gönderilir. Kargo süresi, teslimat adresi ve kargo firmasının operasyon süreçlerine göre değişebilir."),
      block("Adres Bilgisi", "Alıcı, teslimat adresini doğru ve eksiksiz girmekle sorumludur. Hatalı veya eksik adres nedeniyle oluşabilecek gecikmelerden alıcı sorumludur."),
      block("Kargo Teslim Kontrolü", "Alıcı, teslimat sırasında paketi kontrol etmelidir. Hasarlı paketlerde kargo görevlisine tutanak tutulması önerilir."),
      block("Teslim Edilemeyen Siparişler", "Alıcının adreste bulunmaması, eksik adres veya kargo firmasından kaynaklanan durumlarda teslimat süreci uzayabilir. Bu durumda alıcının satıcı veya kargo firması ile iletişime geçmesi gerekir.")
    ]
  },
  return_policy: {
    docId: "policy_return",
    title: "İade Politikası",
    subtitle: "İade ve değişim koşulları",
    blocks: [
      block("Son güncelleme", "14 Mayıs 2026"),
      block("Genel Bilgilendirme", "Bu iade politikası, QUAORA Swimwear üzerinden verilen siparişlerde cayma hakkı, iade, değişim, kargo ve ücret iadesi süreçlerini açıklar."),
      block("1. Cayma Hakkı", "Mesafeli satışlarda, ürünün tesliminden itibaren 14 gün içinde herhangi bir gerekçe göstermeden cayma hakkınızı kullanabilirsiniz. Cayma bildiriminin yazılı olarak veya e-posta gibi kalıcı veri saklayıcısı aracılığıyla yapılması gerekir."),
      block("2. İade Şartları", "Ürün kullanılmamış, yıkanmamış, hasar görmemiş ve tekrar satılabilir durumda olmalıdır.\nEtiket, hijyen bandı, koruyucu ambalaj, fatura ve varsa aksesuarları eksiksiz olmalıdır.\nMayo, bikini, mayokini ve benzeri hijyen hassasiyeti olan ürünlerde hijyen bandı çıkarılmış, ambalajı açılmış veya kullanım izi oluşmuş ürünlerde iade kabul edilmeyebilir.\nYanlış, eksik veya ayıplı ürün gönderilmesi halinde iade/değişim süreci öncelikli olarak değerlendirilir."),
      block("3. İade Talebi Nasıl Oluşturulur?", "İade veya değişim talebiniz için iletişim sayfamızdan bize ulaşabilir ya da sipariş bilgilerinizi içeren bir mesajı quaoratr@gmail.com adresine gönderebilirsiniz. Sipariş numarası, ad soyad, iletişim bilgisi, ürün adı ve iade sebebi süreci hızlandırır."),
      block("4. Kargo ve İnceleme Süreci", "Cayma bildirimi sonrası ürünü, bildirimi yaptığınız tarihten itibaren 10 gün içinde tarafımıza göndermeniz gerekir. Ürün bize ulaştığında etiket, hijyen bandı, kullanım izi ve ürün bütünlüğü kontrol edilir."),
      block("5. Ücret İadesi", "İade talebi onaylandığında ödeme iadesi, satın alırken kullanılan ödeme aracına uygun şekilde yapılır. Banka veya ödeme kuruluşunun işlem süreleri ayrıca değişebilir."),
      block("6. Değişim", "Beden veya model değişimi stok durumuna bağlıdır. Değişim talebi için ürünün kullanılmamış, hijyen bandı ve etiketi korunmuş olması gerekir."),
      block("7. İade Kapsamı Dışında Kalabilecek Durumlar", "Kişisel kullanım, hijyen, sağlık veya ürün niteliği gereği iadesi uygun olmayan; etiketi sökülmüş, hijyen bandı çıkarılmış, kullanılmış, yıkanmış, kokusu değişmiş, lekelenmiş veya hasar görmüş ürünlerde iade reddedilebilir."),
      block("8. İletişim", "İade ve değişim konularında bize quaoratr@gmail.com üzerinden veya sosyal medya hesaplarımızdan ulaşabilirsiniz.")
    ]
  },
  privacy_policy: {
    docId: "policy_privacy",
    title: "Gizlilik Sözleşmesi",
    subtitle: "Kişisel veriler ve gizlilik",
    blocks: [
      block("Son güncelleme", "14 Mayıs 2026"),
      block("Genel Bilgilendirme", "Bu gizlilik sözleşmesi, QUAORA Swimwear web sitesini ziyaret ettiğinizde, üyelik oluşturduğunuzda, alışveriş yaptığınızda veya bizimle iletişime geçtiğinizde kişisel verilerinizin nasıl işlendiğini açıklar."),
      block("1. Toplanan Bilgiler", "Site kullanımınıza göre ad soyad, e-posta adresi, telefon numarası, kullanıcı adı, sipariş ve sepet bilgileri, favoriler, indirim kodu kullanımı, iletişim formu mesajları ve ödeme sürecine ait işlem bilgileri işlenebilir."),
      block("2. Kullanım Amaçları", "Üyelik ve giriş işlemlerini yürütmek.\nSipariş, ödeme, teslimat, iade ve değişim süreçlerini yönetmek.\nMüşteri taleplerine cevap vermek.\nFavoriler, sepet ve indirim kodu gibi site özelliklerini çalıştırmak.\nGüvenlik, hata takibi ve yasal yükümlülükleri yerine getirmek."),
      block("3. Üçüncü Taraf Hizmetler", "Sitede altyapı ve hizmet sağlamak için Firebase, PayTR, FormSubmit, Google servisleri ve sosyal medya bağlantıları gibi üçüncü taraf hizmetlerden yararlanılabilir. Ödeme bilgileriniz PayTR güvenli ödeme altyapısı üzerinden işlenir; kart bilgileriniz QUAORA tarafından saklanmaz."),
      block("4. Çerezler ve Yerel Depolama", "Sepet, favoriler, indirim kodu ve oturum deneyimi için tarayıcı çerezleri veya localStorage kullanılabilir. Tarayıcı ayarlarınızdan bu verileri silebilir veya engelleyebilirsiniz; ancak bazı site özellikleri sınırlı çalışabilir."),
      block("5. Verilerin Saklanması ve Güvenliği", "Kişisel veriler, işleme amacı için gerekli süre boyunca ve ilgili mevzuatın gerektirdiği ölçüde saklanır. Yetkisiz erişim, kayıp ve kötüye kullanıma karşı makul teknik ve idari güvenlik önlemleri alınır."),
      block("6. Haklarınız", "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenen veriler hakkında bilgi talep etme, eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme, silinmesini veya yok edilmesini talep etme ve mevzuatta yer alan diğer haklarınızı kullanabilirsiniz."),
      block("7. İletişim", "Gizlilik ve kişisel veri talepleriniz için iletişim sayfamızdan bize ulaşabilir veya quaoratr@gmail.com adresine yazabilirsiniz.")
    ]
  }
};

const getPolicyConfig = (pageKey) => QUAORA_POLICY_DEFAULTS[pageKey] || QUAORA_POLICY_DEFAULTS.return_policy;
const isAdminUser = (user) => !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function htmlToBlocks(html = "") {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return Array.from(doc.querySelectorAll("section")).map((section) => {
    const heading = section.querySelector("h3,h4,strong")?.textContent?.trim() || "";
    const lines = [];
    section.querySelectorAll("p,li").forEach((el) => {
      const text = el.textContent.trim();
      if (text) lines.push(text);
    });
    return { heading, text: lines.join("\n") };
  }).filter(item => item.heading || item.text);
}

function blocksToHtml(blocks = []) {
  return blocks.filter(b => (b.heading || b.text)).map((b) => {
    const heading = (b.heading || "").trim();
    const lines = String(b.text || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
    const body = lines.length > 1
      ? `<ul>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : `<p>${escapeHtml(lines[0] || "")}</p>`;
    return `<section>${heading ? `<h4>${escapeHtml(heading)}</h4>` : ""}${body}</section>`;
  }).join("\n");
}

const normalizePolicy = (pageKey, data = {}) => {
  const fallback = getPolicyConfig(pageKey);
  const fallbackBlocks = fallback.blocks || htmlToBlocks(fallback.contentHtml || "");
  const incomingBlocks = Array.isArray(data.blocks) ? data.blocks : htmlToBlocks(data.contentHtml || "");
  const blocks = incomingBlocks.length ? incomingBlocks : fallbackBlocks;
  return {
    title: data.title || fallback.title,
    subtitle: data.subtitle || fallback.subtitle,
    blocks,
    contentHtml: blocksToHtml(blocks)
  };
};

const getPolicyRef = (pageKey) => doc(db, "page_settings", getPolicyConfig(pageKey).docId);
let activePolicyData = null;
let activePolicyKey = null;

function renderPolicyPage(pageKey, data = {}) {
  const policy = normalizePolicy(pageKey, data);
  activePolicyKey = pageKey;
  activePolicyData = policy;
  const titleEl = document.getElementById("policyTitle");
  const subtitleEl = document.getElementById("policySubtitle");
  const contentEl = document.getElementById("policyContent");
  if (titleEl) titleEl.textContent = policy.title;
  if (subtitleEl) subtitleEl.textContent = policy.subtitle;
  if (contentEl) contentEl.innerHTML = policy.contentHtml;
}

function renderBlocksEditor(containerId, blocks = [], mode = "page") {
  const container = document.getElementById(containerId);
  if (!container) return;
  const safeBlocks = blocks.length ? blocks : [{ heading: "", text: "" }];
  container.innerHTML = safeBlocks.map((b, index) => `
    <div class="policy-block-editor bg-white border border-[#964b00]/15 rounded-2xl p-3 space-y-2" data-index="${index}">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[9px] font-black uppercase tracking-[0.22em] text-[#964b00]">Bölüm ${index + 1}</span>
        <button type="button" onclick="removePolicyBlock('${containerId}', ${index})" class="text-red-500 font-black text-xs hover:scale-110 transition-transform">SİL</button>
      </div>
      <input class="policy-block-heading w-full bg-[#FAE29C]/20 border border-[#964b00]/10 rounded-xl px-3 py-2 text-[11px] font-black outline-none focus:border-[#964b00]" value="${escapeHtml(b.heading || "")}" placeholder="Bölüm başlığı">
      <textarea class="policy-block-text w-full bg-[#FAE29C]/20 border border-[#964b00]/10 rounded-xl px-3 py-2 text-[11px] font-semibold outline-none focus:border-[#964b00] resize-y" rows="4" placeholder="Bu bölümün metnini yaz. Her satır ayrı madde/paragraf olur.">${escapeHtml(b.text || "")}</textarea>
    </div>`).join("");
}

function readBlocksEditor(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll(".policy-block-editor")).map((wrap) => ({
    heading: wrap.querySelector(".policy-block-heading")?.value?.trim() || "",
    text: wrap.querySelector(".policy-block-text")?.value?.trim() || ""
  })).filter(item => item.heading || item.text);
}

window.removePolicyBlock = (containerId, index) => {
  const current = readBlocksEditor(containerId);
  current.splice(index, 1);
  renderBlocksEditor(containerId, current.length ? current : [{ heading: "", text: "" }]);
};

window.addPolicyAdminBlock = () => {
  const current = readBlocksEditor("policyAdminBlocksContainer");
  current.push({ heading: "", text: "" });
  renderBlocksEditor("policyAdminBlocksContainer", current);
};

window.addAdminPolicyBlock = () => {
  const current = readBlocksEditor("adminPolicyBlocksContainer");
  current.push({ heading: "", text: "" });
  renderBlocksEditor("adminPolicyBlocksContainer", current);
};

async function fillPolicyEditor(pageKey, data = activePolicyData) {
  const policy = normalizePolicy(pageKey, data || {});
  const titleInput = document.getElementById("policyAdminTitleInput");
  const subtitleInput = document.getElementById("policyAdminSubtitleInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  renderBlocksEditor("policyAdminBlocksContainer", policy.blocks);
}

window.openPolicyAdminModal = async () => {
  if (!activePolicyKey) return;
  await fillPolicyEditor(activePolicyKey, activePolicyData);
  const modal = document.getElementById("policyAdminModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.closePolicyAdminModal = () => {
  const modal = document.getElementById("policyAdminModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.savePolicyAdminContent = async () => {
  const user = auth.currentUser;
  if (!isAdminUser(user)) return alert("Bu işlem sadece admin tarafından yapılabilir.");
  if (!activePolicyKey) return;
  const title = document.getElementById("policyAdminTitleInput")?.value?.trim();
  const subtitle = document.getElementById("policyAdminSubtitleInput")?.value?.trim();
  const blocks = readBlocksEditor("policyAdminBlocksContainer");
  if (!title || !subtitle || blocks.length === 0) return alert("Başlık, alt başlık ve en az bir bölüm boş bırakılamaz.");
  await setDoc(getPolicyRef(activePolicyKey), { title, subtitle, blocks, contentHtml: blocksToHtml(blocks), updatedAt: Date.now(), updatedBy: user.email }, { merge: true });
  window.closePolicyAdminModal();
  alert("Politika sayfası güncellendi.");
};

window.resetPolicyAdminContent = async () => {
  if (!activePolicyKey) return;
  await fillPolicyEditor(activePolicyKey, getPolicyConfig(activePolicyKey));
};

function initPolicyPage() {
  const pageKey = document.body?.dataset?.policyPage;
  if (!pageKey) return;
  renderPolicyPage(pageKey);
  onSnapshot(getPolicyRef(pageKey), (snap) => renderPolicyPage(pageKey, snap.exists() ? snap.data() : {}), () => renderPolicyPage(pageKey));
  onAuthStateChanged(auth, (user) => {
    const btn = document.getElementById("policyAdminOpenBtn");
    if (btn) btn.classList.toggle("hidden", !isAdminUser(user));
  });
}

async function getPolicyForAdmin(pageKey) {
  const snap = await getDoc(getPolicyRef(pageKey));
  return normalizePolicy(pageKey, snap.exists() ? snap.data() : {});
}

window.loadAdminPolicyEditor = async () => {
  const select = document.getElementById("adminPolicyPageSelect");
  if (!select) return;
  const pageKey = select.value || "distance_sales_policy";
  const policy = await getPolicyForAdmin(pageKey);
  const titleInput = document.getElementById("adminPolicyTitleInput");
  const subtitleInput = document.getElementById("adminPolicySubtitleInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  renderBlocksEditor("adminPolicyBlocksContainer", policy.blocks);
};

window.saveAdminPolicyPage = async () => {
  const user = auth.currentUser;
  if (!isAdminUser(user)) return alert("Bu işlem sadece admin tarafından yapılabilir.");
  const pageKey = document.getElementById("adminPolicyPageSelect")?.value || "distance_sales_policy";
  const title = document.getElementById("adminPolicyTitleInput")?.value?.trim();
  const subtitle = document.getElementById("adminPolicySubtitleInput")?.value?.trim();
  const blocks = readBlocksEditor("adminPolicyBlocksContainer");
  if (!title || !subtitle || blocks.length === 0) return alert("Başlık, alt başlık ve en az bir bölüm boş bırakılamaz.");
  await setDoc(getPolicyRef(pageKey), { title, subtitle, blocks, contentHtml: blocksToHtml(blocks), updatedAt: Date.now(), updatedBy: user.email }, { merge: true });
  alert("Sayfa metni güncellendi.");
};

window.resetAdminPolicyPage = async () => {
  const pageKey = document.getElementById("adminPolicyPageSelect")?.value || "distance_sales_policy";
  const policy = normalizePolicy(pageKey, getPolicyConfig(pageKey));
  const titleInput = document.getElementById("adminPolicyTitleInput");
  const subtitleInput = document.getElementById("adminPolicySubtitleInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  renderBlocksEditor("adminPolicyBlocksContainer", policy.blocks);
};

function initIndexPolicyAdmin() {
  const select = document.getElementById("adminPolicyPageSelect");
  if (!select) return;
  select.addEventListener("change", () => window.loadAdminPolicyEditor());
  onAuthStateChanged(auth, (user) => {
    if (isAdminUser(user)) window.loadAdminPolicyEditor();
  });
}

function ready(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
}

ready(() => {
  initPolicyPage();
  initIndexPolicyAdmin();
});
