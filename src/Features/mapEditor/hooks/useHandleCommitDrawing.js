import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import { setOpenDialogCreateEntity } from "Features/entities/entitiesSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import db from "App/db/db";
import getAnnotationTemplateFromNewAnnotation from "Features/annotations/utils/getAnnotationTemplateFromNewAnnotation";


export default function useHandleCommitDrawing() {

    // dispatch

    const dispatch = useDispatch();

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);
    const newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const openedPanel = useSelector(s => s.listings.openedPanel);

    const createEntity = useCreateEntity();
    const updateAnnotation = useUpdateAnnotation();
    const createAnnotation = useCreateAnnotation();

    const baseMap = useMainBaseMap();
    const resetNewAnnotation = useResetNewAnnotation();

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


        // update rawPoints for rectangle
        if (drawRectangle) {
            const P2 = { x: rawPoints[1].x, y: rawPoints[0].y }
            const P4 = { x: rawPoints[0].x, y: rawPoints[1].y }
            //rawPoints = [...rawPoints, P2, P4];
        }
        // image size

        const { width, height } = baseMap?.getImageSize() ?? {}

        // cuts

        if (newAnnotation.type === "CUT") {
            console.log("[CommitDrawing] cutHostId", cutHostId, rawPoints)
            _updatedAnnotation = { ...await db.annotations.get(cutHostId) }
        }


        // ETAPE : création de l'entité ou non

        let entityId = newAnnotation?.entityId;
        if (!entityId && newAnnotation?.type !== "LABEL" && !isBaseMapAnnotation) {
            const entity = await createEntity({})
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
            console.log("[CommitDrawing] add label", newAnnotation)
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
                // Mise à jour Optimiste Redux
                //dispatch(addPoints(newPointsToSave));
                // Sauvegarde DB
                await db.points.bulkAdd(newPointsToSave);
            }

            let annotationTemplateId;
            // ÉTAPE 2.5 : Enregistrement de l'annotation template
            if (newAnnotation && !_updatedAnnotation && !isBaseMapAnnotation) {
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
                const cut = { points: finalPointIds.map(id => ({ id })) };
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

                // ... props de style
            };

            if (isBaseMapAnnotation) _newAnnotation.isBaseMapAnnotation = true;

            if (closeLine) _newAnnotation.closeLine = true;

            if (["POLYGON", "POLYLINE", "MARKER"].includes(newAnnotation?.type)) {
                _newAnnotation.points = finalPointIds.map(id => ({ id }));
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
            console.log("Annotation mise à jour avec succès !", _updatedAnnotation);
        } else {
            await createAnnotation(_newAnnotation);
            console.log("Annotation créée avec succès !", _newAnnotation);
        }



        // Reset
        //resetNewAnnotation();


    }

    return handleDrawingCommit
}