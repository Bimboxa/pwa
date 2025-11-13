import { useEffect, useState } from "react";

import { Box } from "@mui/material";
import { RichTreeViewPro } from "@mui/x-tree-view-pro";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import SwitchSeeSelectionOnly from "./SwitchSeeSelectionOnly";
import TreeItemGeneric from "./TreeItemGeneric";
import SectionSearch from "./SectionSearch";

import getNodesToExpand from "../utils/getNodesToExpand";
import getSelectedNodesWithParents from "../utils/getSelectedNodesWithParents";
import getNodesFromSearchText from "../utils/getNodesFromSearchText";
import getAllNodesIds from "../utils/getAllNodesIds";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SelectorVariantTree({
  items,
  selection,
  onChange,
  multiSelect = false,
  color,
  onCreateClick,
}) {
  // strings

  const saveS = "Sélectionner";

  // state - search text

  const [searchText, setSearchText] = useState("");

  // state

  let initSelection = selection ?? [];
  initSelection = Array.isArray(initSelection)
    ? initSelection
    : [initSelection];

  const [tempSelection, setTempSelection] = useState(initSelection);
  const [expandedNodes, setExpandedNodes] = useState([]);

  const [seeSelectionOnly, setSeeSelectionOnly] = useState(false);

  console.log("debug_1211_tempSelection", tempSelection);

  useEffect(() => {
    setTempSelection(selection);
    const expanded = getNodesToExpand(items, selection);
    setExpandedNodes(expanded);
  }, []);

  // helpers - items

  if (seeSelectionOnly) {
    items = getSelectedNodesWithParents(tempSelection, items);
  } else if (searchText?.length > 0) {
    items = getNodesFromSearchText(searchText, items);
  }

  // effect - expand found nodes

  useEffect(() => {
    if (searchText?.length > 0) {
      setExpandedNodes(getAllNodesIds(items));
    } else {
      setExpandedNodes(getNodesToExpand(items, tempSelection));
    }
  }, [searchText]);

  // handlers

  function handleSelectionChange(event, ids) {
    setTempSelection(ids);
  }

  function handleSave() {
    onChange(tempSelection);
  }

  function handleCreateClick() {
    onCreateClick({ tempSelection });
  }

  return (
    <BoxFlexVStretch>
      <SectionSearch
        searchText={searchText}
        onChange={setSearchText}
        color={color}
        onCreateClick={handleCreateClick}
      />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <RichTreeViewPro
          checkboxSelection={multiSelect}
          multiSelect={multiSelect}
          items={items}
          selectedItems={tempSelection}
          onSelectedItemsChange={handleSelectionChange}
          expandedItems={expandedNodes}
          onExpandedItemsChange={(e, ids) => setExpandedNodes(ids)}
          slots={{ item: TreeItemGeneric }}
        />
      </Box>
      <SwitchSeeSelectionOnly
        checked={seeSelectionOnly}
        onChange={setSeeSelectionOnly}
      />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="contained"
        color="secondary"
        disabled={!tempSelection?.length > 0}
      />
    </BoxFlexVStretch>
  );
}
