import {useSelector} from "react-redux";

import useSelectedScope from "./useSelectedScope";

export default function useScope(options) {
  // options

  const forceNew = options?.forceNew;

  // main

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const newScope = useSelector((s) => s.scopes.newScope);
  const editedScope = useSelector((s) => s.scopes.editedScope);
  const isEditingScope = useSelector((s) => s.scopes.isEditingScope);

  const {value: selectedScope, loading} = useSelectedScope();

  let scope = loading ? null : selectedScope;

  if (!selectedScopeId) {
    if (isEditingScope) {
      scope = editedScope;
    } else {
      scope = newScope;
    }
  }

  if (forceNew) {
    scope = newScope;
  }

  return {value: scope, loading};
}
