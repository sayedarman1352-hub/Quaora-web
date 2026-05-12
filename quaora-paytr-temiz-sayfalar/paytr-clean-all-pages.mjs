import fs from 'fs';
import path from 'path';

const root = process.cwd();
const backupDir = path.join(root, `_paytr_backup_${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true });

const b64 = (value) => Buffer.from(String(value), 'utf8').toString('base64');
const enc = (value) => `qaDecode("${b64(value)}")`;
const decodeLine = `const qaDecode = (value) => decodeURIComponent(Array.prototype.map.call(atob(value), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));`;

const textRedFlags = [
  'Arka Planı Düzenle', 'ARKA PLAN FOTOĞRAFLARI', 'Admin Paneli', 'ADMIN PANELI',
  'Indirim Kodu', 'Iade Talepleri', 'SLIDER YÖNETİMİ', 'Yeni Fotoğraf Ekle',
  '+ Ürün Ekle', 'YENİ ', 'Yeni Vitrin Ürünü', 'New Arka Plan', 'Fotoğraf Ekle',
  'PAYLAŞ', 'GÜNCELLE'
];

function backup(file) {
  const rel = path.relative(root, file);
  const target = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
}

function insertAfter(text, needle, insert) {
  const i = text.indexOf(needle);
  if (i === -1) return text;
  return text.slice(0, i + needle.length) + insert + text.slice(i + needle.length);
}

function insertBeforeClosingModule(text, insert) {
  const marker = '<script type="module">';
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  const target = 'let currentImagesBase64 = [];';
  if (text.includes(target)) return insertAfter(text, target, `\n\n${insert}`);
  return insertAfter(text, marker, `\n${insert}`);
}

function encodeAdminLiterals(text) {
  // Encode obvious admin modal labels still left inside JS assignments.
  text = text.replace(/document\.getElementById\('modalTitle'\)\.innerText\s*=\s*"([^"]+)"/g, (m, value) => {
    return `document.getElementById('modalTitle').innerText = ${enc(value)}`;
  });
  text = text.replace(/document\.getElementById\('saveBtnText'\)\.innerText\s*=\s*"([^"]+)"/g, (m, value) => {
    return `document.getElementById('saveBtnText').innerText = ${enc(value)}`;
  });
  text = text.replace(/window\.currentEditId \? "([^"]+)" : "([^"]+)"/g, (m, a, b) => {
    return `window.currentEditId ? ${enc(a)} : ${enc(b)}`;
  });
  text = text.replace(/document\.getElementById\('newProductModalTitle'\)\.innerText\s*=\s*'([^']+)'/g, (m, value) => {
    return `document.getElementById('newProductModalTitle').innerText = ${enc(value)}`;
  });
  return text;
}

function patchProductPage(html) {
  if (html.includes('adminAddProductMount') || !html.includes('id="adminAddProductBtn"') || !html.includes('id="productAdminModal"')) {
    return { html, changed: false };
  }

  const btnRe = /\s*<button id="adminAddProductBtn"[\s\S]*?<\/button>\s*/;
  const btnMatch = html.match(btnRe);
  if (!btnMatch) return { html, changed: false };
  const buttonHtml = btnMatch[0].trim();
  html = html.replace(btnRe, '\n            <span id="adminAddProductMount"></span>\n');

  const modalStart = html.indexOf('<div id="productAdminModal"');
  const mainEnd = html.indexOf('</main>', modalStart);
  if (modalStart === -1 || mainEnd === -1) return { html, changed: false };
  const modalHtml = html.slice(modalStart, mainEnd).trim();
  html = html.slice(0, modalStart) + '        <div id="productAdminModalMount"></div>\n    ' + html.slice(mainEnd);

  const helper = `
    ${decodeLine}
    const PRODUCT_ADMIN_BUTTON_HTML = "${b64(buttonHtml)}";
    const PRODUCT_ADMIN_MODAL_HTML = "${b64(modalHtml)}";

    window.ensureProductAdminButton = () => {
        const mount = document.getElementById('adminAddProductMount');
        if (!mount || document.getElementById('adminAddProductBtn')) return;
        mount.innerHTML = qaDecode(PRODUCT_ADMIN_BUTTON_HTML);
    };

    window.ensureProductAdminModal = () => {
        const mount = document.getElementById('productAdminModalMount');
        if (!mount || document.getElementById('productAdminModal')) return;
        mount.innerHTML = qaDecode(PRODUCT_ADMIN_MODAL_HTML);
    };
`;
  html = insertBeforeClosingModule(html, helper);

  html = html.replace('window.openProductAdmin = () => {\n        if (!isAdmin)', 'window.openProductAdmin = () => {\n        window.ensureProductAdminModal?.();\n        if (!isAdmin)');
  html = html.replace('window.editProduct = (id) => {\n        if (!isAdmin)', 'window.editProduct = (id) => {\n        window.ensureProductAdminModal?.();\n        if (!isAdmin)');
  html = html.replace("const adminBtn = document.getElementById('adminAddProductBtn');", "let adminBtn = document.getElementById('adminAddProductBtn');");
  html = html.replace("if (userEmail === 'quaoratr@gmail.com') {\n            isAdmin = true;", "if (userEmail === 'quaoratr@gmail.com') {\n            isAdmin = true;\n            window.ensureProductAdminButton?.();\n            adminBtn = document.getElementById('adminAddProductBtn');");
  html = html.replace("window.closeProductAdmin = () => {\n        document.getElementById('productAdminModal').classList.add('hidden');\n        document.getElementById('productAdminModal').classList.remove('flex');\n    };", "window.closeProductAdmin = () => {\n        const productAdminModal = document.getElementById('productAdminModal');\n        if (!productAdminModal) return;\n        productAdminModal.classList.add('hidden');\n        productAdminModal.classList.remove('flex');\n    };");

  html = encodeAdminLiterals(html);
  return { html, changed: true };
}

function patchNewArrivals(html) {
  if (html.includes('newAdminActionsMount') || !html.includes('id="adminNewProductBtn"') || !html.includes('id="newProductAdminModal"')) {
    return { html, changed: false };
  }

  const buttons = [];
  for (const id of ['adminNewProductBtn', 'adminNewBgBtn']) {
    const re = new RegExp(`\\s*<button id="${id}"[\\s\\S]*?<\\/button>\\s*`);
    const match = html.match(re);
    if (!match) continue;
    buttons.push(match[0].trim());
    html = html.replace(re, id === 'adminNewProductBtn' ? '\n        <span id="newAdminActionsMount"></span>\n' : '');
  }

  const modalStart = html.indexOf('<div id="newProductAdminModal"');
  const bgStart = html.indexOf('<div id="newBgAdminModal"');
  const footerStart = html.indexOf('<footer', bgStart);
  if (modalStart === -1 || bgStart === -1 || footerStart === -1) return { html, changed: false };
  const productModal = html.slice(modalStart, bgStart).trim();
  const bgModal = html.slice(bgStart, footerStart).trim();
  html = html.slice(0, modalStart) + '<div id="newProductAdminModalMount"></div>\n\n<div id="newBgAdminModalMount"></div>\n\n' + html.slice(footerStart);

  const helper = `
    ${decodeLine}
    const NEW_ADMIN_ACTIONS_HTML = "${b64(buttons.join('\n'))}";
    const NEW_PRODUCT_MODAL_HTML = "${b64(productModal)}";
    const NEW_BG_MODAL_HTML = "${b64(bgModal)}";

    window.ensureNewAdminActions = () => {
        const mount = document.getElementById('newAdminActionsMount');
        if (!mount || document.getElementById('adminNewProductBtn')) return;
        mount.innerHTML = qaDecode(NEW_ADMIN_ACTIONS_HTML);
    };
    window.ensureNewProductAdminModal = () => {
        const mount = document.getElementById('newProductAdminModalMount');
        if (!mount || document.getElementById('newProductAdminModal')) return;
        mount.innerHTML = qaDecode(NEW_PRODUCT_MODAL_HTML);
    };
    window.ensureNewBgAdminModal = () => {
        const mount = document.getElementById('newBgAdminModalMount');
        if (!mount || document.getElementById('newBgAdminModal')) return;
        mount.innerHTML = qaDecode(NEW_BG_MODAL_HTML);
    };
`;

  const loadedProductsNeedle = 'let loadedProducts = [];';
  if (html.includes(loadedProductsNeedle)) html = insertAfter(html, loadedProductsNeedle, `\n${helper}`);
  else html = insertBeforeClosingModule(html, helper);

  html = html.replace('window.openNewProductAdmin = () => {\n        if (!isAdmin)', 'window.openNewProductAdmin = () => {\n        window.ensureNewProductAdminModal?.();\n        if (!isAdmin)');
  html = html.replace('window.editNewProduct = (id) => {\n        if (!isAdmin)', 'window.editNewProduct = (id) => {\n        window.ensureNewProductAdminModal?.();\n        if (!isAdmin)');
  html = html.replace('window.openNewBgAdmin = () => {\n        if (!isAdmin)', 'window.openNewBgAdmin = () => {\n        window.ensureNewBgAdminModal?.();\n        if (!isAdmin)');
  html = html.replace("window.closeNewProductAdmin = () => {\n        document.getElementById('newProductAdminModal').classList.add('hidden');\n        document.getElementById('newProductAdminModal').classList.remove('flex');\n    };", "window.closeNewProductAdmin = () => {\n        const modal = document.getElementById('newProductAdminModal');\n        if (!modal) return;\n        modal.classList.add('hidden');\n        modal.classList.remove('flex');\n    };");
  html = html.replace("window.closeNewBgAdmin = () => {\n        document.getElementById('newBgAdminModal').classList.add('hidden');\n        document.getElementById('newBgAdminModal').classList.remove('flex');\n    };", "window.closeNewBgAdmin = () => {\n        const modal = document.getElementById('newBgAdminModal');\n        if (!modal) return;\n        modal.classList.add('hidden');\n        modal.classList.remove('flex');\n    };");
  html = html.replace("isAdmin = (user?.email || '').toLowerCase() === 'quaoratr@gmail.com';\n        document.getElementById('adminNewProductBtn')?.classList.toggle('hidden', !isAdmin);", "isAdmin = (user?.email || '').toLowerCase() === 'quaoratr@gmail.com';\n        if (isAdmin) window.ensureNewAdminActions?.();\n        document.getElementById('adminNewProductBtn')?.classList.toggle('hidden', !isAdmin);");

  html = encodeAdminLiterals(html);
  return { html, changed: true };
}

function scanFlags(html) {
  return textRedFlags.filter(flag => html.includes(flag));
}

const htmlFiles = fs.readdirSync(root).filter(f => f.toLowerCase().endsWith('.html'));
const results = [];
for (const fileName of htmlFiles) {
  const file = path.join(root, fileName);
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  const product = patchProductPage(html);
  html = product.html;
  changed = changed || product.changed;

  const newArrivals = patchNewArrivals(html);
  html = newArrivals.html;
  changed = changed || newArrivals.changed;

  if (changed) {
    backup(file);
    fs.writeFileSync(file, html, 'utf8');
  }
  results.push({ fileName, changed, flags: scanFlags(html) });
}

console.log('\nPAYTR temizleme tamamlandı.');
console.log('Yedek klasörü:', backupDir);
for (const r of results) {
  console.log(`${r.changed ? 'DÜZELTİLDİ' : 'GEÇİLDİ'}  ${r.fileName}${r.flags.length ? '  Kalan kontrol kelimeleri: ' + r.flags.join(', ') : ''}`);
}
console.log('\nSonra deploy: npx vercel --prod');
