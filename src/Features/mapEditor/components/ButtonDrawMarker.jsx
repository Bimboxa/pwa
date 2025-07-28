import { useDispatch } from "react-redux";

import { setShowLayerScreenCursor } from "../mapEditorSlice";
import { Add as Marker } from "@mui/icons-material";
import { IconButton } from "@mui/material";

import editor from "App/editor";

export default function ButtonDrawMarker() {
  const dispatch = useDispatch();
  // handler

  function handleClick() {
    dispatch(setShowLayerScreenCursor(true));
    editor.mapEditor.enableDrawingMode("MARKER", { updateRedux: true });
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Marker />
    </IconButton>
  );
}
