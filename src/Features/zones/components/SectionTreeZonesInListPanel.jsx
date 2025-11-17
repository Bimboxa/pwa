import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  setSelectedItems,
  setExpandedItems,
  setSelectedZoneId,
} from "../zonesSlice";

import useZonesTree from "../hooks/useZonesTree";
import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";
import useSelectedZone from "../hooks/useSelectedZone";

import { Box } from "@mui/material";

import TreeZones from "./TreeZones";
import MenuGeneric from "Features/layout/components/MenuGeneric";

import { removeNodeById } from "Features/tree/utils/nodesManagementUtils";
import manageTree from "Features/tree/utils/manageTree";

import MenuActionsZone from "./MenuActionsZone";
import SectionCreateFirstZone from "./SectionCreateFirstZone";
import IconButtonMoreZones from "./IconButtonMoreZones";

export default function SectionTreeZonesInListPanel() {
  const dispatch = useDispatch();

  // data

  const { value: zonesTree, loading } = useZonesTree();

  const selectedItems = useSelector((state) => state.zones.selectedItems);
  const expandedItems = useSelector((state) => state.zones.expandedItems);

  const updatedAt = useSelector((s) => s.zones.zonesUpdatedAt);

  const selectedZone = useSelectedZone();

  // data - func

  const createOrUpdate = useCreateOrUpdateZonesTree();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  let items = Array.isArray(zonesTree) ? zonesTree : [];

  const noZones = !items.length > 0;

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
    createOrUpdate({ zonesTree: items }, { updateSyncFile: true });
  }

  function handleItemPositionChange({ itemId, oldPosition, newPosition }) {
    const targetId = itemId;
    const newParentId = newPosition.parentId;
    const position = newPosition.index;
    console.log("[TreeZones] handleItemPositionChange", targetId, newPosition);

    const result = manageTree(items, {
      action: "move_node",
      targetId,
      newParentId,
      position,
    });
    items = result.tree;
    createOrUpdate({ zonesTree: items }, { updateSyncFile: true });
  }

  function handleMoreClick(e, zoneId) {
    const currentTarget = e.currentTarget;
    console.log("[TreeZones] handleMoreClick", zoneId, currentTarget);
    setAnchorEl(e.currentTarget);
    dispatch(setSelectedZoneId(zoneId));
  }

  return loading ? (
    <Box />
  ) : (
    <>
      <MenuActionsZone
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        zone={selectedZone}
        zonesTree={zonesTree}
      />
      <Box sx={{ width: 1, p: 1 }}>
        <IconButtonMoreZones />
      </Box>
      {noZones ? (
        <SectionCreateFirstZone />
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
          onMoreClick={handleMoreClick}
        />
      )}
    </>
  );
}
