import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import splitArcOnInsert from "Features/geometry/utils/splitArcOnInsert";
import splitArcAtControlPoint from "Features/geometry/utils/splitArcAtControlPoint";
import cutClosedPolylineAtVertex from "Features/mapEditor/utils/cutClosedPolylineAtVertex";
import remapSegmentIdxAfterInsert from "Features/mapEditor/utils/remapSegmentIdxAfterInsert";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

// Segment-indexed annotation fields that must follow the points when they are
// permuted (closed cut) or partitioned between the two pieces (open cut).
const SEGMENT_IDX_FIELDS = [
  "hiddenSegmentsIdx",
  "isoHeightSegmentsIdx",
  "isExtEdgeSegmentsIdx",
];

/**
 * Normalize a snap result into a consistent format with annotationId.
 */
function normalizeSnap(snap) {
  if (!snap) return null;
  return {
    type: snap.type,
    x: snap.x,
    y: snap.y,
    pointId: snap.id,
    annotationId: snap.annotationId || snap.previewAnnotationId,
    annotationType: snap.annotationType,
    segmentIndex: snap.previewSegmentIndex,
    segmentStartId: snap.segmentStartId,
    segmentEndId: snap.segmentEndId,
    cutIndex: snap.cutIndex,
  };
}

/**
 * "Couper un segment" (SPLIT_POLYLINE_CLICK) — cut a POLYLINE / STRIP in two at
 * the clicked snap point.
 *
 * - Open polyline: the clicked point (inserted first when the click lands
 *   between vertices) is shared by the two resulting annotations.
 * - Closed polyline: single annotation kept — the clicked vertex becomes the
 *   first point (rotation + permutation of the segment-indexed fields), then a
 *   fresh db.points row duplicating the first point's coordinates is appended
 *   and closeLine goes to false, so the geometry stays visually identical.
 * - Arcs (S-C-S): insertions go through splitArcOnInsert; clicking an arc
 *   control point splits the arc at the control via splitArcAtControlPoint.
 */
