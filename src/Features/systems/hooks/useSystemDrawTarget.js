import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import { SYSTEM_DRAWING_SHAPE } from "../constants/systemConstants";
import getSystemSourceTemplate from "../utils/getSystemSourceTemplate";
import isSystemListing from "../utils/isSystemListing";

// What arming a template row actually draws:
//   - a regular template: itself, in its listing;
//   - a SYSTEM template (`template.systemListingId`): the SOURCE template of
//     the system listing it points to, drawn INTO that listing —
//     `systemTemplateId` (the row's template) rides on the draft so the source
//     annotation remembers which SYSTEM template armed it. `template` is null
//     while the source template loads, or when the system is incomplete (no
//     listing / no source template): nothing can be drawn then.
//
// No query runs for a regular template.
export default function useSystemDrawTarget(template, listingId) {
  const isSystem = resolveDrawingShape(template) === SYSTEM_DRAWING_SHAPE;
  const systemListingId = isSystem ? (template?.systemListingId ?? null) : null;

  const sourceTemplate = useLiveQuery(async () => {
    if (!systemListingId) return null;
    const listing = await db.listings.get(systemListingId);
    if (!isSystemListing(listing)) return null;
    const templates = await db.annotationTemplates
      .where("listingId")
      .equals(systemListingId)
      .toArray();
    return getSystemSourceTemplate(templates);
  }, [systemListingId]);

  if (!isSystem) return { template, listingId, systemTemplateId: null };
  return {
    template: sourceTemplate ?? null,
    listingId: systemListingId,
    systemTemplateId: template?.id ?? null,
  };
}
