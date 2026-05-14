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

export const QUAORA_POLICY_DEFAULTS = {
  return_policy: {
    docId: "policy_return",
    title: "İade Politikası",
    subtitle: "İade ve değişim koşulları",
    contentHtml: `
      <section>
        <p class="font-semibold text-[#964b00]">Son güncelleme: 14 Mayıs 2026</p>
        <p>Bu iade politikası, QUAORA Swimwear üzerinden verilen siparişlerde cayma hakkı, iade, değişim, kargo ve ücret iadesi süreçlerini açıklar.</p>
      </section>
      <section>
        <h4>1. Cayma Hakkı</h4>
        <p>Mesafeli satışlarda, ürünün tesliminden itibaren 14 gün içinde herhangi bir gerekçe göstermeden cayma hakkınızı kullanabilirsiniz. Cayma bildiriminin yazılı olarak veya e-posta gibi kalıcı veri saklayıcısı aracılığıyla yapılması gerekir.</p>
      </section>
      <section>
        <h4>2. İade Şartları</h4>
        <ul>
          <li>Ürün kullanılmamış, yıkanmamış, hasar görmemiş ve tekrar satılabilir durumda olmalıdır.</li>
          <li>Etiket, hijyen bandı, koruyucu ambalaj, fatura ve varsa aksesuarları eksiksiz olmalıdır.</li>
          <li>Mayo, bikini, mayokini ve benzeri hijyen hassasiyeti olan ürünlerde hijyen bandı çıkarılmış, ambalajı açılmış veya kullanım izi oluşmuş ürünlerde iade kabul edilmeyebilir.</li>
          <li>Yanlış, eksik veya ayıplı ürün gönderilmesi halinde iade/değişim süreci öncelikli olarak değerlendirilir.</li>
        </ul>
      </section>
      <section>
        <h4>3. İade Talebi Nasıl Oluşturulur?</h4>
        <p>İade veya değişim talebiniz için <a href="iletisim.html">iletişim sayfamızdan</a> bize ulaşabilir ya da sipariş bilgilerinizi içeren bir mesajı <strong>quaoratr@gmail.com</strong> adresine gönderebilirsiniz. Sipariş numarası, ad soyad, iletişim bilgisi, ürün adı ve iade sebebi süreci hızlandırır.</p>
      </section>
      <section>
        <h4>4. Kargo ve İnceleme Süreci</h4>
        <p>Cayma bildirimi sonrası ürünü, bildirimi yaptığınız tarihten itibaren 10 gün içinde tarafımıza göndermeniz gerekir. Ürün bize ulaştığında etiket, hijyen bandı, kullanım izi ve ürün bütünlüğü kontrol edilir.</p>
      </section>
      <section>
        <h4>5. Ücret İadesi</h4>
        <p>İade talebi onaylandığında ödeme iadesi, satın alırken kullanılan ödeme aracına uygun şekilde yapılır. Banka veya ödeme kuruluşunun işlem süreleri ayrıca değişebilir.</p>
      </section>
      <section>
        <h4>6. Değişim</h4>
        <p>Beden veya model değişimi stok durumuna bağlıdır. Değişim talebi için ürünün kullanılmamış, hijyen bandı ve etiketi korunmuş olması gerekir.</p>
      </section>
      <section>
        <h4>7. İade Kapsamı Dışında Kalabilecek Durumlar</h4>
        <p>Kişisel kullanım, hijyen, sağlık veya ürün niteliği gereği iadesi uygun olmayan; etiketi sökülmüş, hijyen bandı çıkarılmış, kullanılmış, yıkanmış, kokusu değişmiş, lekelenmiş veya hasar görmüş ürünlerde iade reddedilebilir.</p>
      </section>
      <section>
        <h4>8. İletişim</h4>
        <p>İade ve değişim konularında bize <strong>quaoratr@gmail.com</strong> üzerinden veya sosyal medya hesaplarımızdan ulaşabilirsiniz.</p>
      </section>`
  },
  privacy_policy: {
    docId: "policy_privacy",
    title: "Gizlilik Sözleşmesi",
    subtitle: "Kişisel veriler ve gizlilik",
    contentHtml: `
      <section>
        <p class="font-semibold text-[#964b00]">Son güncelleme: 14 Mayıs 2026</p>
        <p>Bu gizlilik sözleşmesi, QUAORA Swimwear web sitesini ziyaret ettiğinizde, üyelik oluşturduğunuzda, alışveriş yaptığınızda veya bizimle iletişime geçtiğinizde kişisel verilerinizin nasıl işlendiğini açıklar.</p>
      </section>
      <section>
        <h4>1. Toplanan Bilgiler</h4>
        <p>Site kullanımınıza göre ad soyad, e-posta adresi, telefon numarası, kullanıcı adı, sipariş ve sepet bilgileri, favoriler, indirim kodu kullanımı, iletişim formu mesajları ve ödeme sürecine ait işlem bilgileri işlenebilir.</p>
      </section>
      <section>
        <h4>2. Kullanım Amaçları</h4>
        <ul>
          <li>Üyelik ve giriş işlemlerini yürütmek,</li>
          <li>Sipariş, ödeme, teslimat, iade ve değişim süreçlerini yönetmek,</li>
          <li>Müşteri taleplerine cevap vermek,</li>
          <li>Favoriler, sepet ve indirim kodu gibi site özelliklerini çalıştırmak,</li>
          <li>Güvenlik, hata takibi ve yasal yükümlülükleri yerine getirmek.</li>
        </ul>
      </section>
      <section>
        <h4>3. Üçüncü Taraf Hizmetler</h4>
        <p>Sitede altyapı ve hizmet sağlamak için Firebase, PayTR, FormSubmit, Google servisleri ve sosyal medya bağlantıları gibi üçüncü taraf hizmetlerden yararlanılabilir. Ödeme bilgileriniz PayTR güvenli ödeme altyapısı üzerinden işlenir; kart bilgileriniz QUAORA tarafından saklanmaz.</p>
      </section>
      <section>
        <h4>4. Çerezler ve Yerel Depolama</h4>
        <p>Sepet, favoriler, indirim kodu ve oturum deneyimi için tarayıcı çerezleri veya localStorage kullanılabilir. Tarayıcı ayarlarınızdan bu verileri silebilir veya engelleyebilirsiniz; ancak bazı site özellikleri sınırlı çalışabilir.</p>
      </section>
      <section>
        <h4>5. Verilerin Saklanması ve Güvenliği</h4>
        <p>Kişisel veriler, işleme amacı için gerekli süre boyunca ve ilgili mevzuatın gerektirdiği ölçüde saklanır. Yetkisiz erişim, kayıp ve kötüye kullanıma karşı makul teknik ve idari güvenlik önlemleri alınır.</p>
      </section>
      <section>
        <h4>6. Haklarınız</h4>
        <p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenen veriler hakkında bilgi talep etme, eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme, silinmesini veya yok edilmesini talep etme ve mevzuatta yer alan diğer haklarınızı kullanabilirsiniz.</p>
      </section>
      <section>
        <h4>7. İletişim</h4>
        <p>Gizlilik ve kişisel veri talepleriniz için <a href="iletisim.html">iletişim sayfamızdan</a> bize ulaşabilir veya <strong>quaoratr@gmail.com</strong> adresine yazabilirsiniz.</p>
      </section>`
  }
};

