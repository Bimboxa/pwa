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
  onToggleItem,
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

  useEffect(() => {
    setTempSelection(initSelection);
  }, [initSelection.join(".")]);

  const [expandedNodes, setExpandedNodes] = useState([]);

  const [seeSelectionOnly, setSeeSelectionOnly] = useState(false);

  console.log("debug_1211_tempSelection", tempSelection);

  useEffect(() => {
    const normalizedSelection = Array.isArray(selection)
      ? selection
      : selection != null
      ? [selection]
      : [];
    setTempSelection(normalizedSelection);
    const expanded = getNodesToExpand(items, normalizedSelection);
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
    console.log("debug_1211_handleSelectionChange", ids);

    if (multiSelect) {
      const prevSelection = Array.isArray(tempSelection) ? tempSelection : [];
      const newSelection = Array.isArray(ids) ? ids : [];

      // Find which item was added (checked) or removed (unchecked)
      const added = newSelection.filter((id) => !prevSelection.includes(id));
      const removed = prevSelection.filter((id) => !newSelection.includes(id));

      // Determine which item was toggled
      const toggledItemId = added[0] || removed[0] || null;
      const wasChecked = added.length > 0;
      const wasUnchecked = removed.length > 0;

      if (toggledItemId) {
        console.log("Toggled item:", {
          itemId: toggledItemId,
          wasChecked,
          wasUnchecked,
        });
        if (onToggleItem)
          onToggleItem({
            itemId: toggledItemId,
            wasChecked: wasChecked,
          });
        // You can emit this information if needed
        // onChange?.({ itemId: toggledItemId, checked: wasChecked, selection: newSelection });
      }

      setTempSelection(newSelection);
    } else {
      setTempSelection(ids ? [ids] : []);
    }
  }

  function handleSave() {
    let selection = tempSelection;
    if (!multiSelect) selection = selection?.[0];
    if (onChange) {
      onChange(selection);
    }
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
      {onChange && (
        <ButtonInPanelV2
          label={saveS}
          onClick={handleSave}
          variant="contained"
          color="secondary"
          disabled={!Array.isArray(tempSelection) || tempSelection.length === 0}
        />
      )}
    </BoxFlexVStretch>
  );
}
