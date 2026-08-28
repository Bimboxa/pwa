// PARALLEL offset of an open polyline with a VARIABLE distance profile.
//
// Dependency free (plain {x, y} objects) so it can be replayed in node. Every
// other field of an original point ({id, type, offsetBottom, …}) rides along
// untouched; inserted stations get `_derived: true` and a deterministic id.
//
// `profile` is a sorted array of `{s, d}` nodes — s = arc-length station in px
// from pts[0], d = signed offset distance — interpreted piecewise-linearly
// between nodes and constant-extended beyond both ends. Two nodes at the same
// station encode a deliberate perpendicular jump (left value first).
//
// Sign convention is the STRIP band one (offsetPolylineAsPolygon.offsetPolyline):
// positive d offsets to the LEFT of travel, normal = (-uy, ux) in y-down screen
// coordinates. NOTE this is the OPPOSITE of offsetPolylineParallel, which uses
// the right-of-tangent normal.

// Beyond this, a near-180° fold would send the miter point to infinity; the
// joint is clamped instead (same limit as offsetPolylineParallel).
const MITER_LIMIT = 8;

// Loop-removal window: a corner "consumes" arc length proportional to the
// local distance, so a profile step landing within d of a corner makes the
// offset path backtrack over itself in a LOCAL loop (a few segments at most).
const LOOP_WINDOW = 6;

const EPS_S = 1e-6;
const EPS_LEN = 1e-9;

// Proper intersection of segments [a,b] and [c,d] (both parameters strictly
// inside), or null.
const segmentIntersection = (a, b, c, d) => {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  const eps = 1e-6;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
};

// Cut local self-intersection loops: when segment i crosses a nearby forward
// segment j, drop the loop's points and join at the crossing. This is what
// lets a 45° ramp stop against the offset run standing after a corner instead
// of zigzagging through it.
const removeLocalLoops = (pts) => {
  let out = pts;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (let i = 0; i < out.length - 3 && !changed; i++) {
      const jMax = Math.min(out.length - 2, i + LOOP_WINDOW);
      for (let j = i + 2; j <= jMax && !changed; j++) {
        const x = segmentIntersection(out[i], out[i + 1], out[j], out[j + 1]);
        if (!x) continue;
        out = [
          ...out.slice(0, i + 1),
          { id: `layerloop-${i}-${j}`, _derived: true, ...x },
          ...out.slice(j + 1),
        ];
        changed = true;
      }
    }
  }
  return out;
};

const segmentNormal = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS_LEN) return null;
  return { x: -dy / len, y: dx / len };
};

// Profile value at station s. side = -1 → left limit, +1 → right limit (only
// differs at a deliberate jump, i.e. duplicated stations).
export function evaluateProfile(profile, s, side = 0) {
  if (!profile?.length) return 0;
  if (s <= profile[0].s + EPS_S) return profile[0].d;
  const last = profile[profile.length - 1];
  if (s >= last.s - EPS_S) return last.d;
  // Find the bracketing nodes [i, i+1] with s in [s_i, s_i+1].
  let i = 0;
  while (i < profile.length - 1 && profile[i + 1].s < s - EPS_S) i++;
  // Exactly on a node (possibly duplicated → jump).
  if (Math.abs(profile[i + 1].s - s) <= EPS_S) {
    let j = i + 1;
    if (side <= 0) return profile[j].d;
    while (j < profile.length - 1 && Math.abs(profile[j + 1].s - s) <= EPS_S)
      j++;
    return profile[j].d;
  }
  const a = profile[i];
  const b = profile[i + 1];
  const span = b.s - a.s;
  if (span <= EPS_S) return b.d;
  const t = (s - a.s) / span;
  return a.d + (b.d - a.d) * t;
}

