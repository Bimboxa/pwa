import {
  COMPONENT_ITEM_TYPE_POLYLINE,
  COMPONENT_ITEM_TYPE_STRIP,
} from "../constants/componentConstants";

// Annotation type generated for an item: its own `type`, else a band when the
// template draws bands by default, else a line.
export function getComponentItemType(item, template) {
  if (
    item?.type === COMPONENT_ITEM_TYPE_STRIP ||
    item?.type === COMPONENT_ITEM_TYPE_POLYLINE
  )
    return item.type;
  return String(template?.defaultTool ?? "").startsWith("STRIP")
    ? COMPONENT_ITEM_TYPE_STRIP
    : COMPONENT_ITEM_TYPE_POLYLINE;
}

/**
 * Items of a component template, resolved against the template rows:
 *
 *   [{ annotationTemplateId, template, type, enabledByDefault, enabled }]
 *
 * `enabledMap` = `componentItemsEnabled` of a source annotation (or of the
 * draft being drawn): its entries win over the defaults of the template.
 * Items whose template is missing / deleted are dropped, duplicates too.
 */
export default function getComponentItems(
  componentTemplate,
  templateById,
  enabledMap
) {
  const items = [];
  const seen = new Set();
  for (const item of componentTemplate?.componentItems ?? []) {
    const id = item?.annotationTemplateId;
    if (!id || seen.has(id) || id === componentTemplate.id) continue;
    const template = templateById?.get
      ? templateById.get(id)
      : templateById?.[id];
    if (!template || template.deletedAt) continue;
    seen.add(id);
    const enabledByDefault = item.enabled !== false;
    const override = enabledMap?.[id];
    items.push({
      annotationTemplateId: id,
      template,
      type: getComponentItemType(item, template),
      enabledByDefault,
      enabled: typeof override === "boolean" ? override : enabledByDefault,
    });
  }
  return items;
}
