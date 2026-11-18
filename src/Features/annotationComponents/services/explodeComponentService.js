import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import collectComponentChildren from "./collectComponentChildren";

// Row fields a copied point must not inherit (set again by the audit hooks).
const POINT_AUDIT_FIELDS = [
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdByUserIdMaster",
  "updatedByUserIdMaster",
];

/**
 * « Éclater le composant » — first half: turns the children of the given
 * component sources (see constants/componentConstants.js) into regular,
 * independent annotations:
 *
 *   - their component tags (`componentSourceAnnotationId`,
 *     `componentElementKey`) are removed, so neither the sync
 *     (useComponentsSync) nor the display filter (applyComponentDisplay)
 *     knows them any more;
 *   - they stop sharing their points: the first child of a source keeps the
 *     point rows of the source, every other child gets its own copies
 *     (db.points, same normalized coordinates) — moving a vertex of one no
 *     longer moves the others.
 *
 * The caller then deletes the sources (useDeleteAnnotations: with no child
 * left, the cascade only drops the source rows and their relations; the
 * points survive, still referenced by the first child), inside the same undo
 * group — the writes here DO record undo entries, unlike the derived writes
 * of applyComponentService.
 *
 * Returns the detached annotations ({ id, type, listingId,
 * annotationTemplateId }), in source order.
 */
export default async function explodeComponentService({ sourceIds }) {
  const ids = [...new Set((sourceIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];

  const sources = (await db.annotations.bulkGet(ids)).filter(
    (s) => s && !s.deletedAt && !s.componentSourceAnnotationId
  );
  if (sources.length === 0) return [];

  const detached = [];
  const pointsToAdd = [];
  const annotationUpdates = [];

  for (const source of sources) {
    const children = await collectComponentChildren({
      sourceIds: [source.id],
      projectId: source.projectId,
    });
    if (children.length === 0) continue;

    const pointIds = [
      ...new Set(
        children.flatMap((c) => (c.points ?? []).map((ref) => ref?.id))
      ),
    ].filter(Boolean);
    const pointRows = pointIds.length ? await db.points.bulkGet(pointIds) : [];
    const pointById = new Map(
      pointRows.filter((p) => p && !p.deletedAt).map((p) => [p.id, p])
    );

    children.forEach((child, index) => {
      const changes = {
        componentSourceAnnotationId: undefined,
        componentElementKey: undefined,
      };
      if (index > 0) {
        // one copy per shared point (a closing ref repeating an id keeps
        // pointing at the same copy); a ref without a row is left as is
        const copyIdByPointId = new Map();
        changes.points = (child.points ?? []).map((ref) => {
          const row = ref?.id ? pointById.get(ref.id) : null;
          if (!row) return ref;
          let copyId = copyIdByPointId.get(row.id);
          if (!copyId) {
            copyId = nanoid();
            copyIdByPointId.set(row.id, copyId);
            const copy = { ...row, id: copyId, listingId: child.listingId };
            POINT_AUDIT_FIELDS.forEach((field) => delete copy[field]);
            pointsToAdd.push(copy);
          }
          return { ...ref, id: copyId };
        });
      }
      annotationUpdates.push({ key: child.id, changes });
      detached.push({
        id: child.id,
        type: child.type,
        listingId: child.listingId,
        annotationTemplateId: child.annotationTemplateId,
      });
    });
  }

  if (annotationUpdates.length === 0) return [];

  await db.transaction("rw", [db.annotations, db.points], async () => {
    if (pointsToAdd.length) await db.points.bulkAdd(pointsToAdd);
    for (const { key, changes } of annotationUpdates)
      await db.annotations.update(key, changes);
  });

  return detached;
}
