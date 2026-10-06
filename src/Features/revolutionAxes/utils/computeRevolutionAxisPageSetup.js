// Relative imports on purpose: pure module replayed by node --test
// (computeRevolutionAxisPageSetup.test.mjs), no Vite alias there.
import { PAPER_SIZES_MM } from "../../baseMaps/utils/getBlankBaseMapGeometry.js";
import { AXIS_BASE_POINT_RATIO } from "../constants/revolutionAxisPage.js";

// Page setup of the blank vertical base map created for a revolution axis
// (the "Fond de plan" overlay action): A3, the finest scale whose page holds
// the axis — radius on each side of the middle (AXIS_BASE_POINT_RATIO.x) and
// the axis height above its base (AXIS_BASE_POINT_RATIO.y), plus a paper
// margin. Portrait is tried before paysage at each scale. Same candidate loop
// as computeChateauEauPageSetup, with the axis scalars as extents.
const CANDIDATE_SCALES = [10, 25, 50, 100];
const CANDIDATE_FORMATS = ["portrait", "paysage"];
const SIZE = "A3";
const MARGIN_PAPER_MM = 10;

/**
 * @param {object} args
 * @param {number} args.radiusM axis radius in meters (graphical circle)
 * @param {number} args.heightM axis height in meters (above its base)
 * @returns {{ format: "portrait"|"paysage", size: "A3", scale: number, fits: boolean }}
 *   feeds getBlankBaseMapGeometry as-is; fits=false flags the best-effort
 *   fallback (axis larger than the biggest candidate)
 */
export default function computeRevolutionAxisPageSetup({ radiusM, heightM }) {
  const halfWidthM = Math.max(Number(radiusM) || 0, 0);
  const aboveM = Math.max(Number(heightM) || 0, 0);
  const { short, long } = PAPER_SIZES_MM[SIZE];

  for (const scale of CANDIDATE_SCALES) {
    const margin = (MARGIN_PAPER_MM / 1000) * scale; // paper mm → real meters
    for (const format of CANDIDATE_FORMATS) {
      const widthMm = format === "paysage" ? long : short;
      const heightMm = format === "paysage" ? short : long;
      const pageW = (widthMm / 1000) * scale;
      const pageH = (heightMm / 1000) * scale;
      const fits =
        halfWidthM + margin <= AXIS_BASE_POINT_RATIO.x * pageW &&
        aboveM + margin <= AXIS_BASE_POINT_RATIO.y * pageH;
      if (fits) return { format, size: SIZE, scale, fits: true };
    }
  }
  return { format: "portrait", size: SIZE, scale: 100, fits: false };
}
