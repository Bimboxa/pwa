import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";

// Vertices within this distance (2D units, m) of the lowest one are "at the
// bottom" too (a wall base is never perfectly level after a conversion).
const TIE_TOL = 1e-3;

// A crossing interval shorter than this (m) is a vertex the line only
// touches — no chord.
const MIN_CHORD = 1e-6;

// "Coupe face" axis cuts (« Découpe horizontale / verticale »): where a
// horizontal (axis "H": constant v) or vertical (axis "V": constant u) line
// cuts the hovered face, in the face's own 2D frame (u horizontal, v the
// true vertical — see getFaceCutBasisWorld).
//
//   - loops2d: [contour, ...holes] of the face, projected ({x: u, y: v});
//   - cursor2d: the cursor on the face;
//   - side: "LEFT" | "RIGHT" — the bottom corner the vertical cut's distance
//     is measured from (S toggles it);
//   - typedDistance: distance typed by the user (m) from the reference,
//     locking the line there; null to follow the cursor;
//   - snapToleranceM: the line snaps to the coordinate of a vertex of the
//     face (contour + holes), or to the middle of an edge it would halve,
//     closer than this.
//
// The reference is the bottom of the face: the lowest contour vertex nearest
// the cursor (H), or the lowest-left / lowest-right one (V). The chord is the
// run of the line inside the face holding the cursor (on a concave face the
// line may cross it several times), else the nearest run; null when the line
// misses the face (a typed distance beyond it). A chord ending on a hole
// (`endsOnHole`) would merge the hole into the contour instead of cutting the
// face (splitMesh3dFace) — the caller refuses it.
//
// Returns { cut, chord2d: [a, b] | null, loopIndexA, loopIndexB, endsOnHole,
// ref2d, guide2d, distance, snapped, locked } or null (no face / cursor).
// Pure (no three.js): node-testable.
export default function computeFaceAxisCut({
  loops2d,
  cursor2d,
  axis,
  side = "LEFT",
  typedDistance = null,
  snapToleranceM = 0,
}) {
  const contour = loops2d?.[0];
  if (!contour || contour.length < 3 || !cursor2d) return null;
  const isH = axis === "H";
  const coord = isH ? "y" : "x";
  const along = isH ? "x" : "y";

  // Reference: a bottom vertex of the contour.
  const minV = Math.min(...contour.map((p) => p.y));
  const bottom = contour.filter((p) => p.y <= minV + TIE_TOL);
  const ref2d = bottom.reduce((best, p) => {
    if (!best) return p;
    if (isH) {
      return Math.abs(p.x - cursor2d.x) < Math.abs(best.x - cursor2d.x)
        ? p
        : best;
    }
    return (side === "LEFT" ? p.x < best.x : p.x > best.x) ? p : best;
  }, null);
  const dir = isH ? 1 : side === "LEFT" ? 1 : -1;

  // Cut coordinate: typed (locked) or the cursor's, snapped.
  let cut;
  let locked = false;
  let snapped = false;
  if (typedDistance != null && Number.isFinite(typedDistance)) {
    cut = ref2d[coord] + dir * typedDistance;
    locked = true;
  } else {
    cut = cursor2d[coord];
    let bestDist = snapToleranceM;
    const consider = (candidate) => {
      const d = Math.abs(candidate - cursor2d[coord]);
      if (d < bestDist) {
        bestDist = d;
        cut = candidate;
        snapped = true;
      }
    };
    for (const loop of loops2d) {
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % n];
        consider(a[coord]);
        // An edge the line would halve: it crosses the cut axis more than
        // it runs along it (meshing parity: the mid-edge snap).
        if (Math.abs(b[coord] - a[coord]) > Math.abs(b[along] - a[along])) {
          consider((a[coord] + b[coord]) / 2);
        }
      }
    }
  }
  const distance = Math.abs(cut - ref2d[coord]);
  const guide2d = { ...ref2d, [coord]: cut };

  // Crossings of the line with every edge of every loop, half-open rule so
  // a vertex on the line counts once (the point-in-polygon convention).
  const crossings = [];
  loops2d.forEach((loop, loopIndex) => {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % n];
      if (a[coord] > cut === b[coord] > cut) continue;
      const t = (cut - a[coord]) / (b[coord] - a[coord]);
      crossings.push({ at: a[along] + t * (b[along] - a[along]), loopIndex });
    }
  });
  crossings.sort((p, q) => p.at - q.at);

  const [, ...holes] = loops2d;
  const runs = [];
  for (let i = 0; i + 1 < crossings.length; i++) {
    const a = crossings[i];
    const b = crossings[i + 1];
    if (b.at - a.at < MIN_CHORD) continue;
    const mid = { [coord]: cut, [along]: (a.at + b.at) / 2 };
    if (!pointInPolygon2d(mid, contour)) continue;
    if (holes.some((hole) => pointInPolygon2d(mid, hole))) continue;
    runs.push({ a, b });
  }
  const at = cursor2d[along];
  const run =
    runs.find((r) => at >= r.a.at && at <= r.b.at) ??
    runs.reduce((best, r) => {
      const d = at < r.a.at ? r.a.at - at : at - r.b.at;
      return !best || d < best.d ? { r, d } : best;
    }, null)?.r ??
    null;

  const toPoint = (c) => ({ [coord]: cut, [along]: c.at });
  return {
    cut,
    chord2d: run ? [toPoint(run.a), toPoint(run.b)] : null,
    loopIndexA: run ? run.a.loopIndex : null,
    loopIndexB: run ? run.b.loopIndex : null,
    endsOnHole: Boolean(run && (run.a.loopIndex > 0 || run.b.loopIndex > 0)),
    ref2d,
    guide2d,
    distance,
    snapped,
    locked,
  };
}
