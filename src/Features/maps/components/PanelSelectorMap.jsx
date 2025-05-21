import useMaps from "../hooks/useMaps";
import ListMaps from "./ListMaps";
import Panel from "Features/layout/components/Panel";
import SelectorMapsListingVariantChips from "./SelectorMapsListingVariantChips";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useMapsInSelector from "../hooks/useMapsInSelector";

export default function PanelSelectorMap({onSelectionChange, selection}) {
  // data

  const {value: items} = useMapsInSelector();
  console.log("[SelectorMap] maps", items);

  // handler

  function handleClick(map) {
    console.log("map", map);
    onSelectionChange(map.id);
  }

  function handleCreateClick() {
    console.log("create");
  }

  return (
    <Panel>
      <BoxFlexVStretch>
        <SelectorMapsListingVariantChips />
        <BoxFlexVStretch>
          <ListMaps
            maps={items}
            selection={selection ? [selection] : []}
            onClick={handleClick}
            //onCreateClick={handleCreateClick}
          />
        </BoxFlexVStretch>
      </BoxFlexVStretch>
    </Panel>
  );
}
