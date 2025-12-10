import { nanoid } from "@reduxjs/toolkit";
import db from "App/db/db";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

export default async function migrateLegacyAnnotations(annotations) {
    const newPoints = [];
    const updatedAnnotations = [];

    for (const annotation of annotations) {
        let isLegacy = false;
        const newAnnotationPointsRefs = [];

        // CASE 1: Legacy Array of Points (Polygon/Polyline)
        if (annotation.points && Array.isArray(annotation.points) && annotation.points.length > 0) {
            const firstPoint = annotation.points[0];
            // Check if it's legacy: has x and y directly in the point object
            if (testObjectHasProp(firstPoint, "x") || testObjectHasProp(firstPoint, "y")) {
                isLegacy = true;

                for (const point of annotation.points) {
                    const newPointId = nanoid();
                    const newPoint = {
                        id: newPointId,
                        x: point.x,
                        y: point.y,
                        baseMapId: annotation.baseMapId,
                        projectId: annotation.projectId,
                        listingId: annotation.listingId,
                        forMarker: annotation.type === "MARKER", // heuristic
                    };

                    newPoints.push(newPoint);
                    newAnnotationPointsRefs.push({ id: newPointId });
                }
            } else {
                // Already migrated or empty? Keep existing refs if valid
                // But if it's not legacy, we assume we don't touch it unless it matches Case 2
                // We just copy them? No, if !isLegacy we might not need to do anything here.
                // But wait, what if it falls into Case 2 properties?
            }
        }

        // CASE 2: Legacy Top-level x,y (Marker)
        // Note: Some legacy markers might also have a points array [ {x,y} ], so we handle Case 1 first.
        // If it was Case 1, we already built newAnnotationPointsRefs. Use them.
        // If NOT Case 1 (or empty points), check for top-level x,y.

        if (testObjectHasProp(annotation, "x") || testObjectHasProp(annotation, "y")) {
            isLegacy = true;

            // If we haven't created points yet (e.g. points array was empty or missing)
            if (newAnnotationPointsRefs.length === 0) {
                const newPointId = nanoid();
                const newPoint = {
                    id: newPointId,
                    x: annotation.x,
                    y: annotation.y,
                    baseMapId: annotation.baseMapId,
                    projectId: annotation.projectId,
                    listingId: annotation.listingId,
                    forMarker: true,
                };
                newPoints.push(newPoint);
                newAnnotationPointsRefs.push({ id: newPointId });
            }
        }

        if (isLegacy) {
            const updatedAnnotation = {
                ...annotation,
                points: newAnnotationPointsRefs,
            };
            // Clean up legacy props
            delete updatedAnnotation.x;
            delete updatedAnnotation.y;

            updatedAnnotations.push(updatedAnnotation);
        }
    }

    if (newPoints.length > 0) {
        await db.points.bulkAdd(newPoints);
    }

    if (updatedAnnotations.length > 0) {
        await db.annotations.bulkPut(updatedAnnotations);
    }
}