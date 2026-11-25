import { useDispatch, useStore } from "react-redux";

import { setSelectedScopeId } from "../scopesSlice";

import deleteScopeService from "../services/deleteScopeService";

export default function useDeleteScope() {
  const dispatch = useDispatch();
  const store = useStore();

  const deleteScope = async (scopeId) => {
    await deleteScopeService(scopeId);
    // Never keep a deleted scope selected: writes would land nowhere.
    if (store.getState().scopes.selectedScopeId === scopeId) {
      dispatch(setSelectedScopeId(null));
    }
  };
  return deleteScope;
}
