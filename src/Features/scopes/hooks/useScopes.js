import {useSelector} from "react-redux";

export default function useScopes(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;

  // data

  const scopesMap = useSelector((state) => state.scopes.scopesMap);

  let scopes = Array.from(scopesMap.values());

  // filter

  if (filterByProjectId) {
    scopes = scopes.filter((scope) => scope.projectId === filterByProjectId);
  }

  // return

  return scopes;
}
