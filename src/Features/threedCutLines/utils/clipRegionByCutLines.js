import computeFaceArea from "../../threedMesh/utils/computeFaceArea.js";
import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import extractRegionBoundaryLoops from "../../threedMesh/utils/extractRegionBoundaryLoops.js";
import partitionTrisByDihedralAngle from "../../threedMesh/utils/partitionTrisByDihedralAngle.js";
import {
  liftPointTo3d,
  projectLoopTo2d,
} from "../../threedMesh/utils/planeProjection.js";
import splitTrisIntoComponents from "../../threedMesh/utils/splitTrisIntoComponents.js";
import { dot, length, scale, sub } from "../../threedMesh/utils/vec3Utils.js";
import clipFaceByCutLines, {
  polygonCentroid2dWithHoles,
} from "./clipFaceByCutLines.js";
import findCutPieceAt from "./findCutPieceAt.js";

// Pieces of a face REGION (planar or faceted — a hovered region of
// getFaceRegion grown across the facets of a curved surface) delimited by
// the CUT_LINE polylines lying on it.
//
// The region is first split into its planar facets (dihedral angle ≤
// `facetAngleDeg` between neighbors), each facet into one face per
// edge-connected component, and every face is clipped on its own plane by
// clipFaceByCutLines. The pieces of neighboring facets are then joined back
// across the crease edges they share: two pieces of two facets whose
// boundaries run along the same crease edge over more than `minOverlap`
// form one GROUP — unless a cut line runs along that overlap (a line drawn
// on a crease separates the two sides). The pieces of ONE facet never join
// (they only share cut edges). A group is what the hover highlights and what
// a click or « Mailler » turns into a maille.
//
// positions / tris: world triangle soup of the region (buildWorldSoup).
// cutLines: [[{x,y,z}]] world polylines.
//
// Returns null when the region is degenerate, else
// { facets, pieces, groups, joins, locate } — pieces: [{ contour, holes,
// normal, area, centroid, facetIndex, cut }] (cut: the piece is bounded by a
// cut line); groups: [{ pieceIndices, area, cut }] (cut: at least one of its
// pieces is); joins: [{ pieceA, pieceB, crease: { origin, dir, len }, lo,
// hi }] — the pairs of pieces joined across a crease edge, over the abscissa
// interval [lo, hi] of that edge; locate(triIndex, point): { pieceIndex,
// groupIndex } of the piece of the facet of `triIndex` (a soup triangle
// index) holding `point`, null when none.
//
// Pure (no three.js), node-tested.
export default function clipRegionByCutLines({
  positions,
  tris,
  cutLines,
  // Facet split: ~float noise, every real fold separates (0.1° like the
  // Pinceau's BRUSH_FACE_ANGLE_DEG).
  facetAngleDeg = 0.1,
  // A boundary edge lies on a crease when both its ends are within this of
  // the crease line (meters).
  lineTolerance = 1e-3,
  // Minimum shared crease length for two pieces to join (meters): touching
  // corners never join.
  minOverlap = 5e-3,
} = {}) {
  if (!positions || !tris?.length) return null;
  const lines = (cutLines || []).filter((line) => line?.length >= 2);

  const { parts, edges } = partitionTrisByDihedralAngle({
    positions,
    index: null,
    tris,
    angleDeg: facetAngleDeg,
  });
  if (!parts.length) return null;

  // 1. Facets: one face per edge-connected component of each planar part.
  const facets = [];
  const facetOfTri = new Map();
  for (const partTris of parts) {
    for (const componentTris of splitTrisIntoComponents({
      positions,
      index: null,
      tris: partTris,
    })) {
      const face = extractRegionBoundaryLoops({
        positions,
        index: null,
        tris: componentTris,
      });
      if (!face) continue;
      const facetIndex = facets.length;
      facets.push({ tris: componentTris, face, clip: null, pieceIndices: [] });
      for (const t of componentTris) facetOfTri.set(t, facetIndex);
    }
  }
  if (!facets.length) return null;

  // 2. Pieces: the face clipped by the lines, or the whole face.
  const pieces = [];
  facets.forEach((facet, facetIndex) => {
    const clip = lines.length
      ? clipFaceByCutLines({ face: facet.face, cutLines: lines })
      : null;
    facet.clip = clip;
    if (clip?.pieces?.length) {
      for (const piece of clip.pieces) {
        facet.pieceIndices.push(pieces.length);
        pieces.push({ ...piece, facetIndex, cut: true });
      }
      return;
    }
    facet.pieceIndices.push(pieces.length);
    pieces.push(wholeFacePiece(facet.face, facetIndex));
  });

  // 3. Union-find over the pieces, joined across the crease edges.
  const parent = pieces.map((_, i) => i);
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };
  const union = (i, j) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
  };

  // Crease joins: the pieces united across a crease, with the crease frame
  // and the shared abscissa interval — what unfolds a group flat
  // (threedMesh/utils/unfoldPiecesAcrossCreases).
  const joins = [];
  for (const edge of edges) {
    if (edge.tris.length !== 2) continue; // free or non-manifold edge
    const fa = facetOfTri.get(edge.tris[0]);
    const fb = facetOfTri.get(edge.tris[1]);
    if (fa === undefined || fb === undefined || fa === fb) continue;
    const crease = buildCreaseFrame(edge.a, edge.b);
    if (!crease) continue;
    const covered = cutLineIntervals(lines, crease, lineTolerance);
    const spansA = pieceSpansOnCrease(
      pieces,
      facets[fa].pieceIndices,
      crease,
      lineTolerance,
      minOverlap
    );
    const spansB = pieceSpansOnCrease(
      pieces,
      facets[fb].pieceIndices,
      crease,
      lineTolerance,
      minOverlap
    );
    for (const a of spansA) {
      for (const b of spansB) {
        const lo = Math.max(a.lo, b.lo);
        const hi = Math.min(a.hi, b.hi);
        if (hi - lo <= minOverlap) continue;
        const free = hi - lo - coveredLength(lo, hi, covered);
        if (free > minOverlap) {
          union(a.pieceIndex, b.pieceIndex);
          joins.push({
            pieceA: a.pieceIndex,
            pieceB: b.pieceIndex,
            crease,
            lo,
            hi,
          });
        } else {
          // A cut line runs along the crease: the line bounds both pieces.
          pieces[a.pieceIndex].cut = true;
          pieces[b.pieceIndex].cut = true;
        }
      }
    }
  }

  const groups = [];
  const groupOfRoot = new Map();
  const groupOfPiece = new Array(pieces.length);
  pieces.forEach((piece, pieceIndex) => {
    const root = find(pieceIndex);
    let groupIndex = groupOfRoot.get(root);
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      groupOfRoot.set(root, groupIndex);
      groups.push({ pieceIndices: [], area: 0, cut: false });
    }
    const group = groups[groupIndex];
    group.pieceIndices.push(pieceIndex);
    group.area += piece.area;
    group.cut = group.cut || piece.cut;
    groupOfPiece[pieceIndex] = groupIndex;
  });

  const locate = (triIndex, point) => {
    const facetIndex = facetOfTri.get(triIndex);
    if (facetIndex === undefined) return null;
    const facet = facets[facetIndex];
    let pieceIndex;
    if (facet.clip) {
      const local = findCutPieceAt(facet.clip, point);
      if (local < 0) return null;
      pieceIndex = facet.pieceIndices[local];
    } else {
      // The ray hit a triangle of this facet: the point is on its face.
      pieceIndex = facet.pieceIndices[0];
    }
    if (pieceIndex === undefined) return null;
    return { pieceIndex, groupIndex: groupOfPiece[pieceIndex] };
  };

  return { facets, pieces, groups, joins, locate };
}

