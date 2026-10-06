// Resolves an image src written in a tutorial Markdown file to a path
// relative to Data/<orgaCode>/ (the key space of useDataImageUrl).
// `./assets/x.svg` with basePath "configurations/tutorials" gives
// "configurations/tutorials/assets/x.svg". Absolute URLs are not Data assets
// and resolve to null.
export default function resolveTutorialImagePath(src, basePath) {
  if (!src || typeof src !== "string") return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return null;
  let path = src.trim().replace(/^\.\//, "");
  while (path.startsWith("../")) path = path.slice(3);
  if (!path) return null;
  const base = (basePath ?? "").replace(/\/+$/, "");
  return base ? `${base}/${path}` : path;
}
