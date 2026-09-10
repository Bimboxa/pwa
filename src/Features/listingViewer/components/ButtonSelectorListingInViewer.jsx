import { useState } from "react";

import { Box, Paper, Popover } from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SelectorListingForViewer from "./SelectorListingForViewer";

// Floating listing selector of the SCOPE module, shown at the top left of the
// recap editor when the left panel is folded (leftPanelDocked false). Folded,
// the panel only slides back on hover of the module band or the breadcrumbs —
// so nothing said which listing drove the editor, and there was no explicit
// way to change it. The button names the selected listing and opens the very
// content of the docked panel (SelectorListingForViewer), so both entry points
// stay the same list.
//
// A Popover, not a Popper + ClickAwayListener: the panel mounts the family
// creation dialogs as its own children, and a ClickAwayListener would close
// the popper — unmounting the dialog with it — on the first click inside it.
export default function ButtonSelectorListingInViewer({ listing }) {
  // strings

  // No selection means the editor shows every base map and the totals of the
  // whole scope, not an empty state.
  const allListingsS = "Toutes les listes";

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const open = Boolean(anchorEl);
  const label = listing?.name ?? allListingsS;

  // handlers

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // render

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          maxWidth: 260,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "panel.border",
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        <ButtonGeneric
          label={label}
          onClick={handleClick}
          endIcon={<ArrowDropDown />}
          // ButtonGeneric's Typography is `noWrap`, but a flex item defaults to
          // min-width:auto — without this it would push past the Paper instead
          // of ellipsizing, and shove the arrow out of view.
          sx={{
            maxWidth: 1,
            minWidth: 0,
            "& .MuiTypography-root": { minWidth: 0 },
          }}
        />
      </Paper>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        // The creation dialogs open on top of the popover; letting them own the
        // focus keeps the two focus traps from fighting.
        disableEnforceFocus
        slotProps={{
          paper: {
            sx: {
              // Same width as the docked panel (MainListingViewer panelWidth):
              // the menu reads as that panel, floated.
              width: 300,
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <SelectorListingForViewer
            selectedListingId={listing?.id ?? null}
            onListingSelected={handleClose}
          />
        </Box>
      </Popover>
    </>
  );
}
