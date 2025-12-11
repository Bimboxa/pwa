import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import db from "App/db/db";
import getAnnotationTemplateFromNewAnnotation from "Features/annotations/utils/getAnnotationTemplateFromNewAnnotation";


export default function useHandleCommitDrawing() {

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);
    const newAnnotation = useSelector(s => s.annotations.newAnnotation);

    const createEntity = useCreateEntity();
    const createAnnotation = useCreateAnnotation();

    const baseMap = useMainBaseMap();
    const resetNewAnnotation = useResetNewAnnotation();

    // main

    const handleDrawingCommit = async (rawPoints, options) => {

        let _newAnnotation; // created at the end.

        // options

        const closeLine = options?.closeLine;

        // image size

        const { width, height } = baseMap?.image?.imageSize ?? {}

        // edge case
        if (newAnnotation.type === "LABEL" && rawPoints.length === 1) {
            const { x: _x, y: _y } = rawPoints[0];
            // on calcule le point central
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                annotationTemplateId,
                entityId: entity.id,
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
            if (newAnnotation) {
                const existingAnnotationTemplates = await db.annotationTemplates.where("listingId").equals(listingId).toArray();
                const existingAnnotationTemplate = getAnnotationTemplateFromNewAnnotation({
                    newAnnotation,
                    annotationTemplates: existingAnnotationTemplates,
                });
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

            // ETAPE : création de l'entité.

            const entity = await createEntity({})

            // ÉTAPE 3 : Création de l'Annotation (Topologie)
            _newAnnotation = {
                ...newAnnotation,
                id: nanoid(),
                annotationTemplateId,
                entityId: entity.id,
                points: finalPointIds.map(id => ({ id })), // Référence uniquement les IDs !
                baseMapId,
                projectId,
                listingId,

                // ... props de style
            };

            if (closeLine) _newAnnotation.closeLine = true;

            if (["POLYGON", "POLYLINE", "MARKER"].includes(newAnnotation?.type)) {
                _newAnnotation.points = finalPointIds.map(id => ({ id }));
            }

            if (newAnnotation?.type === "MARKER") {
                _newAnnotation.point = { id: finalPointIds[0] };
            }
        }

        // Mise à jour Optimiste Redux
        //dispatch(addAnnotation(newAnnotation));
        // Sauvegarde DB
        await createAnnotation(_newAnnotation);

        console.log("Annotation créée avec succès !");

        // Reset
        resetNewAnnotation();
    }

    return handleDrawingCommit
}