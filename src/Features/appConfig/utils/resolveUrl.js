/**
 * Construit une URL complète à partir d'une configuration et des variables d'environnement Vite.
 * @param {Object} urlConfig - La partie 'url' de votre configuration
 * @returns {string} L'URL complète résolue
 */

const resolveUrl = (urlConfig) => {

    console.log("debug_resolveUrl_start", urlConfig);
    if (!urlConfig) return '';

    let baseUrl = '';

    // 1. Résolution de la Base URL
    if (urlConfig.baseUrl) {
        // Cas A : C'est une config avec une variable d'environnement (votre cas)
        if (typeof urlConfig.baseUrl === 'object' && urlConfig.baseUrl.env) {
            // Dans Vite, on accède aux variables via import.meta.env
            // On utilise la notation crochet [] car le nom de la variable est dynamique
            baseUrl = import.meta.env[urlConfig.baseUrl.env] || '';

            if (!baseUrl) {
                console.warn(`Attention: La variable d'environnement ${urlConfig.baseUrl.env} est vide ou introuvable.`);
            }
        }
        // Cas B : C'est une chaîne de caractères simple (hardcodée)
        else if (typeof urlConfig.baseUrl === 'string') {
            baseUrl = urlConfig.baseUrl;
        }
    }

    const route = urlConfig.route || '';

    // 2. Nettoyage et Concaténation (pour éviter "http://site.com//api")
    // On retire le slash à la fin de la base s'il existe
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    // On retire le slash au début de la route s'il existe
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;


    const _resolvedUrl = `${cleanBase}/${cleanRoute}`;
    console.log("debug_resolveUrl_end", urlConfig, _resolvedUrl);

    // On rejoint proprement
    return _resolvedUrl;
};

export default resolveUrl;
