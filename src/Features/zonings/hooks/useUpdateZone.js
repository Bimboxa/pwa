import { useDispatch } from "react-redux";

import { triggerZonesUpdate } from "../zoningsSlice";
import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import db from "App/db/db";

export default function useUpdateZone() {
  const dispatch = useDispatch();

  // Rename / recolor a zone. Propagates to its template and to the existing
  // delimitation annotations (label / colors) in one transaction.
  const update = async (zoneId, { label, color } = {}) => {
    const zone = await db.zones.get(zoneId);
    if (!zone) return;

    const zoneUpdates = {};
    if (label != null) zoneUpdates.label = label;
    if (color != null) zoneUpdates.color = color;
    if (Object.keys(zoneUpdates).length === 0) return;

    const templateUpdates = {};
    if (label != null) templateUpdates.label = label;
    if (color != null) {
      templateUpdates.fillColor = color;
      templateUpdates.strokeColor = color;
    }

    await db.transaction(
      "rw",
      db.zones,
      db.annotationTemplates,
      db.annotations,
      async () => {
        await db.zones.update(zoneId, zoneUpdates);
        if (zone.templateId) {
          await db.annotationTemplates.update(zone.templateId, templateUpdates);
          if (color != null) {
            const annotations = await db.annotations
              .where("annotationTemplateId")
              .equals(zone.templateId)
              .toArray();
            const liveIds = annotations
              .filter((a) => !a.deletedAt)
              .map((a) => a.id);
            await Promise.all(
              liveIds.map((id) =>
                db.annotations.update(id, {
                  fillColor: color,
                  strokeColor: color,
                })
              )
            );
          }
        }
      }
    );

    dispatch(triggerZonesUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());
    if (color != null) dispatch(triggerAnnotationsUpdate());
  };

  return update;
}
