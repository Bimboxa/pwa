import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";

import avoidVisibleAnnotationsService from "../services/avoidVisibleAnnotationsService";
import getAnnotationBBox from "../utils/getAnnotationBbox";
import {
  SEGMENT_FLAG_FIELDS,
  getRingSegmentFlagPointIds,
  segmentIdxToPointIds,
  filterSegmentPointIds,
} from "../utils/segmentFlags";

import db from "App/db/db";

// "Evider": carve the given POLYGON by the footprints of every visible
// annotation, as if each footprint punched through it. Same boolean pipeline
// as the draw-time "Eviter les annotations visibles" option, but applied on
// demand to an existing annotation — and without the different-templateId
// restriction: every visible annotation cuts.
// When the carving splits the polygon into disjoint pieces, the largest piece
// keeps the original annotation and each extra piece becomes a new annotation
// cloned from it.
//
// Shared by the ToolbarEditAnnotation button (IconButtonHollowOutAnnotation)
// and the "E" keyboard shortcut (InteractionLayer).
export default function useHollowOutAnnotation() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const visibleAnnotations = useVisibleAnnotations();

  // Async carve does DB transactions — ignore re-triggers while one is running.
  const runningRef = useRef(false);

  async function hollowOutAnnotation(annotation) {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await carve(annotation);
    } finally {
      runningRef.current = false;
    }
  }

  async function carve(annotation) {
    if (!annotation?.points || annotation.points.length < 3) return;

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height) return;
    const { width, height } = imageSize;

    const candidates = (visibleAnnotations ?? []).filter(
      (a) =>
        a &&
        a.id !== annotation.id &&
        a.baseMapId === annotation.baseMapId &&
        ["POLYGON", "POLYLINE", "STRIP"].includes(a.type)
    );
    if (candidates.length === 0) return;

    // annotation.points / cuts are already pixel-resolved (useAnnotationsV2)
    const shape = { points: annotation.points, cuts: annotation.cuts ?? [] };
    const shapeBbox = getAnnotationBBox(shape);
    if (!shapeBbox) return;

    const TOL = 2;
    const overlapping = candidates.filter((a) => {
      const bb = getAnnotationBBox(a);
      if (!bb) return false;
      return (
        bb.x + bb.width >= shapeBbox.x - TOL &&
        bb.x <= shapeBbox.x + shapeBbox.width + TOL &&
        bb.y + bb.height >= shapeBbox.y - TOL &&
        bb.y <= shapeBbox.y + shapeBbox.height + TOL
      );
    });
    if (overlapping.length === 0) return;

    const carved = avoidVisibleAnnotationsService({
      drawnShape: shape,
      candidates: overlapping,
      baseMap,
    });

    // Fully consumed → keep the original geometry untouched.
    if (carved.consumed) return;
    if (!carved.points || carved.points.length < 3) return;

    // Reads up-front — writes are batched in a single transaction below so
    // liveQuery observers (useAnnotationsV2 & co) recompute only once.
    const firstPointId = annotation.points.find((p) => p?.id)?.id;
    const [samplePoint, raw] = await Promise.all([
      firstPointId ? db.points.get(firstPointId) : null,
      db.annotations.get(annotation.id),
    ]);
    if (!raw) return;

    // Scope fields for new db.points rows: copy from an existing stored point.
    const pointScope = {
      baseMapId: samplePoint?.baseMapId ?? annotation.baseMapId,
      projectId: samplePoint?.projectId ?? annotation.projectId,
      listingId: samplePoint?.listingId ?? annotation.listingId,
    };

    // Rebuild point-id refs: reuse existing ids where the vertex is unchanged,
    // mint new db.points rows (normalized) for boolean-intersection vertices.
    // Same reconciliation as useHandleCommitDrawing.
    const keyOf = (x, y) =>
      `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    const pxLookup = new Map();
    for (const p of annotation.points) {
      if (p?.id) pxLookup.set(keyOf(p.x, p.y), p.id);
    }
    for (const c of annotation.cuts ?? []) {
      for (const p of c.points ?? []) {
        if (p?.id) pxLookup.set(keyOf(p.x, p.y), p.id);
      }
    }

    // Refs keep `type: "circle"` so recovered S-C-S arcs stay arcs.
    const asRef = (id, px) =>
      px.type === "circle" ? { id, type: "circle" } : { id };

    const pointsToSave = [];
    const mint = (px) => {
      const newId = nanoid();
      pointsToSave.push({
        id: newId,
        x: px.x / width,
        y: px.y / height,
        ...pointScope,
      });
      return asRef(newId, px);
    };
    const findOrMint = (px) => {
      const k = keyOf(px.x, px.y);
      const existing = pxLookup.get(k);
      if (existing) return asRef(existing, px);
      const ref = mint(px);
      pxLookup.set(k, ref.id);
      return ref;
    };

    const newPointsRefs = carved.points.map(findOrMint);
    const newCutsRefs = (carved.cuts ?? []).map((c) => {
      const ref = { id: c.id, points: (c.points ?? []).map(findOrMint) };
      if (c.label != null) ref.label = c.label;
      if (c.type != null) ref.type = c.type;
      // Positional carry (reconcileCuts on the resolved cuts' effective
      // indices) converted to start-point ids on the rebuilt ring.
      for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
        if (c[idxField] != null)
          ref[idField] = segmentIdxToPointIds(c[idxField], ref.points, {
            closed: true,
          });
      }
      return ref;
    });

    // Root-ring flags: keyed by start point id, they follow the surviving
    // refs through the carve (findOrMint reuses ids on unchanged vertices);
    // the write below migrates the row off the legacy index fields.
    const rootFlagChanges = {};
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      const ids = getRingSegmentFlagPointIds(raw, idxField, idField, raw.points, {
        closed: true,
      });
      if (ids != null)
        rootFlagChanges[idField] = filterSegmentPointIds(ids, newPointsRefs);
      if (raw[idxField] !== undefined) rootFlagChanges[idxField] = undefined;
    }

    // Extra disjoint pieces → one new annotation per piece, cloned from the
    // original record. All their points get fresh ids so no vertex is shared
    // between the resulting annotations.
    const clonedProps = { ...raw };
    delete clonedProps.id;
    delete clonedProps.points;
    delete clonedProps.cuts;
    delete clonedProps.entityId;
    // Segment flags never carry over to a piece whose points are re-minted.
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      delete clonedProps[idxField];
      delete clonedProps[idField];
    }
    delete clonedProps.createdAt;
    delete clonedProps.updatedAt;
    delete clonedProps.createdByUserIdMaster;
    delete clonedProps.updatedByUserIdMaster;

    const newAnnotationRows = [];
    for (const piece of (carved.pieces ?? []).slice(1)) {
      if (!piece?.points || piece.points.length < 3) continue;
      newAnnotationRows.push({
        ...clonedProps,
        id: nanoid(),
        points: piece.points.map(mint),
        cuts: (piece.cuts ?? []).map((c) => ({
          id: nanoid(),
          ...(c.label != null && { label: c.label }),
          points: (c.points ?? []).map(mint),
        })),
      });
    }

    // Mapping-category rels for the cloned annotations (same as
    // useCreateAnnotation, but built in memory for the whole batch).
    let newRels = [];
    if (newAnnotationRows.length > 0 && raw.annotationTemplateId) {
      const template = await db.annotationTemplates.get(
        raw.annotationTemplateId
      );
      const mappingCategories = (template?.mappingCategories ?? [])
        .map((entry) => {
          if (typeof entry === "string") {
            const parts = entry.split(":").map((s) => s.trim());
            return parts.length === 2 && parts[0] && parts[1]
              ? { nomenclatureKey: parts[0], categoryKey: parts[1] }
              : null;
          }
          return entry?.nomenclatureKey && entry?.categoryKey ? entry : null;
        })
        .filter(Boolean);
      newRels = newAnnotationRows.flatMap((a) =>
        mappingCategories.map((mc) => ({
          id: nanoid(),
          annotationId: a.id,
          projectId: raw.projectId,
          nomenclatureKey: mc.nomenclatureKey,
          categoryKey: mc.categoryKey,
          source: "annotationTemplate",
        }))
      );
    }

    // Single transaction (bulk writes) + single Redux dispatch — same batch
    // pattern as useUpdateAnnotations, so annotationsUpdatedAt observers and
    // liveQueries fire once for the whole carve.
    await db.transaction(
      "rw",
      [db.points, db.annotations, db.relAnnotationMappingCategory],
      async () => {
        if (pointsToSave.length > 0) await db.points.bulkAdd(pointsToSave);
        await db.annotations.update(annotation.id, {
          points: newPointsRefs,
          cuts: newCutsRefs,
          ...rootFlagChanges,
        });
        if (newAnnotationRows.length > 0) {
          await db.annotations.bulkAdd(newAnnotationRows);
        }
        if (newRels.length > 0) {
          await db.relAnnotationMappingCategory.bulkAdd(newRels);
        }
      }
    );

    dispatch(triggerAnnotationsUpdate());
  }

  return hollowOutAnnotation;
}
