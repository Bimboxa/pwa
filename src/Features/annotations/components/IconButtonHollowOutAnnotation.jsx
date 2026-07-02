import { nanoid } from "@reduxjs/toolkit";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVisibleAnnotations from "Features/mapEditor/hooks/useVisibleAnnotations";
import useCreateAnnotation from "../hooks/useCreateAnnotation";

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
  // data

  const baseMap = useMainBaseMap();
  const visibleAnnotations = useVisibleAnnotations();
  const createAnnotation = useCreateAnnotation();

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

    // Rebuild point-id refs: reuse existing ids where the vertex is unchanged,
    // mint + persist new db.points rows (normalized) for boolean-intersection
    // vertices. Same reconciliation as useHandleCommitDrawing.
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

    // Scope fields for new db.points rows: copy from an existing stored point.
    const firstPointId = annotation.points.find((p) => p?.id)?.id;
    const samplePoint = firstPointId ? await db.points.get(firstPointId) : null;

    const pointsToSave = [];
    const findOrMint = (px) => {
      const k = keyOf(px.x, px.y);
      const existing = pxLookup.get(k);
      if (existing) return { id: existing };
      const newId = nanoid();
      pointsToSave.push({
        id: newId,
        x: px.x / width,
        y: px.y / height,
        baseMapId: samplePoint?.baseMapId ?? annotation.baseMapId,
        projectId: samplePoint?.projectId ?? annotation.projectId,
        listingId: samplePoint?.listingId ?? annotation.listingId,
      });
      pxLookup.set(k, newId);
      return { id: newId };
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

    if (pointsToSave.length > 0) {
      await db.points.bulkAdd(pointsToSave);
    }
    await db.annotations.update(annotation.id, {
      points: newPointsRefs,
      cuts: newCutsRefs,
    });

    // Extra disjoint pieces → one new annotation per piece, cloned from the
    // original record. All their points get fresh ids so no vertex is shared
    // between the resulting annotations.
    const extraPieces = (carved.pieces ?? []).slice(1);
    if (extraPieces.length === 0) return;

    const raw = await db.annotations.get(annotation.id);
    if (!raw) return;

    const pieceScope = {
      baseMapId: samplePoint?.baseMapId ?? annotation.baseMapId,
      projectId: samplePoint?.projectId ?? annotation.projectId,
      listingId: samplePoint?.listingId ?? annotation.listingId,
    };

    for (const piece of extraPieces) {
      if (!piece?.points || piece.points.length < 3) continue;

      const piecePointsToSave = [];
      const mint = (px) => {
        const newId = nanoid();
        piecePointsToSave.push({
          id: newId,
          x: px.x / width,
          y: px.y / height,
          ...pieceScope,
        });
        return { id: newId };
      };

      const piecePointsRefs = piece.points.map(mint);
      const pieceCutsRefs = (piece.cuts ?? []).map((c) => ({
        id: nanoid(),
        ...(c.label != null && { label: c.label }),
        points: (c.points ?? []).map(mint),
      }));

      await db.points.bulkAdd(piecePointsToSave);

      const clonedProps = { ...raw };
      delete clonedProps.id;
      delete clonedProps.points;
      delete clonedProps.cuts;
      delete clonedProps.entityId;
      delete clonedProps.createdAt;
      delete clonedProps.updatedAt;
      delete clonedProps.createdByUserIdMaster;

      await createAnnotation({
        ...clonedProps,
        id: nanoid(),
        points: piecePointsRefs,
        cuts: pieceCutsRefs,
      });
    }
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
