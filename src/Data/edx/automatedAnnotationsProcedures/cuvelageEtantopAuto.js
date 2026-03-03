import { nanoid } from "@reduxjs/toolkit";
import { Vector2 } from "three";

import matchAnnotationTemplate from "Features/annotationsAuto/utils/matchAnnotationTemplate";

const JUNCTION_THRESHOLD_PX = 5;
const RETURN_LENGTH_M = 1;

/**
 * Find the closest endpoint of a polyline to a given point.
 * Returns { index: 0|last, distance, point } or null.
 */
function closestEndpoint(polylinePoints, point) {
  if (!polylinePoints?.length) return null;
  const first = polylinePoints[0];
  const last = polylinePoints[polylinePoints.length - 1];
  const dFirst = Math.hypot(first.x - point.x, first.y - point.y);
  const dLast = Math.hypot(last.x - point.x, last.y - point.y);
  if (dFirst <= dLast) {
    return { index: 0, distance: dFirst, point: first };
  }
  return { index: polylinePoints.length - 1, distance: dLast, point: last };
}

/**
 * Find all junctions between a VCT polyline's endpoints and VI polylines.
 * Returns array of { vctEndpointIndex, viAnnotation, viEndpointIndex, junctionPoint }
 */
function findJunctions(vctPoints, viAnnotations, threshold) {
  const junctions = [];
  const vctEndpoints = [
    { index: 0, point: vctPoints[0] },
    { index: vctPoints.length - 1, point: vctPoints[vctPoints.length - 1] },
  ];

  for (const vctEnd of vctEndpoints) {
    for (const viAnn of viAnnotations) {
      const viPoints = viAnn.points;
      if (!viPoints?.length) continue;
      const closest = closestEndpoint(viPoints, vctEnd.point);
      if (closest && closest.distance < threshold) {
        junctions.push({
          vctEndpointIndex: vctEnd.index,
          viAnnotation: viAnn,
          viEndpointIndex: closest.index,
          junctionPoint: vctEnd.point,
        });
      }
    }
  }
  return junctions;
}

/**
 * Compute the direction vector of a VI polyline at a given endpoint,
 * pointing inward (away from the endpoint, along the polyline).
 */
function getViDirectionAtEndpoint(viPoints, endpointIndex) {
  if (endpointIndex === 0 && viPoints.length >= 2) {
    const dir = new Vector2(
      viPoints[1].x - viPoints[0].x,
      viPoints[1].y - viPoints[0].y
    );
    return dir.normalize();
  }
  if (endpointIndex === viPoints.length - 1 && viPoints.length >= 2) {
    const last = viPoints.length - 1;
    const dir = new Vector2(
      viPoints[last - 1].x - viPoints[last].x,
      viPoints[last - 1].y - viPoints[last].y
    );
    return dir.normalize();
  }
  return new Vector2(0, -1);
}

/**
 * Count how many points to skip from an endpoint when trimming a polyline.
 * Walks along the polyline from the endpoint, accumulating distance.
 * Returns the number of original points that fall within the trim zone.
 */
function getSkipCount(points, endpointIndex, trimDistancePx) {
  const fromStart = endpointIndex === 0;
  const ordered = fromStart ? points : [...points].reverse();

  let cumDist = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const segLen = Math.hypot(
      ordered[i + 1].x - ordered[i].x,
      ordered[i + 1].y - ordered[i].y
    );
    cumDist += segLen;
    if (cumDist >= trimDistancePx) {
      return i + 1;
    }
  }
  return ordered.length;
}

/**
 * Create a point record for Dexie storage from pixel coordinates.
 */
function createPointRecord(pt, imageSize, context) {
  return {
    id: nanoid(),
    x: pt.x / imageSize.width,
    y: pt.y / imageSize.height,
    baseMapId: context.baseMapId,
    projectId: context.projectId,
    listingId: context.targetListingId,
  };
}

/**
 * Build output annotation and rels for a source annotation.
 */
function buildOutputAnnotation(
  pointRefs,
  sourceAnn,
  categories,
  targetAnnotationTemplates,
  context
) {
  const targetTemplate = matchAnnotationTemplate(
    targetAnnotationTemplates,
    categories
  );

  const annotationId = nanoid();
  const annotation = {
    id: annotationId,
    projectId: context.projectId,
    baseMapId: context.baseMapId,
    listingId: context.targetListingId,
    annotationTemplateId: targetTemplate?.id ?? null,
    type: "POLYLINE",
    points: pointRefs,
    height: sourceAnn.height ?? null,
  };

  const rels = categories.map((cat) => {
    const [nomenclatureKey, categoryKey] = cat.split(":");
    return {
      id: nanoid(),
      annotationId,
      projectId: context.projectId,
      nomenclatureKey,
      categoryKey,
      source: "annotationTemplate",
    };
  });

  return { annotation, rels };
}

