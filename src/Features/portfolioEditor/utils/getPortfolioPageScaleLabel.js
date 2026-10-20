import getPageDimensions from "./getPageDimensions";
import { formatPrintZoneScale } from "Features/baseMaps/utils/printZone";

// Printed scale label of a portfolio page ("1:50"), bound to the title block
// `page.scale` cell. Pure — takes the page, its largest base map container
// and that base map's resolved print zone.
//
// The label is only meaningful when the container prints the zone at the
// zone's scale, i.e. when the container's pt-per-reference-px ratio equals
// the zone's own ratio (page width in pt / zone width in px), on both axes:
// - the zone carries a scale (zone.scale > 0, "libre" zones have none),
// - container.width / viewBox.width ≈ pageDims(zone).width / zone.width
//   (0.5 % tolerance), same for the height — a missing viewBox means the
//   default framing, i.e. the zone itself (see computeDefaultViewBox).
// A cropped container (smaller frame, same ratio — « Croper ») keeps the
// label; a zoomed (« Cadrer » wheel) or stretched one loses it.
// Every other case returns "" so the cell hides (hideIfEmpty).

const RATIO_TOLERANCE = 0.005;

const near = (a, b, tol) => Math.abs((a ?? NaN) - (b ?? NaN)) <= tol;

export function getLargestBaseMapContainer(containers) {
  let best = null;
  for (const c of containers || []) {
    if (!c?.baseMapId || c.deletedAt) continue;
    const area = (c.width || 0) * (c.height || 0);
    if (!best || area > best.area) best = { container: c, area };
  }
  return best?.container ?? null;
}

export default function getPortfolioPageScaleLabel({
  page,
  container,
  printZone,
}) {
  if (!page || !container || !printZone) return "";
  if (!(printZone.scale > 0)) return "";
  if (!(printZone.width > 0) || !(printZone.height > 0)) return "";

  const zoneDims = getPageDimensions(printZone.format, printZone.orientation);
  const kZone = zoneDims.width / printZone.width;

  const viewBox = container.viewBox ?? printZone;
  if (!(viewBox.width > 0) || !(viewBox.height > 0)) return "";
  const kX = container.width / viewBox.width;
  const kY = container.height / viewBox.height;

  const tol = kZone * RATIO_TOLERANCE;
  if (!near(kX, kZone, tol) || !near(kY, kZone, tol)) return "";

  return `1:${formatPrintZoneScale(printZone.scale)}`;
}
