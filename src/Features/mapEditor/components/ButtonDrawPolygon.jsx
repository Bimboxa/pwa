import {Pentagon as Polygon} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";

export default function ButtonDrawPolygon() {
  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode("POLYGON", {updateRedux: true});
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Polygon />
    </IconButton>
  );
}
