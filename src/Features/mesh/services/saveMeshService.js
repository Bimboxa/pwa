import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

import mapElevationCellToPolyline from "Features/mesh/utils/mapElevationCellToPolyline";

// Style fields copied from the parent onto each mesh cell so the cells look
// like the parent even when it has inline (template-less) styling.
const INHERITED_STYLE_FIELDS = [
  "fillColor",
  "fillOpacity",
  "fillType",
  "strokeColor",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeOpacity",
  "strokeType",
  "strokeOffset",
];

function pickStyle(annotation) {
  const style = {};
  for (const f of INHERITED_STYLE_FIELDS) {
    if (annotation[f] !== undefined) style[f] = annotation[f];
  }
  return style;
}

const labelNum = (label) => {
  const m = /(\d+)/.exec(label || "");
  return m ? parseInt(m[1], 10) : 0;
};

/**
 * Renumber every (live) maille of a listing as M1, M2, M3… so the sequence stays
 * gap-free and collision-free after a (re)mesh. Surfaces are ordered by creation
 * time (createdAt, then id); within a surface the existing label order is kept
 * (mailles were created in reading order). Runs inside the caller's transaction.
 */
async function relabelListingMeshCells(listingId, labelPrefix = "M") {
  if (!listingId) return;
  const cells = (
    await db.annotations.where("listingId").equals(listingId).toArray()
  ).filter((a) => a.isMeshCell && !a.deletedAt && a.parentAnnotationId);
  if (!cells.length) return;

  const parentIds = [...new Set(cells.map((c) => c.parentAnnotationId))];
  const parents = await db.annotations.bulkGet(parentIds);
  const createdAtById = {};
  parents.forEach((p) => {
    if (p) createdAtById[p.id] = p.createdAt || "";
  });

  cells.sort((a, b) => {
    const ca = createdAtById[a.parentAnnotationId] || "";
    const cb = createdAtById[b.parentAnnotationId] || "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    if (a.parentAnnotationId !== b.parentAnnotationId)
      return a.parentAnnotationId < b.parentAnnotationId ? -1 : 1;
    return labelNum(a.label) - labelNum(b.label);
  });

  for (let i = 0; i < cells.length; i++) {
    const label = `${labelPrefix}${i + 1}`;
    if (cells[i].label !== label)
      await db.annotations.update(cells[i].id, { label });
  }
}

// Normalize a draft cut line (editor world space) for persistence on the parent.
//   POLYGON  → [0..1] baseMap coords
//   POLYLINE → elevation param space { u (0..1 along developed wall), z (m) }
function normalizeMeshLine(
  line,
  { mode, imageSize, developedRange, meterByPx }
) {
  const norm = (p) => {
    if (mode === "POLYGON") {
      return { x: p.x / imageSize.width, y: p.y / imageSize.height };
    }
    const span = developedRange.xMax - developedRange.xMin || 1;
    return { u: (p.x - developedRange.xMin) / span, z: -p.y * meterByPx };
  };
  return {
    id: line.id,
    orientation: line.orientation,
    p1: norm(line.p1),
    p2: norm(line.p2),
  };
}

/**
 * Materialize the mesh cells of a parent annotation as real, linked annotations
 * and persist the cut-line definition on the parent.
 *
 * Re-save safe: previously generated cells (and their relations) are
 * soft-deleted first, then regenerated.
 *
 * @param {Object} args
 * @param {Object} args.parentAnnotation - the resolved selected annotation
 * @param {"POLYGON"|"POLYLINE"} args.mode
 * @param {Array} args.cells - computed mesh cells (world space)
 * @param {Array} args.draftMeshLines - cut lines (world space)
 * @param {{width:number,height:number}} args.imageSize
 * @param {number} args.meterByPx
 * @param {Object} [args.elevation] - POLYLINE only: { chain, developedRange }
 * @param {Function} args.dispatch
 */
