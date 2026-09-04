import { getStripDistancePx } from "Features/geometry/utils/getStripePolygons";

// Lateral offset (px, along the left normal (-uy, ux) of each host segment)
// between a host's STORED polyline and the curve glued openings sit on:
//   - 0 for POLYLINE / POLYGON: the band is centered on the stored points,
//   - half the signed band width for STRIP: the stored points are one EDGE
//     of the band (offset by strokeWidth × stripOrientation toward the left
//     normal), so the band's median line is that edge shifted by d / 2.
//
// The offset is never stored on the relAnnotationOpenings row: it is
// recomputed from the host at every placement / reflow, so a change of the
// strip thickness or side moves the opening with the median.
export default function getOpeningHostOffsetPx(host, meterByPx) {
  if (host?.type !== "STRIP") return 0;
  const d = getStripDistancePx(host, meterByPx);
  return Number.isFinite(d) ? d / 2 : 0;
}
