import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionBaseMapsInListPanel from "Features/baseMaps/components/SectionBaseMapsInListPanel";

export default function ListPanelV2() {
  // data

  const key = useSelector((s) => s.listPanel.selectedListTypeKey);
  console.log("listType", key);

  return (
    <BoxFlexVStretch>
      {key === "BASE_MAPS" && <SectionBaseMapsInListPanel />}
    </BoxFlexVStretch>
  );
}
