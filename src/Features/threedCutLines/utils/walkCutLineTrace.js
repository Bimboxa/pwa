import { cross, dot, normalize, scale, sub } from "./vec3.js";

// Rise under this (unit vectors) is "flat".
const RISE_EPS = 1e-3;
// Intermediate vertices turning less than this are triangulation artefacts.
const COS_STRAIGHT = Math.cos((0.5 * Math.PI) / 180);
// Tie tolerance on dot products when ranking candidates.
const TIE_EPS = 1e-6;

// Drop intermediate vertices where the polyline does not really turn (the
// section of a planar face is chopped at every triangulation edge). Each
// kept point is compared to the LAST KEPT one so tiny drifts never add up.
function simplifyChain(chain) {
  if (chain.length < 3) return chain;
  const out = [chain[0]];
  for (let i = 1; i < chain.length - 1; i++) {
    const u = normalize(sub(chain[i], out[out.length - 1]));
    const v = normalize(sub(chain[i + 1], chain[i]));
    if (u && v && dot(u, v) > COS_STRAIGHT) continue;
    out.push(chain[i]);
  }
  out.push(chain[chain.length - 1]);
  return out;
}

// Walk the section graph from `startKey` along `direction`, following the
// faces met (concave AND convex turns), and return the points added AFTER the
// start node (the start itself is not returned).
//
//   graph      = buildSectionGraph output (startKey inserted by locateOnGraph)
//   direction  = d0, unit-ish direction leaving the drawn polyline
//   faceNormal = n0, normal of the face the start sits on (towards the viewer)
//   planeNormal (optional) = normal of the cutting plane; cross(d0, n0) when
//                omitted. Its sign is irrelevant.
//   maxPoints  = cap on the returned (SIMPLIFIED) points — the section of a
//                curved surface goes through ~2 raw nodes per quad, a raw cap
//                would stop a trace two thirds of the way up a sheet
//   maxRawPoints = safety cap on the raw walk (loops are already prevented by
//                the visited set)
//   allowPerpendicularStart (optional) = accept a first step perpendicular to
//                `direction` (a walk started on a node found by locateNodeNear:
//                the drawn line ends at the foot of a sheet, whose section
//                leaves the end point straight up)
//   visited    (optional) = Set of node keys to treat as already visited; it
//                is MUTATED with every node the walk goes through, so a second
//                walk on the same graph can share it.
//
// State (cur, dir, n). At each node the candidates are the unvisited
// neighbors (never the node we came from); t_out = unit direction to the
// candidate, rise = dot(t_out, n). Classes: concave (rise > 1e-3) beats flat
// (|rise| <= 1e-3) beats convex (rise < -1e-3); ties go to the largest
// dot(t_out, d0), then to the smallest angle with `dir`. No candidate → stop
// (free edge, or every neighbor already visited: a loop).
//
// After a step, `n` becomes the normal carried by the edge taken, re-signed
// so that it keeps pointing to the same side of the trace as n0 did (same
// handedness vs the cutting plane: dot(n, cross(b, dir)) > 0 with b the plane
// normal oriented by n0 and d0). The literal "dot(n_next, previous dir) <= 0"
// rule gives the air-side normal at concave corners but the material-side one
// at convex corners, which would invert the classes after walking over a
// ridge — hence the handedness rule.
export default function walkCutLineTrace(
  graph,
  {
    startKey,
    direction,
    faceNormal,
    planeNormal = null,
    maxPoints = 64,
    maxRawPoints = 4096,
    allowPerpendicularStart = false,
    visited,
  }
) {
  const nodes = graph?.nodes;
  const start = nodes?.get(startKey);
  const d0 = normalize(direction);
  const n0 = normalize(faceNormal);
  if (!start || !d0 || !n0) return [];

  // Cutting-plane normal oriented so that cross(b, dir) is the air side.
  let b = normalize(planeNormal) ?? normalize(cross(d0, n0));
  if (!b) return [];
  const sideSign = dot(n0, cross(b, d0));
  if (Math.abs(sideSign) < 1e-9) return [];
  if (sideSign < 0) b = scale(b, -1);

  const seen = visited instanceof Set ? visited : new Set();
  seen.add(startKey);

  const chain = [start.position];
  let cur = startKey;
  let prev = null;
  let dir = d0;
  let n = n0;

  // A perpendicular first step has dot(tOut, d0) = 0 up to float noise.
  const firstStepMin = allowPerpendicularStart ? -1e-6 : 0;

  while (chain.length - 1 < maxRawPoints) {
    const node = nodes.get(cur);
    const candidates = [];
    const keysSeen = new Set();
    for (const nb of node.neighbors) {
      if (nb.key === prev || seen.has(nb.key) || keysSeen.has(nb.key)) continue;
      const target = nodes.get(nb.key);
      if (!target) continue;
      const tOut = normalize(sub(target.position, node.position));
      if (!tOut) continue;
      // The first step leaves the drawn polyline, never goes back along it.
      if (prev === null && dot(tOut, d0) <= firstStepMin) continue;
      keysSeen.add(nb.key);
      const rise = dot(tOut, n);
      const cls = rise > RISE_EPS ? 2 : rise < -RISE_EPS ? 0 : 1;
      candidates.push({
        key: nb.key,
        tOut,
        normal: nb.normal,
        cls,
        along: dot(tOut, d0),
        straight: dot(tOut, dir),
      });
    }
    if (candidates.length === 0) break;

    candidates.sort((p, q) => {
      if (p.cls !== q.cls) return q.cls - p.cls;
      if (Math.abs(p.along - q.along) > TIE_EPS) return q.along - p.along;
      return q.straight - p.straight;
    });
    const pick = candidates[0];

    seen.add(pick.key);
    chain.push(nodes.get(pick.key).position);

    const inPlane = normalize(cross(b, pick.tOut));
    let nNext = normalize(pick.normal);
    if (!nNext || !inPlane) {
      nNext = inPlane ?? n;
    } else {
      const s = dot(nNext, inPlane);
      if (Math.abs(s) < 1e-6) nNext = inPlane;
      else if (s < 0) nNext = scale(nNext, -1);
    }

    prev = cur;
    cur = pick.key;
    dir = pick.tOut;
    n = nNext;
  }

  return simplifyChain(chain).slice(1, 1 + Math.max(0, maxPoints));
}
