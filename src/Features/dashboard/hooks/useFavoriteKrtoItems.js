import { useMemo } from "react";

import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopes from "Features/scopes/hooks/useScopes";
import getPresetScopeLabel from "../utils/getPresetScopeLabel";

// Resolves the user's favorite scopes into displayable cards:
// { scopeId, name, type, projectName, projectKey, isLocal }
// Resolution order: local Dexie scope > user remote configuration > favorite fields.

export default function useFavoriteKrtoItems() {
  // data

  const appConfig = useAppConfig();
  const favorites = useSelector((s) => s.scopeFavorites.favorites);
  const userConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.userConfigurations
  );
  const { value: scopes } = useScopes({ withProject: true });

  // items

  const items = useMemo(() => {
    return (favorites ?? []).map((favorite) => {
      const scopeId = favorite.scopeId;

      // 1. local scope
      const scope = (scopes ?? []).find((s) => String(s.id) === String(scopeId));
      if (scope) {
        return {
          scopeId,
          name: scope.name,
          type: getPresetScopeLabel(appConfig, scope.presetScopeKey),
          projectName: scope.project?.name,
          projectKey: `local_${scope.projectId}`,
          projectId: scope.projectId,
          isLocal: true,
        };
      }

      // 2. user remote configuration
      const config = (userConfigurations ?? []).find(
        (c) => String(c.scopeId) === String(scopeId)
      );
      const source = config ?? favorite;

      return {
        scopeId,
        name: source.scopeName ?? "Krto",
        type: null,
        projectName: source.projectName,
        projectKey: `remote_${source.projectClientRef ?? source.projectName}`,
        isLocal: false,
      };
    });
  }, [favorites, scopes, userConfigurations, appConfig]);

  return items;
}