/**
 * CUVELAGE ETANTOP AUTO procedure.
 *
 * Generates annotations in the target listing by:
 * 1. Adding 1m return tips along VI at VCT/VI junctions for VCT polylines
 * 2. Shortening VI polylines by 1m at each junction
 * 3. Reusing existing source point IDs (only new return/trim points are created)
 */
export default function cuvelageEtantopAuto({
  sourceAnnotations,
  sourceRels,
  targetAnnotationTemplates,
  imageSize,
  meterByPx,
  context,
}) {
  const returnLengthPx = RETURN_LENGTH_M / meterByPx;

  // Build annotationId → mappingCategory keys index
  const annotationCategories = {};
  for (const rel of sourceRels) {
    const key = `${rel.nomenclatureKey}:${rel.categoryKey}`;
    if (!annotationCategories[rel.annotationId]) {
      annotationCategories[rel.annotationId] = [];
    }
    annotationCategories[rel.annotationId].push(key);
  }

  // Partition source annotations by category
  const vctAnnotations = sourceAnnotations.filter((a) =>
    annotationCategories[a.id]?.includes("OUVRAGE:VCT")
  );
  const viAnnotations = sourceAnnotations.filter((a) =>
    annotationCategories[a.id]?.includes("OUVRAGE:VI")
  );

  const outputAnnotations = [];
  const outputPoints = [];
  const outputRels = [];

  // viJunctionData: viId → { start?: { trimPointId }, end?: { trimPointId } }
  const viJunctionData = {};

  // --- Process VCT annotations ---
  for (const vctAnn of vctAnnotations) {
    const vctPoints = vctAnn.points;
    if (!vctPoints?.length || vctPoints.length < 2) continue;

    const junctions = findJunctions(
      vctPoints,
      viAnnotations,
      JUNCTION_THRESHOLD_PX
    );

    // Create return tip points at junctions
    const returnPointRefs = {}; // vctEndpointIndex → {id}

    for (const j of junctions) {
      const viDir = getViDirectionAtEndpoint(
        j.viAnnotation.points,
        j.viEndpointIndex
      );
      const tipPx = {
        x: j.junctionPoint.x + viDir.x * returnLengthPx,
        y: j.junctionPoint.y + viDir.y * returnLengthPx,
      };

      const pointRecord = createPointRecord(tipPx, imageSize, context);
      outputPoints.push(pointRecord);

      returnPointRefs[j.vctEndpointIndex] = { id: pointRecord.id };

      // Track for VI trimming (same point serves as new VI endpoint)
      const viId = j.viAnnotation.id;
      if (!viJunctionData[viId]) viJunctionData[viId] = {};
      if (j.viEndpointIndex === 0) {
        viJunctionData[viId].start = { trimPointId: pointRecord.id };
      } else {
        viJunctionData[viId].end = { trimPointId: pointRecord.id };
      }
    }

    // Build VCT point refs: original source points + return tips at junctions
    const sourcePointRefs = vctPoints.map((p) => ({ id: p.id }));
    const pointRefs = [];
    if (returnPointRefs[0]) pointRefs.push(returnPointRefs[0]);
    pointRefs.push(...sourcePointRefs);
    if (returnPointRefs[vctPoints.length - 1]) {
      pointRefs.push(returnPointRefs[vctPoints.length - 1]);
    }

    const categories = annotationCategories[vctAnn.id] ?? [];
    const { annotation, rels } = buildOutputAnnotation(
      pointRefs,
      vctAnn,
      categories,
      targetAnnotationTemplates,
      context
    );
    outputAnnotations.push(annotation);
    outputRels.push(...rels);
  }

  // --- Process VI annotations ---
  for (const viAnn of viAnnotations) {
    const viPoints = viAnn.points;
    if (!viPoints?.length || viPoints.length < 2) continue;

    const jd = viJunctionData[viAnn.id];

    let pointRefs;
    if (jd) {
      // Determine how many source points to skip from each end
      const startSkip = jd.start
        ? getSkipCount(viPoints, 0, returnLengthPx)
        : 0;
      const endSkip = jd.end
        ? getSkipCount(viPoints, viPoints.length - 1, returnLengthPx)
        : 0;

      // Keep inner source point references
      const innerRefs = viPoints
        .slice(startSkip, viPoints.length - endSkip)
        .map((p) => ({ id: p.id }));

      pointRefs = [];
      if (jd.start) pointRefs.push({ id: jd.start.trimPointId });
      pointRefs.push(...innerRefs);
      if (jd.end) pointRefs.push({ id: jd.end.trimPointId });
    } else {
      // No trimming: reference all source points as-is
      pointRefs = viPoints.map((p) => ({ id: p.id }));
    }

    const categories = annotationCategories[viAnn.id] ?? [];
    const { annotation, rels } = buildOutputAnnotation(
      pointRefs,
      viAnn,
      categories,
      targetAnnotationTemplates,
      context
    );
    outputAnnotations.push(annotation);
    outputRels.push(...rels);
  }

  return {
    annotations: outputAnnotations,
    points: outputPoints,
    rels: outputRels,
  };
}
