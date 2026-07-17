/**
 * Résout un template de body issu de la config (ex: fetchParams.body) contre
 * un contexte. Chaque valeur "{{chemin.dans.contexte}}" est remplacée par la
 * valeur du contexte (y compris des objets non-string comme un File) ; les
 * valeurs non-template sont conservées telles quelles ; les entrées résolues
 * à undefined/null sont omises du résultat.
 *
 * Ex: resolveBodyTemplate({ scopeId: "{{scope.id}}", file: "{{file}}" },
 *     { scope, file }) → { scopeId: "abc", file: File }
 */
export default function resolveBodyTemplate(bodyTemplate, context) {
  const result = {};
  if (!bodyTemplate) return result;

  for (const [key, valueTemplate] of Object.entries(bodyTemplate)) {
    const resolvedValue = resolveValue(valueTemplate, context);
    if (resolvedValue !== undefined && resolvedValue !== null) {
      result[key] = resolvedValue;
    }
  }

  return result;
}

function resolveValue(template, context) {
  if (typeof template !== "string") return template;

  const match = template.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
  if (match) {
    return getNestedValue(context, match[1]);
  }

  // Pas de template, on retourne la valeur brute
  return template;
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : undefined;
  }, obj);
}
