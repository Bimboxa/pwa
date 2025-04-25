/*
 * filtersTemplates: [{key:"key1",in:values},{key:"key2",value:value3}]
 * context: {values, value3,...}
 *
 * The resolver resolves the "in" or "value" prop of the filtersTemplates array.
 */

import resolveStringFromContext from "./resolveStringFromContext";

export default function resolveFilters(filtersTemplates, context) {
  return filtersTemplates.map((filter) => {
    const {key, in: inKey, value: valueKey} = filter;

    if (inKey) {
      const resolved = resolveStringFromContext(inKey, context);
      return {key, in: resolved};
    }

    if (valueKey !== undefined) {
      const resolved = resolveStringFromContext(valueKey, context);
      return {key, value: resolved};
    }

    return filter; // fallback (should not happen ideally)
  });
}
