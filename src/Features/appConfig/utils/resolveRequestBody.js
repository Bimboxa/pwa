/**
 * Résout les variables dynamiques dans un objet body en utilisant un contexte donné.
 * * @param {any} body - L'objet ou la valeur à résoudre (peut contenir des {{key}}).
 * @param {object} context - L'objet contenant les données pour le remplacement.
 * @returns {any} - Une copie du body avec les valeurs résolues.
 */
const resolveRequestBody = (body, context) => {
    // 1. Si c'est une chaîne de caractères, on vérifie si elle correspond au pattern {{...}}
    if (typeof body === 'string') {
        // Regex : commence par {{, peut avoir des espaces, capture le chemin, finit par }}
        const match = body.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);

        if (match) {
            const path = match[1]; // Ex: "userProfile.idMaster"

            // On parcourt le contexte pour trouver la valeur (ex: context["userProfile"]["idMaster"])
            const resolvedValue = path.split('.').reduce((acc, part) => {
                return acc && acc[part] !== undefined ? acc[part] : undefined;
            }, context);

            return resolvedValue;
        }
        // Si pas de match, on retourne la chaîne telle quelle
        return body;
    }

    // 2. Si c'est un Tableau, on résout chaque élément récursivement
    if (Array.isArray(body)) {
        return body.map(item => resolveRequestBody(item, context));
    }

    // 3. Si c'est un Objet (et pas null), on résout chaque propriété récursivement
    if (body !== null && typeof body === 'object') {
        const resolvedObject = {};
        for (const key in body) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                resolvedObject[key] = resolveRequestBody(body[key], context);
            }
        }
        return resolvedObject;
    }

    // 4. Pour les autres types (nombre, boolean, null, undefined), on retourne tel quel
    return body;
};

// --- EXEMPLE D'UTILISATION ---

// Le body avec les templates
const bodyTemplate = {
    searchValue: "",
    idObjectStaff: "{{userProfile.idMaster}}", // Champ à remplacer
    nestedInfo: {
        role: "{{userProfile.role}}", // Test imbriqué
        static: "fixe"
    },
    skip: 0,
    take: 500
};

// Le contexte contenant les données
const contextData = {
    userProfile: {
        idMaster: 12345,
        role: "ADMIN",
        name: "Antoine"
    },
    env: "production"
};

// Appel de la fonction
const result = resolveRequestBody(bodyTemplate, contextData);

console.log(result);