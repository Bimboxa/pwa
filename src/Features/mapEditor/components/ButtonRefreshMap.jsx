import {IconButton, Tooltip} from "@mui/material";
import {Refresh} from "@mui/icons-material";

import editor from "App/editor";

export default function ButtonRefreshMap() {
  // strings

  const title = "Rafraîchir le fond de plan";

  // handler

  function handleClick() {
    editor.mapEditor.refresh();
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <Refresh />
      </IconButton>
    </Tooltip>
  );
}
