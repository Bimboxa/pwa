import { nanoid } from "@reduxjs/toolkit";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";
import buildCoteAnnotationFields from "Features/threedDrawing/utils/buildCoteAnnotationFields";
import encodeDimensionChainOffsets from "Features/threedDrawing/utils/encodeDimensionChainOffsets";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";

// « Plan de coupe » + « Afficher les cotes »: rows of the template-less
// RULER (« Règle ») running along the drawn axis, one vertex per cut plane —
// its segments read the distance between two planes. Same model as
// commitDrawnRulerService (host base map, offsetZ + per-point offsetBottom
// off the base map plane), but the ruler owns its points: a batch write,
// added by the caller in its own transaction (createCutPlaneLinesService).
//
// axisPoints: world points in order along the axis (getCutPlaneAxisPoints).
// Returns { newPoints, newAnnotations } (empty when there are fewer than two
// points or they do not project on a base map).
export default function buildCutPlaneRulerRows({
  axisPoints,
  baseMaps,
  projectId,
  scopeId = null,
  layerId = null,
  preferredBaseMapId = null,
}) {
  const empty = { newPoints: [], newAnnotations: [] };
  if (!axisPoints || axisPoints.length < 2) return empty;
  const host = resolveHostBaseMap({
    vertices: axisPoints,
    baseMaps,
    preferredBaseMapId,
  });
  const projected = host
    ? axisPoints.map((p) => worldToBaseMapNormalized(p, host))
    : null;
  if (!projected || projected.some((p) => !p)) return empty;

  const { isInPlane, offsetZ, points } = encodeDimensionChainOffsets(projected);
  const newPoints = [];
  const refs = points.map((p) => {
    const id = nanoid();
    newPoints.push({ id, x: p.x, y: p.y, projectId, baseMapId: host.id });
    return isInPlane ? { id } : { id, offsetBottom: p.offsetBottom };
  });

  const now = new Date().toISOString();
  const annotation = {
    id: nanoid(),
    projectId,
    scopeId: scopeId ?? null,
    listingId: null,
    isTemplateless: true,
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    points: refs,
    createdAt: now,
    updatedAt: now,
    ...buildCoteAnnotationFields({
      shape: "RULER",
      classificationFields: {
        type: "RULER",
        ...(isInPlane ? {} : { offsetZ }),
      },
      templateProps: { ...getTemplatelessDraft("RULER"), type: "RULER" },
    }),
    isDrawnIn3d: true,
  };
  return { newPoints, newAnnotations: [annotation] };
}
