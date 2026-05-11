import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyChIV6BI3U6aPxUsRm0akBCPLLBAg6XM9U",
  authDomain: "quaora-web.firebaseapp.com",
  projectId: "quaora-web",
  storageBucket: "quaora-web.firebasestorage.app",
  messagingSenderId: "69244174750",
  appId: "1:69244174750:web:5c9e82172704bb39a2568f"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let discountCodes = {};
let unsubscribeCodes = null;

const money = (value) => '₺' + Number(value || 0).toLocaleString('tr-TR');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const readCart = () => {
  try {
    const cart = JSON.parse(localStorage.getItem('quaora_cart') || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
};
const cartSubtotal = () => readCart().reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
const readPromo = () => {
  try {
    return JSON.parse(localStorage.getItem('quaora_promo') || 'null');
  } catch (e) {
    return null;
  }
};

const calculateDiscount = (subtotal, promo) => {
  if (!promo || promo.active === false || subtotal <= 0) return 0;
  if (subtotal < Number(promo.minSubtotal || 0)) return 0;
  if (Number(promo.maxUses || 0) > 0 && Number(promo.usedCount || 0) >= Number(promo.maxUses || 0)) return 0;

  const uid = auth.currentUser?.uid;
  if (promo.ownerUid && promo.ownerUid !== uid) return 0;
  if (uid && promo.usedBy?.[uid]) return 0;
  if (promo.type === 'percent') return Math.round(subtotal * Number(promo.value || 0) / 100);
  if (promo.type === 'fixed') return Math.min(Number(promo.value || 0), subtotal);
  return 0;
};

const ensureDiscountUi = () => {
  const panel = document.getElementById('cartPanel');
  if (!panel || document.getElementById('quaoraDiscountBox')) return;

  const footer = panel.querySelector('.border-t');
  const checkoutButton = footer?.querySelector('button[onclick*="siparisVer"]');
  if (!footer || !checkoutButton) return;

  checkoutButton.insertAdjacentHTML('beforebegin', `
    <div id="quaoraDiscountBox" class="mb-4 rounded-2xl border border-[#964b00]/15 bg-white p-3 shadow-sm">
      <label for="quaoraPromoInput" class="block text-[9px] font-black uppercase tracking-[0.25em] text-gray-500 mb-2">Indirim Kodu</label>
      <div class="flex gap-2">
        <input id="quaoraPromoInput" type="text" placeholder="Kodu gir" class="flex-1 min-w-0 rounded-xl border border-[#964b00]/20 px-3 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-[#964b00]">
        <button type="button" onclick="applyQuaoraDiscountCode()" class="bg-[#964b00] text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">Uygula</button>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2">
        <p id="quaoraPromoMessage" class="text-[10px] font-bold text-gray-500"></p>
        <button id="quaoraRemovePromoBtn" type="button" onclick="removeQuaoraDiscountCode()" class="hidden text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-black">Kaldir</button>
      </div>
    </div>
    <div id="quaoraDiscountTotals" class="space-y-2 mb-4">
      <div class="flex justify-between items-center">
        <span class="font-bold uppercase text-[10px] tracking-widest text-gray-500">Ara Toplam:</span>
        <span id="quaoraSubtotal" class="text-sm font-black text-gray-700">₺0,00</span>
      </div>
      <div id="quaoraDiscountRow" class="hidden justify-between items-center">
        <span id="quaoraDiscountLabel" class="font-bold uppercase text-[10px] tracking-widest text-green-700">Indirim:</span>
        <span id="quaoraDiscountAmount" class="text-sm font-black text-green-700">-₺0,00</span>
      </div>
    </div>
  `);
};

const updateTotals = () => {
  ensureDiscountUi();
  const subtotal = cartSubtotal();
  const promoCode = normalizeCode(readPromo()?.code);
  const promo = promoCode ? discountCodes[promoCode] : null;
  const discount = calculateDiscount(subtotal, promo);
  const total = Math.max(0, subtotal - discount);

  const input = document.getElementById('quaoraPromoInput') || document.getElementById('promoCodeInput');
  const msg = document.getElementById('quaoraPromoMessage') || document.getElementById('promoMessage');
  const removeBtn = document.getElementById('quaoraRemovePromoBtn') || document.getElementById('removePromoBtn');
  const subtotalEl = document.getElementById('quaoraSubtotal') || document.getElementById('cartSubtotal');
  const discountRow = document.getElementById('quaoraDiscountRow') || document.getElementById('cartDiscountRow') || document.getElementById('discountRow');
  const discountLabel = document.getElementById('quaoraDiscountLabel') || document.getElementById('cartPromoLabel') || document.getElementById('discountLabel');
  const discountAmount = document.getElementById('quaoraDiscountAmount') || document.getElementById('cartDiscount');
  const totalEl = document.getElementById('cartTotal');

  const inputHasFocus = input && document.activeElement === input;
  if (input && !inputHasFocus) input.value = promoCode || '';
  if (subtotalEl) subtotalEl.innerText = money(subtotal);
  if (totalEl && readCart().length > 0) totalEl.innerText = money(total);

  if (!promoCode || !promo) {
    if (msg) {
      msg.innerText = promoCode ? 'Gecersiz indirim kodu.' : '';
      msg.className = promoCode ? 'text-[10px] font-bold text-red-600' : 'text-[10px] font-bold text-gray-500';
    }
    if (removeBtn) removeBtn.classList.toggle('hidden', !promoCode);
    if (discountRow) {
      discountRow.classList.add('hidden');
      discountRow.classList.remove('flex');
    }
    return;
  }

  if (removeBtn) removeBtn.classList.remove('hidden');
  if (discount > 0) {
    if (msg) {
      msg.innerText = `${promoCode} uygulandi.`;
      msg.className = 'text-[10px] font-bold text-green-700';
    }
    if (discountLabel) discountLabel.innerText = `Indirim (${promoCode}):`;
    if (discountAmount) discountAmount.innerText = '-' + money(discount);
    if (discountRow) {
      discountRow.classList.remove('hidden');
      discountRow.classList.add('flex');
    }
  } else {
    if (msg) {
      msg.innerText = 'Kod bu sepet icin kullanilamaz.';
      msg.className = 'text-[10px] font-bold text-red-600';
    }
    if (discountRow) {
      discountRow.classList.add('hidden');
      discountRow.classList.remove('flex');
    }
  }
};

const loadDiscountCodes = () => {
  if (unsubscribeCodes) return;
  const q = query(collection(db, "discount_codes"), orderBy("createdAt", "desc"));
  unsubscribeCodes = onSnapshot(q, (snapshot) => {
    discountCodes = {};
    snapshot.docs.forEach((docSnap) => {
      discountCodes[docSnap.id] = { code: docSnap.id, ...docSnap.data() };
    });
    updateTotals();
    window.renderAdminDiscountCodes?.();
  }, () => {
    updateTotals();
  });
};

window.applyQuaoraDiscountCode = async () => {
  const input = document.getElementById('quaoraPromoInput') || document.getElementById('promoCodeInput');
  const msg = document.getElementById('quaoraPromoMessage') || document.getElementById('promoMessage');
  const code = normalizeCode(input?.value);
  if (!code) {
    if (msg) msg.innerText = 'Lutfen indirim kodu girin.';
    return;
  }

  if (!discountCodes[code]) {
    const snap = await getDoc(doc(db, "discount_codes", code)).catch(() => null);
    if (snap?.exists()) discountCodes[code] = { code, ...snap.data() };
  }

  if (!discountCodes[code]) {
    localStorage.removeItem('quaora_promo');
    if (msg) {
      msg.innerText = 'Gecersiz indirim kodu.';
      msg.className = 'text-[10px] font-bold text-red-600';
    }
    updateTotals();
    return;
  }

  localStorage.setItem('quaora_promo', JSON.stringify({ code }));
  updateTotals();
};

window.removeQuaoraDiscountCode = () => {
  localStorage.removeItem('quaora_promo');
  const input = document.getElementById('quaoraPromoInput') || document.getElementById('promoCodeInput');
  if (input) input.value = '';
  updateTotals();
};

window.applyPromoCode = window.applyQuaoraDiscountCode;
window.removePromoCode = window.removeQuaoraDiscountCode;

window.generateWelcomeDiscountCode = async (user) => {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().welcomeDiscountCode) {
    return userSnap.data().welcomeDiscountCode;
  }

  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await getDoc(doc(db, "discount_codes", code));
    if (!exists.exists()) break;
  }

  await setDoc(doc(db, "discount_codes", code), {
    code,
    type: "percent",
    value: 10,
    minSubtotal: 0,
    active: true,
    maxUses: 1,
    usedCount: 0,
    usedBy: {},
    ownerUid: user.uid,
    ownerEmail: user.email || "",
    source: "welcome",
    createdAt: Date.now()
  });
  await setDoc(userRef, { welcomeDiscountCode: code }, { merge: true });
  return code;
};

