import { useMemo } from "react";

import { useSelector } from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import { getScopeLocalActivityFromStorage } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import getLocalDateString from "../utils/getLocalDateString";

// Krtos of this device with local activity on the given day (creation,
// update of the scope record, last local edit, last save) — shaped like the
// ScopesByDay items so the dashboard can merge them with the server list.
// The activity on this device is the current user's: createdBy = current
// user, hasLocalActivity = true (kept by the "Mes Krtos" filter).

function toTime(value) {
  if (value === undefined || value === null || value === "") return null;
  const time = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export default function useLocalDailyScopes(dateS) {
  // data

  const { value: scopes } = useScopes({ withProject: true });
  const userProfile = useSelector((s) => s.auth.userProfile);

  // items

  return useMemo(() => {
    if (!dateS) return [];
    const createdBy = {
      idMaster: getUserIdMaster(userProfile),
      trigram: userProfile?.trigram,
    };

    return (scopes ?? []).reduce((acc, scope) => {
      const { lastLocalChangeAt, lastSyncAt } =
        getScopeLocalActivityFromStorage(scope.id);
      const times = [
        scope.createdAt,
        scope.updatedAt,
        lastLocalChangeAt,
        lastSyncAt,
      ]
        .map(toTime)
        .filter((t) => t !== null && getLocalDateString(new Date(t)) === dateS);
      if (!times.length) return acc;

      acc.push({
        scopeId: scope.id,
        scopeName: scope.name,
        projectId: scope.projectId,
        projectName: scope.project?.name,
        projectClientRef: scope.project?.clientRef,
        projectType: scope.project?.type,
        lastConfigurationAt: new Date(Math.max(...times)).toISOString(),
        createdBy,
        isLocal: true,
        hasLocalActivity: true,
      });
      return acc;
    }, []);
  }, [scopes, dateS, userProfile]);
}
