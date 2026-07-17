(function () {
  "use strict";

  const localDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isPreorder = (product) => product?.isPreorder === true || product?.preorder === true;

  const formatDate = (value) => {
    if (!value) return "Tarih belirtilmedi";
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return String(value);
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  };

  const injectStyles = () => {
    if (document.getElementById("quaoraPreorderStyles")) return;
    const style = document.createElement("style");
    style.id = "quaoraPreorderStyles";
    style.textContent = `
      .quaora-preorder-admin { margin-top: 16px; padding: 15px; border: 1px solid rgba(17,17,17,.16); border-radius: 8px; background: rgba(255,255,255,.72); }
      .quaora-preorder-toggle { width: 100%; min-height: 46px; padding: 10px 14px; border: 1px solid #111; border-radius: 6px; background: #fff; color: #111; font-size: 11px; font-weight: 900; letter-spacing: .12em; cursor: pointer; }
      .quaora-preorder-toggle.is-active { background: #111; color: #fff; }
      .quaora-preorder-date-wrap { margin-top: 12px; }
      .quaora-preorder-date-wrap[hidden] { display: none !important; }
      .quaora-preorder-date-wrap label { display: block; margin-bottom: 6px; color: #555; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .quaora-preorder-date-wrap input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid rgba(17,17,17,.2); border-radius: 6px; background: #fff; color: #111; font: inherit; }
      .quaora-preorder-card-badge { position: absolute; top: 12px; left: 50%; z-index: 35; transform: translateX(-50%); min-width: max-content; padding: 8px 11px; border: 1px solid rgba(255,255,255,.75); border-radius: 4px; background: rgba(17,17,17,.92); color: #fff; box-shadow: 0 8px 22px rgba(0,0,0,.2); text-align: center; pointer-events: none; }
      .quaora-preorder-card-badge strong { display: block; font-size: 9px; letter-spacing: .15em; }
      .quaora-preorder-card-badge small { display: block; margin-top: 3px; font-size: 8px; letter-spacing: 0; opacity: .82; }
    `;
    document.head.appendChild(style);
  };

  const setAdminState = (enabled, date = "") => {
    const toggle = document.getElementById("pPreorderToggle");
    const dateWrap = document.getElementById("pPreorderDateWrap");
    const dateInput = document.getElementById("pPreorderDate");
    if (!toggle || !dateWrap || !dateInput) return;

    toggle.setAttribute("aria-pressed", String(Boolean(enabled)));
    toggle.classList.toggle("is-active", Boolean(enabled));
    toggle.textContent = enabled ? "ÖNSİPARİŞ AÇIK" : "ÖNSİPARİŞ";
    dateWrap.hidden = !enabled;
    dateInput.required = Boolean(enabled);
    dateInput.min = localDateKey();
    dateInput.value = enabled ? String(date || "") : "";
  };

  const mountAdminFields = () => {
    injectStyles();
    if (document.getElementById("quaoraPreorderAdmin")) return;
    const descriptionInput = document.getElementById("pDesc");
    const anchor = descriptionInput?.closest("div");
    if (!anchor) return;

    const wrapper = document.createElement("div");
    wrapper.id = "quaoraPreorderAdmin";
    wrapper.className = "quaora-preorder-admin";
    wrapper.innerHTML = `
      <button id="pPreorderToggle" class="quaora-preorder-toggle" type="button" aria-pressed="false">ÖNSİPARİŞ</button>
      <div id="pPreorderDateWrap" class="quaora-preorder-date-wrap" hidden>
        <label for="pPreorderDate">Tahmini teslim tarihi</label>
        <input id="pPreorderDate" type="date">
      </div>
    `;
    anchor.insertAdjacentElement("afterend", wrapper);
    document.getElementById("pPreorderToggle")?.addEventListener("click", () => {
      const toggle = document.getElementById("pPreorderToggle");
      setAdminState(toggle?.getAttribute("aria-pressed") !== "true", document.getElementById("pPreorderDate")?.value || "");
    });
    setAdminState(false);
  };

  const resetAdminFields = () => {
    mountAdminFields();
    setAdminState(false);
  };

  const fillAdminFields = (product) => {
    mountAdminFields();
    setAdminState(isPreorder(product), product?.preorderEstimatedDate || product?.estimatedDate || "");
  };

  const readAdminFields = () => {
    mountAdminFields();
    const enabled = document.getElementById("pPreorderToggle")?.getAttribute("aria-pressed") === "true";
    const date = document.getElementById("pPreorderDate")?.value || "";
    if (enabled && !date) throw new Error("Önsipariş için tahmini teslim tarihi seçmelisiniz.");
    if (enabled && date < localDateKey()) throw new Error("Tahmini teslim tarihi bugünden önce olamaz.");
    return { isPreorder: enabled, preorderEstimatedDate: enabled ? date : "" };
  };

  const descriptionText = (product) => {
    const description = product?.description || "Bu ürün için detaylı bir açıklama eklenmemiştir.";
    if (!isPreorder(product)) return description;
    return `ÖNSİPARİŞ ÜRÜNÜ\nTahmini teslim tarihi: ${formatDate(product.preorderEstimatedDate || product.estimatedDate)}\n\n${description}`;
  };

  const decorateProductCards = (products) => {
    injectStyles();
    (Array.isArray(products) ? products : []).forEach((product) => {
      const article = document.getElementById(`product-${product.id}`);
      if (!article) return;
      article.querySelector("[data-quaora-preorder-badge]")?.remove();
      if (!isPreorder(product)) return;

      const media = article.querySelector("div.relative");
      if (!media) return;
      const badge = document.createElement("span");
      badge.className = "quaora-preorder-card-badge";
      badge.dataset.quaoraPreorderBadge = "true";
      badge.innerHTML = "<strong>ÖNSİPARİŞ</strong><small></small>";
      badge.querySelector("small").textContent = `Tahmini ${formatDate(product.preorderEstimatedDate || product.estimatedDate)}`;
      media.appendChild(badge);
    });
  };

  injectStyles();
  window.QuaoraPreorder = Object.freeze({
    isPreorder,
    formatDate,
    mountAdminFields,
    resetAdminFields,
    fillAdminFields,
    readAdminFields,
    descriptionText,
    decorateProductCards
  });
})();
