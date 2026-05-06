/**
 * Pre-processing step that normalizes near-coincident or on-segment vertices
 * across visible POLYGON annotations so downstream geometry algorithms (e.g.
 * shared-edge detection) can match polygons by pointId equality.
 *
 * Two cases handled:
 *  1. Near-coincident points (distance ≤ thresholdPx) → pick a representative
 *     pointId, remap all visible-polygon references to it.
 *  2. Foreign point lying on (or within thresholdPx of) a segment of another
 *     polygon → insert a reference to that pointId at the right position in
 *     the segment's ring.
 *
 * Mutates the resolved in-memory `sourceAnnotations` (so the caller's edge
 * detection sees the normalized geometry) and returns DB-ready
 * `updatedAnnotations` (id-only point refs) for those that changed, so the
 * caller can persist the normalization via bulkPut.
 *
 * Operates only on annotations passed in (i.e. visible polygons). Other
 * annotations are not touched. Discarded points are NOT deleted from db.points
 * so any non-visible annotation that still references them keeps working.
 */

const DEFAULT_THRESHOLD_PX = 1;

function stripResolvedFields(p) {
  // remove fields injected by resolvePoints; keep id + any inline override
  const { x: _x, y: _y, type: _t, ...rest } = p;
  return rest;
}

function dedupeConsecutive(points) {
  if (!points?.length) return points;
  const out = [];
  let prevId = null;
  for (const p of points) {
    if (p.id !== prevId) {
      out.push(p);
      prevId = p.id;
    }
  }
  // also guard against first === last (closed-ring duplicate)
  if (out.length >= 2 && out[0].id === out[out.length - 1].id) {
    out.pop();
  }
  return out;
}

