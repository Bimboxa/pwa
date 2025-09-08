import { useState } from "react";

import { IconButton } from "@mui/material";
import { MoreHoriz as More } from "@mui/icons-material";
import MenuActionsListing from "./MenuActionsListing";

export default function IconButtonMoreListing({ listing }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <More />
      </IconButton>
      <MenuActionsListing
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        listing={listing}
      />
    </>
  );
}
