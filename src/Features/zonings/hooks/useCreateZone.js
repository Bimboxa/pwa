import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import { useDispatch } from "react-redux";

import { triggerZonesUpdate } from "../zoningsSlice";
import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";

import { DEFAULT_ZONE_COLOR } from "../constants/zoningEntityModel";

export default function useCreateZone() {
  const dispatch = useDispatch();

  // Creates the zone row AND its POLYGON annotationTemplate eagerly (one
  // transaction): every zone always has a template, so the popper arming and
  // the zone SOLO filter need no lazy-creation branches.
  const create = async ({ listing, parentId, label, color }) => {
    const listingId = listing.id;
    const projectId = listing.projectId;
    const scopeId = listing.scopeId;
    const _color = color || DEFAULT_ZONE_COLOR;
    const _label = label || "Nouvelle zone";

    // sortIndex after the last sibling (fractional indexing)
    const siblings = (
      await db.zones.where("listingId").equals(listingId).toArray()
    ).filter((z) => !z.deletedAt && (z.parentId ?? null) === (parentId ?? null));
    const lastSortIndex = siblings
      .map((z) => z.sortIndex)
      .filter((s) => s != null)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .pop();

    const zoneId = nanoid();
    const templateId = nanoid();

    const zone = {
      id: zoneId,
      listingId,
      projectId,
      scopeId,
      parentId: parentId ?? null,
      label: _label,
      color: _color,
      sortIndex: generateKeyBetween(lastSortIndex ?? null, null),
      templateId,
    };

    const template = {
      id: templateId,
      projectId,
      listingId,
      zoneId,
      label: _label,
      drawingShape: "POLYGON",
      fillColor: _color,
      fillOpacity: 0.3,
      fillType: "SOLID",
      strokeColor: _color,
      strokeWidth: 2,
      strokeOpacity: 1,
      isZoneAnnotation: true,
      code: getAnnotationTemplateCode({
        annotation: { type: "POLYGON", fillColor: _color },
        listingKey: listingId,
      }),
    };

    await db.transaction("rw", db.zones, db.annotationTemplates, async () => {
      await db.zones.add(zone);
      await db.annotationTemplates.add(template);
    });

    dispatch(triggerZonesUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return zone;
  };

  return create;
}
