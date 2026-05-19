// Delta-independent ramp layout. Built once when the gizmo move starts.
//
// Given the polygon ring (pixel coords) and its two rail chains (iso → moved),
// every rail vertex is parametrized by normalized cumulative chain length
// t ∈ [0,1] (iso end = 0, moved end = 1). To keep contour lines straight when
// the ramp turns, a matching point is inserted on the opposite rail at every
// interior t present on the other rail. A rectangle has no interior rail
// vertices, so nothing is inserted (the simple no-insert case).
//
// Only XY (delta-independent) is computed here; offsetTop is derived per drag
// tick by rampOffsetTopByPointId from the returned `tById`.
//
// Returns:
//   {
//     augmentedRing: [{ id, x, y, t, isInserted }]  // ring-forward order
//     tById:         Map<id, t>                      // every existing+inserted id
//     insertedPoints:[{ id, x, y }]                  // pixel coords, new ids
//   }
// or null on degenerate geometry.

const EPS = 1e-6;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Cumulative-length t for an iso→moved ordered list of point ids.
function paramByLength(ids, pointById) {
  const pts = ids.map((id) => pointById.get(id));
  if (pts.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return null;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  }
  const total = cum[cum.length - 1];
  if (!Number.isFinite(total) || total < EPS) return null;
  return cum.map((c) => c / total);
}

// Point on an iso→moved rail at parameter tVal (t monotonic 0..1).
function pointAtParam(ids, tArr, pointById, tVal) {
  for (let j = 0; j < ids.length - 1; j++) {
    const tLo = tArr[j];
    const tHi = tArr[j + 1];
    if (tVal >= tLo - EPS && tVal <= tHi + EPS) {
      const span = tHi - tLo;
      const f = span < EPS ? 0 : (tVal - tLo) / span;
      const A = pointById.get(ids[j]);
      const B = pointById.get(ids[j + 1]);
      return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
    }
  }
  return null;
}

// `arcPointIds` (optional Set): when the ring carries S-C-S arc control
// points, contour-alignment insertion is skipped — an inserted point inside
// an arc triplet would break the square→circle→square pattern and distort the
// curve. The arc is then preserved verbatim and curved at render time.
export default function buildRampLayout({
  ring,
  chains,
  idFactory,
  arcPointIds,
}) {
  if (!ring || !chains || typeof idFactory !== "function") return null;
  const { railA, railB } = chains;
  if (!railA || !railB || railA.length < 2 || railB.length < 2) return null;

  const skipInserts =
    arcPointIds instanceof Set && ring.some((p) => arcPointIds.has(p.id));

  const pointById = new Map();
  for (const p of ring) pointById.set(p.id, { x: p.x, y: p.y });

  const tA = paramByLength(railA, pointById);
  const tB = paramByLength(railB, pointById);
  if (!tA || !tB) return null;

  const tById = new Map();
  railA.forEach((id, i) => tById.set(id, tA[i]));
  // Iso/moved endpoints are shared parametrically (t=0 / t=1) — railB writes
  // are intentionally consistent with railA at the shared endpoints.
  railB.forEach((id, i) => tById.set(id, tB[i]));

  const insertedPoints = [];
  // Inserts ON railB come from railA's interior t values, and vice versa.
  const insertsOnA = []; // {id,x,y,t}
  const insertsOnB = [];

  if (!skipInserts) {
    const railBTset = new Set(tB.map((t) => Math.round(t / EPS)));
    for (let i = 1; i < railA.length - 1; i++) {
      const tVal = tA[i];
      if (railBTset.has(Math.round(tVal / EPS))) continue;
      const xy = pointAtParam(railB, tB, pointById, tVal);
      if (!xy) continue;
      const id = idFactory();
      insertsOnB.push({ id, x: xy.x, y: xy.y, t: tVal });
      tById.set(id, tVal);
      insertedPoints.push({ id, x: xy.x, y: xy.y });
    }
    const railATset = new Set(tA.map((t) => Math.round(t / EPS)));
    for (let i = 1; i < railB.length - 1; i++) {
      const tVal = tB[i];
      if (railATset.has(Math.round(tVal / EPS))) continue;
      const xy = pointAtParam(railA, tA, pointById, tVal);
      if (!xy) continue;
      const id = idFactory();
      insertsOnA.push({ id, x: xy.x, y: xy.y, t: tVal });
      tById.set(id, tVal);
      insertedPoints.push({ id, x: xy.x, y: xy.y });
    }
  }

  const augmentedRing = [];
  const pushVertex = (id) => {
    const p = pointById.get(id);
    augmentedRing.push({
      id,
      x: p.x,
      y: p.y,
      t: tById.get(id),
      isInserted: false,
    });
  };
  const pushInsert = (ins) => {
    augmentedRing.push({
      id: ins.id,
      x: ins.x,
      y: ins.y,
      t: ins.t,
      isInserted: true,
    });
  };

  // railA (ring-forward, t ascending), inserts-on-A between consecutive t.
  for (let k = 0; k < railA.length; k++) {
    pushVertex(railA[k]);
    if (k < railA.length - 1) {
      const lo = tA[k];
      const hi = tA[k + 1];
      insertsOnA
        .filter((ins) => ins.t > lo + EPS && ins.t < hi - EPS)
        .sort((p, q) => p.t - q.t)
        .forEach(pushInsert);
    }
  }
  // Edge railA[last]→railB[last] is the MOVED edge — no insert.
  // railB reversed = ring-forward [moved … iso], t descending.
  const railBFwd = railB.slice().reverse();
  for (let k = 0; k < railBFwd.length; k++) {
    pushVertex(railBFwd[k]);
    if (k < railBFwd.length - 1) {
      const hi = tById.get(railBFwd[k]);
      const lo = tById.get(railBFwd[k + 1]);
      insertsOnB
        .filter((ins) => ins.t > lo + EPS && ins.t < hi - EPS)
        .sort((p, q) => q.t - p.t)
        .forEach(pushInsert);
    }
  }
  // Closing edge railB[iso]→railA[iso] is the ISO edge (both t=0) — implicit.

  return { augmentedRing, tById, insertedPoints };
}
