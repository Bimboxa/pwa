import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  setSelectedScopeId,
  setScopeOpeningSource,
} from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

// Opens a krto row of the dashboard: a local scope is selected and the
// editor opened; a remote one is installed & opened via the loader route.
// `openingSourceProjectId`: project the krto is opened from when it is not
// its own (krto of a linked project) — recorded as the scope opening source,
// and cleared on any other dashboard opening.

export default function useOpenDashboardScope() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return ({ row, projectId, openingSourceProjectId }) => {
    dispatch(
      setScopeOpeningSource(
        openingSourceProjectId
          ? { scopeId: row.scopeId, projectId: openingSourceProjectId }
          : null
      )
    );
    if (row.isLocal) {
      dispatch(setSelectedScopeId(row.scopeId));
      if (projectId != null) dispatch(setSelectedProjectId(projectId));
      navigate("/");
    } else {
      navigate(`/scopes/${row.scopeId}`);
    }
  };
}
