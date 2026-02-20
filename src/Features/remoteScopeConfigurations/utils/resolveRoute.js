/**
 * Résout les {{variables}} dans une chaîne de route.
 * Ex: "/api/v1/ScopesConfigurations/{{scopeId}}" → "/api/v1/ScopesConfigurations/abc123"
 */
export default function resolveRoute(route, context) {
    if (!route) return "";
    return route.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
        const value = getNestedValue(context, path);
        return value ?? "";
    });
}

/**
 * Accède à une valeur imbriquée dans un objet via un chemin en pointillé.
 * Ex: getNestedValue({ scope: { name: "Test" } }, "scope.name") → "Test"
 */
export function getNestedValue(obj, path) {
    return path.split(".").reduce((acc, part) => {
        return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
}
