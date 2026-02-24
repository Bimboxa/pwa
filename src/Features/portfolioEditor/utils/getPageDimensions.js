// Dimensions in PDF points (1 point = 1/72 inch)
const PAGE_FORMATS = {
  A4: { width: 842, height: 595 },
  A3: { width: 1191, height: 842 },
};

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
