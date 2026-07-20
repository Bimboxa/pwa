import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// The zone selected in the zonings drawer, resolved with its POLYGON
// annotationTemplate (drives the "Nouvelle zone" section of the popper).
export default function useSelectedZone() {
  const selectedZoneId = useSelector((s) => s.zonings.selectedZoneId);
  const zonesUpdatedAt = useSelector((s) => s.zonings.zonesUpdatedAt);
  const templatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );

  const value = useLiveQuery(async () => {
    if (!selectedZoneId) return null;
    const zone = await db.zones.get(selectedZoneId);
    if (!zone || zone.deletedAt) return null;
    const template = zone.templateId
      ? await db.annotationTemplates.get(zone.templateId)
      : null;
    return {
      zone,
      template: template && !template.deletedAt ? template : null,
    };
  }, [selectedZoneId, zonesUpdatedAt, templatesUpdatedAt]);

  return { zone: value?.zone ?? null, template: value?.template ?? null };
}
