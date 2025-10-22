import { IconButton, Tooltip } from "@mui/material";
import { ZoomOutMap as CenterIcon } from "@mui/icons-material";

import { useDispatch } from "react-redux";

import { triggerCenterBaseMap } from "../mapEditorSlice";

export default function ButtonCenterBaseMap() {
  const dispatch = useDispatch();

  // strings

  const title = "Recentrer le fond de plan";

  // handler

  function handleClick() {
    dispatch(triggerCenterBaseMap());
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <CenterIcon />
      </IconButton>
    </Tooltip>
  );
}
