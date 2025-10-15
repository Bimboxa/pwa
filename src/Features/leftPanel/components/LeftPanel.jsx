import { useDispatch, useSelector } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import { Box } from "@mui/material";

import PanelListingContainer from "Features/listings/components/PanelListingContainer";
import ButtonCloseLeftPanel from "./ButtonCloseLeftPanel";
import VerticalSelectorListing from "Features/listings/components/VerticalSelectorListing";
import VerticalBarInLeftPanel from "./VerticalBarInLeftPanel";

export default function LeftPanel() {
  const dispatch = useDispatch();

  // data

  const openLeftPanel = useSelector((s) => s.leftPanel.openLeftPanel);
  const panelWidth = useSelector((s) => s.leftPanel.width);
  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  // helpers

  let width = openLeftPanel ? panelWidth : 0;
  if (isFullScreen) width = 0;

  // handler

  function handleSeeAllClick() {
    console.log("handleSeeAllClick");
    dispatch(setOpenedPanel("LISTING_SELECTOR"));
  }

  // render

  return (
    <Box sx={{ display: "flex" }}>
      {!isFullScreen && (
        <VerticalBarInLeftPanel>
          <VerticalSelectorListing onSeeAllClick={handleSeeAllClick} />
        </VerticalBarInLeftPanel>
      )}
      <Box
        sx={{
          width,
          minWidth: width,
          //borderRight: "1px solid #ccc",
          display: openLeftPanel ? "flex" : "none",
          flexDirection: "column",
          minHeight: 0,
          height: 1,
          position: "relative",
        }}
      >
        <PanelListingContainer />
        {/* <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            transform: "translateX(100%)",
            zIndex: 1000,
          }}
        >
          <ButtonCloseLeftPanel />
        </Box> */}
      </Box>
    </Box>
  );
}
