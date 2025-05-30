import {useSelector, useDispatch} from "react-redux";

import {setSelectedItems, setExpandedItems} from "../zonesSlice";

import useZonesTree from "../hooks/useZonesTree";
import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";

import {Box} from "@mui/material";

import TreeZones from "./TreeZones";

import {
  countNodes,
  removeNodeById,
} from "Features/tree/utils/nodesManagementUtils";
import manageTree from "Features/tree/utils/manageTree";

export default function SectionTreeZonesInListPanel() {
  const dispatch = useDispatch();

  // data

  const {value: zonesTree, loading} = useZonesTree();

  const selectedItems = useSelector((state) => state.zones.selectedItems);
  const expandedItems = useSelector((state) => state.zones.expandedItems);

  const updatedAt = useSelector((s) => s.zones.zonesUpdatedAt);

  // data - func

  const createOrUpdate = useCreateOrUpdateZonesTree();

  // helpers

  let items = Array.isArray(zonesTree) ? zonesTree : [];

  // handlers

  function handleSelectedItemsChange(selectedItems) {
    dispatch(setSelectedItems(selectedItems));
  }

  function handleExpandedItemsChange(expandedItems) {
    dispatch(setExpandedItems(expandedItems));
  }

  function handleDeleteItems(ids) {
    console.log("[TreeZones] deleteItems", ids);
    if (ids && !Array.isArray(ids)) {
      ids = [ids];
    }
    ids.forEach((id) => {
      removeNodeById(items, id);
    });
    createOrUpdate({zonesTree: items}, {updateSyncFile: true});
  }

  function handleItemPositionChange({itemId, oldPosition, newPosition}) {
    const targetId = itemId;
    const newParentId = newPosition.parentId;
    const position = newPosition.index;
    console.log("[TreeZones] handleItemPositionChange", targetId, newPosition);

    items = manageTree(items, {
      action: "move_node",
      targetId,
      newParentId,
      position,
    });
    createOrUpdate({zonesTree: items}, {updateSyncFile: true});
  }

  return loading ? (
    <Box />
  ) : (
    <TreeZones
      updatedAt={updatedAt}
      items={items}
      expandedItems={expandedItems}
      onExpandedItemsChange={handleExpandedItemsChange}
      selectedItems={selectedItems}
      onSelectedItemsChange={handleSelectedItemsChange}
      onItemPositionChange={handleItemPositionChange}
      onDeleteItems={handleDeleteItems}
    />
  );
}
