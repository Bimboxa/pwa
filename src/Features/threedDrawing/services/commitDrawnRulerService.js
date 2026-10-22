import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import buildCoteAnnotationFields from "../utils/buildCoteAnnotationFields";
import dedupeAdjacentVertices from "../utils/dedupeAdjacentVertices";
import encodeDimensionChainOffsets from "../utils/encodeDimensionChainOffsets";
import resolveHostBaseMap from "../utils/resolveHostBaseMap";
import insertOrReusePoints from "./insertOrReusePoints";

// Orchestrator: 3D N-click dimension chain → host baseMap → 2D RULER
// annotation. The cote service (commitDrawnCoteService) generalized to a
// chain, with the polyline service's riser encoding:
//   - in-plane chain → points: [{id}, …] — byte-identical to the 2D commit
//     shape, so 2D-drawn rulers and flat 3D-drawn rulers are the same.
//   - lifted / vertical / oblique chain → annotation.offsetZ = min offset,
//     per-point ref carries offsetBottom = offset - offsetZ
//     (encodeDimensionChainOffsets).
//   - a vertical segment projects both ends onto the same normalized (x, y):
//     dedupeAdjacentVertices keeps them (different altitude) and
//     insertOrReusePoints reuses ONE db.points row referenced twice — a 2D
//     vertex drag then keeps the riser vertical.
//
// No `type` is set on the projected points (plain "square" refs): a ruler
// has no arc segments.
//
// Template-less ruler (templateProps.isTemplateless, no annotationTemplateId
// — the "Dessin" tool on its RULER type): the annotation belongs to the
// scope + the host base map only (`scopeId`, `listingId: null`), same rule as
// the cote. It then needs `createAnnotationFn` (useCreateAnnotation):
// createAnnotationService refuses annotations without a template.
//
// Returns the created annotation record, or null on failure (fewer than two
// distinct vertices, no host baseMap, projection failure…).
export default async function commitDrawnRulerService({
  verticesInOrder,
  baseMaps,
  projectId,
  listingId,
  scopeId = null,
  templateProps = null,
  layerId = null,
  createAnnotationFn = null,
  preferredBaseMapId = null,
}) {
  if (!verticesInOrder || verticesInOrder.length < 2) {
    console.warn("[threedDrawing] ruler commit aborted: fewer than 2 vertices");
    return null;
  }
  if (!baseMaps?.length) {
    console.warn("[threedDrawing] ruler commit aborted: no base maps");
    return null;
  }
  const isTemplateless =
    Boolean(templateProps?.isTemplateless) &&
    !templateProps?.annotationTemplateId;

  // A unanimous base map carried by the vertices (points picked on a scan
  // base map) wins, then the base map selected in 2D, then the centroid
  // heuristic — same rule as the cote / polyline services.
  const host = resolveHostBaseMap({
    vertices: verticesInOrder,
    baseMaps,
    preferredBaseMapId,
  });
  if (!host) {
    console.warn("[threedDrawing] ruler commit aborted: no host base map");
    return null;
  }

  const projected = verticesInOrder.map((v) =>
    worldToBaseMapNormalized(v, host)
  );
  if (projected.some((p) => !p)) {
    console.warn("[threedDrawing] ruler commit aborted: projection failed");
    return null;
  }

  const { isInPlane, offsetZ, points } = encodeDimensionChainOffsets(projected);
  const projectedPoints = dedupeAdjacentVertices(points);
  if (projectedPoints.length < 2) {
    console.warn(
      "[threedDrawing] ruler commit aborted: fewer than 2 distinct vertices"
    );
    return null;
  }

  const rawRefs = await insertOrReusePoints({
    projectedPoints,
    baseMap: host,
    projectId,
    listingId: isTemplateless ? undefined : listingId,
  });

  // In-plane: strip refs down to {id} to keep byte-parity with the 2D
  // commit shape. Otherwise keep the per-point Z (offsetBottom).
  const pointRefs = rawRefs.map((ref, i) =>
    isInPlane
      ? { id: ref.id }
      : { id: ref.id, offsetBottom: projectedPoints[i].offsetBottom }
  );

  const annotationFields = buildCoteAnnotationFields({
    shape: "RULER",
    classificationFields: {
      type: "RULER",
      ...(isInPlane ? {} : { offsetZ }),
    },
    templateProps,
  });

  const annotation = {
    id: nanoid(),
    projectId,
    ...(isTemplateless
      ? { scopeId: scopeId ?? null, listingId: null, isTemplateless: true }
      : {
          listingId,
          annotationTemplateId: templateProps?.annotationTemplateId ?? null,
        }),
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
    // Rulers drawn from the 3D viewer stay visible in 3D whatever the
    // template's showIn3d (see the excludeDimensionsHiddenIn3d filter in
    // useAnnotationsV2).
    isDrawnIn3d: true,
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
