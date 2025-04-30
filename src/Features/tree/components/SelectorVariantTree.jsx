import {useEffect, useState} from "react";

import {Box} from "@mui/material";
import {RichTreeViewPro} from "@mui/x-tree-view-pro";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import getNodesToExpand from "../utils/getNodesToExpand";

export default function SelectorVariantTree({
  items,
  selection,
  onChange,
  multiSelect = false,
}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [tempSelection, setTempSelection] = useState(selection ?? []);
  const [expandedNodes, setExpandedNodes] = useState([]);

  useEffect(() => {
    setTempSelection(selection);
    const expanded = getNodesToExpand(items, selection);
    setExpandedNodes(expanded);
  }, []);

  // handlers

  function handleSelectionChange(event, ids) {
    setTempSelection(ids);
  }

  function handleSave() {
    onChange(tempSelection);
  }

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{flex: 1, overflow: "auto"}}>
        <RichTreeViewPro
          checkboxSelection={multiSelect}
          multiSelect={multiSelect}
          items={items}
          selectedItems={tempSelection}
          onSelectedItemsChange={handleSelectionChange}
          expandedItems={expandedNodes}
          onExpandedItemsChange={(e, ids) => setExpandedNodes(ids)}
        />
      </Box>
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </Box>
  );
}
