import {Architecture as Scale} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";

export default function ButtonEditScale() {
  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode("SEGMENT", {
      isScale: true,
      updateRedux: true,
    });
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Scale />
    </IconButton>
  );
}
