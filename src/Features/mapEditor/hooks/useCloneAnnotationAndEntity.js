import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import useMainBaseMap from "./useMainBaseMap";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import getPolygonsPointsFromStripAnnotation from "Features/annotations/utils/getPolygonsPointsFromStripAnnotation";

// Compute signed area to determine polygon winding order.
// Positive = counter-clockwise, negative = clockwise.
function getSignedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

export default function useCloneAnnotationAndEntity() {

    const createAnnotation = useCreateAnnotation();
    const createEntity = useCreateEntity();
    const baseMap = useMainBaseMap()

    const _newAnnotation = useSelector((state) => state.annotations.newAnnotation);
    const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

    return async (annotation, options) => {
        // options
        const entityLabel = options?.entityLabel;
        let newAnnotation = options?.newAnnotation;

        if (!newAnnotation) newAnnotation = _newAnnotation;

        console.log("CLONE with newAnnotation", newAnnotation, _newAnnotation)

        // 1. Identify Logic: Are we splitting a Polygon with cuts into Polylines?
        const isPolygonToPolyline =
            annotation.type === "POLYGON" && newAnnotation.type === "POLYLINE";
        const hasCuts = Array.isArray(annotation.cuts) && annotation.cuts.length > 0;
        const shouldSplitIntoMultiple = isPolygonToPolyline && hasCuts;

        const isStripToPolygon =
            annotation.type === "STRIP" && newAnnotation.type === "POLYGON";

        const isToStrip = newAnnotation.type === "STRIP" && annotation.type !== "STRIP";

        // 2. Prepare the list of items (geometry sets) to create
        // Each item contains { points: [], cuts: [] }
        const itemsToCreate = [];

        if (shouldSplitIntoMultiple) {
            // A. Main Contour -> Becomes 1 independent Polyline
            itemsToCreate.push({
                points: annotation.points,
                cuts: [], // Polylines don't have cuts
            });

            // B. Each Cut -> Becomes 1 independent Polyline
            annotation.cuts.forEach((cut) => {
                if (cut.points && cut.points.length > 0) {
                    itemsToCreate.push({
                        points: cut.points,
                        cuts: [],
                    });
                }
            });
        }

        else if (isStripToPolygon) {
            const polygonsPoints = getPolygonsPointsFromStripAnnotation(annotation, baseMap.meterByPx);
            polygonsPoints.forEach((points) => {
                itemsToCreate.push({
                    points,
                    cuts: [],
                });
            });
        }

        else {
            // Standard Clone (1 to 1)
            // We preserve the cuts if we are not splitting
            itemsToCreate.push({
                points: annotation.points,
                cuts: annotation.cuts,
            });
        }

        // 3. Execution Loop
        const createdAnnotations = [];

        for (const item of itemsToCreate) {
            // A. Create a NEW unique entity for THIS specific geometry
            const entity = await createEntity({
                label: entityLabel,
                listingId: annotation.listingId,
                projectId: annotation.projectId,
            });

            // B. Create the Annotation
            const clonedAnnotation = {
                ...annotation,
                ...newAnnotation, // Apply new type/styles from store
                id: nanoid(),
                entityId: entity?.id, // Link to the newly created entity
                points: item.points,
                cuts: item.cuts,
                ...(activeLayerId ? { layerId: activeLayerId } : {}),
            };

            // Ensure lines are closed if converting from Polygon to Polyline
            if (isPolygonToPolyline || isStripToPolygon) {
                clonedAnnotation.closeLine = true;
            }

            // Handle conversion to STRIP
            if (isToStrip) {
                clonedAnnotation.stripOrientation = 1; // default
                // For polygon/closed-line → strip, orient band inside
                if (annotation.type === "POLYGON" || annotation.closeLine) {
                    clonedAnnotation.closeLine = true;
                    const signedArea = getSignedArea(item.points);
                    // CCW (positive area) → left side is inside → orientation 1
                    // CW (negative area) → right side is inside → orientation -1
                    clonedAnnotation.stripOrientation = signedArea >= 0 ? 1 : -1;
                }
            }

            const _annotation = await createAnnotation(clonedAnnotation);
            createdAnnotations.push(_annotation);
        }

        // Return single object if only one created (backward compatibility), else return array
        return createdAnnotations.length === 1
            ? createdAnnotations[0]
            : createdAnnotations;
    };
}
