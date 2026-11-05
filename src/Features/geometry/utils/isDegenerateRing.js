// Explicit .js extensions (and relative paths) so the plain-node test harness
// can import this module without a bundler.
import { adaptiveArcSamples, expandRingWithOffsets } from "./arcSampling.js";
import signedArea2 from "./signedArea2.js";

// Area below this fraction of the ring's squared bbox diagonal is "no area".
// Relative, so the test holds in pixels as well as in meters.
const DEGENERATE_AREA_RATIO = 1e-9;

/**
 * True when a closed ring encloses no area: fewer than 3 points, every point
 * at the same place, or all points aligned. The area is measured on the ring
 * with its arcs expanded ("circle" control points), so a circle made of 2
 * squares + 2 circles is not mistaken for a flat ring.
 *
 * Such a ring carves nothing as a hole, and earcut throws on it
 * (eliminateHoles reads a node of an empty linked list) — callers must drop it
 * before the triangulation.
 *
 * @param {Array<{x:number, y:number, type?:string}>} ring
 * @returns {boolean}
 */
export default function isDegenerateRing(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return true;

  const expanded = expandRingWithOffsets(ring, adaptiveArcSamples, true);
  if (!expanded || expanded.length < 3) return true;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of expanded) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return true;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const diagonal2 = (maxX - minX) ** 2 + (maxY - minY) ** 2;

  return Math.abs(signedArea2(expanded)) <= DEGENERATE_AREA_RATIO * diagonal2;
}
