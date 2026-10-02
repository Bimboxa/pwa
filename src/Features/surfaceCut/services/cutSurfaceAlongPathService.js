import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup, withoutUndo } from "App/db/undoManager";

import loadStoredMesh3d, {
  getMesh3dMetrics,
} from "Features/annotationMesh3d/services/loadStoredMesh3d";
import writeMesh3dService, {
  buildMesh3dStorage,
} from "Features/annotationMesh3d/services/writeMesh3dService";
import {
  localToNormalized,
  normalizedToLocal,
} from "Features/annotationMesh3d/utils/mesh3dFrame";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  SEGMENT_FLAG_FIELDS,
  getRingSegmentFlagPointIds,
  hasAnySegmentFlagField,
} from "Features/annotations/utils/segmentFlags";
import { copyMeshPaintsForSplit } from "Features/meshPaint/services/copyMeshPaintsService";
import fitPlanarValue from "Features/threedFaceCut/utils/fitPlanarValue";

import getPathChunksInRegion, {
  isInsideRegion,
  signedArea2d,
} from "../utils/getPathChunksInRegion";
import getSplitPieceProps from "../utils/getSplitPieceProps";
import splitFlatRegionAlongChunks from "../utils/splitFlatRegionAlongChunks";
import splitMesh3dAlongVerticalPath from "../utils/splitMesh3dAlongVerticalPath";

// Plan tolerance (m): a trace end closer than this to the outline is on it,
// closer to a corner is that corner.
const PLAN_TOL_M = 1e-2;

// A vertex the split put closer than this (m) to an original edge lies on it.
const ON_EDGE_M = 1e-6;

// Fields holding point ids along a line of the polygon: they stay on the
// main piece, the new pieces start without them.
const LINE_FIELDS = ["guideLines", "isoHeightLines", "profileLines"];

// Why a surface was not cut, least telling first (the toaster shows the
// most telling one over the candidates).
export const SURFACE_CUT_REASONS = [
  "NO_CROSSING",
  "NOT_THROUGH",
  "SELF_INTERSECTING",
  "ARC",
  "ROTATED",
  "HOST",
  "NOT_EDITABLE",
  "FAILED",
];

// « Couper une surface » (2D editor): cuts the surfaces (POLYGON
// annotations) a plan trace runs across into one annotation per piece. The
// largest piece keeps the annotation (id, relations, mesh paints); the others
// are created with its fields. An isMesh3d annotation is cut like by a
// vertical guillotine standing on the trace (splitMesh3dAlongVerticalPath).
// An end of the trace stopping inside a surface is prolonged to its edge.
//
// annotationIds: the candidate surfaces; path: the trace, normalized
// [{x, y}] (db.points convention). One Ctrl+Z undoes the whole cut, every
// surface included.
//
// Returns { cutCount, pieceCount, reason } — reason (SURFACE_CUT_REASONS):
// why nothing was cut, null otherwise.
export default async function cutSurfaceAlongPathService({
  annotationIds,
  path,
  projectId,
  dispatch,
  createAnnotationFn,
  updateAnnotationFn,
}) {
  let reason = "NO_CROSSING";
  const keepReason = (next) => {
    if (SURFACE_CUT_REASONS.indexOf(next) > SURFACE_CUT_REASONS.indexOf(reason))
      reason = next;
  };

  // 1. Plan every cut before writing anything.
  const metricsByBaseMapId = new Map();
  const plans = [];
  for (const annotationId of annotationIds ?? []) {
    const annotation = await db.annotations.get(annotationId);
    if (!annotation || annotation.deletedAt || annotation.type !== "POLYGON")
      continue;
    const metrics = await loadMetrics(annotation.baseMapId, metricsByBaseMapId);
    if (!metrics) continue;
    const localPath = path.map((p) => {
      const { x, y } = normalizedToLocal([p.x, p.y], metrics);
      return { x, y };
    });
    try {
      const plan = annotation.isMesh3d
        ? await planMeshCut({ annotation, path: localPath })
        : await planPolygonCut({
            annotation,
            path: localPath,
            metrics,
            projectId,
          });
      if (plan.reason) keepReason(plan.reason);
      else plans.push({ ...plan, annotation, metrics });
    } catch (error) {
      console.error("[surfaceCut] plan failed", annotationId, error);
      keepReason("FAILED");
    }
  }
  if (!plans.length) return { cutCount: 0, pieceCount: 0, reason };

  // 2. Write them as ONE undo step.
  let cutCount = 0;
  let pieceCount = 0;
  try {
    await withUndoGroup(async () => {
      for (const plan of plans) {
        const newIds = await plan.write({
          projectId,
          dispatch,
          createAnnotationFn,
          updateAnnotationFn,
        });
        if (!newIds) continue;
        cutCount += 1;
        pieceCount += 1 + newIds.length;
        // Painted parts (« Pinceau ») follow their piece.
        if (newIds.length) {
          try {
            await copyMeshPaintsForSplit({
              sourceHostId: plan.annotation.id,
              newHostIds: newIds,
              metrics: plan.metrics,
            });
          } catch (error) {
            console.warn("[surfaceCut] mesh paints not distributed", error);
          }
        }
      }
    });
  } catch (error) {
    console.error("[surfaceCut] write failed", error);
    if (!cutCount) return { cutCount: 0, pieceCount: 0, reason: "FAILED" };
  }
  dispatch?.(triggerAnnotationsUpdate());
  return { cutCount, pieceCount, reason: cutCount ? null : "FAILED" };
}

