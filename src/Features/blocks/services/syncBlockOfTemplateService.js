import db from "App/db/db";

import {
  isBlockInstanceAnnotation,
  isBlockTemplate,
} from "../utils/blockTypes";
import createBlockService from "./createBlockService";

// Keeps a BLOCK annotation template and its block consistent. Called when
// the template is created or updated:
//   - no (live) block behind `template.blockId`: a block named after the
//     template is created in the template's scope;
//   - else the block takes the template's label;
//   - the instances of the block that carry no template yet (placed before
//     the template existed) are attached to it, in one batch.
// `scopeId`: fallback when the template's listing carries none.
// Returns the block id (to store on the template), or null when the
// template is not a BLOCK one / no scope is known.
export default async function syncBlockOfTemplateService({
  template,
  scopeId: fallbackScopeId,
}) {
  if (!isBlockTemplate(template)) return null;

  const listing = template.listingId
    ? await db.listings.get(template.listingId)
    : null;
  const projectId = template.projectId ?? listing?.projectId;
  const scopeId = listing?.scopeId ?? fallbackScopeId;
  const label = template.label?.trim();

  let block = template.blockId ? await db.blocks.get(template.blockId) : null;
  if (!block || block.deletedAt) {
    if (!projectId || !scopeId) return null;
    block = await createBlockService({ projectId, scopeId, label });
  } else if (label && block.label !== label) {
    await db.blocks.update(block.id, { label });
  }

  if (template.id) {
    const orphanInstanceIds = (
      await db.annotations.where("instanceOfBlockId").equals(block.id).toArray()
    )
      .filter(
        (a) =>
          !a.deletedAt &&
          isBlockInstanceAnnotation(a) &&
          !a.annotationTemplateId
      )
      .map((a) => a.id);
    if (orphanInstanceIds.length > 0) {
      await db.annotations.bulkUpdate(
        orphanInstanceIds.map((key) => ({
          key,
          changes: { annotationTemplateId: template.id },
        }))
      );
    }
  }

  return block.id;
}
