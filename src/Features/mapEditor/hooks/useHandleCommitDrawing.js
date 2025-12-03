import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

export default function useHandleCommitDrawing() {

    // data

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const listingId = useSelector(s => s.listings.selectedListingId);
    const newAnnotation = useSelector(s => s.annotations.newAnnotation);

    const baseMap = useMainBaseMap();

    // main

    const handleDrawingCommit = async (rawPoints) => {
        // rawPoints = [{x,y, existingPointId?}, {x,y}, ...]

        const { width, height } = baseMap?.image?.imageSize ?? {}

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

        // ÉTAPE 3 : Création de l'Annotation (Topologie)
        const _newAnnotation = {
            id: nanoid(),
            points: finalPointIds.map(id => ({ id })), // Référence uniquement les IDs !
            baseMapId,
            projectId,
            listingId,
            ...newAnnotation,
            // ... props de style
        };

        // Mise à jour Optimiste Redux
        //dispatch(addAnnotation(newAnnotation));
        // Sauvegarde DB
        await db.annotations.add(_newAnnotation);

        console.log("Annotation créée avec succès !");
    }

    return handleDrawingCommit
}