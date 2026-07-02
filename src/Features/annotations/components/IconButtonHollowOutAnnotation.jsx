import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";

import { IconButton, Tooltip } from "@mui/material";

import IconHollowOut from "./IconHollowOut";

import avoidVisibleAnnotationsService from "../services/avoidVisibleAnnotationsService";
import getAnnotationBBox from "../utils/getAnnotationBbox";

import db from "App/db/db";

// "Evider": carve the selected POLYGON by the footprints of every visible
// annotation, as if each footprint punched through it. Same boolean pipeline
// as the draw-time "Eviter les annotations visibles" option, but applied on
// demand to an existing annotation — and without the different-templateId
// restriction: every visible annotation cuts.
// When the carving splits the polygon into disjoint pieces, the largest piece
// keeps the original annotation and each extra piece becomes a new annotation
// cloned from it.
export default function IconButtonHollowOutAnnotation({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const visibleAnnotations = useVisibleAnnotations();

  // handlers

  async function handleHollowOut() {
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
      if (c.hiddenSegmentsIdx != null) ref.hiddenSegmentsIdx = c.hiddenSegmentsIdx;
      if (c.isoHeightSegmentsIdx != null)
        ref.isoHeightSegmentsIdx = c.isoHeightSegmentsIdx;
      if (c.isExtEdgeSegmentsIdx != null)
        ref.isExtEdgeSegmentsIdx = c.isExtEdgeSegmentsIdx;
      return ref;
    });

    // Extra disjoint pieces → one new annotation per piece, cloned from the
    // original record. All their points get fresh ids so no vertex is shared
    // between the resulting annotations.
    const clonedProps = { ...raw };
    delete clonedProps.id;
    delete clonedProps.points;
    delete clonedProps.cuts;
    delete clonedProps.entityId;
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

  // render

  return (
    <Tooltip title="Evider (découper par les annotations visibles)">
      <IconButton
        size="small"
        onClick={handleHollowOut}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <IconHollowOut fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
