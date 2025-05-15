/*
 * filtersTemplates: [{key:"key1",in:values,doNotResolve:true},{key:"key2",value:value3}]
 * context: {values, value3,...}
 *
 * The resolver resolves the "in" or "value" prop of the filtersTemplates array.
 * If doNotResolve, do not resolve the "in" or "value" (for ex, value="true")
 */

import resolveStringFromContext from "./resolveStringFromContext";

export default function resolveFilters(filtersTemplates, context) {
  return filtersTemplates.map((filter) => {
    const {key, in: inKey, value: valueKey, doNotResolve} = filter;

    if (doNotResolve) {
      return filter;
    } else if (inKey) {
      const resolved = resolveStringFromContext(inKey, context);
      return {key, in: resolved};
    } else if (valueKey !== undefined) {
      const resolved = resolveStringFromContext(valueKey, context);
      return {key, value: resolved};
    } else {
      return filter; // fallback (should not happen ideally)
    }
  });
}
