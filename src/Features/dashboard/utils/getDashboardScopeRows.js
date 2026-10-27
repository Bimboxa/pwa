import parseBackendDate from "Features/date/utils/parseBackendDate";
import getScopeConfigMetaData from "Features/remoteScopeConfigurations/utils/getScopeConfigMetaData";

// Krto rows of a dashboard project item: local scopes first, then the remote
// (not installed) scope configurations.
// row = { scopeId, name, subText, isLocal, isFavorite, povPreviews,
//         annotationsCount, baseMapsCount }
// `subText` = "author trigram, last configuration date".
// The latest scopeConfiguration pushed for a local scope, when known, is
// authoritative for the sub text, POV previews and content stats. The
// project fetch (same key rule as useFetchProjectScopeConfigurations) also
// covers installed scopes, absent from the ByUser list.

function formatDate(value) {
  return parseBackendDate(value)?.toLocaleDateString() ?? null;
}

export default function getDashboardScopeRows({
  item,
  projectConfigurations,
  userConfigurations,
  isFavorite,
}) {
  if (!item) return [];

  const projectConfigs =
    projectConfigurations?.[String(item.idMaster ?? item.clientRef ?? "")] ??
    [];

  function findScopeConfig(scopeId) {
    return [...projectConfigs, ...(userConfigurations ?? [])].find(
      (c) => String(c.scopeId) === String(scopeId)
    );
  }

  function getSubText({ config, fallbackAuthor, fallbackDate }) {
    const author = config?.createdBy?.trigram ?? fallbackAuthor;
    const date = formatDate(config?.createdAt ?? fallbackDate);
    return [author, date].filter(Boolean).join(", ");
  }

  return [
    ...item.scopes.map((scope) => {
      const config = findScopeConfig(scope.id);
      const metaData = getScopeConfigMetaData(config);
      return {
        scopeId: scope.id,
        name: scope.name,
        subText: getSubText({
          config,
          fallbackAuthor: scope.createdBy,
          fallbackDate: scope.updatedAt ?? scope.createdAt,
        }),
        isLocal: true,
        isFavorite: isFavorite?.(scope.id) ?? false,
        povPreviews: config?.povPreviews,
        annotationsCount: metaData.annotationsCount,
        baseMapsCount: metaData.baseMapsCount,
      };
    }),
    ...item.remoteConfigs.map((config) => {
      const metaData = getScopeConfigMetaData(config);
      return {
        scopeId: config.scopeId,
        name: config.scopeName,
        subText: getSubText({ config }),
        isLocal: false,
        isFavorite: isFavorite?.(config.scopeId) ?? false,
        povPreviews: config.povPreviews,
        annotationsCount: metaData.annotationsCount,
        baseMapsCount: metaData.baseMapsCount,
      };
    }),
  ];
}
