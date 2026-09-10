import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

// Keys of the synthesized template that are NOT annotationTemplate row fields —
// they only carry import-time metadata and must not reach the DB.
const NON_ROW_KEYS = ["incomplete"];

/**
 * Can an existing annotationTemplate row be reused as-is by an import?
 * Single source of truth for the rule, shared with the panel's preview.
 */
export function isImportTemplateReusable(row, projectId) {
  return Boolean(row && !row.deletedAt && row.projectId === projectId);
}

/**
 * Decide, for each template of the import payload, whether it already exists in
 * the target DB or must be created.
 *
 * The "dump" format references templates by their SOURCE db id, so re-importing
 * a selection into the project it was copied from must reuse the very same
 * template instead of duplicating it. Reuse requires a LIVE row of the SAME
 * project — a soft-deleted row is not resurrected (the user deleted it on
 * purpose) and a row belonging to another project is not hijacked; both get a
 * fresh id instead. A template absent from the DB is created keeping the source
 * id, which makes a second import of the same payload idempotent.
 *
 * The reuse rule is mirrored by isImportTemplateReusable so the panel can show
 * "existant / à créer" before the import runs, without a second query.
 *
 * Only the "dump" format opts into id preservation: its ids are real nanoids
 * minted by this app. The inline-JSON format uses author-chosen local ids
 * ("tpl_concrete", ...) that would collide across unrelated drawings, so it
 * always gets fresh ids and never matches an existing row.
 *
 * @param {Object} params
 * @param {Object[]} params.templates - synthesized templates (id + row fields)
 * @param {string} params.projectId
 * @param {string} params.listingId   - target listing for the created templates
 * @param {boolean} params.preserveIds - true for the dump format (see above)
 * @returns {Promise<{templateIdMap: Map<string,string>, templateRecords: Object[], reusedIds: Set<string>}>}
 */
export default async function resolveImportTemplatesService({
  templates,
  projectId,
  listingId,
  preserveIds,
}) {
  const templateIdMap = new Map();
  const templateRecords = [];
  const reusedIds = new Set();

  if (!templates?.length) return { templateIdMap, templateRecords, reusedIds };

  const existingRows = preserveIds
    ? await db.annotationTemplates.bulkGet(templates.map((t) => t.id))
    : [];

  let lastIndex = null;
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const existing = existingRows[i];

    // Live row of this project → reuse as-is, nothing to create.
    if (isImportTemplateReusable(existing, projectId)) {
      templateIdMap.set(template.id, existing.id);
      reusedIds.add(template.id);
      continue;
    }

    // Row not reusable (soft-deleted, or another project's) → fresh id. Missing
    // row → keep the source id so a second import of the payload reuses this one.
    const id = preserveIds && !existing ? template.id : nanoid();
    templateIdMap.set(template.id, id);

    const orderIndex = generateKeyBetween(lastIndex, null);
    lastIndex = orderIndex;

    const record = { ...template, id, projectId, listingId, orderIndex };
    for (const key of NON_ROW_KEYS) delete record[key];
    if (!record.drawingShape) {
      record.drawingShape = resolveDrawingShapeFromType(record.type);
    }
    record.code = getAnnotationTemplateCode({
      annotation: record,
      listingKey: listingId,
    });
    templateRecords.push(record);
  }

  return { templateIdMap, templateRecords, reusedIds };
}
