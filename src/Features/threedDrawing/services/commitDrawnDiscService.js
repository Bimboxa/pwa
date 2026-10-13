import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import createAnnotationService from "Features/annotations/services/createAnnotationService";

import buildFaceAnnotationFields from "../utils/buildFaceAnnotationFields";
import resolveHostBaseMap from "../utils/resolveHostBaseMap";
import roundForDisplay from "../utils/roundForDisplay";

// 3D two-click DISC (centre, then a rim point on the centre's plane) → the
// SAME row the 2D disc tools commit (MainMapEditorV3
// handleCommitDrawingFromDisc + useHandleCommitDrawing):
//   - centre = one FRESH db.points row (never shared with another
//     annotation, like the 2D commit), normalized against the host image,
//     referenced by `point: {id}`;
//   - radiusM from the two clicks in image px × meterByPx (rounded 1e-6);
//   - `offsetZ` = the centre's height above the host plane, template props
//     (fill, height, 3D render…) through buildFaceAnnotationFields.
// A disc only lies PARALLEL to its base map: a rim point off the centre's
// plane (the centre was placed on a vertical face) is refused with the
// reason DISC_COMMIT_NOT_PARALLEL.
//
// Returns { annotation } or { annotation: null, reason }.
export const DISC_COMMIT_NOT_PARALLEL = "NOT_PARALLEL";
export const DISC_COMMIT_NO_SCALE = "NO_SCALE";

const OFFSET_EPS_M = 5e-3;

export default async function commitDrawnDiscService({
  center,
  rim,
  baseMaps,
  projectId,
  listingId,
  templateProps,
  layerId = null,
  createAnnotationFn = null,
  // The base map selected in 2D (resolveHostBaseMap).
  preferredBaseMapId = null,
}) {
  const abort = (message, reason = "ABORTED") => {
    console.warn(`[threedDrawing] disc commit aborted: ${message}`);
    return { annotation: null, reason };
  };

  if (!center || !rim) return abort("needs a centre and a rim point");
  if (!baseMaps?.length) return abort("no base maps available");
  if (!templateProps?.annotationTemplateId)
    return abort("no armed template (annotationTemplateId missing)");

  const host = resolveHostBaseMap({
    vertices: [center],
    baseMaps,
    preferredBaseMapId,
  });
  if (!host)
    return abort("no host base map (projection failed on every base map)");

  const imageSize =
    typeof host.getImageSize === "function"
      ? host.getImageSize()
      : host.image?.imageSize;
  const meterByPx =
    typeof host.getMeterByPx === "function"
      ? host.getMeterByPx()
      : host.meterByPx;
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!width || !height) return abort(`base map ${host.id} has no image size`);
  if (!(Number.isFinite(meterByPx) && meterByPx > 0))
    return abort(`base map ${host.id} has no scale`, DISC_COMMIT_NO_SCALE);

  const cN = worldToBaseMapNormalized(center, host);
  const rN = worldToBaseMapNormalized(rim, host);
  if (!cN || !rN) return abort(`projection on base map ${host.id} failed`);
  if (Math.abs(rN.offset - cN.offset) > OFFSET_EPS_M)
    return abort(
      "rim point off the centre's plane (disc not parallel to its base map)",
      DISC_COMMIT_NOT_PARALLEL
    );

  // Same formulas as the 2D commit (image px, y down).
  const dx = (rN.x - cN.x) * width;
  const dy = (rN.y - cN.y) * height;
  const radiusPx = Math.hypot(dx, dy);
  if (!(radiusPx > 0)) return abort("zero radius");
  const radiusM = Math.round(radiusPx * meterByPx * 1e6) / 1e6;

  const annotationFields = buildFaceAnnotationFields({
    classifiedShape: "DISC",
    classificationFields: {
      type: "DISC",
      radiusM,
      partialRevolution: false,
      offsetZ: roundForDisplay(cN.offset),
      height: templateProps.height ?? 0,
    },
    templateProps,
  });
  // A fresh draft never carries sector angles.
  delete annotationFields.revolutionAngleStartDeg;
  delete annotationFields.revolutionAngleEndDeg;

  const pointId = nanoid();
  const pointRow = {
    id: pointId,
    x: cN.x,
    y: cN.y,
    baseMapId: host.id,
    projectId,
    listingId,
  };

  const annotation = {
    id: nanoid(),
    projectId,
    listingId,
    annotationTemplateId: templateProps.annotationTemplateId,
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    point: { id: pointId },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...annotationFields,
  };

  // useCreateAnnotation writes the point row in the same transaction; the
  // bare service does not take rows, so write it first.
  if (createAnnotationFn) {
    return {
      annotation: await createAnnotationFn(annotation, {
        pointRowsToSave: [pointRow],
      }),
    };
  }
  await db.points.put(pointRow);
  return { annotation: await createAnnotationService(annotation) };
}
