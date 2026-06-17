// Compute the 3D placement (orientation / angleDeg / position) of each baseMap
// cut from the SAME PDF page, so the user does not have to position them
// manually with the green/red calibration markers afterwards.
//
// Rule: within one page, the FIRST baseMap is the reference (kept at the world
// origin, HORIZONTAL, angleDeg 0). Every other baseMap from that page is
// translated relative to it by the offset of its crop rectangle on the page,
// scaled to real-world meters.
//
// Geometry matches the existing 3D image-plane convention (getBaseMapEuler +
// baseMapNormalizedToWorld + baseMapLocalToWorld): for a HORIZONTAL, angleDeg 0
// baseMap, page +X (right) -> world +X and page +Y (down) -> world +Z, and the
// group position is the CENTER of the image plane.

const METER_PER_INCH = 0.0254; // same constant as pdfToPngAsync
const POINTS_PER_INCH = 72;

// Crop center on the page in normalized [0..1] coords (y down).
// bboxInRatio null => full page => center (0.5, 0.5).
function getCropCenter(bboxInRatio) {
  if (!bboxInRatio) return { cx: 0.5, cy: 0.5 };
  const { x1, y1, x2, y2 } = bboxInRatio;
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

// Returns a Map<tempId, { orientation, angleDeg, position: {x, y, z} }>.
// Empty map when blueprintScale is falsy (no scale => meterByPx is null too).
export default async function computeBaseMapsPlacements({
  baseMaps,
  pdfDocument,
  blueprintScale,
}) {
  const placements = new Map();
  const scale = Number(blueprintScale);
  if (!blueprintScale || !Number.isFinite(scale) || scale <= 0) return placements;
  if (!pdfDocument || !Array.isArray(baseMaps)) return placements;

  // Group by page, preserving input order.
  const groups = new Map();
  for (const baseMap of baseMaps) {
    const page = baseMap.page ?? 1;
    if (!groups.has(page)) groups.set(page, []);
    groups.get(page).push(baseMap);
  }

  for (const [page, group] of groups) {
    const ref = group[0];
    const rotate = ref?.rotate ?? 0;

    let pdfPage;
    try {
      pdfPage = await pdfDocument.getPage(page);
    } catch (error) {
      console.error("[computeBaseMapsPlacements] getPage failed", page, error);
      continue;
    }
    const viewport = pdfPage.getViewport({ scale: 1, rotation: rotate });
    const pageWidthM =
      (viewport.width / POINTS_PER_INCH) * METER_PER_INCH * scale;
    const pageHeightM =
      (viewport.height / POINTS_PER_INCH) * METER_PER_INCH * scale;

    const { cx: cx0, cy: cy0 } = getCropCenter(ref?.bboxInRatio);

    for (const baseMap of group) {
      const { cx, cy } = getCropCenter(baseMap?.bboxInRatio);
      placements.set(baseMap.id, {
        orientation: "HORIZONTAL",
        angleDeg: 0,
        position: {
          x: (cx - cx0) * pageWidthM,
          y: 0,
          z: (cy - cy0) * pageHeightM,
        },
      });
    }
  }

  return placements;
}
