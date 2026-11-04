import computePlaneBasis from "./computePlaneBasis.js";
import { projectPointTo2d } from "./planeProjection.js";
import { add, cross, dot, length, normalize, scale, sub } from "./vec3Utils.js";

// Unfolds ("développé") a group of planar pieces joined across crease edges
// (clipRegionByCutLines: `pieces` + `joins`) onto the plane of a ROOT piece.
//
// Best-first walk from the root across the joins (nearest crease to
// `rootPoint` first): every reached piece gets a rigid transform { R, t }
// (x' = R·x + t) that rotates it about the crease it shares with its parent
// until its normal matches the parent's — composed with the parent's own
// transform, so the piece ends up in the root plane, on the other side of
// the crease from its parent. For a child c of parent p joined on the crease
// (o, d):
//   o' = T_p(o), d' = R_p·d, a = R_p·n_c, b = R_p·n_p,
//   θ = atan2((a × b)·d', a·b), R_θ = rotation of θ about d',
//   R_c = R_θ·R_p, t_c = R_θ·(t_p − o') + o'.
// The facets of a region are consistently wound (the region grows on the
// SIGNED normal), so no side has to be chosen.
//
// A piece is unfolded once: a closed ribbon never wraps over itself, the
// unfolded region simply ends where the two branches of the walk would
// meet. A developable sheet (cylinder, cone, swept profile) unfolds exactly;
// on a doubly-curved one the creases off the walk's tree are not glued back
// (small gaps / overlaps between unfolded neighbors — accepted).
//
// pieces: [{ contour, holes, normal }] world; pieceIndices: the pieces of
// the group (default: all); joins: [{ pieceA, pieceB, crease: { origin, dir },
// lo, hi }]; frame: { origin, u, v, n } in-plane frame of the root piece
// (computeUserAxesFrame); rootPoint: world point the walk starts from.
//
// Returns Map(pieceIndex → node), node = { pieceIndex, parent, basis,
// transform: { R, t }, toAtlas(p2d), fromAtlas(q2d), worldToAtlas(P) } —
// `basis` is the piece's own plane basis (computePlaneBasis(normal,
// contour[0]), the frame of clipFaceByCutLines / triangulatePiece), toAtlas
// maps its 2D coordinates to the frame's (a 2D rotation + translation),
// fromAtlas is the inverse. Pure (no three.js), node-testable.
export default function unfoldPiecesAcrossCreases({
  pieces,
  pieceIndices,
  joins,
  rootPieceIndex,
  frame,
  rootPoint,
  maxPieces = 1500,
}) {
  const nodes = new Map();
  const rootPiece = pieces?.[rootPieceIndex];
  if (!rootPiece || !frame) return nodes;
  const allowed = new Set(pieceIndices ?? pieces.map((_, i) => i));
  if (!allowed.has(rootPieceIndex)) return nodes;
  const from = rootPoint ?? rootPiece.contour[0];

  // Adjacency: the longest join of every pair of pieces.
  const adjacency = new Map();
  const link = (a, b, join) => {
    let byOther = adjacency.get(a);
    if (!byOther) adjacency.set(a, (byOther = new Map()));
    const known = byOther.get(b);
    if (!known || join.hi - join.lo > known.hi - known.lo) byOther.set(b, join);
  };
  for (const join of joins || []) {
    if (!allowed.has(join.pieceA) || !allowed.has(join.pieceB)) continue;
    if (join.pieceA === join.pieceB) continue;
    link(join.pieceA, join.pieceB, join);
    link(join.pieceB, join.pieceA, join);
  }

  const heap = createMinHeap();
  const pushNeighbors = (pieceIndex) => {
    for (const [other, join] of adjacency.get(pieceIndex) || []) {
      if (nodes.has(other)) continue;
      const mid = add(
        join.crease.origin,
        scale(join.crease.dir, (join.lo + join.hi) / 2)
      );
      heap.push({
        priority: length(sub(mid, from)),
        pieceIndex: other,
        parent: pieceIndex,
        join,
      });
    }
  };

  nodes.set(
    rootPieceIndex,
    buildNode(rootPiece, rootPieceIndex, null, IDENTITY, frame)
  );
  pushNeighbors(rootPieceIndex);

  while (heap.size() && nodes.size < maxPieces) {
    const { pieceIndex, parent, join } = heap.pop();
    if (nodes.has(pieceIndex)) continue;
    const parentNode = nodes.get(parent);
    const transform = unfoldAcrossCrease(
      parentNode.transform,
      normalize(pieces[parent].normal),
      normalize(pieces[pieceIndex].normal),
      join.crease
    );
    nodes.set(
      pieceIndex,
      buildNode(pieces[pieceIndex], pieceIndex, parent, transform, frame)
    );
    pushNeighbors(pieceIndex);
  }
  return nodes;
}

