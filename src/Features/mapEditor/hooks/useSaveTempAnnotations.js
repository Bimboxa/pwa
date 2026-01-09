import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import db from "App/db/db";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";


export default function useSaveTempAnnotations() {

    const dispatch = useDispatch();

    // data
    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);

    const tempAnnotations = useSelector(s => s.annotations.tempAnnotations);

    const createEntity = useCreateEntity();
    const createAnnotation = useCreateAnnotation();

    const baseMap = useMainBaseMap();

    const saveTempAnnotations = async () => {

        if (!tempAnnotations || tempAnnotations.length === 0) return;

        // image size for normalization
        const { width, height } = baseMap?.getImageSize() ?? { width: 1, height: 1 };

        // Process each temp annotation
        for (const tempAnn of tempAnnotations) {

            // 1. Create Entity
            const entity = await createEntity({});
            const entityId = entity.id;

            const allNewPointsToSave = [];

            // Helper to process points
            const processPoints = (points) => {
                const pointIds = [];
                for (const pt of points) {
                    const newId = nanoid();
                    const newPointEntity = {
                        id: newId,
                        x: pt.x / width,
                        y: pt.y / height,
                        baseMapId,
                        projectId,
                        listingId,
                        forMarker: tempAnn.type === "MARKER",
                    };
                    allNewPointsToSave.push(newPointEntity);
                    pointIds.push(newId);
                }
                return pointIds;
            };

            // 2. Process Main Points
            const mainPointIds = processPoints(tempAnn.points || []);

            // 3. Process Cuts
            const finalCuts = [];
            if (tempAnn.cuts && tempAnn.cuts.length > 0) {
                for (const cut of tempAnn.cuts) {
                    const cutPointIds = processPoints(cut.points || []);
                    finalCuts.push({
                        points: cutPointIds.map(id => ({ id }))
                    });
                }
            }

            // 4. Save All Points for this annotation
            if (allNewPointsToSave.length > 0) {
                await db.points.bulkAdd(allNewPointsToSave);
            }

            // 5. Create Annotation
            const _newAnnotation = {
                ...tempAnn,
                id: nanoid(),
                entityId,
                baseMapId,
                projectId,
                listingId,

                // Main Points
                points: mainPointIds.map(id => ({ id })),

                // Cuts
                cuts: finalCuts,

                // Ensure type matches
                type: tempAnn.type || "POLYGON",

                // Default props if needed (color, etc.)
                strokeColor: tempAnn.strokeColor || "#2196f3", // Default blue if missing
                fillColor: tempAnn.fillColor || "#2196f3",

                closeLine: true // Force closed for polygons coming from temp
            };

            await createAnnotation(_newAnnotation);
        }

        // Clear temp annotations
        dispatch(setTempAnnotations([]));
    };

    return saveTempAnnotations;
}