import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSearchProject from "./SectionSearchProject";
import SectionCreateProject from "./SectionCreateProject";
import SectionSelectPresetScope from "./SectionSelectPresetScope";
import SectionCreateScope from "./SectionCreateScope";

export default function SectionSteps() {
  // data

  const stepKey = useSelector((s) => s.scopeCreator.stepKey);

  return (
    <BoxFlexVStretch>
      {stepKey === "SEARCH_PROJECT" && <SectionSearchProject />}
      {stepKey === "CREATE_PROJECT" && <SectionCreateProject />}
      {stepKey === "SELECT_PRESET_SCOPE" && <SectionSelectPresetScope />}
      {stepKey === "CREATE_SCOPE" && <SectionCreateScope />}
    </BoxFlexVStretch>
  );
}
