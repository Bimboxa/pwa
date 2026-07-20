import { useDispatch } from "react-redux";

import {
  triggerZonesUpdate,
  triggerRelsZoneAnnotationUpdate,
  setSoloZone,
  setSelectedZoneId,
} from "../zoningsSlice";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";

import { getZoneDescendants } from "../utils/buildZonesTree";

export default function useDeleteZone() {
  const dispatch = useDispatch();
  const deleteAnnotations = useDeleteAnnotations();

  // Deletes a zone with its descendants, their templates, their delimitation
  // annotations (points cascade handled by useDeleteAnnotations) and the
  // relsZoneAnnotation rows pointing at any deleted zone.
  const deleteZone = async (zone) => {
    const listingZones = (
      await db.zones.where("listingId").equals(zone.listingId).toArray()
    ).filter((z) => !z.deletedAt);

    const zonesToDelete = [
      zone,
      ...getZoneDescendants(listingZones, zone.id),
    ];
    const zoneIds = zonesToDelete.map((z) => z.id);
    const templateIds = zonesToDelete
      .map((z) => z.templateId)
      .filter(Boolean);

    // 1. delimitation annotations (handles orphan points + mesh cascades)
    if (templateIds.length > 0) {
      const annotations = await db.annotations
        .where("annotationTemplateId")
        .anyOf(templateIds)
        .toArray();
      const annotationIds = annotations
        .filter((a) => !a.deletedAt)
        .map((a) => a.id);
      if (annotationIds.length > 0) await deleteAnnotations(annotationIds);
    }

    // 2. zones + templates + rels (soft-delete middleware sets deletedAt)
    await db.transaction(
      "rw",
      db.zones,
      db.annotationTemplates,
      db.relsZoneAnnotation,
      async () => {
        await db.zones.bulkDelete(zoneIds);
        if (templateIds.length > 0)
          await db.annotationTemplates.bulkDelete(templateIds);
        const rels = await db.relsZoneAnnotation
          .where("zoneId")
          .anyOf(zoneIds)
          .toArray();
        const relIds = rels.filter((r) => !r.deletedAt).map((r) => r.id);
        if (relIds.length > 0) await db.relsZoneAnnotation.bulkDelete(relIds);
      }
    );

    dispatch(setSoloZone(null));
    dispatch(setSelectedZoneId(null));
    dispatch(triggerZonesUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    dispatch(triggerRelsZoneAnnotationUpdate());
  };

  return deleteZone;
}
