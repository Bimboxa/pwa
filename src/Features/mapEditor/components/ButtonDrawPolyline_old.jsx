import {Polyline} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";

export default function ButtonDrawPolyline() {
  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode("POLYLINE", {updateRedux: true});
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Polyline />
    </IconButton>
  );
}
