import buildAnnotationEdgeRings from "Features/annotations/utils/buildAnnotationEdgeRings";
import getGuideLineRampSampler from "Features/annotations/utils/getGuideLineRampSampler";
import isOpeningAnnotation from "Features/annotations/utils/isOpeningAnnotation";

import { makeRingsContains } from "Features/meshPaint/utils/matchWallFaceToGroundPolygons";

// Floor polygon candidates of the « Pinceau » on a thick wall
// (matchWallFaceToGroundPolygons): every POLYGON annotation loaded in the 3D
// scene on the host's base map — what the user sees — except the host
// itself, mesh annotations, mesh cells, photo plans, openings and the
// annotations of the armed template (never painted, getPaintHostRefusal).
//
// Sources are the RESOLVED annotations of the scene (pixel space, ramp /
// cuts resolved): annotationsManager.getAnnotationSource.
//
// Returns [{id, baseZ, sloped, rings, contains(pt), bottomAt(pt)}]:
//   - baseZ = the polygon's offsetZ (base-map-local, absolute — the floor
//     the wall stands on; a thick slab's `height` is not added, like the
//     SURFACES_VERTICALES procedure);
//   - bottomAt = baseZ + the guideLine ramp at that point (sloped floors:
//     getGuideLineRampSampler); stairs guide lines are ignored (flat
//     floor, V1).
export default function collectGroundPolygonsFromScene({
  annotationsManager,
  baseMapId,
  hostId,
  armedTemplateId,
  meterByPx,
}) {
  const out = [];
  const ids = Object.keys(annotationsManager?.annotationsObjectsMap ?? {});
  for (const id of ids) {
    if (id === hostId) continue;
    const a = annotationsManager.getAnnotationSource?.(id);
    if (!a || a.type !== "POLYGON") continue;
    if (a.baseMapId !== baseMapId) continue;
    if (a.isMesh3d || a.isMeshCell || a._photoPlan3D || a.isAdjacencyOnly)
      continue;
    if (isOpeningAnnotation(a)) continue;
    if (armedTemplateId && a.annotationTemplateId === armedTemplateId) continue;
    if (!(a.points?.length >= 3)) continue;

    const rings = buildAnnotationEdgeRings(a).filter(
      (ring) => ring.kind === "MAIN" || ring.kind === "CUT"
    );
    if (!rings.some((ring) => ring.kind === "MAIN")) continue;

    const baseZ = Number(a.offsetZ) || 0;
    const rampLines = (a.guideLines ?? []).filter(
      (g) => !g?.isStairs && Number(g?.slopePct) && g?.points?.length >= 2
    );
    const sampler = rampLines.length
      ? getGuideLineRampSampler({
          guideLines: rampLines,
          polygonPts: [
            ...(a.points ?? []),
            ...(a.cuts ?? []).flatMap((cut) => cut?.points ?? []),
            ...(a.innerPoints ?? []),
          ],
          meterByPx,
        })
      : null;
    const sloped = Boolean(sampler?.ok);

    out.push({
      id: a.id,
      baseZ,
      sloped,
      rings,
      contains: makeRingsContains(rings),
      bottomAt: sloped ? (pt) => baseZ + sampler.groundAt(pt) : () => baseZ,
    });
  }
  return out;
}