async function loadMetrics(baseMapId, cache) {
  if (!cache.has(baseMapId)) {
    const record = baseMapId ? await db.baseMaps.get(baseMapId) : null;
    const versions = record
      ? await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
      : [];
    cache.set(baseMapId, record ? getMesh3dMetrics(record, versions) : null);
  }
  return cache.get(baseMapId);
}

// --- mesh annotation: vertical guillotine

async function planMeshCut({ annotation, path }) {
  const ctx = await loadStoredMesh3d(annotation.id);
  if (!ctx) return { reason: "NOT_EDITABLE" };
  const result = splitMesh3dAlongVerticalPath(ctx.mesh, path);
  if (result.error) return { reason: result.error };
  if (await isOpeningOrSubtractionHost(annotation.id))
    return { reason: "HOST" };
  if (!result.capped) {
    console.info("[surfaceCut] open mesh cut without caps", annotation.id);
  }
  const [keep, ...others] = result.pieces;

  return {
    write: async ({ dispatch, createAnnotationFn }) => {
      const kept = await writeMesh3dService({
        annotation: ctx.annotation,
        mesh: keep,
        baseOffsetZ: ctx.baseOffsetZ,
        metrics: ctx.metrics,
        dispatch,
      });
      if (!kept) return null;
      // « Réinitialiser » would bring the whole original back over the
      // other pieces: a cut piece has no reset.
      if (ctx.annotation.mesh3dSource) {
        await db.annotations.update(annotation.id, {
          mesh3dSource: undefined,
        });
      }

      const newIds = [];
      for (const piece of others) {
        const storage = buildMesh3dStorage({
          mesh: piece,
          baseOffsetZ: ctx.baseOffsetZ,
          metrics: ctx.metrics,
          baseMapId: annotation.baseMapId,
          projectId: annotation.projectId,
          listingId: annotation.listingId,
        });
        if (!storage) continue;
        const { pointRows, ...fields } = storage;
        await withoutUndo(() => db.points.bulkAdd(pointRows));
        const props = getSplitPieceProps(kept);
        delete props.mesh3dSource;
        const created = await createAnnotationFn({
          ...props,
          id: nanoid(),
          type: "POLYGON",
          isMesh3d: true,
          height: 0,
          ...fields,
        });
        if (created) newIds.push(created.id);
      }
      return newIds;
    },
  };
}

// --- regular polygon: plan split

