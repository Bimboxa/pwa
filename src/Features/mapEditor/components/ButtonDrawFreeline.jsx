import {Draw as Freeline} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";

export default function ButtonDrawFreeline() {
  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode("FREELINE", {updateRedux: true});
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Freeline />
    </IconButton>
  );
}
