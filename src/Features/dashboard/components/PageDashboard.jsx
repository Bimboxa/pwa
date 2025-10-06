import PageGeneric from "Features/layout/components/PageGeneric";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PageDashboardHeader from "./PageDashboardHeader";

import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import PageDashboardFooter from "./PageDashboardFooter";
import SectionDashboardTitle from "./SectionDashboardTitle";
import SectionProjectsInDashboard from "./SectionProjectsInDashboard";

export default function PageDashboard() {
  return (
    <>
      <PageGeneric>
        <BoxFlexVStretch sx={{ height: 1 }}>
          <PageDashboardHeader />
          <SectionDashboardTitle />
          <BoxFlexVStretch>
            <SectionProjectsInDashboard />
          </BoxFlexVStretch>
          <PageDashboardFooter />
        </BoxFlexVStretch>
      </PageGeneric>

      <DialogAutoScopeCreator />
    </>
  );
}
