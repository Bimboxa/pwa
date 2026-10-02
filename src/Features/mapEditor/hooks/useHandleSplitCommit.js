import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import splitPolygonByPolyline from "Features/geometry/utils/splitPolygonByPolyline";
import splitPolylineAtVertex from "Features/mapEditor/utils/splitPolylineAtVertex";

import { setToaster } from "Features/layout/layoutSlice";
import { copyMeshPaintsForSplit } from "Features/meshPaint/services/copyMeshPaintsService";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

export default function useHandleSplitCommit() {

    // data

    const dispatch = useDispatch();

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);

    const baseMap = useMainBaseMap();
    const createAnnotation = useCreateAnnotation();
    const updateAnnotation = useUpdateAnnotation();

    // helpers

    /**
     * Second piece of a split: created, then the painted parts (« Pinceau »
     * 3D) of the original are distributed over the two pieces (kept,
     * re-hosted or spread — copyMeshPaintsForSplit). Inside the caller's
     * undo group.
     */
    async function createSecondPiece(annotation, props) {
        const hostProps = { ...annotation };
        delete hostProps.id;
        delete hostProps.entityId;
        delete hostProps.cuts;
        const pieceId = nanoid();
        await createAnnotation({ ...hostProps, id: pieceId, ...props });
        await copyMeshPaintsForSplit({
            sourceHostId: annotation.id,
            newHostIds: [pieceId],
            metrics: annotation.baseMapId === baseMap?.id ? getMeshPaintMetrics(baseMap) : null,
        });
    }

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
        await createSecondPiece(annotation, {
            points: piece2.map(p => ({ id: p.id })),
        });

        return true;
    }

    // main

    const handleSplitCommit = async (rawCuttingPoints) => {

        const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
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

        // One Ctrl+Z undoes the whole split (painted parts included).
        let splitCount = 0;
        await withUndoGroup(async () => {
            for (const annotation of allAnnotations) {
                const wasSplit = await splitOneAnnotation(annotation, cuttingPoints, sharedPointsRegistry, savedPointIds);
                if (wasSplit) splitCount++;
            }
        });

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

    // handler — split a POLYLINE or STRIP at an existing vertex

    const handlePolylineSplitAtVertex = async (annotationId, vertexPointId) => {
        const annotation = await db.annotations.get(annotationId);
        if (!annotation) {
            dispatch(setToaster({ message: "Annotation not found", isError: true }));
            return;
        }

        const vertexIndex = annotation.points?.findIndex(p => p.id === vertexPointId);
        if (vertexIndex === -1 || vertexIndex === undefined) {
            dispatch(setToaster({ message: "Vertex not found in annotation", isError: true }));
            return;
        }

        const result = splitPolylineAtVertex(annotation.points, vertexIndex, annotation.closeLine);
        if (!result) {
            dispatch(setToaster({ message: "Cannot split at this vertex", isError: true }));
            return;
        }

        if (result.piece2) {
            // Open split → two pieces (one Ctrl+Z, painted parts included)
            await withUndoGroup(async () => {
                await updateAnnotation({
                    ...annotation,
                    points: result.piece1,
                    closeLine: false,
                });
                await createSecondPiece(annotation, {
                    points: result.piece2,
                    closeLine: false,
                });
            });
        } else {
            // Closed → open (single reordered piece)
            await updateAnnotation({
                ...annotation,
                points: result.piece1,
                closeLine: false,
            });
        }

        dispatch(setToaster({ message: "Annotation split successfully", isError: false }));
    };

    return { handleSplitCommit, handlePolylineSplitAtVertex };
}
