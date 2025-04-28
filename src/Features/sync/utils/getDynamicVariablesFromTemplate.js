/*
 * string = projects/12/_listings_1123
 * template = projects/{{project.id}}/_listings_{{listingId}}
 * context = {project: {id: 12}}
 *
 * output: {
 *   listingId: 1123
 */
export default function getDynamicVariablesFromTemplate(
  str,
  template,
  context = {}
) {
  const keys = [];

  // Étape 1 : remplacer les variables de contexte {{object.key}} par leur valeur réelle
  const resolvedTemplate = template.replace(/{{(.*?)}}/g, (_, key) => {
    if (key.includes(".")) {
      const [obj, prop] = key.split(".");
      return context?.[obj]?.[prop] ?? "";
    } else {
      keys.push(key); // Ce sont les variables à extraire
      return `{{${key}}}`; // On les garde pour extraction plus tard
    }
  });

  // Étape 2 : transformer le template avec {{key}} en RegExp
  const regexPattern = resolvedTemplate.replace(/{{(.*?)}}/g, (_, key) => {
    return `(?<${key}>[^/]+)`;
  });

  const regex = new RegExp(`^${regexPattern}$`);
  const match = str.match(regex);

  if (!match?.groups) return {};

  // Étape 3 : convertir les résultats en valeurs typées simples
  const result = {};
  for (const key of keys) {
    const raw = match.groups[key];
    result[key] = isNaN(raw) ? raw : Number(raw);
  }

  return result;
}
