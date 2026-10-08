import { useState } from "react";

import { IconButton } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import MenuMoreActionsPortfolio from "./MenuMoreActionsPortfolio";

export default function IconButtonMoreActionsPortfolio({
  portfolio,
  onRename,
  ...iconButtonProps
}) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon fontSize="inherit" />
      </IconButton>

      <MenuMoreActionsPortfolio
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        portfolio={portfolio}
        onRename={onRename}
      />
    </>
  );
}
