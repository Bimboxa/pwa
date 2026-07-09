import { nanoid } from "@reduxjs/toolkit";

/**
 * Mint brand-new db.points records for a cloned annotation so the duplicate
 * no longer shares point refs with its source.
 *
 * The annotation reaches us with point refs resolved to PIXEL space (from
 * useAnnotationsV2). New db.points records must be stored NORMALIZED to [0..1]
 * vs imageSize, so we divide back here — matching pasteAnnotationService /
 * duplicateAndMovePoint. See docs/annotations/POINTS_STORAGE.md.
 *
 * A single oldId → newId map is shared across the main contour and every cut,
 * so a point referenced in several places yields exactly one new record.
 *
 * @param {object} annotation fully-built cloned annotation (pixel-space refs)
 * @param {object} ctx { imageSize, projectId, baseMapId, listingId }
 * @returns {{ annotation: object, pointRecords: object[] }}
 */
export default function duplicateAnnotationPoints(annotation, ctx) {
  const { imageSize, projectId, baseMapId, listingId } = ctx || {};
  if (!annotation) return { annotation, pointRecords: [] };

  const width = imageSize?.width;
  const height = imageSize?.height;

  const idMap = new Map(); // oldId → newId
  const pointRecords = [];

  // Remap one array of point refs, minting new points as needed.
  function remapRefs(refs) {
    if (!Array.isArray(refs)) return refs;
    return refs.map((ref) => {
      if (!ref || ref.id == null) return ref;

      const hasCoords =
        typeof ref.x === "number" &&
        typeof ref.y === "number" &&
        width > 0 &&
        height > 0;

      // Without usable coords we can't create a valid db.points record;
      // keep the original ref rather than emitting a dangling one.
      if (!hasCoords) return ref;

      let newId = idMap.get(ref.id);
      if (!newId) {
        newId = nanoid();
        idMap.set(ref.id, newId);
        pointRecords.push({
          id: newId,
          x: ref.x / width,
          y: ref.y / height,
          projectId,
          baseMapId,
          // Informative only — nothing must rely on a point's listingId (the
          // export/purge paths key on referenced ids / baseMapId).
          listingId,
        });
      }

      // Strip inline pixel x/y so pointsIndex (db.points) is the single source
      // of truth; preserve ref-level metadata (type, offsets, ...).
      const rest = { ...ref };
      delete rest.x;
      delete rest.y;
      return { ...rest, id: newId };
    });
  }

  const nextAnnotation = { ...annotation };

  if (Array.isArray(annotation.points)) {
    nextAnnotation.points = remapRefs(annotation.points);
  }

  if (Array.isArray(annotation.cuts)) {
    nextAnnotation.cuts = annotation.cuts.map((cut) =>
      cut && Array.isArray(cut.points)
        ? { ...cut, points: remapRefs(cut.points) }
        : cut
    );
  }

  return { annotation: nextAnnotation, pointRecords };
}
