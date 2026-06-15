import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { setToaster } from "Features/layout/layoutSlice";

import {
  typeOf,
  circleFromThreePoints,
  sampleArcPoints,
} from "Features/geometry/utils/arcSampling";

import db from "App/db/db";

// Preserve arc/offset metadata when copying annotation point refs.
// Arc identity (type:"circle") and per-vertex offsets live ONLY on the
// annotation.points refs, never in db.points — a plain {id} copy erases arcs.
const keepRef = (p) => {
  const ref = { id: p.id };
  if (p.type === "circle") ref.type = "circle";
  if (p.offsetBottom != null) ref.offsetBottom = p.offsetBottom;
  if (p.offsetTop != null) ref.offsetTop = p.offsetTop;
  return ref;
};

// Demote any "circle" control point that is no longer flanked (cyclically) by
// non-circle points to a plain square, so an arc cut in half by the split
// renders as a clean straight segment instead of a degenerate/orphan arc.
const sanitizeArcs = (refs) => {
  const n = refs.length;
  const t = (i) => typeOf(refs[((i % n) + n) % n]);
  return refs.map((r, i) => {
    if (r.type !== "circle") return r;
    if (t(i - 1) !== "circle" && t(i + 1) !== "circle") return r; // valid S-C-S
    const rest = { ...r }; // orphan circle → demote to square
    delete rest.type;
    return rest;
  });
};

/**
 * Hook that handles the COMPLETE_ANNOTATION commit logic.
 *
 * Three commit cases:
 * 1. POLYLINE + Enter (open path)       → new POLYLINE from drawn points
 * 2. POLYLINE + reconnect to same       → new closed POLYLINE (drawn path + original segment)
 * 3. POLYGON  + reconnect to same       → modify polygon (replace shortest contour side)
 */
