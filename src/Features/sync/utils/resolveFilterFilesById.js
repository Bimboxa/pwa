/*
 * filterFilesById: {template,in}
 * context: {values, value3,...}
 *
 * The resolver resolves the "in" or "value" prop.
 */

import resolveStringFromContext from "./resolveStringFromContext";

export default function resolveFilterFilesById(filterFilesById, context) {
  return {
    template: filterFilesById.template,
    in: resolveStringFromContext(filterFilesById.in, context),
  };
}