const getPolicyConfig = (pageKey) => QUAORA_POLICY_DEFAULTS[pageKey] || QUAORA_POLICY_DEFAULTS.return_policy;
const isAdminUser = (user) => !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;

const normalizePolicy = (pageKey, data = {}) => {
  const fallback = getPolicyConfig(pageKey);
  return {
    title: data.title || fallback.title,
    subtitle: data.subtitle || fallback.subtitle,
    contentHtml: data.contentHtml || fallback.contentHtml
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

async function fillPolicyEditor(pageKey, data = activePolicyData) {
  const policy = normalizePolicy(pageKey, data || {});
  const titleInput = document.getElementById("policyAdminTitleInput");
  const subtitleInput = document.getElementById("policyAdminSubtitleInput");
  const contentInput = document.getElementById("policyAdminContentInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  if (contentInput) contentInput.value = policy.contentHtml.trim();
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
  const contentHtml = document.getElementById("policyAdminContentInput")?.value?.trim();
  if (!title || !subtitle || !contentHtml) return alert("Başlık, alt başlık ve metin alanı boş bırakılamaz.");
  await setDoc(getPolicyRef(activePolicyKey), { title, subtitle, contentHtml, updatedAt: Date.now(), updatedBy: user.email }, { merge: true });
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
  const pageKey = select.value || "return_policy";
  const policy = await getPolicyForAdmin(pageKey);
  const titleInput = document.getElementById("adminPolicyTitleInput");
  const subtitleInput = document.getElementById("adminPolicySubtitleInput");
  const contentInput = document.getElementById("adminPolicyContentInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  if (contentInput) contentInput.value = policy.contentHtml.trim();
};

window.saveAdminPolicyPage = async () => {
  const user = auth.currentUser;
  if (!isAdminUser(user)) return alert("Bu işlem sadece admin tarafından yapılabilir.");
  const pageKey = document.getElementById("adminPolicyPageSelect")?.value || "return_policy";
  const title = document.getElementById("adminPolicyTitleInput")?.value?.trim();
  const subtitle = document.getElementById("adminPolicySubtitleInput")?.value?.trim();
  const contentHtml = document.getElementById("adminPolicyContentInput")?.value?.trim();
  if (!title || !subtitle || !contentHtml) return alert("Başlık, alt başlık ve metin alanı boş bırakılamaz.");
  await setDoc(getPolicyRef(pageKey), { title, subtitle, contentHtml, updatedAt: Date.now(), updatedBy: user.email }, { merge: true });
  alert("Sayfa metni güncellendi.");
};

window.resetAdminPolicyPage = async () => {
  const pageKey = document.getElementById("adminPolicyPageSelect")?.value || "return_policy";
  const policy = getPolicyConfig(pageKey);
  const titleInput = document.getElementById("adminPolicyTitleInput");
  const subtitleInput = document.getElementById("adminPolicySubtitleInput");
  const contentInput = document.getElementById("adminPolicyContentInput");
  if (titleInput) titleInput.value = policy.title;
  if (subtitleInput) subtitleInput.value = policy.subtitle;
  if (contentInput) contentInput.value = policy.contentHtml.trim();
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
