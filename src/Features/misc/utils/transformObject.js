/**
 * Récupère une valeur dans un objet via un chemin (ex: "adresse.ville")
 */
const getDeepValue = (obj, path) => {
    if (!path || !obj) return undefined;
    // On découpe le chemin par les points et on descend dans l'objet
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

/**
 * Assigne une valeur dans un objet via un chemin, en créant la structure si besoin
 */
const setDeepValue = (obj, path, value) => {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        // Si la propriété n'existe pas, on crée un objet vide
        if (!current[part]) {
            current[part] = {};
        }
        current = current[part];
    }

    // On assigne la valeur à la dernière clé du chemin
    current[parts[parts.length - 1]] = value;
};

/**
 * Fonction principale de mapping
 * @param {Object} source - L'objet de données initial
 * @param {Object} mappingConfig - La configuration du mapping
 */
const transformObject = (source, mappingConfig) => {
    const result = {};

    // On parcourt chaque clé définie dans le mapping (les champs de destination)
    Object.keys(mappingConfig).forEach((targetPath) => {
        const rule = mappingConfig[targetPath];
        let finalValue;

        // Cas 1 : Valeur fixe
        if (rule.hasOwnProperty('value')) {
            finalValue = rule.value;
        }
        // Cas 2 : Valeur issue d'un champ source
        else if (rule.field) {
            finalValue = getDeepValue(source, rule.field);
        }

        // On écrit le résultat dans l'objet de destination
        setDeepValue(result, targetPath, finalValue);
    });

    return result;
};

export default transformObject


// 1. L'objet Source (imaginons qu'il vient d'une vieille API)
const sourceData = {
    IdObject: 12345,
    sDesignation: "Rénovation Toiture",
    sNumero: "CLI-999",
    adresse: {
        sVille: "Lyon",
        sCodePostal: "69000"
    },
    autreInfo: "inutile"
};

// 2. Ta configuration de mapping
const mappingDefinition = {
    "id": {
        field: "IdObject"
    },
    "name": {
        field: "sDesignation"
    },
    "clientRef": {
        field: "sNumero"
    },
    "address.city": {
        field: "adresse.sVille"
    },
    "type": {
        value: "CHANTIER"
    }
};

// 3. Exécution
const newObject = transformObject(sourceData, mappingDefinition);