async function planPolygonCut({ annotation, path, metrics, projectId }) {
  const outline = await resolveRing(annotation.points, metrics);
  if (!outline) return { reason: "NO_CROSSING" };
  // holders[L]: the row (L = 0) or the cut (L > 0) owning ring L.
  const holders = [annotation];
  const rings = [outline];
  for (const cut of annotation.cuts ?? []) {
    const ring = await resolveRing(cut?.points, metrics);
    if (!ring) continue;
    holders.push(cut);
    rings.push(ring);
  }
  const loops = rings.map((ring) => ring.map(({ x, y }) => ({ x, y })));

  const { chunks, error } = getPathChunksInRegion(loops, path, {
    tolerance: PLAN_TOL_M,
    extendEnds: true,
  });
  if (error) return { reason: error };
  if (!chunks.length) return { reason: "NO_CROSSING" };
  if (Number(annotation.rotation)) return { reason: "ROTATED" };
  if (await isOpeningOrSubtractionHost(annotation.id))
    return { reason: "HOST" };
  const chunkEnds = chunks.flatMap((chunk) => [chunk[0], chunk.at(-1)]);
  if (chunkEnds.some((p) => isOnArc(rings, p))) return { reason: "ARC" };

  const split = splitFlatRegionAlongChunks(loops, chunks);
  if (!split) return { reason: "NOT_THROUGH" };

  // Where each vertex of the split comes from.
  const flat = rings.flatMap((ring, L) => ring.map((p, k) => ({ ...p, L, k })));
  const n = flat.length;
  const origins = split.vertices.map((v, i) =>
    i < n
      ? { kind: "VERTEX", L: flat[i].L, k: flat[i].k }
      : locateOnRings(rings, v)
  );

  // New vertices: one db point each, shared by the pieces touching it.
  const hasOffsets = flat.some(
    (p) => p.ref.offsetBottom != null || p.ref.offsetTop != null
  );
  const planarAt = Object.fromEntries(
    ["offsetBottom", "offsetTop"].map((key) => [
      key,
      fitPlanarValue(
        outline.map((p) => ({ x: p.x, y: p.y, value: Number(p.ref[key]) || 0 }))
      ),
    ])
  );
  const pointRows = [];
  const newRefs = new Map();
  const refOf = (vi) => {
    if (vi < n) return flat[vi].ref;
    if (newRefs.has(vi)) return newRefs.get(vi);
    const v = split.vertices[vi];
    const [x, y] = localToNormalized({ x: v.x, y: v.y, z: 0 }, metrics);
    const row = {
      id: nanoid(),
      x,
      y,
      projectId: annotation.projectId ?? projectId,
      baseMapId: annotation.baseMapId,
      ...(annotation.listingId ? { listingId: annotation.listingId } : {}),
    };
    pointRows.push(row);
    const ref = { id: row.id, type: "square" };
    if (hasOffsets) {
      const origin = origins[vi];
      for (const key of ["offsetBottom", "offsetTop"]) {
        if (origin.kind === "EDGE") {
          const ring = rings[origin.L];
          const a = Number(ring[origin.k].ref[key]) || 0;
          const b = Number(ring[(origin.k + 1) % ring.length].ref[key]) || 0;
          ref[key] = a + (b - a) * origin.t;
        } else {
          ref[key] = planarAt[key](v.x, v.y);
        }
      }
    }
    newRefs.set(vi, ref);
    return ref;
  };

  // Per-segment flags (hidden, iso, ext, int): a piece segment lying on a
  // flagged original segment keeps the flag.
  const anyFlags = holders.some(hasAnySegmentFlagField);
  const flaggedByField = SEGMENT_FLAG_FIELDS.map(({ idxField, idField }) =>
    holders.map(
      (holder) =>
        new Set(
          getRingSegmentFlagPointIds(holder, idxField, idField, holder.points, {
            closed: true,
          }) ?? []
        )
    )
  );
  const getOriginalEdge = (s, t) =>
    getForwardEdge(origins[s], origins[t], rings) ??
    getForwardEdge(origins[t], origins[s], rings);
  const ringFlags = (ring, { root }) => {
    if (!anyFlags) return {};
    const out = {};
    SEGMENT_FLAG_FIELDS.forEach(({ idxField, idField }, f) => {
      const ids = [];
      ring.forEach((s, i) => {
        const edge = getOriginalEdge(s, ring[(i + 1) % ring.length]);
        if (!edge) return;
        const startId = rings[edge.L][edge.k].ref.id;
        if (flaggedByField[f][edge.L].has(startId)) ids.push(refOf(s).id);
      });
      out[idField] = ids;
      if (root) out[idxField] = undefined;
    });
    return out;
  };

  // An original hole the cut did not touch keeps its cut row as is.
  const matchOriginalHole = (hole) => {
    if (!hole.every((vi) => vi < n)) return null;
    const L = flat[hole[0]].L;
    if (L === 0 || hole.length !== rings[L].length) return null;
    return hole.every((vi) => flat[vi].L === L) ? L : null;
  };

  const innerPoints =
    (await resolveRefsLoose(annotation.innerPoints, metrics)) ?? [];
  const pieces = split.faces.map((face) => {
    const holes = face.holes ?? [];
    const pieceLoops = [face.loop, ...holes].map((loop) =>
      loop.map((vi) => split.vertices[vi])
    );
    const area =
      Math.abs(signedArea2d(pieceLoops[0])) -
      pieceLoops
        .slice(1)
        .reduce((sum, hole) => sum + Math.abs(signedArea2d(hole)), 0);
    return {
      area,
      loops: pieceLoops,
      fields: {
        points: face.loop.map(refOf),
        cuts: holes.map((hole) => {
          const L = matchOriginalHole(hole);
          if (L) return holders[L];
          return {
            id: nanoid(),
            points: hole.map(refOf),
            ...ringFlags(hole, { root: false }),
          };
        }),
        ...ringFlags(face.loop, { root: true }),
      },
      innerPoints: [],
    };
  });
  pieces.sort((a, b) => b.area - a.area);
  for (const inner of innerPoints) {
    const piece =
      pieces.find((candidate) => isInsideRegion(candidate.loops, inner)) ??
      pieces[0];
    piece.innerPoints.push(inner.ref);
  }
  const hasInnerPoints = Boolean(annotation.innerPoints?.length);
  const [keep, ...others] = pieces;

  return {
    write: async ({ createAnnotationFn, updateAnnotationFn }) => {
      await db.points.bulkAdd(pointRows);
      await updateAnnotationFn({
        ...annotation,
        ...keep.fields,
        ...(hasInnerPoints ? { innerPoints: keep.innerPoints } : {}),
      });
      const newIds = [];
      for (const piece of others) {
        const props = getSplitPieceProps(annotation);
        for (const key of LINE_FIELDS) if (props[key]?.length) props[key] = [];
        const created = await createAnnotationFn({
          ...props,
          id: nanoid(),
          ...piece.fields,
          ...(hasInnerPoints ? { innerPoints: piece.innerPoints } : {}),
        });
        if (created) newIds.push(created.id);
      }
      return newIds;
    },
  };
}

