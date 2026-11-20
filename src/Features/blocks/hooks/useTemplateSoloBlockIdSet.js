import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { isBlockMemberAnnotation } from "../utils/blockTypes";

const EMPTY_SET = new Set();

// Ids of the blocks holding at least one member drawn with the given
// annotation template. Used by the template SOLO filter of useAnnotationsV2:
// a block instance carries no template of its own, it follows the templates
// of its block's members. Queries only when a templateId is set; returns a
// stable empty Set otherwise.
export default function useTemplateSoloBlockIdSet(templateId) {
  const blockIds = useLiveQuery(async () => {
    if (!templateId) return null;
    const rows = await db.annotations
      .where("annotationTemplateId")
      .equals(templateId)
      .toArray();
    const ids = new Set();
    rows.forEach((a) => {
      if (!a.deletedAt && isBlockMemberAnnotation(a)) ids.add(a.blockId);
    });
    return [...ids].sort();
  }, [templateId]);

  const key = blockIds?.join(",") ?? "";

  return useMemo(() => (key ? new Set(blockIds) : EMPTY_SET), [key]);
}
