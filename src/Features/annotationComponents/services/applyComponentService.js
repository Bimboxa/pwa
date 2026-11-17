import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

import collectComponentChildren from "./collectComponentChildren";
import { deleteComponentChildRowsInTx } from "./deleteComponentChildrenService";
import { COMPONENT_ITEM_TYPE_STRIP } from "../constants/componentConstants";
import getComponentItems from "../utils/getComponentItems";
import getComponentSignature from "../utils/getComponentSignature";
import isComponentTemplate from "../utils/isComponentTemplate";

function parseMappingCategory(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const parts = entry.split(":");
    if (parts.length !== 2) return null;
    const [nomenclatureKey, categoryKey] = parts.map((s) => s.trim());
    if (!nomenclatureKey || !categoryKey) return null;
    return { nomenclatureKey, categoryKey };
  }
  if (entry.nomenclatureKey && entry.categoryKey) return entry;
  return null;
}

const sameValue = (a, b) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Only the keys whose value actually differs from the stored row.
function diffChanges(existing, next) {
  const changes = {};
  for (const [key, value] of Object.entries(next)) {
    if (!sameValue(existing[key], value)) changes[key] = value;
  }
  return changes;
}

/**
 * (Re)generates the children of a component from its source annotation (see
 * constants/componentConstants.js): one annotation per ENABLED item of the
 * component template, built from the template of the item and carrying the
 * very point refs of the source (shared db.points rows — nothing is copied,
 * see docs/annotations/POINTS_STORAGE.md).
 *
 * Existing children are RECONCILED by `componentElementKey` (the id of their
 * template): updated in place, the others deleted — without their points,
 * which belong to the source. Everything lands in one transaction without
 * undo entry (tx.skipUndo): the rows are derived, undoing the source edit
 * re-derives them (useComponentsSync). The signature the rows were generated
 * from is stored on the source (`componentApplied`).
 *
 * Returns { count } or null when the annotation is not a component source.
 */
export default async function applyComponentService({ sourceId, dispatch }) {
  const source = await db.annotations.get(sourceId);
  if (!source || source.deletedAt || source.componentSourceAnnotationId)
    return null;

  const componentTemplate = source.annotationTemplateId
    ? await db.annotationTemplates.get(source.annotationTemplateId)
    : null;
  if (!isComponentTemplate(componentTemplate) || componentTemplate.deletedAt)
    return null;

  const itemTemplateIds = (componentTemplate.componentItems ?? [])
    .map((item) => item?.annotationTemplateId)
    .filter(Boolean);
  const [templateRows, existing] = await Promise.all([
    itemTemplateIds.length
      ? db.annotationTemplates.bulkGet(itemTemplateIds)
      : [],
    collectComponentChildren({
      sourceIds: [sourceId],
      projectId: source.projectId,
    }),
  ]);
  const templateById = new Map(
    templateRows.filter(Boolean).map((t) => [t.id, t])
  );
  const items = getComponentItems(
    componentTemplate,
    templateById,
    source.componentItemsEnabled
  );
  const signature = getComponentSignature({ source, items });

  // --- desired rows

  const refs = (source.points ?? []).filter((ref) => ref?.id);
  const enabledItems = refs.length >= 2 ? items.filter((i) => i.enabled) : [];
  const desired = enabledItems.map(({ template, type, stripOrientation }) => ({
    template,
    row: {
      ...getNewAnnotationPropsFromAnnotationTemplate(template),
      annotationTemplateProps: { label: template.label },
      projectId: source.projectId,
      baseMapId: source.baseMapId,
      listingId: template.listingId ?? source.listingId,
      layerId: source.layerId,
      type,
      closeLine: Boolean(source.closeLine),
      ...(type === COMPONENT_ITEM_TYPE_STRIP
        ? {
            // side of the component's band, flipped for an "opposite" item
            stripOrientation:
              (source.stripOrientation ?? 1) * (stripOrientation ?? 1),
          }
        : {}),
      points: refs.map((ref) => ({ ...ref })),
      componentSourceAnnotationId: sourceId,
      componentElementKey: template.id,
    },
  }));

  // --- reconcile with the existing rows (by element key)

  const existingByKey = new Map();
  const toDelete = [];
  for (const child of existing) {
    if (
      !child.componentElementKey ||
      existingByKey.has(child.componentElementKey)
    )
      toDelete.push(child);
    else existingByKey.set(child.componentElementKey, child);
  }

  const annotationsToAdd = [];
  const annotationUpdates = [];
  const relsToAdd = [];
  const keptKeys = new Set();

  for (const { row, template } of desired) {
    const current = existingByKey.get(row.componentElementKey);
    const reusable =
      current &&
      current.annotationTemplateId === template.id &&
      current.type === row.type;
    if (reusable) {
      keptKeys.add(row.componentElementKey);
      const changes = diffChanges(current, row);
      if (Object.keys(changes).length)
        annotationUpdates.push({ key: current.id, changes });
      continue;
    }
    const id = nanoid();
    annotationsToAdd.push({ ...row, id });
    for (const entry of template.mappingCategories ?? []) {
      const mc = parseMappingCategory(entry);
      if (!mc) continue;
      relsToAdd.push({
        id: nanoid(),
        annotationId: id,
        projectId: row.projectId,
        nomenclatureKey: mc.nomenclatureKey,
        categoryKey: mc.categoryKey,
        source: "annotationTemplate",
      });
    }
  }
  for (const [key, child] of existingByKey) {
    if (!keptKeys.has(key)) toDelete.push(child);
  }

  const count = desired.length;
  const rowsChanged =
    annotationsToAdd.length > 0 ||
    annotationUpdates.length > 0 ||
    toDelete.length > 0;
  const stampChanged =
    source.componentApplied?.signature !== signature ||
    source.componentApplied?.count !== count;
  if (!rowsChanged && !stampChanged) return { count };

  // --- write

  await db.transaction(
    "rw",
    db.annotations,
    db.relAnnotationMappingCategory,
    async (tx) => {
      tx.skipUndo = true;
      await deleteComponentChildRowsInTx(toDelete);
      if (annotationsToAdd.length)
        await db.annotations.bulkAdd(annotationsToAdd);
      if (annotationUpdates.length)
        await db.annotations.bulkUpdate(annotationUpdates);
      if (relsToAdd.length)
        await db.relAnnotationMappingCategory.bulkAdd(relsToAdd);
      if (stampChanged) {
        const fresh = await db.annotations.get(sourceId);
        if (fresh && !fresh.deletedAt) {
          await db.annotations.update(sourceId, {
            componentApplied: { signature, count },
          });
        }
      }
    }
  );

  dispatch?.(triggerAnnotationsUpdate());
  return { count };
}
