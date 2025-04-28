/*
 * iteration: {key,in}
 * context: {values, value3,...}
 *
 * The resolver resolves the "in" or "value" prop of the filtersTemplates array.
 */

import resolveStringFromContext from "./resolveStringFromContext";

export default function resolveIteration(iteration, context) {
  return {
    key: iteration.key,
    in: resolveStringFromContext(iteration.in, context),
  };
}