export default async function saveMeshService({
  parentAnnotation,
  mode,
  cells,
  draftMeshLines,
  imageSize,
  meterByPx,
  elevation,
  dispatch,
}) {
  if (!parentAnnotation || !mode || !imageSize?.width || !cells?.length) {
    return { createdIds: [] };
  }

  const projectId = parentAnnotation.projectId;
  const baseMapId = parentAnnotation.baseMapId;
  const listingId = parentAnnotation.listingId;
  const parentAnnotationId = parentAnnotation.id;
  const style = pickStyle(parentAnnotation);

  // --- build the new cells (annotations + normalized points) ---
  const newPoints = [];
  const newAnnotations = [];

  cells.forEach((cell, index) => {
    let cellPlanPoints; // [{ x, y, offsetBottom?, offsetTop? }] in pixel plan space
    let type;

    if (mode === "POLYGON") {
      type = "POLYGON";
      cellPlanPoints = cell.points.map((p) => ({ x: p.x, y: p.y }));
    } else {
      type = "POLYLINE";
      const res = mapElevationCellToPolyline(cell.points, {
        chain: elevation?.chain,
        meterByPx,
        height: parseFloat(parentAnnotation.height) || 0,
        offsetZ: Number(parentAnnotation.offsetZ) || 0,
      });
      if (!res) return;
      cellPlanPoints = res.points;
    }

    if (!cellPlanPoints || cellPlanPoints.length < 2) return;

    const annotationPointRefs = cellPlanPoints.map((p) => {
      const pointId = nanoid();
      newPoints.push({
        id: pointId,
        x: p.x / imageSize.width,
        y: p.y / imageSize.height,
        projectId,
        baseMapId,
        listingId,
      });
      const ref = { id: pointId };
      if (p.offsetBottom !== undefined) ref.offsetBottom = p.offsetBottom;
      if (p.offsetTop !== undefined) ref.offsetTop = p.offsetTop;
      return ref;
    });

    newAnnotations.push({
      id: nanoid(),
      projectId,
      baseMapId,
      listingId,
      annotationTemplateId: parentAnnotation.annotationTemplateId,
      layerId: parentAnnotation.layerId,
      type,
      points: annotationPointRefs,
      closeLine: type === "POLYGON" ? true : false,
      isMeshCell: true,
      parentAnnotationId,
      // per-listing maille label (M1, M2, M3…); finalized by the listing-wide
      // relabel below. cell.label already carries the per-listing offset.
      label: cell.label ?? `M${index + 1}`,
      ...(type === "POLYLINE" && {
        height: parseFloat(parentAnnotation.height) || 0,
        offsetZ: Number(parentAnnotation.offsetZ) || 0,
      }),
      ...style,
    });
  });

  // --- normalized cut-lines for the parent ---
  const persistedMeshLines = (draftMeshLines ?? []).map((l) =>
    normalizeMeshLine(l, {
      mode,
      imageSize,
      developedRange: elevation?.developedRange,
      meterByPx,
    })
  );

  // --- previously generated cells to replace ---
  const existingRels = (
    await db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .equals(parentAnnotationId)
      .toArray()
  ).filter((r) => !r.deletedAt);
  const oldCellIds = existingRels.map((r) => r.meshCellAnnotationId);
  const oldRelIds = existingRels.map((r) => r.id);

  await db.transaction(
    "rw",
    [db.points, db.annotations, db.relAnnotationMeshCells],
    async () => {
      // replace: soft-delete previous cells + their relations
      if (oldCellIds.length > 0) await db.annotations.bulkDelete(oldCellIds);
      if (oldRelIds.length > 0)
        await db.relAnnotationMeshCells.bulkDelete(oldRelIds);

      // create points + cell annotations
      if (newPoints.length > 0) await db.points.bulkAdd(newPoints);
      if (newAnnotations.length > 0)
        await db.annotations.bulkAdd(newAnnotations);

      // link each cell to the parent
      const rels = newAnnotations.map((a) => ({
        id: nanoid(),
        projectId,
        parentAnnotationId,
        meshCellAnnotationId: a.id,
      }));
      if (rels.length > 0) await db.relAnnotationMeshCells.bulkAdd(rels);

      // persist the cut-line definition on the parent
      await db.annotations.update(parentAnnotationId, {
        meshLines: persistedMeshLines,
      });

      // renumber the whole listing so the M1, M2, M3… sequence stays clean
      await relabelListingMeshCells(listingId);
    }
  );

  dispatch?.(triggerAnnotationsUpdate());

  return { createdIds: newAnnotations.map((a) => a.id) };
}