window.createAdminDiscountCode = async () => {
  const type = document.getElementById('adminDiscountType')?.value || 'percent';
  const value = Number(document.getElementById('adminDiscountValue')?.value || 0);
  const minSubtotal = Number(document.getElementById('adminDiscountMin')?.value || 0);
  const maxUses = Number(document.getElementById('adminDiscountMaxUses')?.value || 0);
  const manual = normalizeCode(document.getElementById('adminDiscountCode')?.value);
  const code = manual || String(Math.floor(100000 + Math.random() * 900000));

  if (value <= 0) return alert("Indirim degeri girin.");
  if (type === 'percent' && value > 100) return alert("Yuzde indirim 100'den buyuk olamaz.");

  await setDoc(doc(db, "discount_codes", code), {
    code,
    type,
    value,
    minSubtotal,
    active: true,
    maxUses,
    usedCount: 0,
    usedBy: {},
    source: "admin",
    createdAt: Date.now()
  }, { merge: true });

  ['adminDiscountCode', 'adminDiscountValue', 'adminDiscountMin', 'adminDiscountMaxUses'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  alert(`Kod olusturuldu: ${code}`);
};

window.toggleAdminDiscountCode = async (code, active) => {
  await setDoc(doc(db, "discount_codes", code), { active: !active, updatedAt: Date.now() }, { merge: true });
};

window.deleteAdminDiscountCode = async (code) => {
  if (!confirm(`${code} kodu silinsin mi?`)) return;
  await deleteDoc(doc(db, "discount_codes", code));
};

window.renderAdminDiscountCodes = () => {
  const list = document.getElementById('adminDiscountList');
  if (!list) return;
  const codes = Object.values(discountCodes);
  if (codes.length === 0) {
    list.innerHTML = '<div class="text-center py-8 text-gray-400 italic text-sm">Kod bulunmuyor.</div>';
    return;
  }

  list.innerHTML = codes.map((promo) => `
    <div class="bg-gray-50 border border-black/5 rounded-2xl p-4 shadow-sm">
      <div class="flex justify-between gap-3">
        <div>
          <h4 class="font-black text-sm tracking-widest text-gray-800">${promo.code}</h4>
          <p class="text-[10px] font-bold text-gray-500 mt-1">${promo.type === 'percent' ? '%' : 'TL'}${promo.value} | Min: ${money(promo.minSubtotal || 0)} | Kullanim: ${promo.usedCount || 0}${promo.maxUses ? '/' + promo.maxUses : ''}</p>
        </div>
        <span class="text-[10px] font-black ${promo.active === false ? 'text-red-600' : 'text-green-700'} uppercase">${promo.active === false ? 'Pasif' : 'Aktif'}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button onclick="toggleAdminDiscountCode('${promo.code}', ${promo.active !== false})" class="bg-white border border-[#964b00]/20 text-[#964b00] py-2 rounded-xl font-black tracking-widest uppercase text-[9px] hover:bg-[#964b00] hover:text-white transition-all">${promo.active === false ? 'Aktif et' : 'Pasifle'}</button>
        <button onclick="deleteAdminDiscountCode('${promo.code}')" class="bg-red-50 text-red-600 py-2 rounded-xl font-black tracking-widest uppercase text-[9px] hover:bg-red-600 hover:text-white transition-all">Sil</button>
      </div>
    </div>
  `).join('');
};

const installOrderWrapper = () => {
  const wrap = () => {
    if (window.__quaoraDiscountOrderWrapped || typeof window.siparisVer !== 'function') return;
    window.__quaoraDiscountOrderWrapped = true;
    window.siparisVer = () => {
      const cart = readCart();
      if (cart.length === 0) return alert("Sepetiniz bos!");
      const subtotal = cartSubtotal();
      const promoCode = normalizeCode(readPromo()?.code);
      const promo = promoCode ? discountCodes[promoCode] : null;
      const discount = calculateDiscount(subtotal, promo);
      localStorage.setItem('quaora_checkout_summary', JSON.stringify({
        subtotal,
        discount,
        total: Math.max(0, subtotal - discount),
        promoCode: discount > 0 ? promoCode : null
      }));
      window.location.href = "checkout.html";
    };
  };
  wrap();
  setTimeout(wrap, 250);
  setTimeout(wrap, 1000);
};

loadDiscountCodes();
ensureDiscountUi();
installOrderWrapper();
setInterval(updateTotals, 700);
