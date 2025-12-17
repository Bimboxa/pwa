import db from "App/db/db"; // Assurez-vous que le chemin d'import est correct

/**
 * Supprime un point d'une annotation et nettoie la base de données
 * si le point n'est plus utilisé nulle part.
 * * @param {Object} params
 * @param {string} params.pointId - L'ID du point à supprimer
 * @param {string} params.annotationId - L'ID de l'annotation en cours d'édition
 * @param {Array} params.annotations - La liste complète des annotations (pour vérifier les dépendances)
 */
export const deletePointAsync = async ({ pointId, annotationId, annotations }) => {
    try {
        // 1. Récupérer l'annotation cible

        const targetAnnotation = annotations.find(a => a.id === annotationId);
        if (!targetAnnotation) {
            console.warn(`Annotation ${annotationId} not found.`);
            return;
        }

        // 2. Préparer les nouvelles données géométriques
        // A. Retirer du contour principal (points)
        const newPoints = (targetAnnotation.points || []).filter(pt => pt.id !== pointId);

        // B. Retirer des trous (cuts)
        const newCuts = (targetAnnotation.cuts || []).map(cut => ({
            ...cut,
            // On filtre les points à l'intérieur du cut
            points: (cut.points || []).filter(pt => pt.id !== pointId)
        }));

        // Note: Vous pourriez vouloir ajouter une logique ici pour supprimer l'annotation 
        // ou le cut complet s'il reste moins de 2 ou 3 points.
        // Pour l'instant, on se contente de mettre à jour la liste.

        // 3. Mettre à jour l'annotation dans la DB
        await db.annotations.update(annotationId, {
            points: newPoints,
            cuts: newCuts
        });

        // 4. Vérifier si le point est orphelin
        // Le point est orphelin s'il n'est utilisé dans AUCUNE autre annotation.
        // (Comme on vient de le retirer de targetAnnotation via le filter, on doit chercher dans les autres).

        const isUsedElsewhere = annotations.some(ann => {
            // On ne regarde pas l'annotation qu'on vient de modifier 
            // (car on part du principe qu'on vient de le retirer)
            if (ann.id === annotationId) return false;

            // Vérification dans le main path
            const inMain = ann.points?.some(pt => pt.id === pointId);
            if (inMain) return true;

            // Vérification dans les cuts
            const inCuts = ann.cuts?.some(cut =>
                cut.points?.some(pt => pt.id === pointId)
            );
            if (inCuts) return true;

            return false;
        });

        // 5. Suppression physique ou conservation
        if (!isUsedElsewhere) {
            console.log(`[deletePointAsync] Point ${pointId} is orphan. Deleting from DB.`);
            await db.points.delete(pointId);
        } else {
            console.log(`[deletePointAsync] Point ${pointId} is shared. Keeping in DB.`);
        }

    } catch (error) {
        console.error("[deletePointAsync] Error:", error);
    }
};