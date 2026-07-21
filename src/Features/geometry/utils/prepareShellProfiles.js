// Prepare shell profile polylines for the 3D shell build (TENT partition /
// DOME solver): detect pairwise crossings between profiles and insert each
// intersection as a vertex in BOTH polylines, as a SHARED JS object — the
// TENT partition remaps mesh indices by object identity, so sharing makes the
// crossing watertight. The intersection height is the AVERAGE of the two
// profiles' interpolated heights at that spot (the constraint resolution rule
// for crossing profiles).
//
// Input:  profiles: [{ polyline: [{x, y, height}, ...], inheritEndpoints? },
//         ...] (heights in meters, offsetTop semantics; profile endpoints
//         already baked with contour continuity. Iso lines join the set as
//         constant-height polylines with inheritEndpoints=false.)
// Output: [{ polyline: [vertex, ...], inheritEndpoints }, ...] where each
//         vertex is { x, y, height, isJunction? } and junction vertices are
//         shared between the polylines that cross there.
//
// Notes:
// - Intersections are computed against the ORIGINAL segments, then spliced in
//   sorted by their segment parameter — so multiple crossings per segment and
//   3+ profiles compose correctly.
// - A crossing landing within `weldTol` of an existing vertex of one profile
//   snaps to that vertex object (its authored height wins) and only the other
//   polyline gets the insertion.
// - Self-intersections within a single profile are ignored (V1).
export default function prepareShellProfiles({ profiles, weldTol = null }) {
  const lines = (profiles || [])
    .map((p) => ({
      verts: (p?.polyline || [])
        .filter((q) => Number.isFinite(q?.x) && Number.isFinite(q?.y))
        .map((q) => ({ x: q.x, y: q.y, height: Number(q.height) || 0 })),
      inheritEndpoints: p?.inheritEndpoints === true,
    }))
    .filter((l) => l.verts.length >= 2);
  if (lines.length === 0) return [];

  // Default weld tolerance: 1e-3 of the profiles' bbox diagonal.
  if (!Number.isFinite(weldTol)) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const l of lines) {
      for (const v of l.verts) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      }
    }
    const diag = Math.hypot(maxX - minX, maxY - minY);
    weldTol = Number.isFinite(diag) && diag > 0 ? diag * 1e-3 : 1e-6;
  }

  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= weldTol;

  // insertions[li] = Map(segIdx -> [{t, vertex}])
  const insertions = lines.map(() => new Map());
  const junctions = []; // shared junction vertex objects (for welding)

  const addInsertion = (li, segIdx, t, vertex) => {
    const m = insertions[li];
    const list = m.get(segIdx) || [];
    // Skip if this vertex object is already registered on this segment.
    if (list.some((e) => e.vertex === vertex)) return;
    list.push({ t, vertex });
    m.set(segIdx, list);
  };

  // Proper segment-segment intersection (params strictly inside both spans).
  const intersectSegments = (a, b, c, d) => {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-12) return null; // parallel / collinear: ignore
    const acX = c.x - a.x;
    const acY = c.y - a.y;
    const t = (acX * sY - acY * sX) / denom;
    const u = (acX * rY - acY * rX) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u, x: a.x + rX * t, y: a.y + rY * t };
  };

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i].verts;
      const B = lines[j].verts;
      for (let si = 0; si < A.length - 1; si++) {
        for (let sj = 0; sj < B.length - 1; sj++) {
          const hit = intersectSegments(A[si], A[si + 1], B[sj], B[sj + 1]);
          if (!hit) continue;

          // Snap to an existing vertex when the crossing lands on one: that
          // vertex object becomes the junction (authored height wins) and only
          // the other polyline gets an insertion.
          const p = { x: hit.x, y: hit.y };
          const nearA0 = near(p, A[si]);
          const nearA1 = near(p, A[si + 1]);
          const nearB0 = near(p, B[sj]);
          const nearB1 = near(p, B[sj + 1]);

          if ((nearA0 || nearA1) && (nearB0 || nearB1)) continue; // vertex-on-vertex: already coincident
          if (nearA0 || nearA1) {
            const v = nearA0 ? A[si] : A[si + 1];
            v.isJunction = true;
            addInsertion(j, sj, hit.u, v);
            continue;
          }
          if (nearB0 || nearB1) {
            const v = nearB0 ? B[sj] : B[sj + 1];
            v.isJunction = true;
            addInsertion(i, si, hit.t, v);
            continue;
          }

          // Weld onto an existing junction (3+ profiles through one point).
          let vertex = junctions.find((junc) => near(p, junc));
          if (!vertex) {
            const hA = A[si].height + (A[si + 1].height - A[si].height) * hit.t;
            const hB = B[sj].height + (B[sj + 1].height - B[sj].height) * hit.u;
            vertex = {
              x: hit.x,
              y: hit.y,
              height: (hA + hB) / 2,
              isJunction: true,
            };
            junctions.push(vertex);
          }
          addInsertion(i, si, hit.t, vertex);
          addInsertion(j, sj, hit.u, vertex);
        }
      }
    }
  }

  // Splice insertions (sorted by t) into each polyline.
  return lines.map((l, li) => {
    const out = [];
    for (let s = 0; s < l.verts.length; s++) {
      out.push(l.verts[s]);
      const list = insertions[li].get(s);
      if (list) {
        list.sort((u, v) => u.t - v.t);
        for (const e of list) out.push(e.vertex);
      }
    }
    return { polyline: out, inheritEndpoints: l.inheritEndpoints };
  });
}
