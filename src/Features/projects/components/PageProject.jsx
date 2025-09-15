import { useParams, useNavigate } from "react-router-dom";

import { useDispatch } from "react-redux";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useScopes from "Features/scopes/hooks/useScopes";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function PageProject() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const { projectId } = useParams();
  const { value: scopes, loading } = useScopes({
    filterByProjectId: projectId,
  });

  // helpers

  const items = scopes?.map((scope) => ({
    ...scope,
    label: scope.name,
  }));

  // handlers

  function handleScopeClick(scope) {
    console.log("Scope clicked:", scope);
    dispatch(setSelectedScopeId(scope.id));
    dispatch(setSelectedProjectId(projectId));
    navigate(`/`);
  }

  return <ListItemsGeneric items={items} onClick={handleScopeClick} />;
}
