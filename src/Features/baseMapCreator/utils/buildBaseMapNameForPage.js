// Builds the base map name for a given page from the name typed in the header.
// Increments the trailing number (keeping zero-padding); otherwise suffixes the
// page number; empty => "Page N".
//   "Page 01" => Page 01, Page 02, … ; "doc p1" => doc p1, doc p2, … ;
//   ""        => Page 1, Page 2, …   ; "Plan"   => Plan 1, Plan 2, …
export default function buildBaseMapNameForPage(baseName, pageNumber, startPage = 1) {
  const trimmed = (baseName ?? "").trim();
  if (!trimmed) return `Page ${pageNumber}`;
  const m = trimmed.match(/^(.*?)(\d+)(\D*)$/); // prefix, digits, suffix
  if (!m) return `${trimmed} ${pageNumber}`;
  const [, prefix, digits, suffix] = m;
  const next = parseInt(digits, 10) + (pageNumber - startPage);
  return `${prefix}${String(next).padStart(digits.length, "0")}${suffix}`;
}
