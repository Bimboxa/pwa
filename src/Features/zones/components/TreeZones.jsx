import {useState} from "react";
import {RichTreeViewPro} from "@mui/x-tree-view-pro";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSearch from "Features/tree/components/SectionSearch";
import TreeItemGeneric from "Features/tree/components/TreeItemGeneric";

import {cleanNodesIds} from "Features/tree/utils/nodesManagementUtils";
import getNodesFromSearchText from "Features/tree/utils/getNodesFromSearchText";
import getAllNodesIds from "Features/tree/utils/getAllNodesIds";

export default function TreeZones({
  items,
  expandedItems,
  onExpandedItemsChange,
  selectedItems,
  onSelectedItemsChange,
  onItemPositionChange,
  onDeleteItems,
  updatedAt, // to force re-render of the tree
  onMoreClick,
}) {
  // state - search

  const [searchText, setSearchText] = useState("");
  const onSearchChange = (text) => {
    setSearchText(text);
  };

  // helpers

  items = cleanNodesIds(items);

  // search

  items = getNodesFromSearchText(searchText, items);

  // helpers

  if (searchText?.length > 0) expandedItems = getAllNodesIds(items);

  // handlers

  function handleSelectedItemsChange(e, ids) {
    onSelectedItemsChange(ids);
  }

  function handleExpandedItemsChange(e, ids) {
    onExpandedItemsChange(ids);
  }

  function handleItemPositionChange({itemId, oldPosition, newPosition}) {
    onItemPositionChange({itemId, oldPosition, newPosition});
  }

  function handleKeyDown(e) {
    if (e.key === "Delete" || e.key === "Backspace") {
      onDeleteItems(selectedItems);
    }
  }

  function handleMoreClick(e, itemId) {
    console.log("More clicked for item:", itemId);
    if (onMoreClick) onMoreClick(e, itemId);
  }

  return (
    <BoxFlexVStretch>
      <SectionSearch searchText={searchText} onChange={onSearchChange} />
      <BoxFlexVStretch sx={{width: 1, p: 1, overflow: "auto"}}>
        <RichTreeViewPro
          key={updatedAt}
          itemsReordering
          experimentalFeatures={{
            indentationAtItemLevel: true,
            itemsReordering: true,
          }}
          items={items}
          expandedItems={expandedItems}
          onExpandedItemsChange={handleExpandedItemsChange}
          selectedItems={selectedItems}
          onSelectedItemsChange={handleSelectedItemsChange}
          onItemPositionChange={handleItemPositionChange}
          onKeyDown={handleKeyDown}
          slots={{item: TreeItemGeneric}}
          slotProps={{
            item: {
              onMoreClick: handleMoreClick,
            },
          }}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
