import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import getComponentItems from "../utils/getComponentItems";
import isComponentTemplate from "../utils/isComponentTemplate";

const EMPTY = [];

// Items of the component template `annotationTemplateId` (see
// utils/getComponentItems), resolved live against the template rows, with
// `enabledMap` (`componentItemsEnabled` of an annotation / of the draft) laid
// over the defaults. Empty when the template is not a component.
export default function useComponentItems(annotationTemplateId, enabledMap) {
  const resolved = useLiveQuery(async () => {
    if (!annotationTemplateId) return null;
    const componentTemplate =
      await db.annotationTemplates.get(annotationTemplateId);
    if (!isComponentTemplate(componentTemplate) || componentTemplate.deletedAt)
      return null;
    const ids = (componentTemplate.componentItems ?? [])
      .map((item) => item?.annotationTemplateId)
      .filter(Boolean);
    const rows = ids.length ? await db.annotationTemplates.bulkGet(ids) : [];
    return {
      componentTemplate,
      templateById: new Map(rows.filter(Boolean).map((t) => [t.id, t])),
    };
  }, [annotationTemplateId]);

  if (!resolved) return EMPTY;
  return getComponentItems(
    resolved.componentTemplate,
    resolved.templateById,
    enabledMap
  );
}
