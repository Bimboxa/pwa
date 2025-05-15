// computedContext: {
//     entitiesListingsIds: {
//       from: "scope.sortedListings",
//       filters: [{key: "table", value: "entities"}],
//       transform: {type: "map", key: "id"},
//     },
//   },
// }

import getFilteredItems from "Features/misc/utils/getFilteredItems";
import getValueFromContext from "./getValueFromContext";
import resolveFilters from "./resolveFilters";

export default function resolveComputedContext(computedContext, context) {
  // edge case

  if (!computedContext || !context) return {};

  // main

  const result = {};

  Object.entries(computedContext).forEach(([key, value]) => {
    const from = value.from;
    const filtersToResolve = value.filters;
    const trans = value.transform;
    const _value = value.value; // value is already computed. No need to resolve it.

    if (_value) {
      result[key] = _value;
    } else {
      let items = getValueFromContext(from, context);
      if (filtersToResolve?.length > 0) {
        //const filters = resolveFilters(filtersToResolve, context); // filters don't need to be resolved here...
        const filters = filtersToResolve;
        items = getFilteredItems(items, filters);
      }
      if (trans?.type === "map") items = items.map((item) => item[trans.key]);

      result[key] = items;
    }
  });

  return result;
}
