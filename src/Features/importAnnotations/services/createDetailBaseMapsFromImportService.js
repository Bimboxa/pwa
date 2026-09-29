import db from "App/db/db";
import editor from "App/editor";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import findDetailBaseMap from "Features/baseMaps/services/findDetailBaseMap";
import findOrCreateDetailBaseMap from "Features/baseMaps/services/findOrCreateDetailBaseMap";

/**
 * Creates (or reuses) the detail baseMaps described by the `baseMaps` block
 * of an import payload. Runs BEFORE the annotations are placed: the DETAIL
 * bubbles reference these baseMaps by payload id, remapped through the
 * returned `baseMapIdMap`.
 *
 * @param {Object} params
 * @param {Object[]} params.baseMaps - validated payload entries
 * @param {string} params.projectId
 * @param {*} params.createdBy
 * @param {Function} params.resolveAttachment - async (attachmentId, fileName)
 *   → resource id or null. The caller knows what an attachment id is (a
 *   resource id for Prompt IA, a relay pdfId for live jobs).
 * @param {Object} [params.baseMapProps] - spread onto every CREATED baseMap
 * @param {Function} [params.dispatch]
 * @returns {Promise<{baseMapIdMap: Map<string,string>, createdBaseMapIds: string[], reusedBaseMapIds: string[]}>}
 */
export default async function createDetailBaseMapsFromImportService({
  baseMaps,
  projectId,
  createdBy = null,
  resolveAttachment,
  baseMapProps = null,
  dispatch,
}) {
  const baseMapIdMap = new Map();
  const createdBaseMapIds = [];
  const reusedBaseMapIds = [];

  try {
    for (const entry of baseMaps ?? []) {
      const source = entry.source;
      const resourceId = resolveAttachment
        ? await resolveAttachment(source.attachmentId, source.fileName ?? null)
        : null;
      if (!resourceId) {
        throw new Error(
          `Pièce jointe introuvable : ${source.fileName ?? source.attachmentId}.`
        );
      }

      const target = {
        resourceId,
        pageNumber: source.pageNumber,
        projectId,
        bboxInRatio: source.bboxInRatio ?? null,
      };
      const existing = await findDetailBaseMap(target);
      const record =
        existing ??
        (await findOrCreateDetailBaseMap({
          ...target,
          rotation: source.rotation ?? 0,
          createdBy,
          name: entry.name ?? null,
          detailRef: entry.detailRef ?? null,
          props: baseMapProps,
        }));
      if (!record) {
        throw new Error(
          `Fond de détail « ${
            entry.name ?? entry.id
          } » : le PDF n'est pas disponible (page ${source.pageNumber}).`
        );
      }

      if (existing) {
        reusedBaseMapIds.push(record.id);
        // The bubble text is the baseMap's detailRef: fill it when missing.
        const detailRef = entry.detailRef?.trim();
        if (!existing.detailRef && detailRef) {
          await db.baseMaps.update(existing.id, { detailRef });
        }
      } else {
        createdBaseMapIds.push(record.id);
      }
      baseMapIdMap.set(entry.id, record.id);
    }
  } catch (e) {
    await deleteCreatedDetailBaseMaps(createdBaseMapIds, dispatch);
    throw e;
  }

  if (createdBaseMapIds.length) dispatch?.(triggerEntitiesTableUpdate("baseMaps"));

  return { baseMapIdMap, createdBaseMapIds, reusedBaseMapIds };
}

// Rollback of baseMaps created by a failed import: nothing was drawn on them
// yet, so the rows and their session images are simply dropped.
export async function deleteCreatedDetailBaseMaps(ids, dispatch) {
  if (!ids?.length) return;
  await db.baseMaps.bulkDelete(ids);
  for (const id of ids) {
    if (editor.baseMapsCache) delete editor.baseMapsCache[id];
  }
  dispatch?.(triggerEntitiesTableUpdate("baseMaps"));
}
