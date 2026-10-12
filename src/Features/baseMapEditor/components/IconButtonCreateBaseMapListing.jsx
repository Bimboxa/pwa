import { useState } from "react";
import { useDispatch } from "react-redux";

import { setDisplayedBaseMapListingId } from "../baseMapEditorSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import DialogCreateBaseMapListing from "./DialogCreateBaseMapListing";

// ---------------------------------------------------------------------------
// IconButtonCreateBaseMapListing — "+" of the "Fonds de plan" poppers' header
// in the BaseMaps module (PopperMapListings, PopperBaseMapsList): opens the
// folder creation dialog (name asked), then makes the new folder the
// selected / displayed listing — the main base map is left as is (the
// popper lives over the module's editor).
// ---------------------------------------------------------------------------

export default function IconButtonCreateBaseMapListing() {
  const dispatch = useDispatch();

  // strings

  const newListingS = "Nouveau dossier de fond de plan";

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleCreated(listing) {
    dispatch(setSelectedBaseMapsListingId(listing.id));
    dispatch(setDisplayedBaseMapListingId(listing.id));
  }

  // render

  return (
    // The popper header is its drag handle: neither the button nor the
    // dialog (a portal — its React events still bubble here) may reach it.
    <Box
      component="span"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      sx={{ display: "contents" }}
    >
      <Tooltip title={newListingS} arrow placement="top">
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      {open && (
        <DialogCreateBaseMapListing
          open={open}
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Box>
  );
}
