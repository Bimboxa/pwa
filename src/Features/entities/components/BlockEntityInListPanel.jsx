import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";
import {
  setSelectedEntityId,
  setIsEditingEntity,
  setNewEntity,
} from "../entitiesSlice";
import {setTempMarker} from "Features/markers/markersSlice";

import useEntity from "../hooks/useEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {Box} from "@mui/material";

import BlockEntityInListPanelVariantBottom from "./BlockEntityInListPanelVariantBottom";
import BlockEntityInListPanelVariantHeader from "./BlockEntityInListPanelVariantHeader";

import theme from "Styles/theme";

export default function BlockEntityInListPanel() {
  const dispatch = useDispatch();

  // data

  const entity = useEntity();
  const {value: listing} = useSelectedListing({withEntityModel: true});
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);
  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  // helper - label

  const newS = listing?.entityModel?.strings?.labelNew;

  // helpers

  const label = entity?.id ? entity?.[listing?.entityModel?.labelKey] : newS;
  const id = entity?.id;
  const bgcolor = listing?.color ?? theme.palette.primary.main;

  // handlers

  function handleClick() {
    console.log("[BlockEntityInListPanel] handleClick");
    dispatch(setOpenPanelListItem(!openPanelListItem));
    if (isEditingEntity) {
      dispatch(setIsEditingEntity(false));
    }
    if (!entity.id) dispatch(setNewEntity({}));
    //
    dispatch(setTempMarker(null));
  }

  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      {openPanelListItem ? (
        <BlockEntityInListPanelVariantHeader
          label={label}
          onClose={handleClick}
          bgcolor={bgcolor}
        />
      ) : (
        <BlockEntityInListPanelVariantBottom
          label={label}
          onClick={handleClick}
          onClose={() => dispatch(setSelectedEntityId(null))}
          bgcolor={bgcolor}
          id={id}
        />
      )}
    </Box>
  );
}
