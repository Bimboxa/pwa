import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionDetailSearchProject from "./SectionDetailSearchProject";
import SectionDetailPresetScope from "./SectionDetailPresetScope";

export default function SectionStepDetail() {
  // data

  const stepKey = useSelector((s) => s.scopeCreator.stepKey);

  return (
    <BoxFlexVStretch>
      {stepKey === "SEARCH_PROJECT" && <SectionDetailSearchProject />}
      {stepKey === "SELECT_PRESET_SCOPE" && <SectionDetailPresetScope />}
    </BoxFlexVStretch>
  );
}
