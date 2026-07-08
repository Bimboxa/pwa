// splitArcAtControlPoint
//
// Demote an S-C-S arc control point (C) into a plain anchor so the path can be
// cut at that exact position. Removing the control alone would straighten the
// whole arc, so we ALSO insert two fresh circle controls at the midpoints of
// the two sub-arcs, sampled on the original circle: S-C-S2 → S-C'-A-C''-S2
// (A = former control, now a square anchor sharing the same db.points row).
//
// Pure & synchronous, same contract as splitArcOnInsert: circle math is done
// in PIXEL space, the caller resolves ref ids via getPx and normalizes the
// returned `newCircles` before persisting them to db.points.
//
// Degenerate cases (missing neighbours, neighbour is itself a circle, flat
// circle) fall back to the plain demotion: the arc renders straight, which is
// what the renderer does anyway for a broken S-C-S pattern.

import { typeOf, circleFromThreePoints, sampleArcPoints } from "./arcSampling";

/**
 * @param {Object} args
 * @param {Array<{id:string,type?:string}>} args.points  point refs of the path
 * @param {number} args.vertexIndex  index of the circle control ref in `points`
 * @param {(id:string)=>({x:number,y:number}|undefined)} args.getPx  pixel resolver
 * @param {boolean} [args.closed=false]  cyclic neighbour lookup for closed rings
 * @param {()=>string} args.makeId  fresh id generator for the new circle controls
 * @returns {{ points: Array, newCircles: Array<{id:string,x:number,y:number}> }}
 *   `newCircles` are the circle controls to persist (pixel space).
 */
export default function splitArcAtControlPoint({
  points,
  vertexIndex,
  getPx,
  closed = false,
  makeId,
}) {
  const v = vertexIndex;
  if (v == null || v < 0 || v >= points.length) {
    return { points, newCircles: [] };
  }

  const cRef = points[v];
  if (typeOf(cRef) !== "circle") return { points, newCircles: [] };

  // Demote the control to a plain anchor (same id → same db.points row).
  const { type: _type, ...anchorRef } = cRef;
  const demoted = points.map((p, i) => (i === v ? anchorRef : p));

  const n = points.length;
  const at = (i) => (closed ? points[((i % n) + n) % n] : points[i]);
  const sRef = at(v - 1);
  const s2Ref = at(v + 1);
  if (
    !sRef ||
    !s2Ref ||
    typeOf(sRef) === "circle" ||
    typeOf(s2Ref) === "circle"
  ) {
    return { points: demoted, newCircles: [] };
  }

  const Spx = getPx(sRef.id);
  const Cpx = getPx(cRef.id);
  const S2px = getPx(s2Ref.id);
  if (!Spx || !Cpx || !S2px) return { points: demoted, newCircles: [] };

  const circ = circleFromThreePoints(Spx, Cpx, S2px);
  if (!circ || !Number.isFinite(circ.r) || !(circ.r > 0)) {
    return { points: demoted, newCircles: [] };
  }

  const cross =
    (Cpx.x - Spx.x) * (S2px.y - Spx.y) - (Cpx.y - Spx.y) * (S2px.x - Spx.x);
  const isCW = cross > 0;

  const mid1 = sampleArcPoints(Spx, Cpx, circ.center, circ.r, isCW, 2)[0];
  const mid2 = sampleArcPoints(Cpx, S2px, circ.center, circ.r, isCW, 2)[0];

  const newCircles = [];
  let next = demoted;

  // Insert C'' after the anchor first so the anchor index stays valid for C'.
  if (mid2) {
    const id2 = makeId();
    next = [
      ...next.slice(0, v + 1),
      { id: id2, type: "circle" },
      ...next.slice(v + 1),
    ];
    newCircles.push({ id: id2, x: mid2.x, y: mid2.y });
  }
  if (mid1) {
    const id1 = makeId();
    next = [...next.slice(0, v), { id: id1, type: "circle" }, ...next.slice(v)];
    newCircles.push({ id: id1, x: mid1.x, y: mid1.y });
  }

  return { points: next, newCircles };
}
