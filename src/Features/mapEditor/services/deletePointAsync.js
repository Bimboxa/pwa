import db from "App/db/db";

/**
 * Supprime un point d'une ou plusieurs annotations et nettoie la base de données
 * si le point n'est plus utilisé nulle part.
 * * @param {Object} params
 * @param {string} params.pointId - L'ID du point à supprimer
 * @param {string|null} params.annotationId - L'ID de l'annotation cible (si null, cible toutes les annotations connectées)
 * @param {Array} params.annotations - La liste complète des annotations (resolved, used only for ID lookups)
 */
export default async function deletePointAsync({ pointId, annotationId, annotations }) {
    try {
        // 1. Identifier les annotations à modifier
        let annotationIdsToModify = [];

        if (annotationId) {
            annotationIdsToModify.push(annotationId);
        } else {
            // Cible TOUTES les annotations qui contiennent ce point
            annotationIdsToModify = annotations
                .filter(ann => {
                    const inMain = ann.points?.some(pt => pt.id === pointId);
                    const inCuts = ann.cuts?.some(cut => cut.points?.some(pt => pt.id === pointId));
                    return inMain || inCuts;
                })
                .map(ann => ann.id);
        }

        if (annotationIdsToModify.length === 0) {
            console.warn(`No annotations found containing point ${pointId}.`);
            return;
        }

        // 2. Read raw annotations from DB and apply modifications
        const updatePromises = annotationIdsToModify.map(async (annId) => {
            const dbAnnotation = await db.annotations.get(annId);
            if (!dbAnnotation) return;

            // A. Retirer du contour principal (points)
            const newPoints = (dbAnnotation.points || []).filter(pt => pt.id !== pointId);

            // B. Retirer des trous (cuts)
            const newCuts = (dbAnnotation.cuts || []).map(cut => ({
                ...cut,
                points: (cut.points || []).filter(pt => pt.id !== pointId)
            }));

            // C. Update DB
            return db.annotations.update(annId, {
                points: newPoints,
                cuts: newCuts
            });
        });

        await Promise.all(updatePromises);
        console.log(`[deletePointAsync] Removed point ${pointId} from ${annotationIdsToModify.length} annotation(s).`);

        // 3. Vérifier si le point est orphelin (Suppression physique)
        const modifiedIds = new Set(annotationIdsToModify);

        // Le point est encore utilisé s'il existe dans une annotation QUI N'A PAS ÉTÉ MODIFIÉE
        const isUsedElsewhere = annotations.some(ann => {
            if (modifiedIds.has(ann.id)) return false;
            const inMain = ann.points?.some(pt => pt.id === pointId);
            const inCuts = ann.cuts?.some(cut => cut.points?.some(pt => pt.id === pointId));
            return inMain || inCuts;
        });

        // 4. Suppression finale
        if (!isUsedElsewhere) {
            console.log(`[deletePointAsync] Point ${pointId} is now orphan. Deleting from DB.`);
            await db.points.delete(pointId);
        } else {
            console.log(`[deletePointAsync] Point ${pointId} is still shared by other annotations. Keeping in DB.`);
        }

    } catch (error) {
        console.error("[deletePointAsync] Error:", error);
    }
};
