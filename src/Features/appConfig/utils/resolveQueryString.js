/**
 * Résout les queryParams, gère la logique conditionnelle et retourne la chaîne URL.
 * Indépendant de toute librairie externe.
 * * @param {object} template - L'objet définissant les paramètres (avec {{}} et logique conditionnelle).
 * @param {object} context - Les données pour le remplacement.
 * @returns {string} - La chaîne de requête formatée (ex: "?id=12&take=100") ou une chaîne vide.
 */
const resolveQueryString = (template, context) => {

    // --- HELPER 1 : Récupérer une valeur profonde dans le contexte ---
    const getValueFromContext = (path) => {
        return path.split('.').reduce((acc, part) => {
            return acc && acc[part] !== undefined ? acc[part] : undefined;
        }, context);
    };

    // --- HELPER 2 : Fonction récursive de résolution (Cœur de la logique) ---
    const resolveNode = (node) => {
        // Cas A : Chaîne de caractères -> On tente l'interpolation {{...}}
        if (typeof node === 'string') {
            const match = node.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
            if (match) {
                return getValueFromContext(match[1]);
            }
            return node;
        }

        // Cas B : Tableau -> Vérification de la logique conditionnelle OU récursion simple
        if (Array.isArray(node)) {
            // Détection de la structure "Logique Conditionnelle"
            const isConditional = node.some(item =>
                item && typeof item === 'object' && 'testField' in item && 'testValue' in item
            );

            if (isConditional) {
                // On cherche l'élément qui matche
                const match = node.find(item => {
                    // IMPORTANT : On doit résoudre le testField avant de comparer
                    // car il contient souvent une variable {{project.type}}
                    const resolvedTestField = resolveNode(item.testField);
                    return resolvedTestField === item.testValue;
                });

                // Si on trouve un match, on résout sa valeur (qui peut elle-même être une variable)
                return match ? resolveNode(match.value) : undefined;
            }

            // Sinon, c'est un tableau de données standard : on résout chaque item
            return node.map(resolveNode);
        }

        // Cas C : Objet standard -> On résout chaque propriété
        if (node !== null && typeof node === 'object') {
            const resolvedObj = {};
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    resolvedObj[key] = resolveNode(node[key]);
                }
            }
            return resolvedObj;
        }

        // Cas D : Primitifs (nombre, boolean, null...) -> On retourne tel quel
        return node;
    };

    // --- ÉTAPE PRINCIPALE ---

    // 1. On résout tout l'objet template
    const resolvedParams = resolveNode(template);

    // 2. On construit les URLSearchParams
    const searchParams = new URLSearchParams();

    if (resolvedParams && typeof resolvedParams === 'object') {
        Object.entries(resolvedParams).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return; // On ignore les valeurs vides
            }

            if (Array.isArray(value)) {
                // Gestion des tableaux (ex: ?status=A&status=B)
                value.forEach(v => searchParams.append(key, v));
            } else {
                searchParams.append(key, value);
            }
        });
    }

    const queryString = searchParams.toString();

    // return queryString ? `?${queryString}` : '';
    return queryString ? `?${decodeURIComponent(queryString)}` : '';
};

export default resolveQueryString;