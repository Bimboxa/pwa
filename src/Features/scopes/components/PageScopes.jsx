import useScopes from "../hooks/useScopes";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function PageScopes() {
  // data

  const { value: scopes, loading } = useScopes();

  // handlers

  function handleScopeClick(scope) {
    console.log("Scope clicked:", scope);
  }

  return <ListItemsGeneric items={scopes} onClick={handleScopeClick} />;
}
