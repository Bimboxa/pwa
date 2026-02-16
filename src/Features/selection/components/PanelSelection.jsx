import { useSelector } from "react-redux";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelEntityInRightPanel from "Features/entities/components/PanelEntityInRightPanel";
import { selectSelectedItems } from "../selectionSlice";

export default function PanelSelection() {

  // data
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  console.log("selectedItem", selectedItem);
  console.log("selectedItem.nodeId", selectedItem?.nodeId);

  // helper

  const type = selectedItem?.itemType || selectedItem?.type;

  return (
    <BoxFlexVStretch>
      {type === "ENTITY" && (
        <PanelEntityInRightPanel selectedItem={selectedItem} />
      )}
    </BoxFlexVStretch>
  );
}
