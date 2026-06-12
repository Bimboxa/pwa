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

  // POLYLINE meshing is per developed-view (identified by its seed segment): the
  // cut lines and the resulting cells belong to that segment only, so switching
  // segments no longer shows / overwrites another segment's mesh. POLYGON has a
  // single global mesh (seed = null).
  const isPolyline = mode === "POLYLINE";
  const seedSegmentIndex = isPolyline
    ? Number.isInteger(elevation?.seedSegmentIndex)
      ? elevation.seedSegmentIndex
      : 0
    : null;

  // --- build the new cells (annotations + normalized points) ---
  const newPoints = [];
  const newAnnotations = [];

  cells.forEach((cell) => {
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

    // label / meshCellNumber / meshCellIndex are assigned in the stable-number
    // allocation pass below (after the previous cells are read).
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
  // POLYGON: replace every cell. POLYLINE: replace only the current seed
  // segment's cells, plus any legacy untagged cells (seedSegmentIndex == null,
  // created before per-segment meshing) so a first re-save cleans them up —
  // other segments' cells are preserved.
  const existingRels = (
    await db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .equals(parentAnnotationId)
      .toArray()
  ).filter((r) => !r.deletedAt);
  const relsToReplace = existingRels.filter(
    (r) =>
      !isPolyline ||
      r.seedSegmentIndex == null ||
      r.seedSegmentIndex === seedSegmentIndex
  );
  const oldCellIds = relsToReplace.map((r) => r.meshCellAnnotationId);
  const oldRelIds = relsToReplace.map((r) => r.id);

  // --- stable maille numbers (persisted, never reshuffled) ---
  // Cells being replaced (this segment), in reading order, so each new cell can
  // inherit the number AND custom label of the cell that previously occupied
  // its slot — re-meshing keeps existing numbers; only genuinely new cells get
  // the next free number.
  const prevCells = (await db.annotations.bulkGet(oldCellIds))
    .filter(Boolean)
    .sort(
      (a, b) =>
        (a.meshCellIndex ?? labelNum(a.label)) -
        (b.meshCellIndex ?? labelNum(b.label))
    );

  // Next free number = max over EVERY live listing cell (including the ones
  // being replaced, since their numbers get reused below — basing the max on
  // the global max keeps extra cells from colliding with a reused number).
  const allListingCells = (
    await db.annotations.where("listingId").equals(listingId).toArray()
  ).filter((a) => a.isMeshCell && !a.deletedAt);
  let nextFree =
    allListingCells.reduce(
      (max, c) => Math.max(max, c.meshCellNumber ?? labelNum(c.label) ?? 0),
      0
    ) + 1;

  newAnnotations.forEach((a, i) => {
    const prev = prevCells[i];
    if (prev) {
      a.meshCellNumber = prev.meshCellNumber ?? labelNum(prev.label) ?? nextFree++;
      a.label = prev.label ?? `M${a.meshCellNumber}`;
    } else {
      a.meshCellNumber = nextFree++;
      a.label = `M${a.meshCellNumber}`;
    }
    a.meshCellIndex = i;
  });

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

      // link each cell to the parent (tag with the seed segment for POLYLINE so
      // each segment's cells can be replaced independently on the next save)
      const rels = newAnnotations.map((a) => ({
        id: nanoid(),
        projectId,
        parentAnnotationId,
        meshCellAnnotationId: a.id,
        ...(isPolyline && { seedSegmentIndex }),
      }));
      if (rels.length > 0) await db.relAnnotationMeshCells.bulkAdd(rels);

      // persist the cut-line definition on the parent — POLYGON: a single array;
      // POLYLINE: keyed by seed segment so each developed view keeps its own.
      if (isPolyline) {
        const next = { ...(parentAnnotation.meshLinesBySegment ?? {}) };
        next[seedSegmentIndex] = persistedMeshLines;
        await db.annotations.update(parentAnnotationId, {
          meshLinesBySegment: next,
        });
      } else {
        await db.annotations.update(parentAnnotationId, {
          meshLines: persistedMeshLines,
        });
      }
    }
  );

  dispatch?.(triggerAnnotationsUpdate());

  return {
    createdIds: newAnnotations.map((a) => a.id),
    // the created mesh-cell annotations (with their stable label) — lets the
    // caller re-select the maille that was selected before the (destructive)
    // re-save, which created it anew under a different id.
    createdCells: newAnnotations,
  };
}