// A plan split would leave the openings glued on the host and the
// subtractions it takes part in pointing at one piece only.
async function isOpeningOrSubtractionHost(annotationId) {
  const [openings, asSource, asTarget] = await Promise.all([
    db.relAnnotationOpenings
      .where("hostAnnotationId")
      .equals(annotationId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .equals(annotationId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("targetAnnotationId")
      .equals(annotationId)
      .toArray(),
  ]);
  return [...openings, ...asSource, ...asTarget].some((rel) => !rel.deletedAt);
}

// Live point refs of a ring with their local plan position; null under 3.
async function resolveRing(refs, metrics) {
  const resolved = await resolveRefsLoose(refs, metrics);
  return resolved && resolved.length >= 3 ? resolved : null;
}

// Refs whose db point is live, with their local plan position (orphans are
// skipped, like the renderer does).
async function resolveRefsLoose(refs, metrics) {
  if (!refs?.length) return null;
  const rows = await db.points.bulkGet(refs.map((ref) => ref?.id));
  const resolved = [];
  refs.forEach((ref, i) => {
    const row = rows[i];
    if (!row || row.deletedAt) return;
    const { x, y } = normalizedToLocal([row.x, row.y], metrics);
    resolved.push({ ref, x, y });
  });
  return resolved;
}

// Original edge (or corner) a split vertex lies on.
function locateOnRings(rings, p) {
  for (let L = 0; L < rings.length; L++) {
    const ring = rings[L];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (!len2) continue;
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      if (t <= 0 || t >= 1) continue;
      const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (d <= ON_EDGE_M) return { kind: "EDGE", L, k, t };
    }
  }
  return { kind: "INTERIOR" };
}

// Original edge {L, k} the piece segment from origin a to origin b runs
// along, walked in its own direction; null when it is a cut segment.
function getForwardEdge(a, b, rings) {
  if (!a || !b || a.kind === "INTERIOR" || b.kind === "INTERIOR") return null;
  if (a.L !== b.L) return null;
  const next = (a.k + 1) % rings[a.L].length;
  if (b.kind === "VERTEX" && b.k === next) return { L: a.L, k: a.k };
  if (b.kind === "EDGE" && b.k === a.k) {
    if (a.kind === "VERTEX" || b.t > a.t) return { L: a.L, k: a.k };
  }
  return null;
}

// A cut end on an arc (S-C-S points) of the outline or of a hole.
function isOnArc(rings, p) {
  for (const ring of rings) {
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      const isArcEdge = a.ref.type === "circle" || b.ref.type === "circle";
      if (Math.hypot(p.x - a.x, p.y - a.y) <= ON_EDGE_M) {
        if (a.ref.type === "circle") return true;
        continue;
      }
      if (!isArcEdge) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (!len2) continue;
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      if (t <= 0 || t >= 1) continue;
      if (Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= ON_EDGE_M)
        return true;
    }
  }
  return false;
}
