import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import getInitScopeId from "Features/init/services/getInitScopeId";
import { setSelectedScopeId } from "../scopesSlice";

// Restores the persisted scope (localStorage initScopeId). The reducer of
// setSelectedScopeId writes that same key, so after any scope change the
// value read here catches up with the store: re-dispatching it would run
// every scope-change reducer a second time (it closed the SCOPE module's
// grid right after its keeper had re-opened it).
export default function useInitSelectScope() {
  const dispatch = useDispatch();
  const store = useStore();

  const initScopeId = getInitScopeId();

  useEffect(() => {
    if (initScopeId === store.getState().scopes.selectedScopeId) return;
    dispatch(setSelectedScopeId(initScopeId));
  }, [initScopeId, dispatch, store]);
}
