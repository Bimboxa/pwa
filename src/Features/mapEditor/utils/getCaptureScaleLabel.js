import { formatPrintZoneScale } from "Features/baseMaps/utils/printZone";

// Printed scale label ("1:50") of a capture, bound to the cartouche
// `page.scale` cell. Pure — takes the capture frame in REFERENCE image px
// and the base map's resolved print zone. Capture-side twin of
// getPortfolioPageScaleLabel: the label only means something when the
// captured sheet IS the print zone, i.e.
// - the zone carries a scale (zone.scale > 0, "libre" zones have none),
// - the frame matches the zone rect (x, y, width, height within 1 % of the
//   zone width — a frame strictly inside the zone is a zoomed detail, whose
//   printed scale is not 1:N any more).
// Every other case returns "" so the cell hides (hideIfEmpty).

const near = (a, b, tol) => Math.abs((a ?? NaN) - (b ?? NaN)) <= tol;

export default function getCaptureScaleLabel({ frameImageRect, printZone }) {
  if (!frameImageRect || !printZone) return "";
  if (!(printZone.scale > 0)) return "";
  if (!(printZone.width > 0)) return "";

  const tol = Math.max(1, printZone.width * 0.01);
  if (
    !near(frameImageRect.x, printZone.x, tol) ||
    !near(frameImageRect.y, printZone.y, tol) ||
    !near(frameImageRect.width, printZone.width, tol) ||
    !near(frameImageRect.height, printZone.height, tol)
  )
    return "";

  return `1:${formatPrintZoneScale(printZone.scale)}`;
}
