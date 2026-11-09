// Re-entrant edges BETWEEN hosts: the base edges of a host's vertical faces
// (a low wall, a podium — oriented EXTERIOR, normals toward the air) that lie
// on a horizontal up-facing face of a support host (a deck sheet, a low wall
// top). A probe point a few millimetres in front of the face, at the edge
// level, must fall inside the support face (contour minus holes, in XY).
//
// Pure (no three.js), node-testable.

import { add, scale } from "../../threedMesh/utils/vec3Utils.js";

import {
  DEFAULT_QTES_THRESHOLDS,
  isVerticalNormal,
  meanZ,
} from "./classifyHostPartsByRules.js";

const PROBE_STEP_M = 0.005;

export function pointInRingXY(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const crosses =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-300) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInPolygonsXY(p, polygons) {
  for (const polygon of polygons || []) {
    if (!pointInRingXY(p, polygon.contour || [])) continue;
    if ((polygon.holes || []).some((hole) => pointInRingXY(p, hole))) continue;
    return true;
  }
  return false;
}

/**
 * @param {object} args
 * @param {{hostId, islands}} args.host oriented EXTERIOR host
 * @param {Array<{hostId, islands}>} args.supports oriented support hosts
 * @param {object} [args.thresholds]
 * @returns {Array<{hostId, points:[a,b], sides:[nV, nS], length}>}
 */
export default function findBaseEdgesOnSupports({
  host,
  supports,
  thresholds = DEFAULT_QTES_THRESHOLDS,
}) {
  const out = [];
  const supportFaces = (supports || [])
    .filter((support) => support.hostId !== host.hostId)
    .flatMap((support) =>
      (support.islands || [])
        .filter((island) => (island.normal?.z ?? 0) > thresholds.TOP_NZ_MIN)
        .map((island) => ({ island, z: meanZ(island) }))
    );
  if (!supportFaces.length) return out;

  for (const island of host.islands || []) {
    if (!isVerticalNormal(island.normal, thresholds)) continue;
    const loops = (island.polygons || []).flatMap((polygon) => [
      polygon.contour || [],
      ...(polygon.holes || []),
    ]);
    const zMin = Math.min(...loops.flat().map((p) => p.z));
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        if (
          Math.abs(a.z - zMin) > thresholds.LEVEL_TOL_M ||
          Math.abs(b.z - zMin) > thresholds.LEVEL_TOL_M
        ) {
          continue;
        }
        const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        if (!(len > 1e-6)) continue;
        const m = scale(add(a, b), 0.5);
        const q = add(m, scale(island.normal, PROBE_STEP_M));
        const support = supportFaces.find(
          ({ island: s, z }) =>
            Math.abs(z - m.z) <= thresholds.PLANE_TOL_M &&
            pointInPolygonsXY(q, s.polygons)
        );
        if (!support) continue;
        out.push({
          hostId: host.hostId,
          points: [{ ...a }, { ...b }],
          sides: [{ ...island.normal }, { ...support.island.normal }],
          length: len,
        });
      }
    }
  }
  return out;
}
