import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

import useEntity from "../hooks/useEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {Box} from "@mui/material";

import BlockEntityInListPanelVariantBottom from "./BlockEntityInListPanelVariantBottom";
import BlockEntityInListPanelVariantHeader from "./BlockEntityInListPanelVariantHeader";
import useEntityModel from "../hooks/useEntityModel";

import theme from "Styles/theme";

export default function BlockEntityInListPanel() {
  const dispatch = useDispatch();

  // data

  const entity = useEntity();
  const entityModel = useEntityModel();
  const {value: listing} = useSelectedListing();
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  // helpers

  const label = entity?.label ?? entity?.id;
  const id = entity?.id;
  const bgcolor = listing?.color ?? theme.palette.primary.main;

  // handlers

  function handleClick() {
    console.log("[BlockEntityInListPanel] handleClick");
    dispatch(setOpenPanelListItem(!openPanelListItem));
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
          bgcolor={bgcolor}
          id={id}
        />
      )}
    </Box>
  );
}
