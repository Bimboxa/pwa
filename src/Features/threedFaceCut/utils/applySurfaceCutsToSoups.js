import cutShellByPlaneNear from "../../threedMesh/utils/cutShellByPlaneNear.js";

// Replays the stored surface cuts of an annotation on its displayed solid
// (one triangle soup per SOLID mesh), in order: each cut splits the piece
// holding its seed — only the chain of facets near the seed, pieces =
// connected components, seams carried (cutShellByPlaneNear) — so the
// partition is the one the user saw when cutting, whatever the later cuts.
//
// A cut whose plane no longer meets any piece (the host's profile or axis
// changed since) is ignored.
//
// Slivers: a cut crossing a previous seam clips the facets around the
// crossing into tiny triangles, and one thinner than the seam tolerance has
// all its edges "on seams" — splitTrisIntoComponents then isolates it. Such
// a sliver (below MIN_PIECE_M2, or one or two triangles thinner than
// SLIVER_WIDTH_M) is absorbed by the piece on its side of the plane it
// shares a vertex with: no 1 cm² "pieces" to hover or paint.
//
// Pure (no three.js): local coordinates, node-testable.

const MIN_PIECE_M2 = 1e-4;
const SLIVER_WIDTH_M = 2e-3;
const SLIVER_MAX_TRIS = 2;
const WELD_M = 1e-4;

const dist3 = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

function vertexKeys(positions) {
  const keys = new Set();
  for (let i = 0; i + 2 < positions.length; i += 3) {
    keys.add(
      `${Math.round(positions[i] / WELD_M)},${Math.round(
        positions[i + 1] / WELD_M
      )},${Math.round(positions[i + 2] / WELD_M)}`
    );
  }
  return keys;
}

// Side of the plane a soup lies on (sign of its mean signed distance).
function planeSide(positions, plane) {
  const { normal, constant } = plane;
  let sum = 0;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    sum +=
      normal.x * positions[i] +
      normal.y * positions[i + 1] +
      normal.z * positions[i + 2] -
      constant;
  }
  return sum >= 0 ? 1 : -1;
}

// Smallest altitude of the soup's triangles (its "width").
function minAltitude(positions) {
  let min = Infinity;
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const a = { x: positions[i], y: positions[i + 1], z: positions[i + 2] };
    const b = { x: positions[i + 3], y: positions[i + 4], z: positions[i + 5] };
    const c = { x: positions[i + 6], y: positions[i + 7], z: positions[i + 8] };
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const area2 = Math.hypot(
      ab.y * ac.z - ab.z * ac.y,
      ab.z * ac.x - ab.x * ac.z,
      ab.x * ac.y - ab.y * ac.x
    );
    const longest = Math.max(dist3(a, b), dist3(b, c), dist3(c, a));
    const altitude = longest > 0 ? area2 / longest : 0;
    if (altitude < min) min = altitude;
  }
  return min;
}

const isSliver = (piece) =>
  piece.surface < MIN_PIECE_M2 ||
  (piece.positions.length <= 9 * SLIVER_MAX_TRIS &&
    minAltitude(piece.positions) < SLIVER_WIDTH_M);

function absorbSlivers(produced, plane) {
  const big = produced.filter((p) => !isSliver(p));
  const slivers = produced.filter((p) => isSliver(p));
  if (!slivers.length || !big.length) return produced;
  const keysOf = new Map(big.map((p) => [p, vertexKeys(p.positions)]));
  for (const sliver of slivers) {
    const side = planeSide(sliver.positions, plane);
    const sliverKeys = vertexKeys(sliver.positions);
    const sameSide = big.filter((p) => planeSide(p.positions, plane) === side);
    const touching = sameSide.filter((p) =>
      [...sliverKeys].some((k) => keysOf.get(p).has(k))
    );
    const target = touching[0] ?? sameSide[0] ?? big[0];
    target.positions = [...target.positions, ...sliver.positions];
    target.surface += sliver.surface;
    for (const seam of sliver.seams) {
      if (!target.seams.includes(seam)) target.seams.push(seam);
    }
    for (const k of sliverKeys) keysOf.get(target).add(k);
  }
  return big;
}

// Distance from the seed to the nearest end of the cut's trace.
function traceDistance(segments, seed) {
  let best = Infinity;
  for (const [p, q] of segments || []) {
    best = Math.min(best, dist3(p, seed), dist3(q, seed));
  }
  return best;
}

/**
 * @param {object} args
 * @param {[{positions: ArrayLike<number>, seams?: Array}]} args.soups - one
 *   flat triangle soup (9 numbers per triangle) per source mesh
 * @param {[{plane: {normal, constant}, seed: {x,y,z}}]} args.cuts - local
 *   cuts, in order
 * @returns {{pieces: [{positions, seams, sourceIndex, touched: boolean,
 *   surface?: number}], applied: number}} — touched: produced by a cut (an
 *   untouched piece is its source soup, unchanged); applied: cuts that
 *   split something.
 */
export default function applySurfaceCutsToSoups({ soups, cuts }) {
  let pieces = (soups || [])
    .filter((soup) => soup?.positions?.length >= 9)
    .map((soup, sourceIndex) => ({
      positions: soup.positions,
      seams: soup.seams || [],
      sourceIndex,
      touched: false,
    }));
  let applied = 0;

  for (const cut of cuts || []) {
    if (!cut?.plane?.normal || !cut.seed) continue;
    let best = null;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const result = cutShellByPlaneNear({
        positions: piece.positions,
        plane: cut.plane,
        hitPoint: cut.seed,
        seams: piece.seams,
      });
      if (!result?.pieces?.length) continue;
      const distance = traceDistance(result.segments, cut.seed);
      if (!best || distance < best.distance) best = { i, result, distance };
    }
    if (!best) continue;
    const source = pieces[best.i];
    const produced = absorbSlivers(
      best.result.pieces.map((p) => ({
        positions: p.shell.positions,
        seams: [...(p.seams || [])],
        surface: p.shell.surface,
        sourceIndex: source.sourceIndex,
        touched: true,
      })),
      cut.plane
    );
    pieces = [
      ...pieces.slice(0, best.i),
      ...produced,
      ...pieces.slice(best.i + 1),
    ];
    applied += 1;
  }

  return { pieces, applied };
}
