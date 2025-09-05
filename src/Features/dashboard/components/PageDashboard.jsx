import PageGeneric from "Features/layout/components/PageGeneric";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PageDashboardHeader from "./PageDashboardHeader";
import SectionScopesInDashboard from "./SectionScopesInDashboard";
import DialogAutoScopeCreator from "Features/scopeCreator/components/DialogAutoScopeCreator";
import PageDashboardFooter from "./PageDashboardFooter";

export default function PageDashboard() {
  return (
    <>
      <PageGeneric>
        <BoxFlexVStretch sx={{ height: 1 }}>
          <PageDashboardHeader />
          <BoxFlexVStretch>
            <SectionScopesInDashboard />
          </BoxFlexVStretch>
          <PageDashboardFooter />
        </BoxFlexVStretch>
      </PageGeneric>

      <DialogAutoScopeCreator />
    </>
  );
}
