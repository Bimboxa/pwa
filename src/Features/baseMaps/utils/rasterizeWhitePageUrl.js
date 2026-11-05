// PNG raster of a synthesized white page image (SVG data url — see
// createWhitePageImage.js), for the few consumers that need real pixels and
// cannot decode an SVG: the OpenCV worker and createImageBitmap both reject
// SVG blobs. Rasterized on demand at the page pixel size, the last few kept
// for the session.
//
// @returns Promise<{ blob: Blob, url: string }> — PNG blob + its object url

const MAX_ENTRIES = 4;
const cache = new Map(); // svg data url -> Promise<{ blob, url }>

function rasterize(svgUrl) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("rasterizeWhitePageUrl: toBlob failed"));
          return;
        }
        resolve({ blob, url: URL.createObjectURL(blob) });
      }, "image/png");
    };
    img.onerror = () =>
      reject(new Error("rasterizeWhitePageUrl: failed to load the page"));
    img.src = svgUrl;
  });
}

export default function rasterizeWhitePageUrl(svgUrl) {
  let entry = cache.get(svgUrl);
  if (entry) return entry;

  entry = rasterize(svgUrl);
  cache.set(svgUrl, entry);
  entry.catch(() => cache.delete(svgUrl));

  if (cache.size > MAX_ENTRIES) {
    const [oldestKey, oldestEntry] = cache.entries().next().value;
    cache.delete(oldestKey);
    oldestEntry.then(({ url }) => URL.revokeObjectURL(url)).catch(() => {});
  }

  return entry;
}
