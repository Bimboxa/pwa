import { useSelector } from "react-redux";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelEntityInRightPanel from "Features/entities/components/PanelEntityInRightPanel";

export default function PanelSelection() {
  // data
  const selectedItem = useSelector((s) => s.selection.selectedItem);
  console.log("selectedItem", selectedItem);

  // helper

  const type = selectedItem?.type;

  return (
    <BoxFlexVStretch>
      {type === "ENTITY" && (
        <PanelEntityInRightPanel selectedItem={selectedItem} />
      )}
    </BoxFlexVStretch>
  );
}
