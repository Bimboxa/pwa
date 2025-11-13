export default async function getEntityComputedFieldsAsync(
  computedFields,
  entity,
  entities
) {
  if (!computedFields || typeof computedFields !== "object") {
    return {};
  }

  const entries = await Promise.all(
    Object.entries(computedFields).map(async ([key, config]) => {
      const scriptKey = config?.scriptKey;
      if (!scriptKey) {
        return [key, null];
      }

      try {
        const module = await import(`../scripts/${scriptKey}.js`);
        const compute = module?.default;

        if (typeof compute !== "function") {
          console.warn(
            `[getEntityComputedFieldsAsync] Script '${scriptKey}' does not export a default function.`
          );
          return [key, null];
        }

        const value = await compute(entity, entities);
        return [key, value];
      } catch (error) {
        console.error(
          `[getEntityComputedFieldsAsync] Failed to execute script '${scriptKey}'`,
          error
        );
        return [key, null];
      }
    })
  );

  return entries.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}
