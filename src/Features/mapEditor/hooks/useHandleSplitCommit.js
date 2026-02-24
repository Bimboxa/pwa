import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";

import splitPolygonByPolyline from "Features/geometry/utils/splitPolygonByPolyline";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

export default function useHandleSplitCommit() {

    // data

    const dispatch = useDispatch();

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);

    const baseMap = useMainBaseMap();
    const createEntity = useCreateEntity();
    const newEntity = useNewEntity();
    const createAnnotation = useCreateAnnotation();
    const updateAnnotation = useUpdateAnnotation();

    // helpers

    /**
     * Fetch annotation points from DB and return them as [{id, x, y}, ...].
     */
    async function resolveAnnotationPoints(annotation) {
        const pointIds = annotation.points?.map(p => p.id) ?? [];
        const pointsRaw = await db.points.bulkGet(pointIds);
        return pointIds
            .map((id, i) => ({
                id,
                x: pointsRaw[i]?.x,
                y: pointsRaw[i]?.y,
            }))
            .filter(p => p.x !== undefined && p.y !== undefined);
    }

    /**
     * Split a single annotation by the cutting polyline.
     * @param {object} annotation - The annotation to split
     * @param {Array} cuttingPoints - Cutting polyline in relative coords
     * @param {Map} sharedPointsRegistry - Shared registry (coordKey → pointId) across splits
     * @param {Set} savedPointIds - Set of point IDs already persisted to DB
     * @returns {Promise<boolean>} true if the annotation was split
     */
    async function splitOneAnnotation(annotation, cuttingPoints, sharedPointsRegistry, savedPointIds) {
        const hostPoints = await resolveAnnotationPoints(annotation);
        if (hostPoints.length < 3) return false;

        const result = splitPolygonByPolyline(hostPoints, cuttingPoints, sharedPointsRegistry);
        if (!result) return false;

        const { piece1, piece2, newPoints } = result;

        // Save only new intersection points not yet persisted
        const pointsToSave = newPoints
            .filter(p => !savedPointIds.has(p.id))
            .map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                baseMapId,
                projectId,
                listingId,
            }));

        if (pointsToSave.length > 0) {
            await db.points.bulkAdd(pointsToSave);
            for (const p of pointsToSave) {
                savedPointIds.add(p.id);
            }
        }

        // Update original annotation with piece1 (keep original entity)
        await updateAnnotation({
            ...annotation,
            points: piece1.map(p => ({ id: p.id })),
        });

        // Create new entity + annotation for piece2
        const entity = await createEntity(newEntity);
        const { id: _discardId, entityId: _discardEntityId, cuts: _discardCuts, ...hostProps } = annotation;
        await createAnnotation({
            ...hostProps,
            id: nanoid(),
            entityId: entity.id,
            points: piece2.map(p => ({ id: p.id })),
        });

        return true;
    }

    // main

    const handleSplitCommit = async (rawCuttingPoints) => {

        const imageSize = baseMap?.image?.imageSize;
        if (!imageSize) {
            console.warn("[useHandleSplitCommit] No image size available");
            return;
        }

        // 1. Convert cutting points from pixel to relative coords (0-1)
        const cuttingPoints = rawCuttingPoints.map(p => ({
            x: p.x / imageSize.width,
            y: p.y / imageSize.height,
        }));

        // 2. Fetch all POLYGON annotations on the current baseMap
        const allAnnotations = (
            await db.annotations.where("baseMapId").equals(baseMapId).toArray()
        ).filter(a => !a.deletedAt && a.type === "POLYGON");

        if (allAnnotations.length === 0) {
            dispatch(setToaster({ message: "No polygon on this base map", isError: true }));
            return;
        }

        // 3. Split each crossed polygon with a shared point registry
        // so that intersection points on shared edges get the same ID across splits.
        const sharedPointsRegistry = new Map();
        const savedPointIds = new Set();

        let splitCount = 0;
        for (const annotation of allAnnotations) {
            const wasSplit = await splitOneAnnotation(annotation, cuttingPoints, sharedPointsRegistry, savedPointIds);
            if (wasSplit) splitCount++;
        }

        // 4. User feedback
        if (splitCount === 0) {
            dispatch(setToaster({ message: "No polygon crossed by the polyline", isError: true }));
        } else {
            dispatch(setToaster({
                message: `${splitCount} annotation(s) split successfully`,
                isError: false,
            }));
        }
    };

    return handleSplitCommit;
}
