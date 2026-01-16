import mergeTwoPolygons from "./mergeTwoPolygons";

export default function mergeAllPolygons(polygonsList) {
    if (!polygonsList || polygonsList.length === 0) return null;

    // 1. On initialise la "Boule de neige" avec le premier polygone
    let currentShape = polygonsList[0];
    let allNewPoints = []; // Pour collecter tous les points créés

    // 2. On met le reste dans une file d'attente
    let pool = polygonsList.slice(1);

    let hasMergedSomething = true;

    // 3. Tant qu'il reste des candidats et qu'on arrive à avancer
    while (pool.length > 0 && hasMergedSomething) {
        hasMergedSomething = false;

        // On cherche un candidat compatible dans la piscine
        for (let i = 0; i < pool.length; i++) {
            const candidate = pool[i];

            // On tente la fusion
            const result = mergeTwoPolygons(currentShape, candidate);

            if (result) {
                // SUCCÈS : Ils se touchaient !

                // 1. On met à jour la forme courante (elle grossit)
                currentShape = result.mergedPolygon;

                // 2. On collecte les nouveaux points (optionnel selon ton besoin)
                allNewPoints.push(...result.newPoints);

                // 3. On retire ce candidat de la liste
                pool.splice(i, 1);

                // 4. On signale qu'on a avancé
                hasMergedSomething = true;

                // 5. TRÈS IMPORTANT : On break pour recommencer la boucle for
                // Pourquoi ? Parce que maintenant que currentShape a changé, 
                // elle pourrait toucher un polygone qu'on a déjà testé et passé (index < i).
                break;
            }
        }
    }

    // Gestion d'erreur : Si pool n'est pas vide à la fin, c'est qu'il y a des îlots isolés
    if (pool.length > 0) {
        console.warn("Attention : Impossible de tout fusionner en un seul polygone. Il reste des éléments disjoints.", pool);
    }

    return {
        mergedPolygon: currentShape,
        newPoints: allNewPoints
    };
}