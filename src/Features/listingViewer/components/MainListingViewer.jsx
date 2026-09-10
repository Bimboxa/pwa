import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";
import SelectorListingForViewer from "./SelectorListingForViewer";
import ButtonSelectorListingInViewer from "./ButtonSelectorListingInViewer";
import MainListingMapsEditor from "./MainListingMapsEditor";

import useListingById from "Features/listings/hooks/useListingById";

// Editor of the SCOPE module: every listing of the scope on the left, the
// base maps and their quantities on the right. The panel always shows the
// list — picking a listing narrows the editor, it does not open a subview
// (the listing's own properties land in the right panel).
export default function MainListingViewer() {
  // data

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const listing = useListingById(selectedListingId);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // helpers

  const panelWidth = 300;

  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left panel */}
      <LeftDrawerPanel width={panelWidth} viewerKey="SCOPE">
        <BoxFlexVStretch
          sx={{
            height: 1,
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          <SelectorListingForViewer selectedListingId={selectedListingId} />
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Right: baseMaps recap editor */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        {/* Folded panel: the floating selector takes over naming the current
            listing and changing it. zIndex 10 is the app's floating-overlay
            level — below the drawer (20), which must keep sliding over it. */}
        {!leftPanelDocked && (
          <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
            <ButtonSelectorListingInViewer listing={listing} />
          </Box>
        )}
        <MainListingMapsEditor listing={listing} />
      </Box>
    </Box>
  );
}
