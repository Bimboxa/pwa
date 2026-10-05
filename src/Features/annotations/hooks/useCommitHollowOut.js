import { useRef } from "react";
import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import {
  SEGMENT_FLAG_FIELDS,
  getRingSegmentFlagPointIds,
  segmentIdxToPointIds,
  filterSegmentPointIds,
} from "../utils/segmentFlags";
import getIsoSurfaceOffsetsSampler from "../utils/getIsoSurfaceOffsetsSampler";

import db from "App/db/db";

// "Evider": write step of the carve of a POLYGON by the footprints of the
// visible annotations, as if each footprint punched through it. The geometry
// is computed upstream by DialogHollowOutAnnotation (candidates from
// getHollowOutCandidates, minus the templates switched off by the user, then
// avoidVisibleAnnotationsService — same boolean pipeline as the draw-time
// "Eviter les annotations visibles" option, without its different-templateId
// restriction) so the user previews the result before it is committed here.
// When the carving splits the polygon into disjoint pieces, the largest piece
// keeps the original annotation and each extra piece becomes a new annotation
// cloned from it.
//
// `annotation` is the pixel-resolved POLYGON (useAnnotationsV2), `carved` the
// service result ({points, cuts, pieces, consumed}, pixel space).
export default function useCommitHollowOut() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();

  // Async commit does DB transactions — ignore re-triggers while one is running.
  const runningRef = useRef(false);

  async function commitHollowOut(annotation, carved) {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await commit(annotation, carved);
    } finally {
      runningRef.current = false;
    }
  }

  async function commit(annotation, carved) {
    if (!annotation?.points || annotation.points.length < 3) return;

    const imageSize = baseMap?.getImageSize?.();
    if (!imageSize?.width || !imageSize?.height) return;
    const { width, height } = imageSize;

    // Fully consumed → keep the original geometry untouched.
    if (!carved || carved.consumed) return;
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

    // Heights live on the refs (offsetBottom / offsetTop): a vertex kept by
    // the carve keeps the offsets of its original ref.
    const offsetsByKey = new Map();
    const rawRefById = new Map();
    for (const r of raw.points ?? []) if (r?.id) rawRefById.set(r.id, r);
    for (const c of raw.cuts ?? []) {
      for (const r of c?.points ?? []) if (r?.id) rawRefById.set(r.id, r);
    }
    const pickOffsets = (source) => {
      const offsets = {};
      if (source?.offsetBottom) offsets.offsetBottom = source.offsetBottom;
      if (source?.offsetTop) offsets.offsetTop = source.offsetTop;
      return offsets;
    };
    for (const [k, id] of pxLookup) {
      offsetsByKey.set(k, pickOffsets(rawRefById.get(id)));
    }

    // isoHeightLines: a vertex created on the contour (notch) takes the
    // height of the folded surface at its position, so the sloped faces are
    // kept around the notch. Cut vertices need nothing: their rim is draped
    // on the surface at build time (carveHolesInTopMesh).
    const sampleSurface = getIsoSurfaceOffsetsSampler(annotation);
    const round = (v) => Math.round(v * 1e6) / 1e6;
    const offsetsOf = (px, { onContour }) => {
      const kept = offsetsByKey.get(keyOf(px.x, px.y));
      if (kept) return kept;
      if (!onContour || !sampleSurface) return {};
      const sampled = sampleSurface(px);
      return pickOffsets({
        offsetBottom: round(sampled?.offsetBottom ?? 0),
        offsetTop: round(sampled?.offsetTop ?? 0),
      });
    };

    // Refs keep `type: "circle"` so recovered S-C-S arcs stay arcs.
    const asRef = (id, px, options) => ({
      id,
      ...(px.type === "circle" && { type: "circle" }),
      ...offsetsOf(px, options),
    });

    const pointsToSave = [];
    const mint = (px, options) => {
      const newId = nanoid();
      pointsToSave.push({
        id: newId,
        x: px.x / width,
        y: px.y / height,
        ...pointScope,
      });
      return asRef(newId, px, options);
    };
    const findOrMint = (px, options) => {
      const k = keyOf(px.x, px.y);
      const existing = pxLookup.get(k);
      if (existing) return asRef(existing, px, options);
      const ref = mint(px, options);
      pxLookup.set(k, ref.id);
      return ref;
    };
    const ON_CONTOUR = { onContour: true };
    const ON_CUT = { onContour: false };

    const newPointsRefs = carved.points.map((px) => findOrMint(px, ON_CONTOUR));
    const newCutsRefs = (carved.cuts ?? []).map((c) => {
      const ref = {
        id: c.id,
        points: (c.points ?? []).map((px) => findOrMint(px, ON_CUT)),
      };
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
        points: piece.points.map((px) => mint(px, ON_CONTOUR)),
        cuts: (piece.cuts ?? []).map((c) => ({
          id: nanoid(),
          ...(c.label != null && { label: c.label }),
          points: (c.points ?? []).map((px) => mint(px, ON_CUT)),
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

  return commitHollowOut;
}
