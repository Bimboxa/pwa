import { useSelector } from "react-redux";

import useBaseMaps from "../hooks/useBaseMaps";

import ListBaseMaps from "./ListBaseMaps";
import Panel from "Features/layout/components/Panel";
import SelectorMapsListingVariantChips from "./SelectorMapsListingVariantChips";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelSelectorBaseMap({ onSelectionChange, selection }) {
  // data

  const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
  const { value: items } = useBaseMaps({
    filterByListingId: listingId,
  });

  // handler

  function handleClick(baseMap) {
    console.log("baseMap", baseMap);
    onSelectionChange(baseMap.id);
  }

  function handleCreateClick() {
    console.log("create");
  }

  return (
    <Panel>
      <BoxFlexVStretch>
        <SelectorMapsListingVariantChips />
        <BoxFlexVStretch>
          <ListBaseMaps
            baseMaps={items}
            selection={selection ? [selection] : []}
            onClick={handleClick}
            //onCreateClick={handleCreateClick}
          />
        </BoxFlexVStretch>
      </BoxFlexVStretch>
    </Panel>
  );
}