export default function useHandleSplitPolylineClick({ newEntity } = {}) {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  const toastError = (message) =>
    dispatch(setToaster({ message, isError: true }));

  /**
   * Handle a single click with snap data — split the polyline at that point.
   */
  const handleSplitPolylineClickPoint = async (rawSnap) => {
    const snap = normalizeSnap(rawSnap);
    if (!snap || !snap.annotationId) {
      toastError("Aucun point d'accroche détecté");
      return { status: "no_snap" };
    }

    const annotation = await db.annotations.get(snap.annotationId);
    if (!annotation) {
      toastError("Annotation introuvable");
      return { status: "error" };
    }

    if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
      toastError("Cet outil ne s'applique qu'aux polylignes et aux bandes");
      return { status: "error" };
    }

    if (snap.cutIndex != null) {
      toastError("Impossible de couper sur une découpe");
      return { status: "error" };
    }

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize) {
      toastError("Taille de l'image indisponible");
      return { status: "error" };
    }

    const closed = annotation.closeLine === true;
    const basePoints = annotation.points ?? [];
    if (basePoints.length < (closed ? 3 : 2)) {
      toastError("Polyligne trop courte pour être coupée");
      return { status: "error" };
    }

    // Resolve the refs to pixel space (db.points wins — never trust inline x/y)
    // for the arc-preserving utils.
    const ids = [...new Set(basePoints.map((p) => p.id))];
    const records = await db.points.bulkGet(ids);
    const normById = {};
    const pxById = {};
    records.forEach((r, i) => {
      if (!r) return;
      normById[ids[i]] = { x: r.x, y: r.y };
      pxById[ids[i]] = { x: r.x * imageSize.width, y: r.y * imageSize.height };
    });
    const getPx = (id) => pxById[id];

    // New db.points rows to persist (normalized), written before the
    // annotation updates.
    const newPointRows = [];
    const pushRowFromPx = (id, px) => {
      const norm = { x: px.x / imageSize.width, y: px.y / imageSize.height };
      normById[id] = norm;
      newPointRows.push({ id, ...norm, baseMapId, projectId, listingId });
    };

    // ------------------------------------------------------------------
    // Step A — resolve the cut vertex (inserting a point when needed)
    // ------------------------------------------------------------------

    let workingPoints = basePoints;
    let splitPointId;

    if (snap.type === "VERTEX") {
      const vertexIndex = basePoints.findIndex((p) => p.id === snap.pointId);
      if (vertexIndex === -1) {
        toastError("Point introuvable dans l'annotation");
        return { status: "error" };
      }

      if (basePoints[vertexIndex].type === "circle") {
        // Arc control point: split the arc at its control (S-C-S2 →
        // S-C'-A-C''-S2) so the cut lands on a plain anchor.
        const { points, newCircles } = splitArcAtControlPoint({
          points: basePoints,
          vertexIndex,
          getPx,
          closed,
          makeId: () => nanoid(),
        });
        workingPoints = points;
        newCircles.forEach((c) => pushRowFromPx(c.id, c));
      }
      splitPointId = snap.pointId;
    } else {
      // MIDPOINT / PROJECTION — insert a new point on the snapped segment,
      // preserving arcs (S-C-S-C-S) via splitArcOnInsert.
      const segmentStartIndex = findSegmentStartIndex(basePoints, snap, closed);
      if (segmentStartIndex == null) {
        toastError("Segment introuvable dans l'annotation");
        return { status: "error" };
      }

      const newPointId = nanoid();
      const newPx = { x: snap.x, y: snap.y };
      const { points, newCircle } = splitArcOnInsert({
        points: basePoints,
        segmentStartIndex,
        newRef: { id: newPointId, type: "square" },
        newPx,
        getPx,
        closed,
        makeId: () => nanoid(),
      });
      workingPoints = points;
      pushRowFromPx(newPointId, newPx);
      if (newCircle) pushRowFromPx(newCircle.id, newCircle);
      splitPointId = newPointId;
    }

    // Follow the insertions on the segment-indexed fields.
    const idxFields = {};
    SEGMENT_IDX_FIELDS.forEach((field) => {
      const arr = annotation[field];
      if (!Array.isArray(arr) || arr.length === 0) return;
      idxFields[field] =
        workingPoints === basePoints
          ? arr
          : remapSegmentIdxAfterInsert(basePoints, workingPoints, arr, {
              closed,
            });
    });

    const v = workingPoints.findIndex((p) => p.id === splitPointId);

    // ------------------------------------------------------------------
    // Step B — cut
    // ------------------------------------------------------------------

    if (closed) {
      // R2: rotate so the cut vertex becomes the first point, permuting the
      // segment-indexed fields. R1: reopen with a fresh point duplicating the
      // first point's coordinates.
      const { points: rotated, remappedFields } = cutClosedPolylineAtVertex(
        workingPoints,
        v,
        idxFields
      );

      const firstNorm = normById[splitPointId];
      if (!firstNorm) {
        toastError("Coordonnées du point introuvables");
        return { status: "error" };
      }
      const duplicateId = nanoid();
      newPointRows.push({
        id: duplicateId,
        x: firstNorm.x,
        y: firstNorm.y,
        baseMapId,
        projectId,
        listingId,
      });

      if (newPointRows.length > 0) await db.points.bulkAdd(newPointRows);
      await updateAnnotation({
        ...annotation,
        ...remappedFields,
        points: [...rotated, { id: duplicateId }],
        closeLine: false,
      });
    } else {
      if (v <= 0 || v >= workingPoints.length - 1) {
        toastError("Impossible de couper à une extrémité");
        return { status: "error" };
      }

      // The two pieces share the cut vertex ref. Cutting on a square anchor
      // never orphans an arc control: S-C-S patterns stay whole on each side.
      const piece1 = workingPoints.slice(0, v + 1);
      const piece2 = workingPoints.slice(v);

      const piece1Fields = {};
      const piece2Fields = {};
      Object.entries(idxFields).forEach(([field, arr]) => {
        piece1Fields[field] = arr.filter((i) => i < v);
        piece2Fields[field] = arr.filter((i) => i >= v).map((i) => i - v);
      });

      if (newPointRows.length > 0) await db.points.bulkAdd(newPointRows);
      await updateAnnotation({
        ...annotation,
        ...piece1Fields,
        points: piece1,
        closeLine: false,
      });

      const entity = await createEntity(newEntity);
      const { id: _id, entityId: _eid, cuts: _cuts, ...hostProps } = annotation;
      await createAnnotation({
        ...hostProps,
        ...piece2Fields,
        id: nanoid(),
        entityId: entity.id,
        points: piece2,
        closeLine: false,
      });
    }

    dispatch(
      setToaster({
        message: "Polyligne coupée en 2",
        isError: false,
      })
    );
    return { status: "split_done" };
  };

  return { handleSplitPolylineClickPoint };
}

/**
 * Locate the snapped segment in the refs: match by segment start/end point ids
 * (both directions, like the other insertion paths), falling back to the snap's
 * segment index (same convention as the renderer, arcs included).
 */
function findSegmentStartIndex(points, snap, closed) {
  if (snap.segmentStartId && snap.segmentEndId) {
    const n = points.length;
    const limit = closed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const a = points[i].id;
      const b = points[(i + 1) % n].id;
      if (
        (a === snap.segmentStartId && b === snap.segmentEndId) ||
        (a === snap.segmentEndId && b === snap.segmentStartId)
      ) {
        return i;
      }
    }
  }
  if (
    Number.isInteger(snap.segmentIndex) &&
    snap.segmentIndex >= 0 &&
    snap.segmentIndex < points.length
  ) {
    return snap.segmentIndex;
  }
  return null;
}