export default function offsetPolylineVariable(pts, profile) {
  const n = pts?.length ?? 0;
  if (n < 2 || !profile?.length) return (pts || []).map((p) => ({ ...p }));

  // Segment normals; a degenerate segment inherits its neighbour's so the
  // chain never breaks (same fallback chain as offsetPolylineParallel).
  const normals = [];
  for (let i = 0; i < n - 1; i++) {
    normals.push(segmentNormal(pts[i], pts[i + 1]));
  }
  for (let i = 0; i < normals.length; i++) {
    if (normals[i]) continue;
    normals[i] = normals.slice(0, i).reverse().find(Boolean) ??
      normals.slice(i + 1).find(Boolean) ?? { x: 0, y: 0 };
  }

  // Cumulative vertex stations.
  const stations = [0];
  for (let i = 0; i < n - 1; i++) {
    stations.push(
      stations[i] + Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    );
  }
  const L = stations[n - 1];

  const out = [];
  let insCount = 0;

  const pushVertex = (i) => {
    const p = pts[i];
    const s = stations[i];
    if (i === 0) {
      const d = evaluateProfile(profile, s, +1);
      out.push({ ...p, x: p.x + normals[0].x * d, y: p.y + normals[0].y * d });
      return;
    }
    if (i === n - 1) {
      const d = evaluateProfile(profile, s, -1);
      const nl = normals[n - 2];
      out.push({ ...p, x: p.x + nl.x * d, y: p.y + nl.y * d });
      return;
    }
    const dLeft = evaluateProfile(profile, s, -1);
    const dRight = evaluateProfile(profile, s, +1);
    const n1 = normals[i - 1];
    const n2 = normals[i];
    if (Math.abs(dLeft - dRight) > EPS_S) {
      // Deliberate jump exactly at a vertex: one point per side, each on its
      // own segment normal.
      out.push({
        ...p,
        x: p.x + n1.x * dLeft,
        y: p.y + n1.y * dLeft,
      });
      out.push({
        ...p,
        id: `${p.id ?? i}-layerjump`,
        _derived: true,
        x: p.x + n2.x * dRight,
        y: p.y + n2.y * dRight,
      });
      return;
    }
    const d = dLeft;
    // Interior joint: the point at `d` from BOTH offset lines is
    //   P + d * (n1 + n2) / (1 + n1·n2)
    // (see offsetPolylineParallel). With a ramp crossing the corner, d is the
    // corner's interpolated value — a documented approximation.
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    if (Math.abs(denom) < 1e-9) {
      out.push({ ...p, x: p.x + n1.x * d, y: p.y + n1.y * d });
      return;
    }
    let mx = (n1.x + n2.x) / denom;
    let my = (n1.y + n2.y) / denom;
    const mLen = Math.hypot(mx, my);
    if (mLen > MITER_LIMIT) {
      mx = (mx / mLen) * MITER_LIMIT;
      my = (my / mLen) * MITER_LIMIT;
    }
    out.push({ ...p, x: p.x + mx * d, y: p.y + my * d });
  };

  // Inserted station strictly inside segment segIdx, at arc station s.
  const pushInserted = (segIdx, s, d) => {
    const a = pts[segIdx];
    const b = pts[segIdx + 1];
    const segLen = stations[segIdx + 1] - stations[segIdx];
    if (segLen < EPS_LEN) return;
    const t = (s - stations[segIdx]) / segLen;
    const nrm = normals[segIdx];
    out.push({
      id: `layerins-${insCount++}`,
      _derived: true,
      x: a.x + (b.x - a.x) * t + nrm.x * d,
      y: a.y + (b.y - a.y) * t + nrm.y * d,
    });
  };

  // Walk vertices and profile nodes merged by station. Profile nodes that
  // coincide with a vertex are absorbed by the vertex emission.
  let profIdx = 0;
  const tolS = Math.max(EPS_S * Math.max(1, L), 1e-6);
  for (let i = 0; i < n; i++) {
    // Emit profile nodes strictly before this vertex.
    while (
      profIdx < profile.length &&
      profile[profIdx].s < stations[i] - tolS
    ) {
      const node = profile[profIdx];
      if (node.s > tolS && node.s < L - tolS && i > 0) {
        // Duplicated stations (jump) inside a segment → two inserted points.
        pushInserted(i - 1, node.s, node.d);
      }
      profIdx++;
    }
    // Skip nodes riding on the vertex itself.
    while (profIdx < profile.length && profile[profIdx].s <= stations[i] + tolS)
      profIdx++;
    pushVertex(i);
  }

  return removeLocalLoops(out);
}
