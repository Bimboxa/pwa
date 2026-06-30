import getAnnotationVertices from "Features/annotations/utils/getAnnotationVertices";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import { getBbox } from "Features/mesh/utils/meshGeometry";

import classifyRepairType from "./classifyRepairType";
import smoothPolyline from "./smoothPolyline";
import spliceJunction from "./spliceJunction";
import buildCenterlineRepair from "./buildCenterlineRepair";
import untangleRing from "./untangleRing";
import isSimpleRing from "./isSimpleRing";

// Build the localized-repair proposal from the concerned annotations.
//
// Returns { proposalMatches, plan }:
//   - proposalMatches: green-preview geometry in pixel space, in the
//     TransientDetectedPatternLayer format
//     [{ polylines: [{ points:[{x,y}], closed }] }].
//   - plan: the payload consumed by useCommitLocalizedRepair (null when there
//     is nothing to repair).
//
// Coordinate space: everything here is local pixel space (the resolved
// annotation geometry). Normalization to [0..1] happens at commit time.
//
// A single self-intersecting closed outline is a tangle of two strips drawn as one
// loop: it is UNTANGLED into its constituent simple loops (untangleRing) and SPLIT
// into separate annotations — the largest loop keeps the original id, the others
// become new annotations. Multiple concerned closed outlines meeting tip-vs-flank
// are joined by the projection splice (see spliceJunction). Wall polylines stored
// as thin centerlines are first turned into their thickness outline (a plain ribbon
// construction). SMOOTH simplifies each concerned (simple) polyline in place.

function thicknessPxOf(ann, meterByPx) {
  const w = ann?.strokeWidth;
  if (!w || w <= 0) return 8;
  const unit = ann?.strokeWidthUnit;
  if (unit === "CM") return meterByPx > 0 ? w / 100 / meterByPx : 8;
  if (unit === "M") return meterByPx > 0 ? w / meterByPx : 8;
  return w; // PX or unknown → treat as pixels
}

// Centered ribbon ring around an open polyline centerline (width T).
function inflatePolylineRing(pts, T) {
  if (!pts || pts.length < 2 || T <= 0) return null;
  const half = T / 2;
  const left = offsetPolyline(pts, half);
  const right = offsetPolyline(pts, -half);
  if (left.length < 2 || right.length < 2) return null;
  return [
    ...left.map((p) => ({ x: p.x, y: p.y })),
    ...right.reverse().map((p) => ({ x: p.x, y: p.y })),
  ];
}

// Drop a repeated closing point (some outlines store first === last).
function dropClosingDuplicate(verts) {
  if (verts.length >= 2) {
    const a = verts[0];
    const b = verts[verts.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) return verts.slice(0, -1);
  }
  return verts;
}

// An annotation is a closed outline when it is a POLYGON, has closeLine, or its
// points form a closed ring by repeating the first point at the end.
function isClosedOutline(ann, verts) {
  if (ann.type === "POLYGON" || ann.closeLine === true) return true;
  if (verts.length >= 4) {
    const a = verts[0];
    const b = verts[verts.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) return true;
  }
  return false;
}

// Pixel-space closed ring representing the annotation footprint.
function ringPxOf(ann, meterByPx) {
  const verts = getAnnotationVertices(ann).map((p) => ({ x: p.x, y: p.y }));
  if (verts.length < 2) return null;
  if (isClosedOutline(ann, verts)) {
    const ring = dropClosingDuplicate(verts);
    return ring.length >= 3 ? ring : null;
  }
  // Open centerline → build its thickness outline (plain ribbon, not a fusion).
  return inflatePolylineRing(verts, thicknessPxOf(ann, meterByPx));
}

function ringShortSide(ring) {
  const bb = getBbox(ring);
  return Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY);
}

