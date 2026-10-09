import { Paper } from "@mui/material";

import SelectorListingForViewer from "./SelectorListingForViewer";

// Unfolded state of the SCOPE module's floating listing selector: the very
// content of the docked panel (SelectorListingForViewer), floated where the
// recap button (ButtonSelectorListingInViewer) stood. MainListingViewer
// swaps the two.
//
// Rendered in place, with no click-away on purpose: the panel mounts the
// family creation dialogs as its own children, and a click-away would fold
// the panel — unmounting the dialog with it — on the first click inside it.
// The panel folds back on a choice (onListingSelected) or on the header's
// close cross (onClose).
//
// `listing` null is the "Afficher toutes les listes" mode of the panel.
export default function PanelSelectorListingFloating({ listing, onClose }) {
  // helpers

  const showAllListings = !listing;

  // render

  return (
    <Paper
      elevation={2}
      sx={{
        // Same width as the docked panel (MainListingViewer panelWidth): the
        // floated panel reads as that panel, floated.
        width: 300,
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "panel.border",
        bgcolor: "background.paper",
      }}
    >
      <SelectorListingForViewer
        selectedListingId={listing?.id ?? null}
        showAllListings={showAllListings}
        onListingSelected={onClose}
        onClose={onClose}
      />
    </Paper>
  );
}
