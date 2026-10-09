import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";
import SelectorListingForViewer from "./SelectorListingForViewer";
import ButtonSelectorListingInViewer from "./ButtonSelectorListingInViewer";
import PanelSelectorListingFloating from "./PanelSelectorListingFloating";
import MainListingMapsEditor from "./MainListingMapsEditor";

import useListingById from "Features/listings/hooks/useListingById";

// Editor of the SCOPE module: every listing of the scope on the left, the
// base maps and their quantities on the right. The panel always shows the
// list — picking a listing narrows the editor, it does not open a subview
// (the listing's own properties land in the right panel).
export default function MainListingViewer() {
  // data

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  // "Afficher toutes les listes": the editor and the selectors get no
  // listing (their all-listings mode) while selectedListingId stays what it
  // is for the rest of the app.
  const showAllListings = useSelector(
    (s) => s.listings.scopeModuleShowAllListings
  );
  const selectedListing = useListingById(selectedListingId);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // state

  // Floating selector (folded left panel): recap button, or the unfolded
  // panel in its place. Local like the fold it answers to.
  const [expanded, setExpanded] = useState(false);

  // Docking brings the real panel back: the floated one folds so that the
  // next unfold starts from the recap.
  useEffect(() => {
    if (leftPanelDocked) setExpanded(false);
  }, [leftPanelDocked]);

  // helpers

  const panelWidth = 300;
  const listing = showAllListings ? null : selectedListing;

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
          <SelectorListingForViewer
            selectedListingId={listing?.id ?? null}
            showAllListings={showAllListings}
          />
        </BoxFlexVStretch>
      </LeftDrawerPanel>

      {/* Right: baseMaps recap editor */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        {/* Folded panel: the floating selector takes over naming the current
            listing and changing it — a recap button, swapped in place for the
            unfolded panel. zIndex 10 is the app's floating-overlay level —
            below the drawer (20), which must keep sliding over it. */}
        {!leftPanelDocked && (
          <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
            {expanded ? (
              <PanelSelectorListingFloating
                listing={listing}
                onClose={() => setExpanded(false)}
              />
            ) : (
              <ButtonSelectorListingInViewer
                listing={listing}
                onExpand={() => setExpanded(true)}
              />
            )}
          </Box>
        )}
        <MainListingMapsEditor listing={listing} />
      </Box>
    </Box>
  );
}
