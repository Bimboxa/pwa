import {RichTreeViewPro} from "@mui/x-tree-view-pro";

import {cleanNodesIds} from "Features/tree/utils/nodesManagementUtils";

export default function TreeZones({
  items,
  expandedItems,
  onExpandedItemsChange,
  selectedItems,
  onSelectedItemsChange,
  onItemPositionChange,
  onDeleteItems,
  updatedAt, // to force re-render of the tree
}) {
  // helpers

  items = cleanNodesIds(items);

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
  return (
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
    />
  );
}
