// splitArcOnInsert
//
// Insert a new point ref into a point-ref path right after a given segment
// start. If that segment is one half of an S-C-S arc (square → circle →
// square), the inserted square would straighten the sub-arc that loses its
// control point (S-S-C-S). To preserve the curve we ALSO insert a fresh circle
// control at the midpoint of the orphaned sub-arc, splitting the arc into two
// arcs that share the new anchor: S-C-S-C-S.
//
// Pure & synchronous. Circle math is done in PIXEL space (normalization is
// anisotropic), so the caller resolves ref ids to pixel coords via getPx and
// normalizes the returned `newCircle` before persisting it to db.points.
//
// Extracted from useHandleCompleteAnnotation.insertCutPoint so the same arc
// preservation can be reused by every point-insertion path (snap-click split,
// projection-snap drag, opening cuts, …).

import { typeOf, circleFromThreePoints, sampleArcPoints } from "./arcSampling";

/**
 * @param {Object} args
 * @param {Array<{id:string,type?:string}>} args.points  point refs to insert into
 * @param {number} args.segmentStartIndex  index of the segment start in `points`
 *   (the new point is inserted right after it; segment spans index → index+1)
 * @param {{id:string,type?:string}} args.newRef  ref to splice in (a square)
 * @param {{x:number,y:number}} args.newPx  inserted point, pixel space
 * @param {(id:string)=>({x:number,y:number}|undefined)} args.getPx  pixel resolver
 * @param {boolean} [args.closed=false]  cyclic neighbour lookup for closed rings
 * @param {()=>string} args.makeId  fresh id generator for the new circle control
 * @returns {{ points: Array, newCircle: {id:string,x:number,y:number}|null }}
 *   `newCircle` is the circle control to persist (pixel space), or null when the
 *   segment is not part of an arc (plain insertion).
 */
export default function splitArcOnInsert({
  points,
  segmentStartIndex,
  newRef,
  newPx,
  getPx,
  closed = false,
  makeId,
}) {
  const sIdx = segmentStartIndex;
  if (sIdx == null || sIdx < 0 || sIdx >= points.length) {
    return { points, newCircle: null };
  }

  const n = points.length;
  const at = (i) => (closed ? points[((i % n) + n) % n] : points[i]);

  const startRef = at(sIdx);
  const endRef = at(sIdx + 1);

  // Always insert the new ref right after the segment start.
  let next = [
    ...points.slice(0, sIdx + 1),
    newRef,
    ...points.slice(sIdx + 1),
  ];

  // Identify the S-C-S triplet the new point falls inside, if any.
  let triplet = null; // { S, C, S2, half: "S" | "S2" }
  if (typeOf(startRef) !== "circle" && endRef && typeOf(endRef) === "circle") {
    // segment S → C, point on the S-half. S2 is the point after C.
    const s2Ref = at(sIdx + 2);
    if (s2Ref && typeOf(s2Ref) !== "circle") {
      triplet = { S: startRef, C: endRef, S2: s2Ref, half: "S" };
    }
  } else if (
    typeOf(startRef) === "circle" &&
    endRef &&
    typeOf(endRef) !== "circle"
  ) {
    // segment C → S2, point on the S2-half. S is the point before C.
    const sRef = at(sIdx - 1);
    if (sRef && typeOf(sRef) !== "circle") {
      triplet = { S: sRef, C: startRef, S2: endRef, half: "S2" };
    }
  }

  if (!triplet) return { points: next, newCircle: null };

  const Spx = getPx(triplet.S.id);
  const Cpx = getPx(triplet.C.id);
  const S2px = getPx(triplet.S2.id);
  if (!Spx || !Cpx || !S2px) return { points: next, newCircle: null };

  const circ = circleFromThreePoints(Spx, Cpx, S2px);
  if (!circ || !Number.isFinite(circ.r) || !(circ.r > 0)) {
    return { points: next, newCircle: null };
  }

  const cross =
    (Cpx.x - Spx.x) * (S2px.y - Spx.y) - (Cpx.y - Spx.y) * (S2px.x - Spx.x);
  const isCW = cross > 0;

  // Midpoint of the sub-arc that lost its control point.
  const midPx =
    triplet.half === "S"
      ? sampleArcPoints(Spx, newPx, circ.center, circ.r, isCW, 2)[0]
      : sampleArcPoints(newPx, S2px, circ.center, circ.r, isCW, 2)[0];
  if (!midPx) return { points: next, newCircle: null };

  const mId = makeId();
  // S-half: insert M just before the new point (S, M, new). S2-half: insert M
  // just before S2 (new, M, S2).
  const beforeId = triplet.half === "S" ? newRef.id : triplet.S2.id;
  const insertIdx = next.findIndex((p) => p.id === beforeId);
  if (insertIdx === -1) return { points: next, newCircle: null };

  next = [
    ...next.slice(0, insertIdx),
    { id: mId, type: "circle" },
    ...next.slice(insertIdx),
  ];

  return {
    points: next,
    newCircle: { id: mId, x: midPx.x, y: midPx.y },
  };
}
