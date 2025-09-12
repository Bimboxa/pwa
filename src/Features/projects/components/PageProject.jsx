import { useParams } from "react-router-dom";

import useScopes from "Features/scopes/hooks/useScopes";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function PageProject() {
  // data

  const { projectId } = useParams();
  const { value: scopes, loading } = useScopes({
    filterByProjectId: projectId,
  });

  // helpers

  const items = scopes.map((scope) => ({
    id: scope.id,
    label: scope.name,
  }));

  // handlers

  function handleScopeClick(scope) {
    console.log("Scope clicked:", scope);
  }

  return <ListItemsGeneric items={items} onClick={handleScopeClick} />;
}
