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
//
// Pure: node-testable, relative imports only.

const COS_MATCH = Math.cos((MATCH_ANGLE_DEG * Math.PI) / 180);

// Prepared items are cached per row object (Dexie rows are never mutated in
// place) and per metrics: resolveMeshPaints runs in several memos per change.
const preparedCache = new WeakMap();
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
  const [a, b] = [local.points[0], local.points[local.points.length - 1]];
  const len = edgeLength(local);
  const chord = length(sub(b, a));
  if (!(chord > MIN_EDGE_LENGTH_M)) return null;
  return {
    partType,
    local,
    box,
    a,
    b,
    length: len,
    chord,
    dir: normalize(sub(b, a)),
  };
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
  if (Math.abs(dot(A.dir, B.dir)) <= COS_MATCH) return false;
  const { overlap, gap } = getEdgeOverlap(A, B);
  if (gap > MATCH_PLANE_GAP_M) return false;
  return overlap >= MATCH_MIN_OVERLAP_RATIO * Math.min(A.chord, B.chord);
}

/**
 * Same painted part? Both items from prepareMeshPaintMatchItem (same base
 * map frame).
 */
export function isSameMeshPaintPart(A, B) {
  if (!A || !B || A.partType !== B.partType) return false;
  if (!boxesTouch(A.box, B.box, MATCH_PLANE_GAP_M)) return false;
  return A.partType === MESH_PAINT_PART_TYPES.FACE
    ? isSameFace(A, B)
    : isSameEdge(A, B);
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
