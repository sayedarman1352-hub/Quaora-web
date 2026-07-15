(function () {
    const PAGE_COLLECTIONS = {
        "ayakkabilar.html": "ayakkabilar",
        "bikini-altlari.html": "bikini-altlari",
        "bikini-ustleri.html": "bikini_ustleri",
        "bottom.html": "bottom_products",
        "cantalar.html": "cantalar",
        "coquette.html": "conquette",
        "gozlukler.html": "gozlukler",
        "mayokini-altlari.html": "mayokini_altlari",
        "mayokini-ustleri.html": "mayokini_ustleri",
        "mayolar.html": "mayolar",
        "outlet.html": "outlet_products",
        "panzer.html": "PANZER",
        "pareolar.html": "pareolar",
        "pie.html": "PIE",
        "plaj-aksesuarlari.html": "plaj_aksesuarlari",
        "relove.html": "RELOVE",
        "sapkalar.html": "sapkalar",
        "takilar.html": "takilar",
        "tops.html": "tops_products",
        "yeni-gelenler.html": "yeni_gelenler"
    };

    const fileName = window.location.pathname.split("/").pop() || "index.html";
    const collectionName = PAGE_COLLECTIONS[fileName];
    if (!collectionName) return;

    const cardSelector = "#productGrid article[id^='product-'], #newProductsGrid [data-product-id]";
    const interactiveSelector = "a, button, input, select, textarea, label, [role='button'], [contenteditable='true']";

    const getProductId = (card) => {
        if (card.dataset.productId) return card.dataset.productId;
        return card.id.startsWith("product-") ? card.id.slice(8) : "";
    };

    const getProductUrl = (card) => {
        const productId = getProductId(card);
        if (!productId) return "";
        const params = new URLSearchParams({
            collection: collectionName,
            id: productId,
            from: fileName
        });
        return `urun.html?${params.toString()}`;
    };

    const openProduct = (card, newTab) => {
        const url = getProductUrl(card);
        if (!url) return;
        if (newTab) {
            window.open(url, "_blank", "noopener");
            return;
        }
        window.location.href = url;
    };

    const enhanceCards = () => {
        document.querySelectorAll(cardSelector).forEach((card) => {
            if (card.dataset.productLinkReady === "true") return;
            card.dataset.productLinkReady = "true";
            card.classList.add("quaora-product-link-card");
            card.tabIndex = 0;
            card.setAttribute("role", "link");
            card.setAttribute("aria-label", `${card.querySelector("h3, h4")?.textContent?.trim() || "Ürün"} detaylarını aç`);
        });
    };

    document.addEventListener("click", (event) => {
        const card = event.target.closest(cardSelector);
        if (!card || event.target.closest(interactiveSelector)) return;
        openProduct(card, event.ctrlKey || event.metaKey);
    });

    document.addEventListener("auxclick", (event) => {
        if (event.button !== 1) return;
        const card = event.target.closest(cardSelector);
        if (!card || event.target.closest(interactiveSelector)) return;
        event.preventDefault();
        openProduct(card, true);
    });

    document.addEventListener("keydown", (event) => {
        const card = event.target.closest(cardSelector);
        if (!card || event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        openProduct(card, false);
    });

    const style = document.createElement("style");
    style.textContent = `
        .quaora-product-link-card { cursor: pointer; }
        .quaora-product-link-card:focus-visible {
            outline: 2px solid #111;
            outline-offset: 5px;
        }
        #productGrid article > .relative > .absolute.inset-0 {
            align-items: flex-end !important;
            justify-content: flex-start !important;
            padding: 12px !important;
            background: linear-gradient(180deg, transparent 58%, rgba(17, 17, 17, .28)) !important;
            backdrop-filter: none !important;
            pointer-events: none;
        }
        #productGrid article > .relative > .absolute.inset-0 > span {
            padding: 7px 10px !important;
            border: 1px solid rgba(17, 17, 17, .14) !important;
            border-radius: 0 !important;
            background: rgba(255, 255, 255, .94) !important;
            color: #111 !important;
            box-shadow: none !important;
            font-size: 8px !important;
            font-style: normal !important;
            letter-spacing: .14em !important;
            transform: none !important;
        }
    `;
    document.head.appendChild(style);

    enhanceCards();
    new MutationObserver(enhanceCards).observe(document.body, { childList: true, subtree: true });
})();
