import defaultTitleBlockManifest from "../data/defaultTitleBlockManifest";

// Manifest lookup: portfolio's stored key -> org default key -> bundled
// default (identical to the historical hardcoded cartouche).
export default function getTitleBlockManifest(appConfig, portfolio) {
  const config = appConfig?.features?.titleBlocks;
  const key = portfolio?.metadata?.titleBlock?.key ?? config?.defaultKey;
  return (key && config?.manifestsByKey?.[key]) || defaultTitleBlockManifest;
}
