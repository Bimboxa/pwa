import useAppConfig from "Features/appConfig/hooks/useAppConfig";

/*
 * Krto creation configurations (card selector). Returns
 * {enabled, items, keywordFamilies} when the org enables the feature and the
 * registry resolved at least one configuration — null otherwise (legacy flow).
 */
export default function useKrtoConfigurations() {
  const appConfig = useAppConfig();

  const krtoConfigurations = appConfig?.features?.krtoConfigurations;
  if (!krtoConfigurations?.enabled || !krtoConfigurations?.items?.length)
    return null;

  return krtoConfigurations;
}
