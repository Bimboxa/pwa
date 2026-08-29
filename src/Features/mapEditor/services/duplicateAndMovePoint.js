import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import { remapPointIds } from "Features/annotations/utils/remapAnnotationRefs";
import { SEGMENT_FLAG_FIELDS } from "Features/annotations/utils/segmentFlags";
import remapOpeningAnchorsForHosts from "Features/annotations/services/remapOpeningAnchorsForHosts";

// Fork commit: the dragged vertex is shared with other annotations, so the
// edited annotation gets a FRESH point row at the new position and every ref
// it holds on the original id is rewritten — neighbours keep the original,
// unmoved point. remapPointIds covers points / cuts / innerPoints /
// guideLines / isoHeightLines / profileLines and the segment-flag id arrays
// (root + per-cut), so flags and guides survive the id swap.
export default async function duplicateAndMovePoint({ originalPointId, annotationId, newPos, imageSize, annotations }) {

    // originaPoint

    const originalPoint = await db.points.get(originalPointId);

    // 1. Créer le nouveau point physique en base
    const newPointId = nanoid();
    const newPointEntity = {
        ...originalPoint, // ... pensez à rajouter projectId / listingId si nécessaire ici
        id: newPointId,
        x: newPos.x / imageSize.width,
        y: newPos.y / imageSize.height,
    };
    await db.points.add(newPointEntity);

    // 2. Récupérer l'annotation cible
    const annotation = annotations.find(a => a.id === annotationId);

    if (annotation) {
        const pointIdMap = { [originalPointId]: newPointId };
        const remapped = { ...annotation };
        remapPointIds(remapped, pointIdMap);

        // Persist only the ref fields present on the source annotation.
        const updates = {};
        const refFields = [
            "points",
            "cuts",
            "innerPoints",
            "guideLines",
            "isoHeightLines",
            "profileLines",
            "point",
            ...SEGMENT_FLAG_FIELDS.map(({ idField }) => idField),
        ];
        for (const field of refFields) {
            if (annotation[field] !== undefined) updates[field] = remapped[field];
        }

        // Clear rotation metadata: moving a vertex "bakes in" the rotation
        if (annotation.rotation || annotation.rotationCenter) {
            updates.rotation = 0;
            updates.rotationCenter = null;
        }

        // 3. Sauvegarde des modifications
        await db.annotations.update(annotationId, updates);

        // 4. Openings glued on this host anchor on point IDS — follow the id
        // swap so the commit-time reflow keeps their exact hostDistanceM.
        // Only this host: sharers keep the original, unmoved point.
        await remapOpeningAnchorsForHosts({
            hostAnnotationIds: [annotationId],
            pointIdMap,
        });
    }

    return { newPointId };
}
