import {DOCUMENTATION_ROOT} from "../constants/documentationRoutes";

// Detect a Markdown link that targets another .md page and produce the
// in-app route for it. Returns null if the href is external or not a .md link.
export default function resolveInternalDocLink(href, {pageId} = {}) {
  if (!href || typeof href !== "string") return null;
  if (/^(https?:)?\/\//i.test(href)) return null;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;

  const [pathPart, hashPart] = href.split("#");
  if (!pathPart) {
    // pure anchor link — leave as-is
    return null;
  }
  if (!/\.md(\?|$)/i.test(pathPart)) return null;

  let cleaned = pathPart.replace(/\.md$/i, "").replace(/^\.\//, "");
  if (cleaned.startsWith("/")) cleaned = cleaned.slice(1);

  // Resolve relative to current page folder if pageId nested
  if (pageId && pageId.includes("/") && !cleaned.startsWith("../")) {
    if (!cleaned.includes("/") || cleaned.startsWith("./")) {
      const pageDir = pageId.split("/").slice(0, -1).join("/");
      cleaned = pageDir ? `${pageDir}/${cleaned}` : cleaned;
    }
  }

  return `${DOCUMENTATION_ROOT}/${cleaned}${hashPart ? `#${hashPart}` : ""}`;
}
