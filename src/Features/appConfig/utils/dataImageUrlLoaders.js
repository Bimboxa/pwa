/*
 * URL loaders for the image assets stored under each org's Data folder
 * (gitignored). The globs are lazy: a loader is only invoked when the image
 * is actually needed, so heavy illustrations (e.g. the recap images of the
 * Krto configurations) never load at startup.
 */

// SVG assets, returned as URLs so we can use them in <img src> or SVG
// <image href>.
export const DATA_SVG_URL_LOADERS = import.meta.glob("../../../Data/**/*.svg", {
  as: "url",
  eager: false,
});

// Raster assets (PNG / JPG / WEBP).
export const DATA_IMAGE_URL_LOADERS = import.meta.glob(
  "../../../Data/**/*.{png,jpg,jpeg,webp}",
  { as: "url", eager: false }
);

// PDF assets (configuration PDF_PAGE base map items), rasterized at scope
// creation time by useCreateConfigurationBaseMaps.
export const DATA_PDF_URL_LOADERS = import.meta.glob("../../../Data/**/*.pdf", {
  as: "url",
  eager: false,
});

// resolved URLs, keyed by glob path — one load per asset
const urlCache = new Map();

/*
 * Resolve the URL of a Data image on demand.
 * relativePath is relative to Data/<orgaCode>/ (e.g.
 * "configurations/assets/metre_cuvelage.png"). Returns null when the file
 * is unknown to the globs.
 */
export default async function loadDataImageUrl({ orgaCode, relativePath }) {
  if (!orgaCode || !relativePath) return null;
  const fullPath = `../../../Data/${orgaCode}/${relativePath}`;
  if (urlCache.has(fullPath)) return urlCache.get(fullPath);
  const loader =
    DATA_SVG_URL_LOADERS[fullPath] || DATA_IMAGE_URL_LOADERS[fullPath];
  if (!loader) return null;
  const url = await loader();
  urlCache.set(fullPath, url ?? null);
  return url ?? null;
}
