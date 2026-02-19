import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedProjectId as setProjectId, setStepKey } from "Features/scopeCreator/scopeCreatorSlice";

import PageGeneric from "Features/layout/components/PageGeneric";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import PageDashboardFooter from "./PageDashboardFooter";
import SectionDashboardTitle from "./SectionDashboardTitle";
import SectionProjectsInDashboard from "./SectionProjectsInDashboard";
import SectionScopesInDashboard from "./SectionScopesInDashboard";

export default function PageDashboard() {

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setSelectedProjectId(null))
    dispatch(setProjectId(null))
    dispatch(setStepKey("SEARCH_PROJECT"));
  }, [])

  return (
    <>
      <PageGeneric>
        <BoxFlexVStretch sx={{ height: 1 }}>
          <SectionDashboardTitle />
          <BoxFlexVStretch>
            {/* <SectionProjectsInDashboard /> */}
            <SectionScopesInDashboard />
          </BoxFlexVStretch>
          <PageDashboardFooter />
        </BoxFlexVStretch>
      </PageGeneric>

      <DialogAutoScopeCreator />
    </>
  );
}
