// resolveTemplate.js

/**
 * Remplace les variables dans une chaîne de type "{{foo.bar}}" par leurs valeurs dans le contexte.
 * Utile pour générer dynamiquement des chemins de fichiers ou dossiers dans la configuration de synchronisation.
 *
 * @param {string} template - Chaîne contenant des variables entre {{ }}
 * @param {Object} context - Objet de données (ex: project, listing, remoteContainer...)
 * @returns {string} - La chaîne avec les variables résolues
 */
export default function resolveTemplate(template, context) {
  return template.replace(/{{(.*?)}}/g, (_, expression) => {
    try {
      return evalInContext(expression.trim(), context);
    } catch (err) {
      console.warn("[resolveTemplate] Failed to resolve:", expression);
      return "";
    }
  });
}

function evalInContext(expression, context) {
  const func = new Function(...Object.keys(context), `return ${expression}`);
  return func(...Object.values(context));
}
