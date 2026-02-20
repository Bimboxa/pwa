import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import splitPolygonByPolyline from "Features/geometry/utils/splitPolygonByPolyline";
import splitPolylineByPolyline from "Features/geometry/utils/splitPolylineByPolyline";

import db from "App/db/db";

export default function useHandleSplitCommit() {

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);

    const baseMap = useMainBaseMap();
    const createEntity = useCreateEntity();
    const newEntity = useNewEntity();
    const createAnnotation = useCreateAnnotation();
    const updateAnnotation = useUpdateAnnotation();

    // main

    const handleSplitCommit = async (rawCuttingPoints, { splitHostId }) => {

        const imageSize = baseMap?.image?.imageSize;
        if (!imageSize) {
            console.warn("[useHandleSplitCommit] No image size available");
            return;
        }

        // 1. Fetch host annotation
        const hostAnnotation = await db.annotations.get(splitHostId);
        if (!hostAnnotation) {
            console.warn("[useHandleSplitCommit] Host annotation not found:", splitHostId);
            return;
        }

        // 2. Fetch and resolve host points (convert from relative to relative — they're already in 0-1)
        const hostPointIds = hostAnnotation.points?.map(p => p.id) ?? [];
        const hostPointsRaw = await db.points.bulkGet(hostPointIds);
        const hostPoints = hostPointIds.map((id, i) => ({
            id,
            x: hostPointsRaw[i]?.x,
            y: hostPointsRaw[i]?.y,
        })).filter(p => p.x !== undefined && p.y !== undefined);

        if (hostPoints.length < 2) {
            console.warn("[useHandleSplitCommit] Not enough host points");
            return;
        }

        // 3. Convert cutting points from pixel to relative coords
        const cuttingPoints = rawCuttingPoints.map(p => ({
            x: p.x / imageSize.width,
            y: p.y / imageSize.height,
        }));

        // 4. Compute split based on annotation type
        let result;
        if (["POLYGON", "STRIP"].includes(hostAnnotation.type)) {
            result = splitPolygonByPolyline(hostPoints, cuttingPoints);
        } else if (hostAnnotation.type === "POLYLINE") {
            result = splitPolylineByPolyline(hostPoints, cuttingPoints);
        }

        if (!result) {
            console.warn("[useHandleSplitCommit] Split computation failed");
            return;
        }

        const { piece1, piece2, newPoints } = result;

        console.log("[useHandleSplitCommit] Split result", { piece1, piece2, newPoints });

        // 5. Save new points to DB
        if (newPoints.length > 0) {
            const pointsToSave = newPoints.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                baseMapId,
                projectId,
                listingId,
            }));
            await db.points.bulkAdd(pointsToSave);
        }

        // 6. Update original annotation with piece1 points (keep original entity)
        await updateAnnotation({
            ...hostAnnotation,
            points: piece1.map(p => ({ id: p.id })),
        });

        // 7. Create new entity for piece2
        const entity = await createEntity(newEntity);

        // 8. Create new annotation for piece2
        const { id: _discardId, entityId: _discardEntityId, cuts: _discardCuts, ...hostProps } = hostAnnotation;
        await createAnnotation({
            ...hostProps,
            id: nanoid(),
            entityId: entity.id,
            points: piece2.map(p => ({ id: p.id })),
        });

        console.log("[useHandleSplitCommit] Split completed successfully");
    };

    return handleSplitCommit;
}
