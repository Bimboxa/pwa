import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

import useEntity from "../hooks/useEntity";

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
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  console.log("entityModel", entityModel);

  // helpers

  const label = entity?.label ?? entity?.id;
  const bgcolor = entityModel?.color ?? theme.palette.primary.main;

  // handlers

  function handleClick() {
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
        />
      )}
    </Box>
  );
}
