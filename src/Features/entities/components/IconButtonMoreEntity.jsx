import { useState } from "react";

import { IconButton } from "@mui/material";
import { MoreHoriz as More } from "@mui/icons-material";
import MenuActionsEntity from "./MenuActionsEntity";

export default function IconButtonMoreEntity({ entity, sx }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={sx}>
        <More />
      </IconButton>
      <MenuActionsEntity
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        entity={entity}
      />
    </>
  );
}