const IDENTITY = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: { x: 0, y: 0, z: 0 } };

function applyR(R, v) {
  return {
    x: R[0] * v.x + R[1] * v.y + R[2] * v.z,
    y: R[3] * v.x + R[4] * v.y + R[5] * v.z,
    z: R[6] * v.x + R[7] * v.y + R[8] * v.z,
  };
}

function multiplyR(A, B) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[3 * r + c] =
        A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c];
    }
  }
  return out;
}

export function applyTransform(transform, p) {
  return add(applyR(transform.R, p), transform.t);
}

// Rodrigues rotation matrix of `angle` about the unit axis `d`.
function rotationAbout(d, cos, sin) {
  const k = 1 - cos;
  return [
    cos + d.x * d.x * k,
    d.x * d.y * k - d.z * sin,
    d.x * d.z * k + d.y * sin,
    d.y * d.x * k + d.z * sin,
    cos + d.y * d.y * k,
    d.y * d.z * k - d.x * sin,
    d.z * d.x * k - d.y * sin,
    d.z * d.y * k + d.x * sin,
    cos + d.z * d.z * k,
  ];
}

// Transform of a child piece (normal nChild) joined to a parent piece
// (normal nParent, transform parentTransform) across `crease`.
function unfoldAcrossCrease(parentTransform, nParent, nChild, crease) {
  const origin = applyTransform(parentTransform, crease.origin);
  const dir = normalize(applyR(parentTransform.R, crease.dir));
  const a = applyR(parentTransform.R, nChild);
  const b = applyR(parentTransform.R, nParent);
  const sin = dot(cross(a, b), dir);
  const cos = dot(a, b);
  const norm = Math.hypot(sin, cos) || 1;
  const rotation = rotationAbout(dir, cos / norm, sin / norm);
  return {
    R: multiplyR(rotation, parentTransform.R),
    t: add(applyR(rotation, sub(parentTransform.t, origin)), origin),
  };
}

function buildNode(piece, pieceIndex, parent, transform, frame) {
  const basis = computePlaneBasis(piece.normal, piece.contour[0]);
  const worldToAtlas = (p) =>
    projectPointTo2d(applyTransform(transform, p), frame);
  const origin = worldToAtlas(basis.origin);
  const ru = applyR(transform.R, basis.u);
  const rv = applyR(transform.R, basis.v);
  const ex = { x: dot(ru, frame.u), y: dot(ru, frame.v) };
  const ey = { x: dot(rv, frame.u), y: dot(rv, frame.v) };
  return {
    pieceIndex,
    parent,
    basis,
    transform,
    worldToAtlas,
    toAtlas: (p) => ({
      x: origin.x + p.x * ex.x + p.y * ey.x,
      y: origin.y + p.x * ex.y + p.y * ey.y,
    }),
    fromAtlas: (q) => {
      const dx = q.x - origin.x;
      const dy = q.y - origin.y;
      return { x: dx * ex.x + dy * ex.y, y: dx * ey.x + dy * ey.y };
    },
  };
}

// Binary min-heap on `priority`.
function createMinHeap() {
  const items = [];
  const swap = (i, j) => {
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  };
  return {
    size: () => items.length,
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (items[up].priority <= items[i].priority) break;
        swap(up, i);
        i = up;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let min = i;
          if (l < items.length && items[l].priority < items[min].priority)
            min = l;
          if (r < items.length && items[r].priority < items[min].priority)
            min = r;
          if (min === i) break;
          swap(min, i);
          i = min;
        }
      }
      return top;
    },
  };
}
