import {useEffect, useState} from "react";

import {Box} from "@mui/material";
import {RichTreeViewPro} from "@mui/x-tree-view-pro";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import SwitchSeeSelectionOnly from "./SwitchSeeSelectionOnly";
import TreeItemGeneric from "./TreeItemGeneric";
import SectionSearch from "./SectionSearch";

import getNodesToExpand from "../utils/getNodesToExpand";
import getSelectedNodesWithParents from "../utils/getSelectedNodesWithParents";
import getNodesFromSearchText from "../utils/getNodesFromSearchText";
import getAllNodesIds from "../utils/getAllNodesIds";

export default function SelectorVariantTree({
  items,
  selection,
  onChange,
  multiSelect = false,
}) {
  // strings

  const saveS = "Sélectionner";

  // state - search text

  const [searchText, setSearchText] = useState("");

  // state

  const [tempSelection, setTempSelection] = useState(selection ?? []);
  const [expandedNodes, setExpandedNodes] = useState([]);

  const [seeSelectionOnly, setSeeSelectionOnly] = useState(false);

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
      <SectionSearch searchText={searchText} onChange={setSearchText} />
      <Box sx={{flex: 1, overflow: "auto"}}>
        <RichTreeViewPro
          checkboxSelection={multiSelect}
          multiSelect={multiSelect}
          items={items}
          selectedItems={tempSelection}
          onSelectedItemsChange={handleSelectionChange}
          expandedItems={expandedNodes}
          onExpandedItemsChange={(e, ids) => setExpandedNodes(ids)}
          slots={{item: TreeItemGeneric}}
        />
      </Box>
      <SwitchSeeSelectionOnly
        checked={seeSelectionOnly}
        onChange={setSeeSelectionOnly}
      />
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </Box>
  );
}
