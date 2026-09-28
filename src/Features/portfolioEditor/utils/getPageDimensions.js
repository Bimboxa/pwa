// Dimensions in PDF points (1 point = 1/72 inch), landscape orientation.
// Single source of truth for ISO A page sizes (portfolio pages, base map
// print zones). Millimetres are derived: mm = pt * 25.4 / 72.
const PAGE_FORMATS = {
  A4: { width: 842, height: 595 },
  A3: { width: 1191, height: 842 },
  A2: { width: 1684, height: 1191 },
  A1: { width: 2384, height: 1684 },
  A0: { width: 3370, height: 2384 },
};

export const PAGE_FORMAT_KEYS = ["A4", "A3", "A2", "A1", "A0"];

export default function getPageDimensions(
  format = "A4",
  orientation = "landscape"
) {
  const base = PAGE_FORMATS[format] || PAGE_FORMATS.A4;
  if (orientation === "portrait") {
    return { width: base.height, height: base.width };
  }
  return { ...base };
}
