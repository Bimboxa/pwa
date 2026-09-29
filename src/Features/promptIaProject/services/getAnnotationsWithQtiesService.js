import db from "App/db/db";

import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";

/**
 * Quantities of annotations just written to the database, outside React
 * (useAnnotationsV2 does it for the editor): points resolved to pixels from
 * db.points, then getAnnotationQties with the scale of the base map.
 *
 * @param {Object} params
 * @param {Array<Object>} params.annotations - db rows (points = id refs)
 * @param {Map<string, Object>} params.baseMapById - base map records
 * @returns {Promise<Array<Object>>} annotations with pixel points + `qties`
 */
export default async function getAnnotationsWithQtiesService({
  annotations,
  baseMapById,
}) {
  const rows = (annotations ?? []).filter(Boolean);
  if (!rows.length) return [];

  const pointIds = new Set();
  for (const annotation of rows) {
    const rings = [
      annotation.points,
      ...(annotation.cuts ?? []).map((c) => c.points),
    ];
    for (const ring of rings)
      for (const point of ring ?? []) if (point?.id) pointIds.add(point.id);
  }
  const points = (await db.points.bulkGet([...pointIds])).filter(Boolean);
  const pointsIndex = Object.fromEntries(points.map((p) => [p.id, p]));

  return rows.map((annotation) => {
    const baseMap = baseMapById.get(annotation.baseMapId);
    const imageSize =
      baseMap?.image?.imageSize ??
      (baseMap?.refWidth && baseMap?.refHeight
        ? { width: baseMap.refWidth, height: baseMap.refHeight }
        : null);
    const meterByPx = baseMap?.meterByPx ?? null;
    if (!imageSize || !meterByPx) return { ...annotation, qties: null };
    const resolved = {
      ...annotation,
      points: resolvePoints({
        points: annotation.points,
        pointsIndex,
        imageSize,
      }),
      ...(annotation.cuts?.length
        ? {
            cuts: resolveCuts({
              cuts: annotation.cuts,
              pointsIndex,
              imageSize,
            }),
          }
        : {}),
    };
    return {
      ...resolved,
      qties: getAnnotationQties({ annotation: resolved, meterByPx }),
    };
  });
}
