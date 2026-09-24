import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import collectBaseMapLinkCloneIds from "./collectBaseMapLinkCloneIds";

// Change (or clear, with `linkedBaseMapId: null`) the vertical base map a
// BASE_MAP_LINK section mark targets. A clone drawn for the previous target
// no longer means anything (a link has ONE target), so the existing clones
// are deleted through the regular delete hook (listing order, points…).
export default async function setBaseMapLinkTargetService({
  linkId,
  linkedBaseMapId,
  deleteAnnotations,
  dispatch,
}) {
  if (!linkId) return;
  const link = await db.annotations.get(linkId);
  if (!link || link.deletedAt) return;
  const next = linkedBaseMapId ?? null;
  if ((link.linkedBaseMapId ?? null) === next) return;

  const cloneIds = await collectBaseMapLinkCloneIds([linkId]);
  if (cloneIds.length > 0 && deleteAnnotations) {
    await deleteAnnotations(cloneIds);
  }
  await db.annotations.update(linkId, { linkedBaseMapId: next });
  dispatch?.(triggerAnnotationsUpdate());
}
