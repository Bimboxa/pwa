/**
 * Nettoie l'arbre pour la sauvegarde finale
 * 1. Supprime physiquement les noeuds marqués DELETE
 * 2. Supprime la propriété agentModification
 * 3. Supprime la propriété order (l'ordre est préservé par la position dans children)
 */
export const commitChanges = (items) => {
    return items
        .map((node) => {
            // Si le noeud est marqué pour suppression, on le retire du mapping
            if (node.agentModification === "DELETE") {
                return null;
            }

            // Création d'une copie propre du noeud
            const { agentModification, order, children, ...cleanNode } = node;

            // Traitement récursif des enfants
            if (children && children.length > 0) {
                cleanNode.children = commitChanges(children);
            } else if (children) {
                cleanNode.children = [];
            }

            return cleanNode;
        })
        .filter(Boolean); // Supprime les entrées null (les DELETE)
};