export default function useHandleCompleteAnnotation({ newEntity } = {}) {
  const dispatch = useDispatch();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const baseMap = useMainBaseMap();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  /**
   * Find annotations that contain a given point ID in their points array.
   */
  async function findAnnotationsWithPoint(pointId) {
    const allAnnotations = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return allAnnotations.filter(
      (a) =>
        !a.deletedAt &&
        (a.type === "POLYLINE" || a.type === "POLYGON") &&
        a.points?.some((p) => p.id === pointId)
    );
  }

  // main

  /**
   * @param {Array} rawDrawnPoints - drawn points in local/pixel coords
   * @param {object} options
   * @param {string} options.completeAnnotationId - the annotation being extended
   * @param {string} options.startPointId - the starting vertex point ID
   * @param {string} [options.endPointId] - the ending vertex point ID (if reconnecting)
   */
  const handleCompleteAnnotationCommit = async (rawDrawnPoints, options) => {
    const { completeAnnotationId, startPointId, endPointId } = options;

    const imageSize =
      baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    if (!imageSize) {
      console.warn("[useHandleCompleteAnnotation] No image size available");
      return;
    }

    // Fetch the target annotation from DB
    const annotation = await db.annotations.get(completeAnnotationId);
    if (!annotation) {
      dispatch(
        setToaster({ message: "Annotation not found", isError: true })
      );
      return;
    }

    const annotationPoints = annotation.points ?? [];
    const isPolyline = annotation.type === "POLYLINE";
    const isPolygon = annotation.type === "POLYGON";

    // Convert drawn points to normalized (0-1) coords and save to DB
    const drawnPointRecords = rawDrawnPoints.map((pt) => ({
      id: pt.existingPointId || nanoid(),
      x: pt.x / imageSize.width,
      y: pt.y / imageSize.height,
      baseMapId,
      projectId,
      listingId,
    }));

    // Filter out points that already exist (snapped vertices)
    const newPointsToSave = drawnPointRecords.filter(
      (p) => !rawDrawnPoints.find((rp) => rp.existingPointId === p.id)
    );

    if (newPointsToSave.length > 0) {
      await db.points.bulkAdd(newPointsToSave);
    }

    const drawnPointRefs = drawnPointRecords.map((p) => ({ id: p.id }));

    // Insert PROJECTION/MIDPOINT snap points into the annotation's points array
    // so that startPointId/endPointId become actual vertices of the annotation.
    let updatedAnnotationPoints = [...annotationPoints];
    let effectiveStartPointId = startPointId;
    let effectiveEndPointId = endPointId;

    const firstDrawn = rawDrawnPoints[0];
    const lastDrawn = rawDrawnPoints[rawDrawnPoints.length - 1];

    // New db.points records to persist (arc midpoints added when a cut lands on an arc).
    const extraPointRecords = [];

    /**
     * Insert a cut point onto a segment. If that segment is one half of an
     * S-C-S arc, the cut would straighten the sub-arc that loses its control
     * point — so we also insert a fresh circle control point at the midpoint
     * of that sub-arc (on the original circle), keeping both halves curved.
     * Circle math is done in PIXEL space (normalization is anisotropic).
     *
     * @returns {{ points, effectiveId } | null}
     */
    const insertCutPoint = async (points, snapSegment, cutId, cutPx) => {
      const { segmentStartId } = snapSegment;
      const sIdx = points.findIndex((p) => p.id === segmentStartId);
      if (sIdx === -1) return null;

      const startRef = points[sIdx];
      const endRef = points[sIdx + 1];

      // Always insert the cut point right after the segment start.
      let next = [
        ...points.slice(0, sIdx + 1),
        { id: cutId },
        ...points.slice(sIdx + 1),
      ];

      // Identify the S-C-S triplet the cut falls inside, if any.
      let triplet = null; // { S, C, S2, half: "S" | "S2" }
      if (typeOf(startRef) !== "circle" && endRef && typeOf(endRef) === "circle") {
        // segment S → C, cut on the S-half. S2 is the point after C.
        const s2Ref = points[sIdx + 2];
        if (s2Ref && typeOf(s2Ref) !== "circle") {
          triplet = { S: startRef, C: endRef, S2: s2Ref, half: "S" };
        }
      } else if (typeOf(startRef) === "circle" && endRef && typeOf(endRef) !== "circle") {
        // segment C → S2, cut on the S2-half. S is the point before C.
        const sRef = points[sIdx - 1];
        if (sRef && typeOf(sRef) !== "circle") {
          triplet = { S: sRef, C: startRef, S2: endRef, half: "S2" };
        }
      }

      if (triplet) {
        const recs = await db.points.bulkGet([
          triplet.S.id,
          triplet.C.id,
          triplet.S2.id,
        ]);
        if (recs.every(Boolean)) {
          const toPx = (r) => ({
            x: r.x * imageSize.width,
            y: r.y * imageSize.height,
          });
          const Spx = toPx(recs[0]);
          const Cpx = toPx(recs[1]);
          const S2px = toPx(recs[2]);
          const circ = circleFromThreePoints(Spx, Cpx, S2px);
          if (circ && Number.isFinite(circ.r) && circ.r > 0) {
            const cross =
              (Cpx.x - Spx.x) * (S2px.y - Spx.y) -
              (Cpx.y - Spx.y) * (S2px.x - Spx.x);
            const isCW = cross > 0;

            // Midpoint of the sub-arc that lost its control point.
            const midPx =
              triplet.half === "S"
                ? sampleArcPoints(Spx, cutPx, circ.center, circ.r, isCW, 2)[0]
                : sampleArcPoints(cutPx, S2px, circ.center, circ.r, isCW, 2)[0];

            if (midPx) {
              const mId = nanoid();
              extraPointRecords.push({
                id: mId,
                x: midPx.x / imageSize.width,
                y: midPx.y / imageSize.height,
                baseMapId,
                projectId,
                listingId,
              });
              // S-half: insert M just before the cut point (S, M, A).
              // S2-half: insert M just before S2 (A, M, S2).
              const beforeId = triplet.half === "S" ? cutId : triplet.S2.id;
              const insertIdx = next.findIndex((p) => p.id === beforeId);
              if (insertIdx !== -1) {
                next = [
                  ...next.slice(0, insertIdx),
                  { id: mId, type: "circle" },
                  ...next.slice(insertIdx),
                ];
              }
            }
          }
        }
      }

      return { points: next, effectiveId: cutId };
    };

    // Insert start point if it was a snap on a segment (not an existing vertex)
    if (!startPointId && firstDrawn?.snapSegment) {
      const res = await insertCutPoint(
        updatedAnnotationPoints,
        firstDrawn.snapSegment,
        drawnPointRecords[0].id,
        { x: firstDrawn.x, y: firstDrawn.y }
      );
      if (res) {
        updatedAnnotationPoints = res.points;
        effectiveStartPointId = res.effectiveId;
      }
    }

    // Insert end point if it was a snap on a segment (not an existing vertex)
    if (!endPointId && lastDrawn?.snapSegment) {
      const res = await insertCutPoint(
        updatedAnnotationPoints,
        lastDrawn.snapSegment,
        drawnPointRecords[drawnPointRecords.length - 1].id,
        { x: lastDrawn.x, y: lastDrawn.y }
      );
      if (res) {
        updatedAnnotationPoints = res.points;
        effectiveEndPointId = res.effectiveId;
      }
    }

    // Persist any arc-midpoint points before they are referenced.
    if (extraPointRecords.length > 0) {
      await db.points.bulkAdd(extraPointRecords);
    }

    // If we inserted snap points, update the annotation in DB first
    if (updatedAnnotationPoints.length !== annotationPoints.length) {
      annotation.points = updatedAnnotationPoints;
      await updateAnnotation({
        ...annotation,
        points: updatedAnnotationPoints,
      });
    }

    // Re-alias for the cases below
    const finalAnnotationPoints = updatedAnnotationPoints;

    // Detect whether this is a closed contour. A "Contours" annotation is often
    // a POLYLINE with closeLine:false whose first/last points coincide in space
    // (duplicated endpoint). Such a closed loop must be cut into 2 contours like
    // a POLYGON — not handled as an open-polyline reconnection.
    let splitPoints = finalAnnotationPoints;
    let endpointsCoincide = false;
    {
      const firstRef = finalAnnotationPoints[0];
      const lastRef = finalAnnotationPoints[finalAnnotationPoints.length - 1];
      if (firstRef && lastRef && finalAnnotationPoints.length > 2) {
        if (firstRef.id === lastRef.id) {
          endpointsCoincide = true;
        } else {
          const [pa, pb] = await db.points.bulkGet([firstRef.id, lastRef.id]);
          if (pa && pb) {
            endpointsCoincide =
              Math.abs(pa.x - pb.x) < 1e-6 && Math.abs(pa.y - pb.y) < 1e-6;
          }
        }
      }
    }
    const isClosedContour =
      isPolygon || annotation.closeLine === true || endpointsCoincide;
    // For the cyclic split, drop the duplicated trailing endpoint so the cut
    // does not leave a zero-length segment.
    if (endpointsCoincide && finalAnnotationPoints.length > 1) {
      splitPoints = finalAnnotationPoints.slice(0, -1);
    }

    // Guard: both clicks resolved to the same vertex/segment → no valid cut
    if (
      effectiveEndPointId &&
      effectiveStartPointId === effectiveEndPointId
    ) {
      dispatch(
        setToaster({
          message: "Cliquez sur deux segments différents",
          isError: true,
        })
      );
      return;
    }

    // Case 1: POLYLINE + Enter (open path, no reconnection) → extend the polyline
    if (isPolyline && !effectiveEndPointId) {
      const startIdx = finalAnnotationPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );

      let newPoints;
      if (startIdx === 0) {
        // Start point is at the beginning → prepend drawn points (reversed)
        newPoints = [
          ...drawnPointRefs.slice(1).reverse(),
          ...finalAnnotationPoints,
        ];
      } else if (startIdx === finalAnnotationPoints.length - 1) {
        // Start point is at the end → append drawn points
        newPoints = [
          ...finalAnnotationPoints,
          ...drawnPointRefs.slice(1),
        ];
      } else {
        // Start point is in the middle → create a new polyline (can't extend)
        const entity = await createEntity(newEntity);
        const {
          id: _id,
          entityId: _eid,
          cuts: _cuts,
          ...hostProps
        } = annotation;
        await createAnnotation({
          ...hostProps,
          id: nanoid(),
          entityId: entity.id,
          type: "POLYLINE",
          points: [{ id: effectiveStartPointId }, ...drawnPointRefs.slice(1)],
          closeLine: false,
        });
        dispatch(
          setToaster({ message: "Polyline created", isError: false })
        );
        return;
      }

      await updateAnnotation({
        ...annotation,
        points: newPoints.map(keepRef),
      });
      dispatch(
        setToaster({ message: "Polyline extended", isError: false })
      );
      return;
    }

    // Case 2: OPEN POLYLINE + reconnect to same polyline (closed contours are
    // handled by the split case below)
    if (isPolyline && effectiveEndPointId && !isClosedContour) {
      const startIdx = finalAnnotationPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );
      const endIdx = finalAnnotationPoints.findIndex((p) => p.id === effectiveEndPointId);
      if (startIdx === -1 || endIdx === -1) {
        dispatch(
          setToaster({ message: "Vertex not found", isError: true })
        );
        return;
      }

      const lastIdx = finalAnnotationPoints.length - 1;
      const isFullClosure =
        (startIdx === 0 && endIdx === lastIdx) ||
        (startIdx === lastIdx && endIdx === 0);

      if (isFullClosure) {
        // Closing the polyline end-to-end → update existing annotation
        let newPoints;
        if (startIdx === 0) {
          // Started at beginning, ended at end → prepend drawn inner points (reversed)
          newPoints = [
            ...drawnPointRefs.slice(1, -1).reverse().map(keepRef),
            ...finalAnnotationPoints.map(keepRef),
          ];
        } else {
          // Started at end, ended at beginning → append drawn inner points
          newPoints = [
            ...finalAnnotationPoints.map(keepRef),
            ...drawnPointRefs.slice(1, -1).map(keepRef),
          ];
        }

        await updateAnnotation({
          ...annotation,
          points: newPoints,
          closeLine: true,
        });
        dispatch(
          setToaster({ message: "Polyline closed", isError: false })
        );
        return;
      }

      // Partial reconnection → create a new closed polyline from drawn path + original segment
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      const originalSegment = finalAnnotationPoints.slice(lo, hi + 1);

      let closedPoints;
      if (startIdx <= endIdx) {
        closedPoints = [
          ...drawnPointRefs,
          ...originalSegment
            .slice(0, -1)
            .reverse()
            .map(keepRef),
        ];
      } else {
        closedPoints = [
          ...drawnPointRefs,
          ...originalSegment
            .slice(1)
            .map(keepRef),
        ];
      }

      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        type: "POLYLINE",
        points: closedPoints,
        closeLine: true,
      });
      dispatch(
        setToaster({ message: "Closed polyline created", isError: false })
      );
      return;
    }

    // Case 3: CLOSED CONTOUR (POLYGON or closed POLYLINE) + reconnect to itself
    // → split into 2 closed contours along the two cut points
    if (isClosedContour && effectiveEndPointId) {
      const startIdx = splitPoints.findIndex(
        (p) => p.id === effectiveStartPointId
      );
      const endIdx = splitPoints.findIndex((p) => p.id === effectiveEndPointId);
      if (startIdx === -1 || endIdx === -1) {
        dispatch(
          setToaster({ message: "Vertex not found", isError: true })
        );
        return;
      }

      const n = splitPoints.length;

      // Two paths around the contour between start and end
      // Path A: startIdx → ... → endIdx (forward)
      const pathALength = ((endIdx - startIdx + n) % n) || n;
      // Path B: endIdx → ... → startIdx (the other way)
      const pathBLength = n - pathALength;

      // Drawn inner points (excluding start & end which are shared with the contour)
      const drawnInner = drawnPointRefs.slice(1, -1);

      // Build both contour pieces
      let polygon1Points, polygon2Points;
      if (pathALength <= pathBLength) {
        // Path B (endIdx → ... → startIdx) + drawn inner → piece 1
        const pathB = [];
        for (let i = 0; i <= pathBLength; i++) {
          pathB.push(splitPoints[(endIdx + i) % n]);
        }
        polygon1Points = sanitizeArcs([
          ...pathB.map(keepRef),
          ...drawnInner,
        ]);

        // Path A (startIdx → ... → endIdx) + drawn inner reversed → piece 2
        const pathA = [];
        for (let i = 0; i <= pathALength; i++) {
          pathA.push(splitPoints[(startIdx + i) % n]);
        }
        polygon2Points = sanitizeArcs([
          ...pathA.map(keepRef),
          ...[...drawnInner].reverse(),
        ]);
      } else {
        // Path A (startIdx → ... → endIdx) + drawn inner reversed → piece 1
        const pathA = [];
        for (let i = 0; i <= pathALength; i++) {
          pathA.push(splitPoints[(startIdx + i) % n]);
        }
        polygon1Points = sanitizeArcs([
          ...pathA.map(keepRef),
          ...[...drawnInner].reverse(),
        ]);

        // Path B (endIdx → ... → startIdx) + drawn inner → piece 2
        const pathB = [];
        for (let i = 0; i <= pathBLength; i++) {
          pathB.push(splitPoints[(endIdx + i) % n]);
        }
        polygon2Points = sanitizeArcs([
          ...pathB.map(keepRef),
          ...drawnInner,
        ]);
      }

      if (polygon1Points.length < 3 || polygon2Points.length < 3) {
        dispatch(setToaster({ message: "Découpe invalide", isError: true }));
        return;
      }

      // A closed POLYLINE keeps its closeLine flag on both pieces; a POLYGON is
      // implicitly closed so we leave its flag untouched.
      const closeLineProps = isPolyline ? { closeLine: true } : {};

      // Update original annotation with piece 1
      await updateAnnotation({
        ...annotation,
        ...closeLineProps,
        points: polygon1Points,
      });

      // Create new entity + annotation for piece 2
      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      await createAnnotation({
        ...hostProps,
        ...closeLineProps,
        id: nanoid(),
        entityId: entity.id,
        points: polygon2Points,
      });

      dispatch(
        setToaster({
          message: "Contour split",
          isError: false,
        })
      );
      return;
    }

    // Fallback: polygon + open path (just create a new polyline)
    if (isPolygon && !effectiveEndPointId) {
      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      const startRef = effectiveStartPointId ? [{ id: effectiveStartPointId }] : [];
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        type: "POLYLINE",
        points: [...startRef, ...drawnPointRefs.slice(startRef.length ? 1 : 0)],
        closeLine: false,
      });
      dispatch(
        setToaster({ message: "Polyline created", isError: false })
      );
      return;
    }
  };

  return { handleCompleteAnnotationCommit, findAnnotationsWithPoint };
}
