import { nanoid } from "@reduxjs/toolkit";

import { expandArcsInPath, typeOf } from "Features/geometry/utils/arcSampling";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

import db from "App/db/db";

// Grid size (px) of the shared-vertex dedup index: contour groups meeting at
// the same corner reference one db.points record instead of two.
const SNAP_TOLERANCE = 3;

// Probe offset (px) used to detect which side offsetPolygon(+distance) lands on.
const STRIP_TEST_OFFSET_PX = 5;

/**
 * Empirical stripOrientation for a closed contour ring: simulate the band the
 * way getStripePolygons renders closed strips (offsetPolygon with
 * distance = width × orientation) and probe a few offset points against the
 * ring. Winding math is NOT reliable here — offsetPolygon normalizes the ring
 * winding internally — so the actual offset side is tested instead.
 * Returns the orientation that puts the band OUTSIDE the contour.
 */
function getOutwardStripOrientation(ringTypedPoints) {
  const expanded = expandArcsInPath(ringTypedPoints, 8, true);
  if (expanded.length < 3) return 1;

  const offRing = offsetPolygon(expanded, STRIP_TEST_OFFSET_PX);
  if (!offRing || offRing.length < 3) return 1;

  // Probe up to 3 segment midpoints spread around the offset ring.
  let outside = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(offRing.length / 3));
  for (let i = 0; i < offRing.length && total < 3; i += step) {
    const a = offRing[i];
    const b = offRing[(i + 1) % offRing.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    total++;
    if (!pointInPolygon(mid, expanded)) outside++;
  }
  if (total === 0) return 1;

  // Positive offset lands outside → orientation +1 puts the band outside.
  return outside * 2 >= total ? 1 : -1;
}

/**
 * Persist contour annotations from typed point groups (factored out of
 * useWallBoundaries so the polygon-contours flow shares the exact same write
 * path). One Dexie transaction: db.points (normalized [0..1]) + entities of
 * the template's listing + db.annotations. The CALLER dispatches
 * triggerAnnotationsUpdate / triggerEntitiesTableUpdate.
 *
 * @param {Object} params
 * @param {Array<{typedPoints: Array<{x,y,type?}>, closed: boolean, boundaryType?: string}>} params.groups
 *   contour geometries in pixel space, S-C-S arcs as typed points
 * @param {Object} params.boundaryAnnotationTemplate - owns the target listing
 * @param {"POLYLINE"|"STRIP"} [params.outputType]
 * @param {{width: number, height: number}} params.imageSize
 * @returns {Promise<{count: number, entityTable: string|undefined}>}
 */
export default async function createContourAnnotationsService({
  groups,
  boundaryAnnotationTemplate,
  outputType = "POLYLINE",
  baseMapId,
  projectId,
  activeLayerId,
  imageSize,
}) {
  // Boundary annotations belong to the listing that OWNS the chosen
  // template, not to whatever listing happens to be selected (the wall
  // listing, the free-annotations listing, ...). Otherwise the contour
  // annotations land in the wrong listing and their template's quantity
  // never shows up in that listing's viewer.
  const listingId = boundaryAnnotationTemplate?.listingId;
  if (!listingId) {
    throw new Error("boundaryAnnotationTemplate has no listingId");
  }
  const targetListing = await db.listings.get(listingId);

  const { width, height } = imageSize ?? {};
  if (!width || !height) throw new Error("No image size available");

  const entityTable =
    targetListing?.table ?? targetListing?.entityModel?.defaultTable;

  const isStrip = outputType === "STRIP";

  const pointIndex = new Map();
  const coordKey = (x, y) =>
    `${Math.round(x / SNAP_TOLERANCE)},${Math.round(y / SNAP_TOLERANCE)}`;
  const getOrCreatePoint = (pxX, pxY) => {
    const key = coordKey(pxX, pxY);
    if (pointIndex.has(key)) return pointIndex.get(key).id;
    const pointId = nanoid();
    pointIndex.set(key, { id: pointId, nx: pxX / width, ny: pxY / height });
    return pointId;
  };

  const allAnnotations = [];
  const allEntities = [];

  for (const group of groups) {
    const typedPoints = group.typedPoints;
    if (!typedPoints || typedPoints.length < 2) continue;

    const pointRefs = [];
    for (const p of typedPoints) {
      const id = getOrCreatePoint(p.x, p.y);
      const last = pointRefs[pointRefs.length - 1];
      if (last && last.id === id) continue; // shared boundary vertex
      pointRefs.push({ id, type: typeOf(p) });
    }
    if (pointRefs.length < 2) continue;

    let entityId;
    if (entityTable) {
      entityId = nanoid();
      allEntities.push({ id: entityId, listingId, projectId });
    }

    // A STRIP band grows on the stripOrientation side of its main line. The
    // contour IS the main line and the band must lie OUTSIDE the closed
    // contour — decided by the empirical probe above, not by winding math.
    let stripProps = {};
    if (isStrip) {
      let stripOrientation = 1;
      if (group.closed === true && typedPoints.length >= 3) {
        stripOrientation = getOutwardStripOrientation(typedPoints);
      }
      stripProps = {
        // Bands are physical: keep the template width only when it is
        // expressed in CM, else fall back to the 20 cm strip draft default.
        strokeWidth:
          boundaryAnnotationTemplate.strokeWidthUnit === "CM"
            ? (boundaryAnnotationTemplate.strokeWidth ?? 20)
            : 20,
        strokeWidthUnit: "CM",
        stripOrientation,
      };
    }

    allAnnotations.push({
      id: nanoid(),
      type: isStrip ? "STRIP" : "POLYLINE",
      annotationTemplateId: boundaryAnnotationTemplate.id,
      strokeColor: boundaryAnnotationTemplate.strokeColor,
      strokeType: boundaryAnnotationTemplate.strokeType ?? "SOLID",
      strokeOpacity: boundaryAnnotationTemplate.strokeOpacity ?? 1,
      strokeWidth: boundaryAnnotationTemplate.strokeWidth ?? 2,
      strokeWidthUnit: boundaryAnnotationTemplate.strokeWidthUnit ?? "PX",
      ...stripProps,
      closeLine: group.closed === true,
      entityId,
      baseMapId,
      projectId,
      listingId,
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
      ...(group.boundaryType ? { boundaryType: group.boundaryType } : {}),
      points: pointRefs,
    });
  }

  const allPoints = [];
  for (const entry of pointIndex.values()) {
    allPoints.push({
      id: entry.id,
      x: entry.nx,
      y: entry.ny,
      baseMapId,
      projectId,
      listingId,
      forMarker: false,
    });
  }

  const tables = [db.points, db.annotations];
  if (entityTable && allEntities.length > 0) tables.push(db[entityTable]);

  await db.transaction("rw", tables, async () => {
    if (allPoints.length > 0) await db.points.bulkAdd(allPoints);
    if (entityTable && allEntities.length > 0)
      await db[entityTable].bulkAdd(allEntities);
    if (allAnnotations.length > 0) await db.annotations.bulkAdd(allAnnotations);
  });

  return { count: allAnnotations.length, entityTable };
}
