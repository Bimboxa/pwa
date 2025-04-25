/*
 * template ex 1: /_{{project.clientRef}/_listing_{{listingId}}
 * template ex 2: /_{{id}}.json
 *
 * rule 1: if {{contextItem.key}} => eval from the context and the key (contextItem[key]).
 * rule 2: if {{itemKey}} => eval from item and the itemKey (item[itemKey])
 * rule 3: if (iteration), return several values based on the key and its values. the key is part of the template
 *  rule 3 ex: /_listing_{{key}}.json
 */

const resolveTemplate = (template, context, item) => {
  if (!template) {
    console.error("[resolveTemplate] template is empty", item);
    return null;
  }
  console.log("[resolveTemplate] template", template);
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    // Si le key contient un point, on considère que c'est context.key
    if (key.includes(".")) {
      const [contextKey, subKey] = key.split(".");
      return context[contextKey]?.[subKey] ?? "";
    }
    // Sinon, on prend la valeur dans item
    return item?.[key] ?? "";
  });
};

const resolveTemplateWithIteration = (template, context, item, iteration) => {
  const resolveSingle = (tpl, overrides = {}) => {
    return tpl.replace(/{{(.*?)}}/g, (_, key) => {
      // Si la clé est exactement "key" (utilisé pour iteration)
      if (key === iteration?.key && key in overrides) {
        return overrides[key];
      }

      // Accès contextuel avec point : {{project.clientRef}}
      if (key.includes(".")) {
        const [obj, prop] = key.split(".");
        return context?.[obj]?.[prop] ?? "";
      }

      // Sinon : item[key]
      return item?.[key] ?? "";
    });
  };

  if (iteration && Array.isArray(iteration.in)) {
    return iteration.in.map((value) => {
      return resolveSingle(template, {[iteration.key]: value});
    });
  }

  // Cas sans itération
  return [resolveSingle(template)];
};

export function resolveFilePath({folderTemplate, fileTemplate, context, item}) {
  const folderPath = resolveTemplate(folderTemplate, context, item);
  const filePath = resolveTemplate(fileTemplate, context, item);
  return `${folderPath}/${filePath}`;
}

export function resolveFolderPath({folderTemplate, context, item}) {
  return resolveTemplate(folderTemplate, context, item);
}

export function resolveFoldersPaths({
  folderTemplate,
  context,
  item,
  iteration,
}) {
  return resolveTemplateWithIteration(folderTemplate, context, item, iteration);
}

export function resolveFilesPathsFromItems({folderTemplate, context, items}) {
  const allPaths = items.map((item) => {
    const filePath = resolveTemplate(folderTemplate, context, item);
    return filePath;
  });
  // we remove duplicates from all the items (ex: entities in one listing)
  return [...new Set(allPaths)];
}
