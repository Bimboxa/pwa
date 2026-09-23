import db from "App/db/db";

import getScaledImageBbox from "../utils/getScaledImageBbox";

// IMAGE scale tool: a 2-click cote of `lengthInPx` (base-map px) drawn on the
// image must measure `targetMeters`. The bbox is scaled by the ratio about the
// first clicked point (p1, base-map px), so that point stays put on the plan.
export default async function applyImageScaleService({
  annotationId,
  imageSize, // base map image size (normalization frame)
  baseMapMeterByPx,
  p1,
  lengthInPx,
  targetMeters,
}) {
  if (!annotationId || !(lengthInPx > 0) || !(targetMeters > 0)) return null;
  if (!(baseMapMeterByPx > 0) || !(imageSize?.width > 0) || !(imageSize?.height > 0))
    return null;

  const raw = await db.annotations.get(annotationId);
  if (!raw?.bbox) return null;

  const bboxPx = {
    x: raw.bbox.x * imageSize.width,
    y: raw.bbox.y * imageSize.height,
    width: raw.bbox.width * imageSize.width,
    height: raw.bbox.height * imageSize.height,
  };
  const factor = targetMeters / baseMapMeterByPx / lengthInPx;
  const scaled = getScaledImageBbox({ bboxPx, pivot: p1, factor });

  const bbox = {
    x: scaled.x / imageSize.width,
    y: scaled.y / imageSize.height,
    width: scaled.width / imageSize.width,
    height: scaled.height / imageSize.height,
  };
  await db.annotations.update(annotationId, { bbox });
  return bbox;
}
