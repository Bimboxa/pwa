import {
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";
import {
  MATCH_MIN_OVERLAP_RATIO,
  MESH_PAINT_PART_TYPES,
  MESH_PAINT_SYNC_STATES,
  RESYNC_AMBIGUITY_RATIO,
  RESYNC_NEAR_M,
  RESYNC_WRITE_TOL_M,
} from "../constants/meshPaintConstants.js";

import { getEdgeOverlap } from "./findMeshPaintMatches.js";
import {
  localGeometryToPaint,
  paintGeometryToLocal,
} from "./meshPaintFrame.js";
import {
  MIN_EDGE_LENGTH_M,
  MIN_FACE_AREA_M2,
  faceArea,
  faceCentroid,
  faceOverlapArea,
  flipFace,
  maxVertexShift,
  orientFaceLoops,
} from "./meshPaintGeometry.js";

// Re-sync of the painted parts of ONE host on its current part index
// (buildHostPartIndex): the paint is a 3D snapshot glued back on the host
// after every change.
//
// FACE
// - Stage 1 (near): islands on planes parallel to the paint (within 1°)
//   within RESYNC_NEAR_M — absorbs the 1 mm z-fight lifts, a lost
//   anti-aliasing shrink, a conversion to mesh. Side: on a closed host the
//   island must face the painted side (the two parements of a thick wall
//   never swap); on an open host (sheet, thin wall) the island is turned
//   toward the painted side. The NEAREST plane holding islands that overlap
//   ≥ 0.5 × min(area) wins and ALL its overlapping islands are kept: a cut
//   face stays painted as one multi-polygon row, an undone cut re-grows it.
// - Stage 2 (far, only when Stage 1 found nothing): same rule up to the
//   host's box diagonal, overlap measured on the projection — a pushed face,
//   a height / offset change. Nearest plane wins; a second plane within
//   RESYNC_AMBIGUITY_RATIO of its distance → ambiguous, no match. On an open
//   host (no side to trust) only a single candidate plane matches.
// - Stage 2 also needs the matched plane to cover at least half of the
//   PAINT (not only half of the smaller of the two): a small far island
//   (the end cap of a wall split at its corner) never takes a large paint.
// - Stage 3 (in-plane, only when Stages 1 and 2 found nothing): the face
//   slid within its own plane (an offsetZ / height edit made outside the 3D
//   move): the parallel same-side islands of the paint's own plane, kept
//   only when they are no more than the paint's polygons (no guess).
// EDGE: chains collinear within 1°; Stage 1 within RESYNC_NEAR_M, chains
//   bordering the paint's facets first (its `sides`, when known), then the
//   best overlap (≥ 0.5 × min length; overlaps within 1 % of the paint's
//   length are a tie, broken by the gap) wins; Stage 2 up to the diagonal,
//   nearest line, unique within RESYNC_AMBIGUITY_RATIO. Stage 2 candidates
//   must border the same facets as the paint: same `sides` (signed on a
//   closed host) when the row carries them — the top edge of a slab that
//   got thicker is never confused with its bottom edge — otherwise chains
//   sharing an (unchanged) host plane with the paint win: a wall that got
//   higher keeps its top-front edge, not the top-back one. The matched
//   geometry carries the chain's sides.
// No match → ORPHAN, geometry kept (a later pass may re-attach it).
//
// Provisional rows (split copies) only go through Stage 1: a copy trimmed
// away must not jump onto the new cut face (Stage 2 would see it). Rows
// flagged `sync.nearOnly` (the source host's rows right after a split, see
// copyMeshPaintsService) too, once: no match → ORPHAN (a user row is never
// deleted by the re-sync); the flag is cleared by that pass.
//
// Pure: node-testable.

const COS_PARALLEL = Math.cos((1 * Math.PI) / 180);
// Islands / chains this close (m) along the normal are on the same plane.
const SAME_PLANE_TOL_M = 1e-3;
// Relative slack of the overlap thresholds (polygon clipping float noise).
const OVERLAP_EPS = 1e-6;
// Stage 1 EDGE: overlaps within this share of the paint's length are a tie.
const EDGE_OVERLAP_TIE_RATIO = 0.01;

const isFace = (partType) => partType === MESH_PAINT_PART_TYPES.FACE;

const boxDiagonal = (box) => (box ? length(sub(box.max, box.min)) : 0);

// Candidate planes (sorted by distance) of the islands parallel to the face.
function collectFacePlanes(local, index, maxDist) {
  const n = local.normal;
  const c = faceCentroid(local);
  const area = faceArea(local);
  const planes = [];
  for (const island of index.islands || []) {
    const facing = dot(n, island.normal);
    if (Math.abs(facing) <= COS_PARALLEL) continue;
    if (index.isClosed && facing <= 0) continue;
    // Distance between the planes, measured at the paint's centroid.
    const offset = dot(island.normal, sub(c, island.centroid));
    if (Math.abs(offset) > maxDist) continue;
    const oriented = facing < 0 ? flipFace(island) : island;
    const overlap = faceOverlapArea(local, oriented);
    if (overlap < MATCH_MIN_OVERLAP_RATIO * Math.min(area, island.area)) {
      continue;
    }
    // Same plane = the islands' own plane (an offset along the paint's
    // normal drifts with the lateral distance when the two are not exactly
    // parallel).
    let plane = planes.find(
      (p) =>
        Math.abs(dot(p.normal, island.normal)) > COS_PARALLEL &&
        Math.abs(dot(p.normal, sub(island.centroid, p.point))) <=
          SAME_PLANE_TOL_M
    );
    if (!plane) {
      plane = {
        offset,
        normal: island.normal,
        point: island.centroid,
        islands: [],
        overlap: 0,
      };
      planes.push(plane);
    }
    plane.islands.push(oriented);
    plane.overlap += overlap;
  }
  planes.sort((p1, p2) => Math.abs(p1.offset) - Math.abs(p2.offset));
  return planes;
}

function planeToFace(plane) {
  return orientFaceLoops({
    polygons: plane.islands.flatMap((island) => island.polygons),
    normal: plane.islands[0].normal,
  });
}

// Stage 3: the parallel same-side islands of the paint's own plane, no
// overlap required (the face slid within its plane).
function matchFaceInPlane(local, index) {
  const n = local.normal;
  const c = faceCentroid(local);
  const islands = [];
  for (const island of index.islands || []) {
    const facing = dot(n, island.normal);
    if (Math.abs(facing) <= COS_PARALLEL) continue;
    if (index.isClosed && facing <= 0) continue;
    if (Math.abs(dot(island.normal, sub(c, island.centroid))) > RESYNC_NEAR_M) {
      continue;
    }
    islands.push(facing < 0 ? flipFace(island) : island);
  }
  if (!islands.length) return null;
  const ref = islands[0];
  const onePlane = islands.every(
    (island) =>
      Math.abs(dot(ref.normal, sub(island.centroid, ref.centroid))) <=
      SAME_PLANE_TOL_M
  );
  if (!onePlane || islands.length > local.polygons.length) return null;
  return { geometry: planeToFace({ islands }), stage: 3 };
}

function matchFace(local, index, allowFar) {
  const area = faceArea(local);
  if (!(area > MIN_FACE_AREA_M2)) return null;

  const near = collectFacePlanes(local, index, RESYNC_NEAR_M);
  if (near.length) return { geometry: planeToFace(near[0]), stage: 1 };
  if (!allowFar) return null;

  // Far planes must cover half of the paint itself.
  const far = collectFacePlanes(local, index, boxDiagonal(index.box)).filter(
    (plane) =>
      plane.overlap >= MATCH_MIN_OVERLAP_RATIO * area * (1 - OVERLAP_EPS)
  );
  if (!far.length) return matchFaceInPlane(local, index);
  if (!index.isClosed && far.length !== 1) return null;
  const d1 = Math.abs(far[0].offset);
  if (
    far.length > 1 &&
    Math.abs(far[1].offset) <= d1 * (1 + RESYNC_AMBIGUITY_RATIO)
  ) {
    return null;
  }
  return { geometry: planeToFace(far[0]), stage: 2 };
}

const toSegment = (a, b) => {
  const chord = length(sub(b, a));
  return { a, b, chord, dir: normalize(sub(b, a)) };
};

// Perpendicular distance of a point to the infinite line of a segment.
function distanceToLine(p, segment) {
  const d = sub(p, segment.a);
  const t = dot(d, segment.dir);
  return length(
    sub(d, {
      x: segment.dir.x * t,
      y: segment.dir.y * t,
      z: segment.dir.z * t,
    })
  );
}

const midpoint = (s) => ({
  x: (s.a.x + s.b.x) / 2,
  y: (s.a.y + s.b.y) / 2,
  z: (s.a.z + s.b.z) / 2,
});

// Every side of the paint is a side of the chain (signed on closed hosts:
// open hosts orient their facets arbitrarily).
function hasSides(paintSides, chainSides, signed) {
  return paintSides.every((s) =>
    (chainSides || []).some(
      (t) => (signed ? dot(s, t) : Math.abs(dot(s, t))) >= COS_PARALLEL
    )
  );
}

export function isSameEdgeSides(sidesA, sidesB) {
  const a = sidesA || [];
  const b = sidesB || [];
  return a.length === b.length && hasSides(a, b, true) && hasSides(b, a, true);
}

// The paint's line (old position, RESYNC_NEAR_M slack) and the chain both
// lie in the plane of one of the host's current facets.
function sharesHostPlane(row, segment, islands) {
  return islands.some((island) => {
    const n = island.normal;
    const d = dot(n, island.centroid);
    const off = (p) => Math.abs(dot(n, p) - d);
    return (
      off(row.a) <= RESYNC_NEAR_M &&
      off(row.b) <= RESYNC_NEAR_M &&
      off(segment.a) <= SAME_PLANE_TOL_M &&
      off(segment.b) <= SAME_PLANE_TOL_M
    );
  });
}

function matchEdge(local, index, allowFar) {
  const points = local.points || [];
  const row = toSegment(points[0], points[points.length - 1]);
  if (!(row.chord > MIN_EDGE_LENGTH_M)) return null;
  const diagonal = boxDiagonal(index.box);

  const candidates = [];
  for (const chain of index.chains || []) {
    const segment = toSegment(chain.points[0], chain.points[1]);
    if (!(segment.chord > MIN_EDGE_LENGTH_M)) continue;
    if (Math.abs(dot(row.dir, segment.dir)) <= COS_PARALLEL) continue;
    const { overlap, gap } = getEdgeOverlap(row, segment);
    if (
      overlap <
      MATCH_MIN_OVERLAP_RATIO * Math.min(row.chord, segment.chord)
    ) {
      continue;
    }
    if (!(gap <= diagonal) && !(gap <= RESYNC_NEAR_M)) continue;
    candidates.push({ chain, segment, overlap, gap });
  }
  if (!candidates.length) return null;

  const toGeometry = ({ chain, segment }) => {
    const ends =
      dot(segment.dir, row.dir) < 0
        ? [segment.b, segment.a]
        : [segment.a, segment.b];
    return chain.sides?.length
      ? { points: ends, sides: chain.sides }
      : { points: ends };
  };

  // Stage 1: chains bordering the paint's facets first (a shrunk pick and
  // the un-shrunk solid have parallel facets), then the best overlap — a
  // tie within EDGE_OVERLAP_TIE_RATIO of the paint's length (float noise,
  // a clamped vs a full overlap on a thin band) is broken by the gap.
  let near = candidates.filter((c) => c.gap <= RESYNC_NEAR_M);
  if (near.length > 1 && local.sides?.length) {
    const sided = near.filter((c) =>
      hasSides(local.sides, c.chain.sides, index.isClosed)
    );
    if (sided.length) near = sided;
  }
  const overlapTie = Math.max(1e-6, EDGE_OVERLAP_TIE_RATIO * row.chord);
  near.sort((c1, c2) =>
    Math.abs(c2.overlap - c1.overlap) > overlapTie
      ? c2.overlap - c1.overlap
      : c1.gap - c2.gap
  );
  if (near.length) return { geometry: toGeometry(near[0]), stage: 1 };
  if (!allowFar) return null;

  let far = [...candidates];
  if (local.sides?.length) {
    far = far.filter((c) =>
      hasSides(local.sides, c.chain.sides, index.isClosed)
    );
  } else {
    const linked = far.filter((c) =>
      sharesHostPlane(row, c.segment, index.islands || [])
    );
    if (linked.length) far = linked;
  }
  if (!far.length) return null;
  far.sort((c1, c2) => c1.gap - c2.gap);
  const nearest = far[0];
  // Chains on the nearest line (an edge cut in pieces) are one candidate:
  // the best overlap among them is taken; another line within the ratio is
  // ambiguous.
  const sameLine = far.filter(
    (c) =>
      distanceToLine(midpoint(c.segment), nearest.segment) <= SAME_PLANE_TOL_M
  );
  const otherLine = far.find((c) => !sameLine.includes(c));
  if (
    otherLine &&
    otherLine.gap <= nearest.gap * (1 + RESYNC_AMBIGUITY_RATIO)
  ) {
    return null;
  }
  const best = [...sameLine].sort((c1, c2) => c2.overlap - c1.overlap)[0];
  return { geometry: toGeometry(best), stage: 2 };
}

/**
 * Where a painted part (local form) sits on a host part index now.
 * Also the re-detection of a freshly picked part on an un-shrunk host
 * (allowFar: false = Stage 1 only): its EDGE geometry carries the chain's
 * `sides`, keep them in the stored row (localGeometryToPaint does).
 *
 * @returns {{geometry: LocalFace|LocalEdge, stage: 1|2|3} | null}
 */
export function matchPaintPartToIndex(
  partType,
  localGeometry,
  index,
  { allowFar = true } = {}
) {
  if (!localGeometry || !index) return null;
  return isFace(partType)
    ? matchFace(localGeometry, index, allowFar)
    : matchEdge(localGeometry, index, allowFar);
}

/**
 * @param {object} args
 * @param {object[]} args.rows - live db.meshPaints rows of ONE host
 * @param {object} args.index - buildHostPartIndex result (same local frame)
 * @param {{imageWidth, imageHeight, meterByPx}} args.metrics - of the host's
 *   base map
 * @returns {Array<{id, geometry, state: "OK"|"ORPHAN", changed: boolean,
 *   clearProvisional: boolean, clearNearOnly: boolean,
 *   deleteProvisional: boolean}>} one entry per
 *   live row ([] without index / metrics). `geometry` is the stored form; it
 *   is the row's own geometry (same object) unless a vertex moved more than
 *   RESYNC_WRITE_TOL_M (or an edge's sides changed: points kept, sides
 *   updated). changed = moved, sides changed or state changed.
 */
export default function planPaintResync({ rows, index, metrics }) {
  if (!index || !metrics) return [];
  const plan = [];
  for (const row of rows || []) {
    if (!row || row.deletedAt) continue;
    const provisional = Boolean(row.sync?.provisional);
    const nearOnly = Boolean(row.sync?.nearOnly);
    const prevState = row.sync?.state ?? MESH_PAINT_SYNC_STATES.OK;
    const local = paintGeometryToLocal(row.partType, row.geometry, metrics);
    const match = local
      ? matchPaintPartToIndex(row.partType, local, index, {
          allowFar: !provisional && !nearOnly,
        })
      : null;

    if (!match) {
      plan.push({
        id: row.id,
        geometry: row.geometry,
        state: MESH_PAINT_SYNC_STATES.ORPHAN,
        changed: prevState !== MESH_PAINT_SYNC_STATES.ORPHAN,
        clearProvisional: false,
        clearNearOnly: nearOnly,
        deleteProvisional: provisional,
      });
      continue;
    }

    const moved =
      maxVertexShift(row.partType, local, match.geometry) > RESYNC_WRITE_TOL_M;
    // An edge learns (or updates) the facets it borders.
    const sidesChanged =
      !isFace(row.partType) &&
      Boolean(match.geometry.sides?.length) &&
      !isSameEdgeSides(local.sides, match.geometry.sides);
    let geometry = row.geometry;
    if (moved) {
      geometry = localGeometryToPaint(row.partType, match.geometry, metrics);
    } else if (sidesChanged) {
      geometry = {
        ...row.geometry,
        sides: localGeometryToPaint(row.partType, match.geometry, metrics)
          .sides,
      };
    }
    plan.push({
      id: row.id,
      geometry,
      state: MESH_PAINT_SYNC_STATES.OK,
      changed: moved || sidesChanged || prevState !== MESH_PAINT_SYNC_STATES.OK,
      clearProvisional: provisional,
      clearNearOnly: nearOnly,
      deleteProvisional: false,
    });
  }
  return plan;
}
