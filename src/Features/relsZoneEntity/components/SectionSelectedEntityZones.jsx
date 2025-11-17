import { useSelector, useDispatch } from "react-redux";

import { setSelectedEntity } from "../relsZoneEntitySlice";

import useAddZoneToEntity from "../hooks/useAddZoneToEntity";
import useRemoveZoneFromEntity from "../hooks/useRemoveZoneFromEntity";

import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import useRelsZoneEntity from "../hooks/useRelsZoneEntity";

import { Box, Paper } from "@mui/material";

import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";

import useZonesTree from "Features/zones/hooks/useZonesTree";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SectionSelectedEntityZones() {
  const dispatch = useDispatch();

  // data

  const { value: zonesTree, zoningId } = useZonesTree();

  const { value: selectedEntity } = useSelectedEntity();

  const relsZoneEntity = useRelsZoneEntity({ entityId: selectedEntity?.id });

  const zoneIds = [...new Set(relsZoneEntity?.map((rel) => rel.zoneId))];

  // data - func

  const addZoneToEntity = useAddZoneToEntity();
  const removeZoneFromEntity = useRemoveZoneFromEntity();

  // handlers

  function handleItemChange(item) {
    console.log("[BlockListingSelectedEntity] handleItemChange", item);
    dispatch(setSelectedEntity(item));
  }

  async function handleToggleItem(toggleItem) {
    const { itemId, wasChecked } = toggleItem;
    if (wasChecked) {
      await addZoneToEntity({
        zoningId,
        zoneId: itemId,
        listingId: selectedEntity?.listingId,
        entityId: selectedEntity?.id,
      });
    } else {
      await removeZoneFromEntity({
        zoneId: itemId,
        entityId: selectedEntity?.id,
      });
    }
  }

  return (
    <BoxFlexVStretch sx={{ p: 2 }}>
      <SelectorVariantTree
        items={zonesTree}
        multiSelect
        onToggleItem={handleToggleItem}
        selection={zoneIds ?? []}
        //onChange={handleChange}
      />
    </BoxFlexVStretch>
  );
}