export default function detectSharedPoints({
  annotations,
  thresholdPx = DEFAULT_THRESHOLD_PX,
} = {}) {
  if (!annotations?.length) return { updatedAnnotations: [] };

  const SQ = thresholdPx * thresholdPx;
  const polygons = annotations.filter((a) => a?.type === "POLYGON");
  if (polygons.length === 0) return { updatedAnnotations: [] };

  // -------------------------------------------------------------------------
  // 1. Collect every unique pointId appearing in visible polygons (resolved
  //    coords in pixel space).
  // -------------------------------------------------------------------------
  const pointMap = new Map(); // pointId → { x, y }
  const collectFromRing = (points) => {
    if (!points) return;
    for (const p of points) {
      if (!p?.id || p.x == null || p.y == null) continue;
      if (!pointMap.has(p.id)) pointMap.set(p.id, { x: p.x, y: p.y });
    }
  };
  for (const ann of polygons) {
    collectFromRing(ann.points);
    for (const cut of ann.cuts ?? []) collectFromRing(cut?.points);
  }

  // -------------------------------------------------------------------------
  // 2. Cluster near-coincident points → idRemap (oldId → keptId).
  //    Sort ids for deterministic representative selection.
  // -------------------------------------------------------------------------
  const sortedIds = [...pointMap.keys()].sort();
  const idRemap = new Map();
  for (let i = 0; i < sortedIds.length; i++) {
    const idA = sortedIds[i];
    if (idRemap.has(idA)) continue; // idA was merged into another representative earlier
    const pA = pointMap.get(idA);
    for (let j = i + 1; j < sortedIds.length; j++) {
      const idB = sortedIds[j];
      if (idRemap.has(idB)) continue;
      const pB = pointMap.get(idB);
      const dx = pA.x - pB.x;
      const dy = pA.y - pB.y;
      if (dx * dx + dy * dy <= SQ) {
        idRemap.set(idB, idA);
      }
    }
  }

  const remap = (id) => idRemap.get(id) ?? id;

  // -------------------------------------------------------------------------
  // 3. Build point-on-segment insertions per ring.
  //    For each polygon's ring, test each foreign point against each segment.
  //    A foreign point's projection must fall strictly inside (0, 1) so we
  //    don't double-handle endpoint coincidences (already resolved via remap).
  // -------------------------------------------------------------------------
  const insertionsByAnnotation = new Map();

  for (const ann of polygons) {
    const ringDescriptors = [];
    if (ann.points?.length >= 2) {
      ringDescriptors.push({ ringKind: "ext", ringIndex: -1, points: ann.points });
    }
    for (let ci = 0; ci < (ann.cuts?.length ?? 0); ci++) {
      const pts = ann.cuts[ci]?.points;
      if (pts?.length >= 2) {
        ringDescriptors.push({ ringKind: "cut", ringIndex: ci, points: pts });
      }
    }

    for (const { ringKind, ringIndex, points } of ringDescriptors) {
      const ringIdSet = new Set(points.map((p) => remap(p.id)));

      for (const [foreignId, foreignPos] of pointMap) {
        const remappedId = remap(foreignId);
        if (ringIdSet.has(remappedId)) continue;

        let bestSegIdx = -1;
        let bestDistSq = Infinity;
        let bestT = 0;
        for (let si = 0; si < points.length; si++) {
          const a = points[si];
          const b = points[(si + 1) % points.length];
          const abx = b.x - a.x;
          const aby = b.y - a.y;
          const lenSq = abx * abx + aby * aby;
          if (lenSq < 1e-9) continue;
          const t =
            ((foreignPos.x - a.x) * abx + (foreignPos.y - a.y) * aby) / lenSq;
          if (t <= 0 || t >= 1) continue;
          const projX = a.x + t * abx;
          const projY = a.y + t * aby;
          const dx = foreignPos.x - projX;
          const dy = foreignPos.y - projY;
          const distSq = dx * dx + dy * dy;
          if (distSq <= SQ && distSq < bestDistSq) {
            bestDistSq = distSq;
            bestSegIdx = si;
            bestT = t;
          }
        }

        if (bestSegIdx >= 0) {
          if (!insertionsByAnnotation.has(ann.id)) {
            insertionsByAnnotation.set(ann.id, []);
          }
          insertionsByAnnotation.get(ann.id).push({
            ringKind,
            ringIndex,
            insertAfterIndex: bestSegIdx,
            t: bestT,
            pointId: remappedId,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Apply remap + insertions. Mutate in-memory polygons (so the caller's
  //    edge detection sees the normalized rings) and produce DB-ready
  //    `updatedAnnotations` for those that changed.
  // -------------------------------------------------------------------------
  const updatedAnnotations = [];

  for (const ann of polygons) {
    const insertions = insertionsByAnnotation.get(ann.id) ?? [];

    // ---- ext ring ----
    let extPoints = ann.points;
    let extChanged = false;

    if (extPoints?.length) {
      // remap ids
      let next = extPoints;
      if (next.some((p) => idRemap.has(p.id))) {
        next = next.map((p) => {
          if (!idRemap.has(p.id)) return p;
          const keptId = idRemap.get(p.id);
          const keptPos = pointMap.get(keptId);
          return { ...p, id: keptId, x: keptPos?.x ?? p.x, y: keptPos?.y ?? p.y };
        });
        extChanged = true;
      }
      // apply insertions on ext
      const extIns = insertions.filter((i) => i.ringKind === "ext");
      if (extIns.length) {
        extIns.sort(
          (a, b) =>
            b.insertAfterIndex - a.insertAfterIndex || b.t - a.t
        );
        const arr = [...next];
        for (const ins of extIns) {
          if (arr.some((p) => p.id === ins.pointId)) continue;
          const pos = pointMap.get(ins.pointId);
          arr.splice(ins.insertAfterIndex + 1, 0, {
            id: ins.pointId,
            x: pos?.x,
            y: pos?.y,
            offsetBottom: 0,
            offsetTop: 0,
          });
        }
        next = arr;
        extChanged = true;
      }
      next = dedupeConsecutive(next);
      if (extChanged) {
        ann.points = next; // mutate for caller's downstream use
        extPoints = next;
      }
    }

    // ---- cut rings ----
    let cuts = ann.cuts;
    let cutsChanged = false;
    if (cuts?.length) {
      const newCuts = cuts.map((cut, ci) => {
        if (!cut?.points?.length) return cut;
        let pts = cut.points;
        let touched = false;

        if (pts.some((p) => idRemap.has(p.id))) {
          pts = pts.map((p) => {
            if (!idRemap.has(p.id)) return p;
            const keptId = idRemap.get(p.id);
            const keptPos = pointMap.get(keptId);
            return {
              ...p,
              id: keptId,
              x: keptPos?.x ?? p.x,
              y: keptPos?.y ?? p.y,
            };
          });
          touched = true;
        }

        const cutIns = insertions.filter(
          (i) => i.ringKind === "cut" && i.ringIndex === ci
        );
        if (cutIns.length) {
          cutIns.sort(
            (a, b) =>
              b.insertAfterIndex - a.insertAfterIndex || b.t - a.t
          );
          const arr = [...pts];
          for (const ins of cutIns) {
            if (arr.some((p) => p.id === ins.pointId)) continue;
            const pos = pointMap.get(ins.pointId);
            arr.splice(ins.insertAfterIndex + 1, 0, {
              id: ins.pointId,
              x: pos?.x,
              y: pos?.y,
              offsetBottom: 0,
              offsetTop: 0,
            });
          }
          pts = arr;
          touched = true;
        }

        pts = dedupeConsecutive(pts);
        if (touched) {
          cutsChanged = true;
          return { ...cut, points: pts };
        }
        return cut;
      });
      if (cutsChanged) {
        cuts = newCuts;
        ann.cuts = newCuts; // mutate for caller's downstream use
      }
    }

    if (extChanged || cutsChanged) {
      updatedAnnotations.push({
        ...ann,
        points: (extPoints ?? []).map(stripResolvedFields),
        cuts: cuts
          ? cuts.map((c) =>
              c?.points
                ? { ...c, points: c.points.map(stripResolvedFields) }
                : c
            )
          : ann.cuts,
      });
    }
  }

  return { updatedAnnotations };
}
