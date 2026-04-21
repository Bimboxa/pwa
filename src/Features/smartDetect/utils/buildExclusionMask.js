import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import getPolylineContourPoints from "Features/geometry/utils/getPolylineContourPoints";

/**
 * Rasterize visible annotations into a Uint8Array exclusion mask
 * (1 = pixel covered by an existing annotation).
 *
 * Annotations are converted to image-pixel coords using the base map
 * scale/offset. STRIP annotations use getStripePolygons to compute the
 * filled ribbon; POLYGON / closed POLYLINE are filled; open POLYLINE
 * is stroked using its strokeWidth.
 */
export default function buildExclusionMask(
  annotations,
  imageSize,
  imageScale,
  imageOffset,
  meterByPx,
  sourceAnnotationId
) {
  const { width, height } = imageSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";

  for (const ann of annotations) {
    if (!ann.points || ann.points.length < 2) continue;
    if (ann.id === sourceAnnotationId) continue;

    const toImgPx = (p) => ({
      x: (p.x - imageOffset.x) / imageScale,
      y: (p.y - imageOffset.y) / imageScale,
    });

    if (ann.type === "STRIP") {
      const polys = getStripePolygons(ann, meterByPx);
      for (const poly of polys) {
        if (!poly.points || poly.points.length < 3) continue;
        ctx.beginPath();
        const pts = poly.points.map(toImgPx);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fill();
      }
    } else if (ann.type === "POLYGON" || (ann.type === "POLYLINE" && ann.closeLine)) {
      const pts = ann.points.map(toImgPx);
      if (pts.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    } else if (ann.type === "POLYLINE") {
      const pts = ann.points.map(toImgPx);
      if (pts.length < 2) continue;
      const sw = ann.strokeWidth ?? 1;
      const swPx =
        ann.strokeWidthUnit === "CM" && meterByPx > 0
          ? Math.abs((sw * 0.01) / meterByPx / imageScale)
          : Math.abs(sw / imageScale);
      // Fill the exact symmetric contour polygon (same algorithm as the
      // "Contours" tool — see getPolylineContourPoints / useWallBoundaries)
      // instead of ctx.stroke(). Avoids the anti-aliased fringe and
      // line-cap artifacts of stroke() — the mask now matches the
      // rendered polyline's geometry pixel-for-pixel.
      const contour = getPolylineContourPoints(pts, swPx);
      if (contour.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(contour[0].x, contour[0].y);
      for (let i = 1; i < contour.length; i++) {
        ctx.lineTo(contour[i].x, contour[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // Use a mostly-painted threshold (>= 128) instead of "any non-zero red
  // channel" so anti-aliased fringe pixels at the stroke / fill edges are
  // NOT masked. Polyline / strip interiors are painted fully opaque white
  // (red = 255), so fully-covered pixels remain masked; only the 0.5-1 px
  // antialiasing fringe on each side drops out. Avoids falsely masking
  // legitimate base-map dark pixels adjacent to existing annotations.
  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (data[i * 4] >= 128) mask[i] = 1;
  }
  return mask;
}
