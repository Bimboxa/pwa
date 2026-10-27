import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

// Opens a krto row of the dashboard: a local scope is selected and the
// editor opened; a remote one is installed & opened via the loader route.

export default function useOpenDashboardScope() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return ({ row, projectId }) => {
    if (row.isLocal) {
      dispatch(setSelectedScopeId(row.scopeId));
      if (projectId != null) dispatch(setSelectedProjectId(projectId));
      navigate("/");
    } else {
      navigate(`/scopes/${row.scopeId}`);
    }
  };
}
