import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import getRevolutionAxesMigrationPlan from "../utils/getRevolutionAxesMigrationPlan";

// Runtime migration of the template-driven revolution axes (and their
// placements) to base map + scope objects — see
// getRevolutionAxesMigrationPlan. Idempotent: a no-op once no
// REVOLUTION_AXIS template is left (the lookup is a scan of the small
// annotationTemplates table, so it can run at every scope opening — rows
// imported later from an older Krto zip are migrated too).
// System write (rows may belong to other users / to a read-only scope: this
// is a storage normalization, not a content edit), no undo. Soft deletes for
// the templates (regular tombstones, they sync like any removed template).
export default async function migrateRevolutionAxesToScopeService() {
  const templates = (
    await db.annotationTemplates
      .filter((t) => t.drawingShape === "REVOLUTION_AXIS")
      .toArray()
  ).filter((t) => !t.deletedAt);
  if (templates.length === 0) return { migrated: 0, deletedTemplates: 0 };

  const annotations = await db.annotations
    .where("annotationTemplateId")
    .anyOf(templates.map((t) => t.id))
    .toArray();

  const listingIds = [
    ...new Set(annotations.map((a) => a.listingId).filter(Boolean)),
  ];
  const listings = listingIds.length
    ? (await db.listings.bulkGet(listingIds)).filter(Boolean)
    : [];
  const scopeIdByListingId = new Map(listings.map((l) => [l.id, l.scopeId]));

  const { updates, templateIdsToDelete } = getRevolutionAxesMigrationPlan({
    annotations,
    templates,
    scopeIdByListingId,
  });
  if (updates.length === 0 && templateIdsToDelete.length === 0)
    return { migrated: 0, deletedTemplates: 0 };

  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction("rw", [db.annotations, db.annotationTemplates], async () => {
        for (const { id, changes } of updates) {
          await db.annotations.update(id, changes);
        }
        if (templateIdsToDelete.length > 0) {
          await db.annotationTemplates.bulkDelete(templateIdsToDelete);
        }
      })
    )
  );

  return {
    migrated: updates.length,
    deletedTemplates: templateIdsToDelete.length,
  };
}
