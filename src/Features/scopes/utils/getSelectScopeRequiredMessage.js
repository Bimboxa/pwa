// Toast shown when an annotation is created / modified with no scope
// selected. Org wording via appConfig strings.scope.selectRequired; the JS
// fallback is mandatory (org yaml replaces appConfig_default.yaml wholesale).
export default function getSelectScopeRequiredMessage(appConfig) {
  return (
    appConfig?.strings?.scope?.selectRequired ??
    "Sélectionnez un plan de repérage"
  );
}
