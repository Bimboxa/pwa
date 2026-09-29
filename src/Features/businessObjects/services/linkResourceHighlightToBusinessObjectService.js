import { nanoid } from "nanoid";

import db from "App/db/db";

// Links a highlighted zone of a PDF document resource to a business object.
// One row = the link and its zone (see db.relsBusinessObjectResource).
// `rects` are normalized [0..1] in the page's INTRINSIC rotation frame.
export default async function linkResourceHighlightToBusinessObjectService({
  businessObject,
  resource,
  pageNumber,
  rects,
  text,
}) {
  if (!businessObject?.id || !resource?.id || !rects?.length) return null;

  const rel = {
    id: nanoid(),
    projectId: businessObject.projectId,
    scopeId: businessObject.scopeId,
    listingId: businessObject.listingId,
    businessObjectId: businessObject.id,
    resourceId: resource.id,
    resourceName: resource.name,
    pageNumber,
    rects,
    text: text ?? "",
  };
  await db.relsBusinessObjectResource.add(rel);
  return rel;
}
