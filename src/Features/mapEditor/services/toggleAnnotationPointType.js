import db from "App/db/db";

export default async function toggleAnnotationPointType({ annotationId, pointId }) {
    console.log("[toggleAnnotationPointType]", annotationId, pointId);

    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;

    let hasChanged = false;

    // Helper pour la logique de toggle
    const toggleType = (point) => {
        if (point.id === pointId) {
            // null/undefined/autre => circle, circle => square, square => circle (pour boucler)
            point.type = (point.type === "circle") ? "square" : "circle";
            hasChanged = true;
            return true;
        }
        return false;
    };

    // 1. Chercher dans les points principaux
    if (annotation.points) {
        annotation.points.forEach(toggleType);
    }

    // 2. Chercher dans les cuts (si pas encore trouvé ou par sécurité sur tous)
    if (annotation.cuts) {
        annotation.cuts.forEach(cut => {
            if (cut.points) {
                cut.points.forEach(toggleType);
            }
        });
    }

    // 2b. Chercher dans les guideLines (refs {pointId, type})
    if (Array.isArray(annotation.guideLines)) {
        annotation.guideLines.forEach((gl) => {
            (gl?.points || []).forEach((g) => {
                if (g.pointId === pointId) {
                    g.type = (g.type === "circle") ? "square" : "circle";
                    hasChanged = true;
                }
            });
        });
    }

    // 3. Sauvegarder uniquement si une modification a eu lieu
    if (hasChanged) {
        await db.annotations.update(annotationId, {
            points: annotation.points,
            cuts: annotation.cuts,
            guideLines: annotation.guideLines
        });
        console.log(`[toggleAnnotationPointType] Point ${pointId} mis à jour.`);
    } else {
        console.warn(`[toggleAnnotationPointType] Point ${pointId} non trouvé.`);
    }
}