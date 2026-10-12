import getPageDimensions from "./getPageDimensions";
import { formatPrintZoneScale } from "Features/baseMaps/utils/printZone";

// Printed scale label of a portfolio page ("1:50"), bound to the title block
// `page.scale` cell. Pure — takes the page, its largest base map container
// and that base map's resolved print zone.
//
// The label is only meaningful when the printed sheet IS the print zone:
// - the zone carries a scale (zone.scale > 0, "libre" zones have none),
// - the page has the zone's format / orientation,
// - the container covers the whole page (x = y = 0, page-sized),
// - the container viewBox is the zone rect (no custom « Cadrer » framing;
//   a missing viewBox means the default framing, i.e. the zone itself —
//   see computeDefaultViewBox).
// Every other case returns "" so the cell hides (hideIfEmpty).

const PAGE_TOLERANCE_PT = 1;

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
  if (
    page.format !== printZone.format ||
    page.orientation !== printZone.orientation
  )
    return "";

  const dims = getPageDimensions(page.format, page.orientation);
  if (
    !near(container.x, 0, PAGE_TOLERANCE_PT) ||
    !near(container.y, 0, PAGE_TOLERANCE_PT) ||
    !near(container.width, dims.width, PAGE_TOLERANCE_PT) ||
    !near(container.height, dims.height, PAGE_TOLERANCE_PT)
  )
    return "";

  const viewBox = container.viewBox;
  if (viewBox) {
    const tol = Math.max(1, printZone.width * 0.005);
    if (
      !near(viewBox.x, printZone.x, tol) ||
      !near(viewBox.y, printZone.y, tol) ||
      !near(viewBox.width, printZone.width, tol) ||
      !near(viewBox.height, printZone.height, tol)
    )
      return "";
  }

  return `1:${formatPrintZoneScale(printZone.scale)}`;
}
