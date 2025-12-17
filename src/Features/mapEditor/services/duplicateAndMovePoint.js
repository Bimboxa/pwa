import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";
import { addPolylinePoint } from "../mapEditorSlice";

export default async function duplicateAndMovePoint({ originalPointId, annotationId, newPos, imageSize, annotations }) {

    console.log("[duplicateAndMovePoint]", originalPointId, annotationId, newPos, imageSize, annotations);

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
        const updates = {};

        // A. Vérification et mise à jour du contour principal (Main Points)
        if (annotation.points) {
            updates.points = annotation.points.map(pt =>
                pt.id === originalPointId ? { ...pt, id: newPointId } : pt
            );
        }

        // B. Vérification et mise à jour des trous (Cuts)
        if (annotation.cuts && Array.isArray(annotation.cuts)) {
            updates.cuts = annotation.cuts.map(cut => {
                // On mappe sur les points de chaque 'cut'
                const updatedCutPoints = cut.points.map(pt =>
                    pt.id === originalPointId ? { ...pt, id: newPointId } : pt
                );

                // On retourne le cut avec ses points mis à jour
                return { ...cut, points: updatedCutPoints };
            });
        }

        // 3. Sauvegarde des modifications (points et/ou cuts)
        await db.annotations.update(annotationId, updates);
    }
}