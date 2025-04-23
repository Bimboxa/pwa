export default function useRelsScopeItemByScope() {
  // data
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const relsScopeItemByScopeId = useSelector(
    (s) => s.scopes.relsScopeItemByScopeId
  );

  // main
  let rels = relsScopeItemByScopeId[selectedScopeId];

  // return
  return {value: rels, loading: false};
}
