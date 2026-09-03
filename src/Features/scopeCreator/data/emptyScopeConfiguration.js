import {
  DEFAULT_DISABLED_MODULE_KEYS,
  DEFAULT_DISABLED_TOOL_KEYS,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

/*
 * Built-in configuration of the "vide" scope (dashboard "Krto vide" button,
 * compact dialog default entry). Same shape as a Data/<org>/configurations
 * item, minus key / card fields — it never shows in the card selector.
 *
 * - no annotation listing at all: no library and no system isForBaseMaps
 *   listing (initSystemAnnotationTemplates false);
 * - baseMap listing "Fonds de plan" created as a fallback only when the
 *   project has no baseMap listing yet; otherwise the scope works with the
 *   project's existing listings (all kept visible — hiding them would leave
 *   the scope without any listing to receive a baseMap);
 * - only the two core modules (Fonds de plan, Dessin) enabled, app default
 *   tools.
 */
const EMPTY_SCOPE_CONFIGURATION = {
  baseMaps: {
    disableExistingListings: false,
    listings: [{ name: "Fonds de plan", fallback: true, items: [] }],
  },
  annotations: { libraryKeys: [], initSystemAnnotationTemplates: false },
  scopeConfig: {
    disabledModuleKeys: [...DEFAULT_DISABLED_MODULE_KEYS],
    disabledToolKeys: [...DEFAULT_DISABLED_TOOL_KEYS],
    disabledToolKeysByModule: {},
  },
};

export default EMPTY_SCOPE_CONFIGURATION;
