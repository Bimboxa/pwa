import { nanoid } from "@reduxjs/toolkit";

import createAnnotationService from "Features/annotations/services/createAnnotationService";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import buildCoteAnnotationFields from "../utils/buildCoteAnnotationFields";
import pickHostBaseMap from "../utils/pickHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";
import insertOrReusePoints from "./insertOrReusePoints";

// Minimum 3D length (metres) for a committable cote.
const MIN_COTE_LENGTH_M = 1e-3;

// A cote whose endpoints both lie on the host baseMap plane (within this
// tolerance, metres) is stored exactly like a 2D-drawn cote: plain {id}
// point refs, no offsetZ. Matches OFFSET_EPS_M of classifyFaceVsBaseMap.
const IN_PLANE_EPS_M = 5e-3;

// Orchestrator: 3D two-click cote → host baseMap → 2D COTE annotation.
//
// Encoding (mirrors commitDrawnFaceService):
//   - in-plane segment → points: [{id}, {id}] — byte-identical to the 2D
//     commit shape, so 2D-drawn cotes and flat 3D-drawn cotes are the same.
//   - lifted / vertical / oblique segment → annotation.offsetZ = min offset,
//     per-point ref carries offsetBottom = offset - offsetZ, so
//     z_i = offsetZ + offsetBottom_i (basemap-local metres) — the same
//     reconstruction rule as triangulateAnnotationGeometry.
//
// A vertical cote projects both endpoints onto the same normalized (x, y):
// insertOrReusePoints then reuses a single db.points row referenced twice —
// intended (same plan position).
//
// Returns the created annotation record, or null on failure (no host
// baseMap, degenerate segment, etc.).
export default async function commitDrawnCoteService({
  a,
  b,
  baseMaps,
  projectId,
  listingId,
  templateProps = null,
  entityId = null,
  layerId = null,
  createAnnotationFn = null,
}) {
  if (!a || !b) return null;
  if (!baseMaps?.length) return null;

  const length3d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (length3d < MIN_COTE_LENGTH_M) return null;

  const host = pickHostBaseMap([a, b], baseMaps);
  if (!host) return null;

  const pA = worldToBaseMapNormalized(a, host);
  const pB = worldToBaseMapNormalized(b, host);
  if (!pA || !pB) return null;

  const isInPlane =
    Math.abs(pA.offset) < IN_PLANE_EPS_M &&
    Math.abs(pB.offset - pA.offset) < IN_PLANE_EPS_M;

  const baseOffset = Math.min(pA.offset, pB.offset);
  const projectedPoints = [pA, pB].map((p) => ({
    x: p.x,
    y: p.y,
    offsetBottom: isInPlane ? 0 : roundForDisplay(p.offset - baseOffset),
    offsetTop: 0,
  }));

  const rawRefs = await insertOrReusePoints({
    projectedPoints,
    baseMap: host,
    projectId,
    listingId,
  });

  // In-plane: strip refs down to {id} to keep byte-parity with the 2D
  // commit shape. Otherwise keep the per-point Z (offsetBottom).
  const pointRefs = rawRefs.map((ref, i) =>
    isInPlane
      ? { id: ref.id }
      : { id: ref.id, offsetBottom: projectedPoints[i].offsetBottom }
  );

  const annotationFields = buildCoteAnnotationFields({
    classificationFields: {
      type: "COTE",
      ...(isInPlane ? {} : { offsetZ: roundForDisplay(baseOffset) }),
    },
    templateProps,
  });

  const annotation = {
    id: nanoid(),
    projectId,
    listingId,
    baseMapId: host.id,
    annotationTemplateId: templateProps?.annotationTemplateId ?? null,
    ...(entityId ? { entityId } : {}),
    ...(layerId ? { layerId } : {}),
    points: pointRefs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
  };

  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
