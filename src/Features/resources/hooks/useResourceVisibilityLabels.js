import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// Labels of the resource scopes ("périmètre"). The SCOPE label follows the
// org wording of a scope (appConfig strings.scope.thisScope: "Ce Krto" for
// edx, "Ce plan de repérage" by default).
export default function useResourceVisibilityLabels() {
  const appConfig = useAppConfig();
  return {
    SCOPE: appConfig?.strings?.scope?.thisScope ?? "Ce plan de repérage",
    PROJECT: "Projet",
    GLOBAL: "Global",
  };
}
