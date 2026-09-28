import { useCallback } from "react";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import linkListingsToScopeService from "../services/linkListingsToScopeService";

// Links listings of another scope into the selected scope ("Depuis un autre
// Krto"). No triggerListingsUpdate: the dexieSyncService liveQuery on
// db.relsScopeListing feeds the listings selector inputs.
export default function useLinkListingsToScope() {
  const dispatch = useDispatch();
  const { value: scope } = useSelectedScope();

  return useCallback(
    async (listings) => {
      if (!scope?.id) return [];
      try {
        return await linkListingsToScopeService({
          hostScope: scope,
          listings,
        });
      } catch (error) {
        console.error("[useLinkListingsToScope]", error);
        dispatch(
          setToaster({
            message: error?.message ?? "Impossible d'ajouter les listes",
            isError: true,
          })
        );
        return [];
      }
    },
    [scope, dispatch]
  );
}
