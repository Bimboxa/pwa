import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Number of mailles already numbered before the current surface in the same
// listing, so the editor can continue the per-listing M1, M2, M3… sequence.
//
// Surfaces (parent annotations) are ordered by their creation time (createdAt,
// then id as a deterministic tie-break) — the same ordering used to relabel the
// listing on save (see saveMeshService). The current surface's own mailles are
// excluded so re-meshing it keeps a stable offset.
export default function useMeshCellLabelOffset({
  listingId,
  parentAnnotationId,
  parentCreatedAt,
}) {
  return (
    useLiveQuery(
      async () => {
        if (!listingId || !parentAnnotationId) return 0;

        const cells = (
          await db.annotations.where("listingId").equals(listingId).toArray()
        ).filter(
          (a) =>
            a.isMeshCell &&
            !a.deletedAt &&
            a.parentAnnotationId &&
            a.parentAnnotationId !== parentAnnotationId
        );
        if (!cells.length) return 0;

        // resolve each owning surface's createdAt to order the surfaces
        const parentIds = [...new Set(cells.map((c) => c.parentAnnotationId))];
        const parents = await db.annotations.bulkGet(parentIds);
        const createdAtById = {};
        parents.forEach((p) => {
          if (p) createdAtById[p.id] = p.createdAt || "";
        });

        const myCreatedAt = parentCreatedAt || "";
        // a maille is "before" if its surface was created earlier (ties broken
        // by surface id) than the current surface.
        return cells.filter((c) => {
          const ca = createdAtById[c.parentAnnotationId] || "";
          if (ca !== myCreatedAt) return ca < myCreatedAt;
          return c.parentAnnotationId < parentAnnotationId;
        }).length;
      },
      [listingId, parentAnnotationId, parentCreatedAt],
      0
    ) ?? 0
  );
}
