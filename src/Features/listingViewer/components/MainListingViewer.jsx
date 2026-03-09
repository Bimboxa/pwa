import { useState } from "react";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelListingViewerTabs from "./PanelListingViewerTabs";
import PanelListingAnnotationTemplates from "./PanelListingAnnotationTemplates";
import PanelListingEntities from "./PanelListingEntities";
import SelectorListingForViewer from "./SelectorListingForViewer";
import HeaderListingViewerPanel from "./HeaderListingViewerPanel";
import MainListingMapsEditor from "./MainListingMapsEditor";

import useListingById from "Features/listings/hooks/useListingById";

export default function MainListingViewer() {
  // data

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const selectedTabId = useSelector((s) => s.listingViewer.selectedTabId);
  const listing = useListingById(selectedListingId);

  // state

  const [showSelector, setShowSelector] = useState(!selectedListingId);

  // helpers

  const panelWidth = 300;

  // handlers

  function handleSelectListing() {
    setShowSelector(true);
  }

  function handleListingSelected() {
    setShowSelector(false);
  }

  // render

  return (
    <Box sx={{ width: 1, height: 1, display: "flex" }}>
      {/* Left panel */}
      <Box
        sx={{
          width: panelWidth,
          minWidth: panelWidth,
          bgcolor: "background.default",
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        <BoxFlexVStretch sx={{ height: 1 }}>
          <HeaderListingViewerPanel
            listing={listing}
            onSelectListing={handleSelectListing}
          />
          {!showSelector && listing && <PanelListingViewerTabs />}
          <BoxFlexVStretch sx={{ overflow: "auto" }}>
            {showSelector ? (
              <SelectorListingForViewer
                onListingSelected={handleListingSelected}
                selectedListingId={selectedListingId}
              />
            ) : listing ? (
              selectedTabId === "ENTITIES" ? (
                <PanelListingEntities listing={listing} />
              ) : (
                <PanelListingAnnotationTemplates listing={listing} />
              )
            ) : (
              <Box sx={{ p: 2, color: "text.secondary" }}>
                Select a listing to view its entities.
              </Box>
            )}
          </BoxFlexVStretch>
        </BoxFlexVStretch>
      </Box>

      {/* Right: baseMaps grid editor */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
        <MainListingMapsEditor listing={listing} />
      </Box>
    </Box>
  );
}
