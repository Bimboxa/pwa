// Collect every db.points id referenced by a set of annotations, across every
// id-bearing field the resolve pipeline reads (resolvePoints / resolveCuts /
// resolveGuideLine). Kept in one place so the read path (useAnnotationsV2,
// which fetches only referenced points) and the purge path
// (purgeDeletedAnnotationsService, which deletes unreferenced "orphan" points)
// share the exact same definition of "referenced" — a divergence would let the
// purge delete a point the renderer still needs.
//
// Fields carrying point ids:
//   - annotation.point.id                    (POINT / MARKER / REVOLUTION_POINT)
//   - annotation.points[].id                 (POLYLINE / POLYGON / STRIP / ...)
//   - annotation.innerPoints[].id            (POLYGON Steiner points)
//   - annotation.cuts[].points[].id          (holes)
//   - annotation.guideLines[].points[].pointId (slope guide lines — note key)
export default function collectReferencedPointIds(annotations, target) {
  const ids = target instanceof Set ? target : new Set();
  if (!Array.isArray(annotations)) return ids;
  for (const a of annotations) {
    if (!a) continue;
    if (a.point?.id) ids.add(a.point.id);
    if (Array.isArray(a.points))
      for (const p of a.points) if (p?.id) ids.add(p.id);
    if (Array.isArray(a.innerPoints))
      for (const p of a.innerPoints) if (p?.id) ids.add(p.id);
    if (Array.isArray(a.cuts))
      for (const c of a.cuts)
        if (Array.isArray(c?.points))
          for (const p of c.points) if (p?.id) ids.add(p.id);
    if (Array.isArray(a.guideLines))
      for (const g of a.guideLines)
        if (Array.isArray(g?.points))
          for (const ref of g.points) if (ref?.pointId) ids.add(ref.pointId);
  }
  return ids;
}
