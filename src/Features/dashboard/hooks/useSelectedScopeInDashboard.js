import { useSelector } from "react-redux";
import useScopes from "Features/scopes/hooks/useScopes";

export default function useSelectedScopeInDashboard() {
  const selectedScopeId = useSelector(
    (state) => state.dashboard.selectedScopeId
  );

  const { value: scopes } = useScopes({ withProject: true });

  return scopes?.find((scope) => scope.id === selectedScopeId);
}
