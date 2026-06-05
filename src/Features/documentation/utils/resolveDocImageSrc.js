// Resolve an <img src> from a Markdown page against the documentation's
// imageLoaders map. Absolute / data / http URLs pass through unchanged.
// Returns a Promise<string|null> — null if no matching local asset.
export default async function resolveDocImageSrc(src, {pageId, imageLoaders}) {
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  // Strip a leading "./" and any leading "/"
  let cleaned = src.replace(/^\.\//, "").replace(/^\//, "");

  // Per-page scheme: pageId is the page folder (`<slug>`), so a `./images/x`
  // reference lives at `<slug>/images/x`.
  if (pageId) {
    const direct = `${pageId}/${cleaned}`;
    if (imageLoaders?.[direct]) {
      return await imageLoaders[direct]();
    }
  }

  // Legacy scheme: pageId is a path including the file (`concepts/krto`), so the
  // image folder is the page's parent dir.
  if (pageId && pageId.includes("/")) {
    const pageDir = pageId.split("/").slice(0, -1).join("/");
    const candidate = `${pageDir}/${cleaned}`;
    if (imageLoaders?.[candidate]) {
      return await imageLoaders[candidate]();
    }
  }

  if (imageLoaders?.[cleaned]) {
    return await imageLoaders[cleaned]();
  }
  return null;
}
