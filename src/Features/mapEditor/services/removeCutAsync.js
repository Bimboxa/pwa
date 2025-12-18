import db from "App/db/db";

/**
 * Supprime un cut (trou) d'une annotation et nettoie les points orphelins.
 *
 * @param {Object} params
 * @param {string} params.annotationId - L'ID de l'annotation
 * @param {number} params.cutIndex - L'index du cut à supprimer dans le tableau annotation.cuts
 * @param {Array} params.annotations - La liste complète des annotations (état actuel avant suppression)
 */
export default async function removeCutAsync({ annotationId, cutIndex, annotations }) {
    try {
        // 1. Récupérer l'annotation cible
        const targetAnnotation = annotations.find(a => a.id === annotationId);
        if (!targetAnnotation || !targetAnnotation.cuts || !targetAnnotation.cuts[cutIndex]) {
            console.warn(`[removeCutAsync] Annotation or Cut not found.`);
            return;
        }

        // 2. Identifier les points qui vont être retirés
        // On doit vérifier si ces points méritent d'être supprimés de la DB
        const cutToRemove = targetAnnotation.cuts[cutIndex];
        const pointsInCut = cutToRemove.points || [];

        // 3. Mettre à jour l'annotation (Suppression du Cut)
        // On filtre pour ne garder que les cuts dont l'index est différent de celui ciblé
        const newCuts = targetAnnotation.cuts.filter((_, index) => index !== cutIndex);

        await db.annotations.update(annotationId, { cuts: newCuts });
        console.log(`[removeCutAsync] Cut ${cutIndex} removed from annotation ${annotationId}.`);

        // 4. Nettoyage des points orphelins
        if (pointsInCut.length === 0) return;

        const pointsToDelete = [];

        // Pour chaque point qui faisait partie du cut...
        for (const point of pointsInCut) {
            const pointId = point.id;
            let isUsedElsewhere = false;

            // On parcourt TOUTES les annotations pour voir si le point est utilisé
            // (Note: 'annotations' contient encore l'ancienne version de targetAnnotation avec le cut,
            // il faut donc faire attention à ignorer le cut qu'on vient de supprimer)
            for (const ann of annotations) {

                // A. Vérifier dans le contour principal (Main Points)
                if (ann.points?.some(p => p.id === pointId)) {
                    isUsedElsewhere = true;
                    break; // Trouvé, pas besoin de chercher plus loin
                }

                // B. Vérifier dans les Cuts (Trous)
                if (ann.cuts && ann.cuts.length > 0) {
                    for (let i = 0; i < ann.cuts.length; i++) {

                        // IMPORTANT : Si on est sur l'annotation cible, on IGNORE le cut qu'on vient de supprimer.
                        // Car 'annotations' est l'état précédent (snapshot).
                        if (ann.id === annotationId && i === cutIndex) {
                            continue;
                        }

                        const cut = ann.cuts[i];
                        if (cut.points?.some(p => p.id === pointId)) {
                            isUsedElsewhere = true;
                            break;
                        }
                    }
                }

                if (isUsedElsewhere) break;
            }

            // Si le point n'est trouvé nulle part ailleurs, on le marque pour suppression
            if (!isUsedElsewhere) {
                pointsToDelete.push(pointId);
            }
        }

        // 5. Suppression physique des points orphelins
        if (pointsToDelete.length > 0) {
            console.log(`[removeCutAsync] Deleting ${pointsToDelete.length} orphan points.`);
            // Suppression en parallèle
            await Promise.all(pointsToDelete.map(id => db.points.delete(id)));
        }

    } catch (error) {
        console.error("[removeCutAsync] Error:", error);
    }
};