// Mirrors the slug rule used by rehype-slug (github-slugger).
// Lowercase, strip non-word chars (keep unicode letters/digits + hyphens),
// collapse whitespace to a single hyphen.
export default function slugifyHeading(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s ]+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
