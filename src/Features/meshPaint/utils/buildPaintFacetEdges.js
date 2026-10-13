import { length, scale } from "../../threedMesh/utils/vec3Utils.js";

import { getPolygonNormal, isCurvedFace } from "./meshPaintGeometry.js";

// Grid lines of a painted CURVED face (« Afficher le maillage 3D »): the
// boundary of every facet the paint stores (one coplanar island of the host
// per polygon — a lathe quad, a sampled-arc strip), lifted by `lift` meters
// along the facet's own normal so the lines sit above the paint skin. The
// result mirrors the host's EdgesGeometry at the 1° tessellation threshold,
// which the opaque paint hides.
//
// Seams shared by two facets are emitted ONCE (quantized key, like
// buildWallEdges) so the 50 % black stroke keeps its opacity. A flat face has
// no facet seam: its only loop is the paint's outline, which is not a grid
// helper, so it yields no segment.
//
// Pure (no three): node-testable.

const QUANT = 1e4;

function keyOf(p) {
  return `${Math.round(p.x * QUANT)},${Math.round(p.y * QUANT)},${Math.round(p.z * QUANT)}`;
}

/**
 * @param {{polygons: [{contour, holes}], curved?: boolean}} localFace
 * @param {{lift?: number}} [options] lift: meters along each facet normal.
 * @returns {Float32Array} line segments, 6 floats per segment (a, b).
 */
export default function buildPaintFacetEdges(localFace, { lift = 0 } = {}) {
  if (!isCurvedFace(localFace)) return new Float32Array(0);
  const out = [];
  const seen = new Set();
  for (const polygon of localFace?.polygons || []) {
    const normal = getPolygonNormal(polygon);
    if (!normal || length(normal) === 0) continue;
    const offset = scale(normal, lift);
    for (const loop of [polygon.contour, ...(polygon.holes || [])]) {
      const n = loop?.length || 0;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const p = loop[i];
        const q = loop[(i + 1) % n];
        if (!p || !q) continue;
        const kp = keyOf(p);
        const kq = keyOf(q);
        if (kp === kq) continue;
        const key = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(
          p.x + offset.x,
          p.y + offset.y,
          p.z + offset.z,
          q.x + offset.x,
          q.y + offset.y,
          q.z + offset.z
        );
      }
    }
  }
  return new Float32Array(out);
}