// The uncut face as a piece, with the same area / centroid as a clipped one.
function wholeFacePiece(face, facetIndex) {
  const basis = computePlaneBasis(face.normal, face.contour[0]);
  const contour2d = projectLoopTo2d(face.contour, basis);
  const holes2d = (face.holes || []).map((hole) =>
    projectLoopTo2d(hole, basis)
  );
  return {
    contour: face.contour,
    holes: face.holes || [],
    normal: { ...face.normal },
    area: computeFaceArea(face),
    centroid: liftPointTo3d(
      polygonCentroid2dWithHoles(contour2d, holes2d),
      basis
    ),
    facetIndex,
    cut: false,
  };
}

// Abscissa frame of a crease edge: origin a, unit direction, length.
function buildCreaseFrame(a, b) {
  const d = sub(b, a);
  const len = length(d);
  if (len < 1e-9) return null;
  return { origin: a, dir: scale(d, 1 / len), len };
}

// Abscissa of p along the crease and its distance to the crease LINE.
function creaseCoords(p, crease) {
  const d = sub(p, crease.origin);
  const s = dot(d, crease.dir);
  const off = length(sub(d, scale(crease.dir, s)));
  return { s, off };
}

// Interval [lo, hi] of the segment p-q along the crease, clamped to the
// crease; null when the segment does not lie on the crease line.
function segmentIntervalOnCrease(p, q, crease, tolerance) {
  const cp = creaseCoords(p, crease);
  const cq = creaseCoords(q, crease);
  if (cp.off > tolerance || cq.off > tolerance) return null;
  const lo = Math.max(0, Math.min(cp.s, cq.s));
  const hi = Math.min(crease.len, Math.max(cp.s, cq.s));
  return hi > lo ? { lo, hi } : null;
}

// Spans [{ pieceIndex, lo, hi }] of the boundary edges of the given pieces
// lying along the crease.
function pieceSpansOnCrease(pieces, pieceIndices, crease, tolerance, minLen) {
  const spans = [];
  for (const pieceIndex of pieceIndices) {
    const piece = pieces[pieceIndex];
    for (const loop of [piece.contour, ...(piece.holes || [])]) {
      for (let i = 0; i < loop.length; i++) {
        const interval = segmentIntervalOnCrease(
          loop[i],
          loop[(i + 1) % loop.length],
          crease,
          tolerance
        );
        if (interval && interval.hi - interval.lo > minLen) {
          spans.push({ pieceIndex, ...interval });
        }
      }
    }
  }
  return spans;
}

// Merged intervals of the cut line segments running along the crease.
function cutLineIntervals(lines, crease, tolerance) {
  const intervals = [];
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const interval = segmentIntervalOnCrease(
        line[i],
        line[i + 1],
        crease,
        tolerance
      );
      if (interval) intervals.push(interval);
    }
  }
  intervals.sort((i1, i2) => i1.lo - i2.lo);
  const merged = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.lo <= last.hi)
      last.hi = Math.max(last.hi, interval.hi);
    else merged.push({ ...interval });
  }
  return merged;
}

// Length of [lo, hi] covered by the merged intervals.
function coveredLength(lo, hi, merged) {
  let sum = 0;
  for (const m of merged) {
    const l = Math.max(lo, m.lo);
    const h = Math.min(hi, m.hi);
    if (h > l) sum += h - l;
  }
  return sum;
}
