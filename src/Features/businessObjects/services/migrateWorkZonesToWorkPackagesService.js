import { nanoid } from "nanoid";

import db, { withHardDelete, withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

// One-shot runtime migration of the v34 work zones (delimitation polygons +
// "Calculer les heures" computed copies) into v35 work packages (sets of
// linked annotations):
// - workZones row → workPackages row (same id, label, colour, covered
//   tasks, sortIndex);
// - the SOURCE annotations of the zone's computed copies → rels of the
//   package (one per source, replace rule: last zone wins);
// - planningSlots.workZoneId → workPackageId (same id);
// - delimitations, computed copies and the per-listing delimitation system
//   templates are hard-deleted; the legacy rows too.
// No-op when db.workZones is empty. System write (rows may belong to other
// users), no undo, hard deletes (legacy rows must disappear).
export default async function migrateWorkZonesToWorkPackagesService() {
  const zones = await db.workZones.toArray();
  const liveZones = zones.filter((z) => !z.deletedAt);
  if (zones.length === 0) return { migrated: 0 };

  const listingIds = [
    ...new Set(liveZones.map((z) => z.listingId).filter(Boolean)),
  ];
  const listingAnnotations =
    listingIds.length > 0
      ? await db.annotations.where("listingId").anyOf(listingIds).toArray()
      : [];
  const zoneRows = listingAnnotations.filter(
    (a) => a.isWorkZoneAnnotation || a.isWorkZoneComputed
  );
  const systemTemplates =
    listingIds.length > 0
      ? (
          await db.annotationTemplates
            .where("listingId")
            .anyOf(listingIds)
            .toArray()
        ).filter((t) => t.isWorkZoneAnnotation)
      : [];
  const slots = await db.planningSlots.toArray();

  await withSystemWrite(() =>
    withoutUndo(() =>
      withHardDelete(() =>
        db.transaction(
          "rw",
          [
            db.workZones,
            db.workPackages,
            db.relsWorkPackageAnnotation,
            db.planningSlots,
            db.annotations,
            db.annotationTemplates,
          ],
          async () => {
            for (const zone of liveZones) {
              const existing = await db.workPackages.get(zone.id);
              if (!existing) {
                await db.workPackages.add({
                  id: zone.id,
                  listingId: zone.listingId,
                  projectId: zone.projectId,
                  scopeId: zone.scopeId,
                  label: zone.label,
                  color: zone.color,
                  workStationIds: Array.isArray(zone.workStationIds)
                    ? [...zone.workStationIds]
                    : [],
                  sortIndex: zone.sortIndex,
                });
              }
              const sourceIds = [
                ...new Set(
                  zoneRows
                    .filter(
                      (a) =>
                        !a.deletedAt &&
                        a.isWorkZoneComputed &&
                        a.workZoneId === zone.id &&
                        a.sourceAnnotationId
                    )
                    .map((a) => a.sourceAnnotationId)
                ),
              ];
              for (const annotationId of sourceIds) {
                const rels = (
                  await db.relsWorkPackageAnnotation
                    .where("annotationId")
                    .equals(annotationId)
                    .toArray()
                ).filter((r) => !r.deletedAt && r.listingId === zone.listingId);
                if (rels.length > 0)
                  await db.relsWorkPackageAnnotation.bulkDelete(
                    rels.map((r) => r.id)
                  );
                await db.relsWorkPackageAnnotation.add({
                  id: nanoid(),
                  projectId: zone.projectId,
                  scopeId: zone.scopeId,
                  annotationId,
                  workPackageId: zone.id,
                  listingId: zone.listingId,
                });
              }
            }
            // blocks: same id for the package
            for (const slot of slots) {
              if (slot.workZoneId && !slot.workPackageId) {
                await db.planningSlots.update(slot.id, {
                  workPackageId: slot.workZoneId,
                });
              }
            }
            if (zoneRows.length > 0)
              await db.annotations.bulkDelete(zoneRows.map((a) => a.id));
            if (systemTemplates.length > 0)
              await db.annotationTemplates.bulkDelete(
                systemTemplates.map((t) => t.id)
              );
            await db.workZones.bulkDelete(zones.map((z) => z.id));
          }
        )
      )
    )
  );

  return { migrated: liveZones.length };
}
