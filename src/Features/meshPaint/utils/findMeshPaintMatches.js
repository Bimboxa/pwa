import {
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";
import {
  MATCH_ANGLE_DEG,
  MATCH_MIN_OVERLAP_RATIO,
  MATCH_PLANE_GAP_M,
  MESH_PAINT_PART_TYPES,
} from "../constants/meshPaintConstants.js";

import { paintGeometryToLocal } from "./meshPaintFrame.js";
import {
  MIN_EDGE_LENGTH_M,
  MIN_FACE_AREA_M2,
  edgeLength,
  faceArea,
  faceCentroid,
  faceOverlapArea,
  faceOverlapAreaByFacet,
  isCurvedFace,
  localGeometryBox,
} from "./meshPaintGeometry.js";

// The single "same painted part" matcher of the « Pinceau » (toggle, preview,
// conflict arbitration). It compares parts at the BASE MAP level, not per
// host: the corner edge shared by two walls is one edge, and two coincident
// faces of two hosts are one face.
//
// FACE: same side (normals within MATCH_ANGLE_DEG — the two sides of a sheet
//   never match), plane gap ≤ MATCH_PLANE_GAP_M, overlap ≥ ratio × min area.
// EDGE: collinear within MATCH_ANGLE_DEG (direction sign ignored), line gap ≤
//   MATCH_PLANE_GAP_M over the overlap, overlap ≥ ratio × min length.
// Curved parts (a smooth surface, a curve) are compared facet by facet /
//   segment by segment, the overlaps added up: a facet painted on its own
//   and the surface holding it are the same part.
//
// Pure: node-testable, relative imports only.

const COS_MATCH = Math.cos((MATCH_ANGLE_DEG * Math.PI) / 180);

// Prepared items are cached per row object (Dexie rows are never mutated in
// place) and per metrics: resolveMeshPaints runs in several memos per change.
const preparedCache = new WeakMap();
// Verdicts per pair of prepared items (a large curved surface is costly to
// compare, and the brush asks again on every hover frame).
const sameCache = new WeakMap();
const metricsKey = (m) => `${m.imageWidth}|${m.imageHeight}|${m.meterByPx}`;

function computePrepared(partType, geometry, metrics) {
  const local = paintGeometryToLocal(partType, geometry, metrics);
  if (!local) return null;
  const box = localGeometryBox(partType, local);
  if (!box) return null;
  if (partType === MESH_PAINT_PART_TYPES.FACE) {
    const area = faceArea(local);
    if (!(area > MIN_FACE_AREA_M2)) return null;
    return {
      partType,
      local,
      box,
      area,
      normal: local.normal,
      centroid: faceCentroid(local),
    };
  }
  // A curve is compared segment by segment (a straight edge is one).
  const segments = [];
  for (let i = 0; i + 1 < local.points.length; i++) {
    const a = local.points[i];
    const b = local.points[i + 1];
    const chord = length(sub(b, a));
    if (!(chord > MIN_EDGE_LENGTH_M)) continue;
    segments.push({ a, b, chord, dir: normalize(sub(b, a)) });
  }
  if (!segments.length) return null;
  return { partType, local, box, segments, length: edgeLength(local) };
}

/**
 * Local-meter form of a row / candidate, ready for isSameMeshPaintPart
 * (null when its geometry is degenerate or metrics are missing).
 */
export function prepareMeshPaintMatchItem(item, metrics) {
  if (!item?.geometry || !metrics) return null;
  const key = metricsKey(metrics);
  const cached = preparedCache.get(item);
  if (
    cached &&
    cached.key === key &&
    cached.geometry === item.geometry &&
    cached.partType === item.partType
  ) {
    return cached.prepared;
  }
  const prepared = computePrepared(item.partType, item.geometry, metrics);
  preparedCache.set(item, {
    key,
    geometry: item.geometry,
    partType: item.partType,
    prepared,
  });
  return prepared;
}

function boxesTouch(boxA, boxB, slack) {
  return (
    boxA.min.x - slack <= boxB.max.x &&
    boxB.min.x - slack <= boxA.max.x &&
    boxA.min.y - slack <= boxB.max.y &&
    boxB.min.y - slack <= boxA.max.y &&
    boxA.min.z - slack <= boxB.max.z &&
    boxB.min.z - slack <= boxA.max.z
  );
}

function isSameFace(A, B) {
  if (isCurvedFace(A.local) || isCurvedFace(B.local)) {
    const overlap = faceOverlapAreaByFacet(A.local, B.local, {
      cosMin: COS_MATCH,
      maxGap: MATCH_PLANE_GAP_M,
    });
    return overlap >= MATCH_MIN_OVERLAP_RATIO * Math.min(A.area, B.area);
  }
  if (dot(A.normal, B.normal) <= COS_MATCH) return false;
  const gap = Math.max(
    Math.abs(dot(A.normal, sub(B.centroid, A.centroid))),
    Math.abs(dot(B.normal, sub(A.centroid, B.centroid)))
  );
  if (gap > MATCH_PLANE_GAP_M) return false;
  const minArea = Math.min(A.area, B.area);
  return faceOverlapArea(A.local, B.local) >= MATCH_MIN_OVERLAP_RATIO * minArea;
}

/**
 * Overlap of two nearly collinear segments, measured along A:
 * {overlap (m), gap (m) between the two lines at the middle of the overlap}.
 */
export function getEdgeOverlap(A, B) {
  const tB1 = dot(sub(B.a, A.a), A.dir);
  const tB2 = dot(sub(B.b, A.a), A.dir);
  const start = Math.max(0, Math.min(tB1, tB2));
  const end = Math.min(A.chord, Math.max(tB1, tB2));
  const overlap = end - start;
  if (!(overlap > 0) || Math.abs(tB2 - tB1) < 1e-12) {
    return { overlap: Math.max(0, overlap), gap: Infinity };
  }
  const tm = (start + end) / 2;
  const onA = {
    x: A.a.x + A.dir.x * tm,
    y: A.a.y + A.dir.y * tm,
    z: A.a.z + A.dir.z * tm,
  };
  const s = (tm - tB1) / (tB2 - tB1);
  const onB = {
    x: B.a.x + (B.b.x - B.a.x) * s,
    y: B.a.y + (B.b.y - B.a.y) * s,
    z: B.a.z + (B.b.z - B.a.z) * s,
  };
  return { overlap, gap: length(sub(onB, onA)) };
}

function isSameEdge(A, B) {
  let total = 0;
  for (const a of A.segments) {
    for (const b of B.segments) {
      if (Math.abs(dot(a.dir, b.dir)) <= COS_MATCH) continue;
      const { overlap, gap } = getEdgeOverlap(a, b);
      if (gap <= MATCH_PLANE_GAP_M) total += overlap;
    }
  }
  return (
    total > 0 && total >= MATCH_MIN_OVERLAP_RATIO * Math.min(A.length, B.length)
  );
}

/**
 * Same painted part? Both items from prepareMeshPaintMatchItem (same base
 * map frame).
 */
export function isSameMeshPaintPart(A, B) {
  if (!A || !B || A.partType !== B.partType) return false;
  if (!boxesTouch(A.box, B.box, MATCH_PLANE_GAP_M)) return false;
  let known = sameCache.get(A);
  if (!known) {
    known = new WeakMap();
    sameCache.set(A, known);
  }
  let same = known.get(B);
  if (same === undefined) {
    same =
      A.partType === MESH_PAINT_PART_TYPES.FACE
        ? isSameFace(A, B)
        : isSameEdge(A, B);
    known.set(B, same);
  }
  return same;
}

/**
 * Rows painting the same part as the candidate: same baseMapId and partType
 * (any host, any template), not deleted, id !== candidate.id.
 *
 * @param {object} args
 * @param {{partType, baseMapId, geometry, id?}} args.candidate - stored form
 * @param {object[]} args.rows - db.meshPaints rows
 * @param {{imageWidth, imageHeight, meterByPx}} args.metrics - of baseMapId
 * @returns {object[]} matching rows (input order)
 */
export default function findMeshPaintMatches({ candidate, rows, metrics }) {
  if (!candidate || !rows?.length || !metrics) return [];
  const prepared = prepareMeshPaintMatchItem(candidate, metrics);
  if (!prepared) return [];
  return rows.filter((row) => {
    if (!row || row.deletedAt) return false;
    if (candidate.id && row.id === candidate.id) return false;
    if (row.baseMapId !== candidate.baseMapId) return false;
    if (row.partType !== candidate.partType) return false;
    return isSameMeshPaintPart(
      prepared,
      prepareMeshPaintMatchItem(row, metrics)
    );
  });
}
