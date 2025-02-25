import {useDispatch} from "react-redux";

import {setOpen} from "../listPanelSlice";

import {IconButton, Tooltip} from "@mui/material";
import {MenuOpen as Close} from "@mui/icons-material";

export default function ButtonCloseListPanel() {
  const dispatch = useDispatch();

  // string

  const title = "Fermer le panneau";

  // handlers

  function handleClick() {
    dispatch(setOpen(false));
  }
  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick}>
        <Close />
      </IconButton>
    </Tooltip>
  );
}
