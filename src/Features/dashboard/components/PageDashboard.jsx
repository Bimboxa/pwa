import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedProjectId as setProjectId, setStepKey } from "Features/scopeCreator/scopeCreatorSlice";

import useInitFetchScopeFavorites from "Features/scopeFavorites/hooks/useInitFetchScopeFavorites";

import PageGeneric from "Features/layout/components/PageGeneric";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import PageDashboardFooter from "./PageDashboardFooter";
import SectionDashboardMasterDetail from "./SectionDashboardMasterDetail";

export default function PageDashboard() {

  const dispatch = useDispatch();

  useInitFetchScopeFavorites();

  useEffect(() => {
    dispatch(setSelectedProjectId(null))
    dispatch(setProjectId(null))
    dispatch(setStepKey("SEARCH_PROJECT"));
  }, [])

  return (
    <>
      <PageGeneric>
        <BoxFlexVStretch sx={{ height: 1 }}>
          <SectionDashboardMasterDetail />
          <PageDashboardFooter />
        </BoxFlexVStretch>
      </PageGeneric>

      <DialogAutoScopeCreator />
    </>
  );
}
