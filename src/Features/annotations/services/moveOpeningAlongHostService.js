import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import resolvePoints from "Features/annotations/utils/resolvePoints";

import db from "App/db/db";

import getOpeningHostSlide from "../utils/getOpeningHostSlide";
import updateAnnotationOpeningAnchor from "./updateAnnotationOpeningAnchor";
import applyPointsMovesService from "./applyPointsMovesService";

async function resolveAnnotationPx(ann, imageSize) {
  const ids = (ann.points ?? []).map((p) => p?.id).filter(Boolean);
  const rows = await db.points.bulkGet(ids);
  const pointsIndex = {};
  for (const r of rows) if (r) pointsIndex[r.id] = r;
  return resolvePoints({ points: ann.points, pointsIndex, imageSize });
}

// Commit of a whole-opening drag (deltaPos in px, from useAnnotationDrag).
//
//   - glued opening: the new centre is projected on the host glue curve
//     (same math as the live constrained drag — getOpeningHostSlide), the rel
//     anchor is rewritten (segment ids + centre distance) and the opening is
//     reflowed from it, so the persisted jambs sit exactly on the axis.
//   - free opening: plain translation of its 2 point rows.
//
// `annotation` is the RESOLVED opening (pixel points with db ids).
export default async function moveOpeningAlongHostService({
  annotation,
  deltaPos,
  meterByPx,
  dispatch,
}) {
  const pts = annotation?.points;
  if (!annotation?.id || pts?.length !== 2 || !deltaPos) return { ok: false };

  const rels = await db.relAnnotationOpenings
    .where("openingAnnotationId")
    .equals(annotation.id)
    .toArray();
  const rel = rels.find((r) => !r.deletedAt);

  const translate = () =>
    applyPointsMovesService({
      annotation,
      moves: pts.map((p) => ({
        pointId: p.id,
        x: p.x + deltaPos.x,
        y: p.y + deltaPos.y,
      })),
      meterByPx,
      dispatch,
    });

  if (!rel || !(meterByPx > 0)) return translate();

  const host = await db.annotations.get(rel.hostAnnotationId);
  const baseMapRecord = await db.baseMaps.get(annotation.baseMapId);
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(annotation.baseMapId)
    .toArray();
  const imageSize = getBaseMapImageSizeFromRecord(baseMapRecord, versions);
  if (!host || host.deletedAt || !imageSize?.width || !imageSize?.height) {
    return translate();
  }

  const hostPx = await resolveAnnotationPx(host, imageSize);
  const targetCenter = {
    x: (pts[0].x + pts[1].x) / 2 + deltaPos.x,
    y: (pts[0].y + pts[1].y) / 2 + deltaPos.y,
  };
  const slide = getOpeningHostSlide({
    opening: annotation,
    host: { ...host, points: hostPx },
    targetCenter,
    meterByPx,
    notchPointIds:
      rel.carve?.mode === "CONTOUR" ? (rel.carve.notchPointIds ?? []) : [],
    preferredAnchor: {
      startId: rel.hostSegmentStartPointId,
      endId: rel.hostSegmentEndPointId,
      arcControlId: rel.hostArcControlPointId ?? null,
    },
  });
  if (!slide) return translate();

  await updateAnnotationOpeningAnchor(rel.id, {
    hostSegmentStartPointId: slide.anchor.hostSegmentStartPointId,
    hostSegmentEndPointId: slide.anchor.hostSegmentEndPointId,
    hostArcControlPointId: slide.anchor.hostArcControlPointId,
    hostDistanceM: slide.anchor.hostDistancePx * meterByPx,
  });
  await reflowOpeningsForHost({
    hostIds: [rel.hostAnnotationId],
    openingIds: [annotation.id],
    projectId: annotation.projectId,
    imageSize,
    meterByPx,
  });
  dispatch?.(triggerAnnotationsUpdate());
  return { ok: true };
}
