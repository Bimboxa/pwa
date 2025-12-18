import db from "App/db/db";

/**
 * Supprime un point d'une ou plusieurs annotations et nettoie la base de données
 * si le point n'est plus utilisé nulle part.
 * * @param {Object} params
 * @param {string} params.pointId - L'ID du point à supprimer
 * @param {string|null} params.annotationId - L'ID de l'annotation cible (si null, cible toutes les annotations connectées)
 * @param {Array} params.annotations - La liste complète des annotations
 */
export default async function deletePointAsync({ pointId, annotationId, annotations }) {
    try {
        // 1. Identifier les annotations à modifier
        let annotationsToModify = [];

        if (annotationId) {
            // Cas A : On cible une annotation spécifique
            const target = annotations.find(a => a.id === annotationId);
            if (target) {
                annotationsToModify.push(target);
            } else {
                console.warn(`Annotation ${annotationId} not found.`);
                return;
            }
        } else {
            // Cas B : On cible TOUTES les annotations qui contiennent ce point
            annotationsToModify = annotations.filter(ann => {
                const inMain = ann.points?.some(pt => pt.id === pointId);
                const inCuts = ann.cuts?.some(cut => cut.points?.some(pt => pt.id === pointId));
                return inMain || inCuts;
            });
        }

        if (annotationsToModify.length === 0) {
            console.warn(`No annotations found containing point ${pointId}.`);
            // On peut quand même tenter de supprimer le point s'il existe en orphelin
            // mais pour l'instant on arrête là.
            return;
        }

        // 2. Appliquer les modifications sur toutes les annotations ciblées
        // On prépare un tableau de promesses pour exécuter les updates en parallèle
        const updatePromises = annotationsToModify.map(targetAnnotation => {

            // A. Retirer du contour principal (points)
            const newPoints = (targetAnnotation.points || []).filter(pt => pt.id !== pointId);

            // B. Retirer des trous (cuts)
            const newCuts = (targetAnnotation.cuts || []).map(cut => ({
                ...cut,
                points: (cut.points || []).filter(pt => pt.id !== pointId)
            }));

            // C. Update DB
            return db.annotations.update(targetAnnotation.id, {
                points: newPoints,
                cuts: newCuts
            });
        });

        await Promise.all(updatePromises);
        console.log(`[deletePointAsync] Removed point ${pointId} from ${annotationsToModify.length} annotation(s).`);

        // 3. Vérifier si le point est orphelin (Suppression physique)

        // On crée un Set des IDs qu'on vient de modifier pour les exclure de la recherche
        const modifiedIds = new Set(annotationsToModify.map(a => a.id));

        // Le point est encore utilisé s'il existe dans une annotation QUI N'A PAS ÉTÉ MODIFIÉE
        const isUsedElsewhere = annotations.some(ann => {
            // Si c'est une annotation qu'on vient de nettoyer, on l'ignore (car le point n'y est plus)
            if (modifiedIds.has(ann.id)) return false;

            // Vérification dans le reste
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