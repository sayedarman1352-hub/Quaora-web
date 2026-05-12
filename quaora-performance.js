(() => {
  const tuneImage = (img) => {
    if (!img || img.dataset.quaoraPerfReady) return;
    img.dataset.quaoraPerfReady = "1";
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
    if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
    if (!img.hasAttribute("fetchpriority")) img.setAttribute("fetchpriority", "low");
  };

  const tuneAllImages = () => document.querySelectorAll("img").forEach(tuneImage);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tuneAllImages, { once: true });
  } else {
    tuneAllImages();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === "IMG") tuneImage(node);
        node.querySelectorAll?.("img").forEach(tuneImage);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Sayfalar arası hızlı geri dönüş için en temel sayfaları arka planda ısıt.
  window.addEventListener("load", () => {
    if (!("requestIdleCallback" in window)) return;
    requestIdleCallback(() => {
      ["/", "/tops.html", "/bottom.html", "/outlet.html", "/yeni-gelenler.html"].forEach((href) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
      });
    }, { timeout: 2500 });
  }, { once: true });
})();
