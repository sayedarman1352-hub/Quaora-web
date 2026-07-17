(function () {
  "use strict";

  const MAX_IMAGE_COUNT = 8;
  const MAX_ARRAY_BYTES = 760000;
  const MIN_TARGET_BYTES = 48000;

  const byteLength = (value) => new TextEncoder().encode(String(value || "")).length;
  const arrayByteLength = (images) => byteLength(JSON.stringify(images || []));

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Fotoğraf okunamadı. Lütfen başka bir dosya deneyin."));
    image.src = source;
  });

  const canvasDataUrl = (canvas, quality) => {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
    return canvas.toDataURL("image/jpeg", quality);
  };

  const compressDataUrl = async (source, targetBytes) => {
    if (!String(source).startsWith("data:image/")) return source;
    if (byteLength(source) <= targetBytes) return source;

    const image = await loadImage(source);
    const initialScale = Math.min(1, 960 / image.width, 1280 / image.height);
    const qualities = [0.76, 0.66, 0.56, 0.46, 0.36, 0.28];
    let scale = initialScale;
    let smallest = source;

    for (let sizeAttempt = 0; sizeAttempt < 6; sizeAttempt += 1) {
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const candidate = canvasDataUrl(canvas, quality);
        if (byteLength(candidate) < byteLength(smallest)) smallest = candidate;
        if (byteLength(candidate) <= targetBytes) return candidate;
      }

      scale *= 0.8;
    }

    return smallest;
  };

  const fitDataUrlArray = async (inputImages, maxBytes = MAX_ARRAY_BYTES) => {
    const images = Array.isArray(inputImages) ? inputImages.filter(Boolean) : [];
    if (!images.length) return [];
    if (images.length > MAX_IMAGE_COUNT) {
      throw new Error(`Bir ürüne en fazla ${MAX_IMAGE_COUNT} fotoğraf ekleyebilirsiniz.`);
    }

    const dataImageCount = images.filter((image) => String(image).startsWith("data:image/")).length;
    const externalBytes = images
      .filter((image) => !String(image).startsWith("data:image/"))
      .reduce((total, image) => total + byteLength(image), 0);
    const availableBytes = Math.max(MIN_TARGET_BYTES, maxBytes - externalBytes - 12000);
    let targetBytes = Math.max(
      MIN_TARGET_BYTES,
      Math.min(155000, Math.floor(availableBytes / Math.max(1, dataImageCount)))
    );
    let prepared = [];

    for (const image of images) {
      prepared.push(await compressDataUrl(image, targetBytes));
    }

    for (let attempt = 0; attempt < 3 && arrayByteLength(prepared) > maxBytes; attempt += 1) {
      const ratio = maxBytes / arrayByteLength(prepared);
      targetBytes = Math.max(MIN_TARGET_BYTES, Math.floor(targetBytes * ratio * 0.84));
      const next = [];
      for (const image of prepared) {
        next.push(await compressDataUrl(image, targetBytes));
      }
      prepared = next;
    }

    if (arrayByteLength(prepared) > maxBytes) {
      throw new Error("Fotoğrafların toplam boyutu hâlâ çok büyük. Bir fotoğrafı kaldırıp tekrar deneyin.");
    }

    return prepared;
  };

  window.QuaoraImageUtils = Object.freeze({
    MAX_IMAGE_COUNT,
    MAX_ARRAY_BYTES,
    arrayByteLength,
    fitDataUrlArray
  });
})();