function ringArea(ring) {
  const bb = getBbox(ring);
  return (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
}

export default function buildRepairProposal({
  annotations,
  repairMode,
  meterByPx,
  rect,
}) {
  const empty = { proposalMatches: [], plan: null };
  if (!Array.isArray(annotations) || annotations.length === 0) return empty;

  const repairType = classifyRepairType(annotations, {
    forcedType: repairMode,
  });

  // ── SMOOTH: simplify each concerned polyline in place ──────────────────
  if (repairType === "SMOOTH") {
    // A single self-intersecting closed outline is two strips drawn as one tangled
    // loop: UNTANGLE it into its constituent simple loops and SPLIT into separate
    // annotations (largest keeps the id, the rest become new annotations).
    if (annotations.length === 1) {
      const ann = annotations[0];
      if (ann.type === "POLYGON" || ann.closeLine === true) {
        const ring = ringPxOf(ann, meterByPx);
        if (ring && ring.length >= 3 && !isSimpleRing(ring)) {
          const loops = untangleRing(ring, rect);
          if (loops && loops.length >= 2) {
            const [winnerLoopPx, ...rest] = loops;
            const plan = {
              repairType: "SPLIT",
              winnerId: ann.id,
              winnerProjectId: ann.projectId,
              winnerBaseMapId: ann.baseMapId,
              winnerLoopPx,
              newLoops: rest.map((loopPx) => ({ loopPx })),
            };
            const proposalMatches = loops.map((points) => ({
              polylines: [{ points, closed: true }],
            }));
            return { proposalMatches, plan };
          }
        }
      }
    }

    const updates = [];
    const proposalMatches = [];
    for (const ann of annotations) {
      const verts = getAnnotationVertices(ann).map((p) => ({ x: p.x, y: p.y }));
      if (verts.length < 3) continue; // nothing to smooth (e.g. 2-pt wall)
      const closed = ann.type === "POLYGON" || ann.closeLine === true;
      const cleaned = smoothPolyline(verts, { closed });
      if (!cleaned || cleaned.length >= verts.length) continue; // no change
      if (cleaned.length < (closed ? 3 : 2)) continue;
      const pointsPx = cleaned.map((p) => ({ x: p.x, y: p.y }));
      updates.push({
        id: ann.id,
        pointsPx,
        projectId: ann.projectId,
        baseMapId: ann.baseMapId,
      });
      proposalMatches.push({ polylines: [{ points: pointsPx, closed }] });
    }
    if (updates.length === 0) return empty;
    return { proposalMatches, plan: { repairType: "SMOOTH", updates } };
  }

  // ── L / T: direct projection + splice (no polygon fusion) ──────────────
  if (annotations.length < 2) return empty;

  // (a) Centerline repair first — for OPEN polylines (axes / U shapes), project
  // each free endpoint inside the selection onto the nearest target line. This
  // connects every branch (e.g. both arms of a U) in one pass, no merge.
  const clUpdates = buildCenterlineRepair({ annotations, rect });
  if (clUpdates.length > 0) {
    const proposalMatches = clUpdates.map((u) => ({
      polylines: [{ points: u.pointsPx, closed: u.closed }],
    }));
    const plan = {
      repairType,
      updates: clUpdates.map((u) => ({
        id: u.ann.id,
        pointsPx: u.pointsPx,
        projectId: u.ann.projectId,
        baseMapId: u.ann.baseMapId,
      })),
    };
    return { proposalMatches, plan };
  }

  // (b) Closed outlines.
  const items = [];
  annotations.forEach((ann) => {
    const ring = ringPxOf(ann, meterByPx);
    if (ring && ring.length >= 3) items.push({ ann, ring });
  });
  if (items.length < 2) return empty;

  // Winner (kept annotation, keeps its id + template) = largest by bbox area.
  let winnerIdx = 0;
  let bestArea = -1;
  items.forEach((it, i) => {
    const area = ringArea(it.ring);
    if (area > bestArea) {
      bestArea = area;
      winnerIdx = i;
    }
  });
  const winner = items[winnerIdx];

  // Tip-vs-flank L/T join: fold every other concerned ring into the winner.
  const minShort = Math.min(...items.map((it) => ringShortSide(it.ring)));
  const maxGap = Math.max(20, 0.6 * minShort);
  let current = winner.ring;
  const deleteIds = [];
  for (let i = 0; i < items.length; i++) {
    if (i === winnerIdx) continue;
    const abut = items[i].ring;
    const merged =
      spliceJunction(current, abut, { maxGap }) ||
      spliceJunction(abut, current, { maxGap }); // reverse try
    if (merged && merged.length >= 3) {
      current = merged;
      deleteIds.push(items[i].ann.id);
    }
  }
  if (deleteIds.length === 0) return empty;

  const plan = {
    repairType,
    winnerId: winner.ann.id,
    winnerProjectId: winner.ann.projectId,
    winnerBaseMapId: winner.ann.baseMapId,
    deleteIds,
    mergedRingPx: current,
  };
  const proposalMatches = [{ polylines: [{ points: current, closed: true }] }];
  return { proposalMatches, plan };
}
