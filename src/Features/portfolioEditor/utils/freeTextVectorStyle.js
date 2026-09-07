// Pure style helpers of the FREE_TEXT vector export (no DOM, no db) — kept
// apart from collectFreeTextVectorItems so they can be replayed headless.

// CSSOM serializes inline colors as rgb()/rgba(); hex and keywords are
// handled for safety. Returns {r, g, b} in [0..1] or null when transparent.
export function parseCssColor(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "transparent" || v === "none") return null;
  let m =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
      v
    );
  if (m) {
    if (m[4] != null && parseFloat(m[4]) === 0) return null;
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 };
  }
  m =
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/.exec(
      v
    );
  if (m) {
    if (m[4] != null && parseFloat(m[4]) === 0) return null;
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 };
  }
  m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    let hex = m[1];
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    const int = parseInt(hex, 16);
    return {
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
    };
  }
  if (v === "white") return { r: 1, g: 1, b: 1 };
  if (v === "black") return { r: 0, g: 0, b: 0 };
  return null;
}

// Web-safe stacks of freeTextConstants → pdf-lib standard font family.
export function getStandardFontFamily(fontFamilyCss) {
  const first = String(fontFamilyCss || "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
  if (first.includes("times") || first.includes("georgia")) return "times";
  if (first.includes("courier") || first.includes("mono")) return "courier";
  return "helvetica";
}
