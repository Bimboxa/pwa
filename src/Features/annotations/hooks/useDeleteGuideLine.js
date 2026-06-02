import db from "App/db/db";

// Deletes the whole guideLine of an annotation: drops every db.points it
// referenced, clears `annotation.guideLine` and `guideLineSlopePct`, and resets
// every vertex `offsetTop` to 0 so the surface returns to its flat footprint.
//
// Reusable hook shared by the keyboard-delete path (MainMapEditorV3) and the
// "Supprimer" action in the guideLine properties panel.
export default function useDeleteGuideLine() {
  return async ({ annotationId }) => {
    const ann = await db.annotations.get(annotationId);
    if (!ann) return;

    const pointIds = Array.isArray(ann.guideLine)
      ? ann.guideLine.map((g) => g.pointId).filter(Boolean)
      : [];

    const zeroRing = (ring) =>
      (ring || []).map((p) =>
        (p?.offsetTop ?? 0) !== 0 ? { ...p, offsetTop: 0 } : p
      );

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
      const update = {
        guideLine: [],
        guideLineSlopePct: 0,
        points: zeroRing(ann.points),
      };
      if (Array.isArray(ann.cuts)) {
        update.cuts = ann.cuts.map((c) => ({ ...c, points: zeroRing(c?.points) }));
      }
      if (Array.isArray(ann.innerPoints)) {
        update.innerPoints = zeroRing(ann.innerPoints);
      }
      await db.annotations.update(annotationId, update);
    });
  };
}
