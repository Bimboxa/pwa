// Paper sizes in mm, expressed as short side x long side.
export const PAPER_SIZES_MM = {
  A4: { short: 210, long: 297 },
  A3: { short: 297, long: 420 },
};

// Rasterization resolution (~150 DPI). 150 / 25.4 mm-per-inch.
export const PX_PER_MM = 150 / 25.4;

export const FORMATS = ["paysage", "carre", "portrait"];
export const SIZES = ["A4", "A3"];
export const SCALES = [10, 25, 50, 100];

// Returns the paper dimensions in mm for a given format + size.
function getPaperSizeMm({ format, size }) {
  const { short, long } = PAPER_SIZES_MM[size] || PAPER_SIZES_MM.A4;
  switch (format) {
    case "paysage":
      return { widthMm: long, heightMm: short };
    case "carre":
      return { widthMm: short, heightMm: short };
    case "portrait":
    default:
      return { widthMm: short, heightMm: long };
  }
}

// Computes pixel dimensions and meterByPx for a blank, scale-calibrated baseMap.
// At scale 1:S, 1 mm on paper represents S mm in reality.
//   realWidthM = widthMm * S / 1000
//   meterByPx  = realWidthM / pixelWidth = S / (PX_PER_MM * 1000)
export default function getBlankBaseMapGeometry({ format, size, scale }) {
  const { widthMm, heightMm } = getPaperSizeMm({ format, size });
  const pixelWidth = Math.round(widthMm * PX_PER_MM);
  const pixelHeight = Math.round(heightMm * PX_PER_MM);
  const meterByPx = scale / (PX_PER_MM * 1000);
  return { pixelWidth, pixelHeight, meterByPx };
}
