import { RESTORABLE_MODULE_KEYS } from "Features/init/services/getInitSelectedModuleKey";

export const DEFAULT_MODULE_KEY = "MAP";

// Device preference: the module a scope lands on when opened from the
// dashboard (Configuration > Données & préférences). Validated against the
// restorable module keys so a stale / unknown key falls back to Dessin.
export default function getDefaultModuleKeyFromLocalStorage() {
  const moduleKey = localStorage.getItem("defaultModuleKey");
  return RESTORABLE_MODULE_KEYS.includes(moduleKey)
    ? moduleKey
    : DEFAULT_MODULE_KEY;
}
