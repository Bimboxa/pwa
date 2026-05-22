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

  // If src is relative to the current page folder, resolve against pageId's dir.
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
