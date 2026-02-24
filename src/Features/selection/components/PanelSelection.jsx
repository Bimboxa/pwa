import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelEntityInRightPanel from "Features/entities/components/PanelEntityInRightPanel";
import PanelBaseMapContainerProperties from "Features/portfolioEditor/components/PanelBaseMapContainerProperties";
import { selectSelectedItems } from "../selectionSlice";

export default function PanelSelection() {

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];

  // helper

  const type = selectedItem?.type;

  return (
    <BoxFlexVStretch>
      {type === "ENTITY" && (
        <PanelEntityInRightPanel selectedItem={selectedItem} />
      )}
      {type === "BASE_MAP_CONTAINER" && (
        <PanelBaseMapContainerProperties />
      )}
    </BoxFlexVStretch>
  );
}
