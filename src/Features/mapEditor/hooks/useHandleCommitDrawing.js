import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import { setOpenDialogCreateEntity, triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { setNewAnnotation, triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateFromNewAnnotation from "Features/annotations/utils/getAnnotationTemplateFromNewAnnotation";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";


export default function useHandleCommitDrawing({ newEntity } = {}) {

    // dispatch

    const dispatch = useDispatch();

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);
    const newAnnotationInState = useSelector(s => s.annotations.newAnnotation);
    const openedPanel = useSelector(s => s.listings.openedPanel);

    const createEntity = useCreateEntity();

    const updateAnnotation = useUpdateAnnotation();
    const createAnnotation = useCreateAnnotation();

    const baseMap = useMainBaseMap();
    const resetNewAnnotation = useResetNewAnnotation();
    const activeLayerId = useSelector(s => s.layers?.activeLayerId);
    const { value: selectedListing } = useSelectedListing();

    // helpers

    const isBaseMapAnnotation = openedPanel === "BASE_MAP_DETAIL";


    // main

    const handleDrawingCommit = async (rawPoints, options) => {

        let _newAnnotation; // created at the end.
        let _updatedAnnotation;

        // options

        const closeLine = options?.closeLine;
        const cutHostId = options?.cutHostId;
        const drawRectangle = options?.drawRectangle;
        const skipTemplateCreation = options?.skipTemplateCreation;
        const detectedCuts = options?.detectedCuts; // from polygon auto-detection

        // newAnnotation

        const newAnnotation = options?.newAnnotation ?? newAnnotationInState

        // update rawPoints for rectangle
        if (drawRectangle) {
            const P2 = { x: rawPoints[1].x, y: rawPoints[0].y }
            const P4 = { x: rawPoints[0].x, y: rawPoints[1].y }
            //rawPoints = [...rawPoints, P2, P4];
        }
        // image size

        const { width, height } = baseMap?.getImageSize?.() ?? {}

        // cuts

        if (newAnnotation.type === "CUT") {
            _updatedAnnotation = { ...await db.annotations.get(cutHostId) }
        }


        // ETAPE : création de l'entité ou non

        let entityId = newAnnotation?.entityId;
        if (!entityId && !isBaseMapAnnotation) {
            const entity = await createEntity(newEntity)
            entityId = entity.id;
        }

        // edge case
        if (newAnnotation.type === "LABEL" && rawPoints.length === 1) {
            // dispatch(setOpenDialogCreateEntity(true))
            // dispatch(setNewAnnotation({
            //     ...newAnnotation,
            //     entityId,
            //     targetPoint: { x: _x / width, y: _y / height },
            //     labelPoint: { x: (_x - 50) / width, y: (_y + 0) / height },
            //     baseMapId,
            //     projectId,
            //     listingId,
            // }))
            // return;
            const { x: _x, y: _y } = rawPoints[0];
            // on calcule le point central
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                entityId,
                targetPoint: { x: _x / width, y: _y / height },
                labelPoint: { x: (_x - 50) / width, y: (_y + 0) / height },
                baseMapId,
                projectId,
                listingId,
                ...(activeLayerId && !isBaseMapAnnotation ? { layerId: activeLayerId } : {}),

                // ... props de style
            };
        }

        else {
            // rawPoints = [{x,y, existingPointId?}, {x,y}, ...]


            const finalPointIds = [];
            const newPointsToSave = []; // Batch pour Dexie

            // ÉTAPE 1 : Résolution des Points (Geometry)
            for (const pt of rawPoints) {
                if (pt.existingPointId) {
                    // Cas A : On réutilise un point existant (Topologie partagée !)
                    finalPointIds.push(pt.existingPointId);
                } else {
                    // Cas B : C'est un nouveau point
                    const newId = nanoid(); // Générer un ID client-side

                    const newPointEntity = {
                        id: newId,
                        x: pt.x / width,
                        y: pt.y / height,
                        baseMapId,
                        projectId,
                        listingId,
                        forMarker: newAnnotation?.type === "MARKER",
                    };

                    newPointsToSave.push(newPointEntity);
                    finalPointIds.push(newId);
                }
            }

            // ÉTAPE 2 : Sauvegarde des Nouveaux Points (Batch)
            if (newPointsToSave.length > 0) {
                await db.points.bulkAdd(newPointsToSave);
            }

            // ÉTAPE 2.1 : Insert snapped points into target annotations' segments
            // When a drawing point was snapped to a PROJECTION/MIDPOINT on an existing
            // annotation segment, we insert the new shared point into that segment.
            const snapInsertions = [];
            for (let idx = 0; idx < rawPoints.length; idx++) {
                const pt = rawPoints[idx];
                if (pt.snapSegment && !pt.existingPointId) {
                    snapInsertions.push({
                        pointId: finalPointIds[idx],
                        annotationId: pt.snapSegment.annotationId,
                        segmentStartId: pt.snapSegment.segmentStartId,
                        segmentEndId: pt.snapSegment.segmentEndId,
                        cutIndex: pt.snapSegment.cutIndex,
                    });
                }
            }

            if (snapInsertions.length > 0) {
                const insertPointInPath = (pointsList, segStartId, segEndId, newPointObj) => {
                    if (!pointsList || pointsList.length < 2) return null;
                    for (let i = 0; i < pointsList.length; i++) {
                        const cur = pointsList[i];
                        const next = pointsList[(i + 1) % pointsList.length];
                        if ((cur.id === segStartId && next.id === segEndId) ||
                            (cur.id === segEndId && next.id === segStartId)) {
                            // Skip arc segments: inserting a point would break the arc geometry
                            if (cur.type === 'circle' || next.type === 'circle') return null;
                            const newPoints = [...pointsList];
                            newPoints.splice(i + 1, 0, newPointObj);
                            return newPoints;
                        }
                    }
                    return null;
                };

                // Group insertions by annotation to avoid conflicting updates
                const byAnnotation = {};
                for (const ins of snapInsertions) {
                    if (!byAnnotation[ins.annotationId]) byAnnotation[ins.annotationId] = [];
                    byAnnotation[ins.annotationId].push(ins);
                }

                for (const [annId, insertions] of Object.entries(byAnnotation)) {
                    const ann = await db.annotations.get(annId);
                    if (!ann) continue;

                    let updatedPoints = ann.points ? [...ann.points] : null;
                    let updatedCuts = ann.cuts ? ann.cuts.map(c => ({ ...c, points: [...c.points] })) : null;

                    for (const ins of insertions) {
                        const newPointObj = { id: ins.pointId, type: 'square' };
                        if (ins.cutIndex != null && updatedCuts?.[ins.cutIndex]) {
                            const result = insertPointInPath(updatedCuts[ins.cutIndex].points, ins.segmentStartId, ins.segmentEndId, newPointObj);
                            if (result) updatedCuts[ins.cutIndex].points = result;
                        } else if (updatedPoints) {
                            const result = insertPointInPath(updatedPoints, ins.segmentStartId, ins.segmentEndId, newPointObj);
                            if (result) updatedPoints = result;
                        }
                    }

                    const changes = {};
                    if (updatedPoints) changes.points = updatedPoints;
                    if (updatedCuts) changes.cuts = updatedCuts;
                    if (Object.keys(changes).length > 0) {
                        await db.annotations.update(annId, changes);
                    }
                }
            }

            let annotationTemplateId;
            // ÉTAPE 2.5 : Enregistrement de l'annotation template
            if (newAnnotation && !_updatedAnnotation && !isBaseMapAnnotation && !skipTemplateCreation) {
                const existingAnnotationTemplates = await db.annotationTemplates.where("listingId").equals(listingId).toArray();
                // const existingAnnotationTemplate = getAnnotationTemplateFromNewAnnotation({
                //     newAnnotation,
                //     annotationTemplates: existingAnnotationTemplates,
                // });
                const existingAnnotationTemplate = existingAnnotationTemplates.find(t => t.id === newAnnotation.annotationTemplateId);
                if (existingAnnotationTemplate) {
                    annotationTemplateId = existingAnnotationTemplate.id;
                } else {
                    annotationTemplateId = nanoid();
                    const _annotationTemplate = {
                        id: annotationTemplateId,
                        projectId,
                        listingId,
                        ...newAnnotation,
                    }
                    await db.annotationTemplates.add(_annotationTemplate);

                }
            }


            // ETAPE 3 : update annotation cuts

            if (_updatedAnnotation) {
                const cut = {
                    points: finalPointIds.map((id, i) => {
                        const entry = { id };
                        if (rawPoints[i]?.type) entry.type = rawPoints[i].type;
                        return entry;
                    }),
                };
                if (newAnnotation.label) cut.label = newAnnotation.label;
                const newCuts = _updatedAnnotation?.cuts ? [..._updatedAnnotation?.cuts, cut] : [cut];
                _updatedAnnotation = {
                    ..._updatedAnnotation,
                    cuts: newCuts,
                };
            }

            // ÉTAPE 3 : Création de l'Annotation (Topologie)
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                annotationTemplateId,
                entityId,
                //points: finalPointIds.map(id => ({ id })), // Référence uniquement les IDs !
                baseMapId,
                projectId,
                listingId,
                ...(activeLayerId && !isBaseMapAnnotation ? { layerId: activeLayerId } : {}),

                // ... props de style
            };


            if (isBaseMapAnnotation) _newAnnotation.isBaseMapAnnotation = true;

            if (closeLine) _newAnnotation.closeLine = true;

            if (["POLYGON", "POLYLINE", "STRIP"].includes(newAnnotation?.type)) {
                _newAnnotation.points = finalPointIds.map((id, i) => {
                    const entry = { id };
                    if (rawPoints[i]?.type) entry.type = rawPoints[i].type;
                    return entry;
                });
            }

            // Handle detected cuts from polygon auto-detection
            if (detectedCuts && detectedCuts.length > 0 && width && height) {
                const cutEntries = [];
                const allCutPointsToSave = [];
                for (const cutRing of detectedCuts) {
                    if (!cutRing || cutRing.length < 3) continue;
                    const cutPointIds = [];
                    for (const pt of cutRing) {
                        const newId = nanoid();
                        allCutPointsToSave.push({
                            id: newId,
                            x: pt.x / width,
                            y: pt.y / height,
                            baseMapId,
                            projectId,
                            listingId,
                        });
                        cutPointIds.push(newId);
                    }
                    cutEntries.push({
                        points: cutPointIds.map(id => ({ id })),
                    });
                }
                // Single bulk insert for all cut points
                if (allCutPointsToSave.length > 0) {
                    await db.points.bulkAdd(allCutPointsToSave);
                }
                if (cutEntries.length > 0) {
                    _newAnnotation.cuts = cutEntries;
                }
            }

            if (drawRectangle) {
                _newAnnotation.bbox = {
                    x: rawPoints[0].x / width,
                    y: rawPoints[0].y / height,
                    width: (rawPoints[1].x - rawPoints[0].x) / width,
                    height: (rawPoints[1].y - rawPoints[0].y) / height,
                }
            }

            if (newAnnotation?.type === "MARKER" || newAnnotation?.type === "POINT") {
                _newAnnotation.point = { id: finalPointIds[0] };
            }
        }



        // Mise à jour Optimiste Redux
        //dispatch(addAnnotation(newAnnotation));
        // Sauvegarde DB
        if (_updatedAnnotation) {
            await updateAnnotation(_updatedAnnotation);
        } else {
            await createAnnotation(_newAnnotation);
        }



        // Reset
        //resetNewAnnotation();


    }

    return { handleDrawingCommit };
}