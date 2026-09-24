import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import resyncBaseMapLinkPlacementsService from "./resyncBaseMapLinkPlacementsService";

// "Inverser le sens": swap the two point REFERENCES of a BASE_MAP_LINK (no
// db.points write — see docs/annotations/POINTS_STORAGE.md). The observer
// side of the section mark is the screen-right of p1 → p2, so reversing the
// order flips the elevation to face the other way; the clones re-pose.
export default async function reverseBaseMapLinkDirectionService({
  linkId,
  dispatch,
}) {
  if (!linkId) return;
  const link = await db.annotations.get(linkId);
  if (!link || link.deletedAt || !Array.isArray(link.points)) return;
  if (link.points.length < 2) return;
  await db.annotations.update(linkId, {
    points: [...link.points].reverse(),
  });
  dispatch?.(triggerAnnotationsUpdate());
  if (!link.sourceLinkAnnotationId) {
    await resyncBaseMapLinkPlacementsService({
      sourceLinkId: linkId,
      dispatch,
    });
  } else {
    await resyncBaseMapLinkPlacementsService({ cloneId: linkId, dispatch });
  }
}
