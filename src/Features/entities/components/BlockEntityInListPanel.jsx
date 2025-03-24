import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

import useEntity from "../hooks/useEntity";

import {Box} from "@mui/material";

import BlockEntityInListPanelVariantBottom from "./BlockEntityInListPanelVariantBottom";
import BlockEntityInListPanelVariantHeader from "./BlockEntityInListPanelVariantHeader";

export default function BlockEntityInListPanel() {
  const dispatch = useDispatch();

  // data

  const entity = useEntity();
  const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);

  // helpers - label

  const label = entity?.label ?? entity?.id;

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
        />
      ) : (
        <BlockEntityInListPanelVariantBottom
          label={label}
          onClick={handleClick}
        />
      )}
    </Box>
  );
}
