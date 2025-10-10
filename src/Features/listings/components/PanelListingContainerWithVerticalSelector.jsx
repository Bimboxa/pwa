import { useDispatch, useSelector } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import { Box } from "@mui/material";

import PanelListingContainer from "Features/listings/components/PanelListingContainer";
import VerticalSelectorListing from "Features/listings/components/VerticalSelectorListing";
import VerticalBarInLeftPanel from "Features/leftPanel/components/VerticalBarInLeftPanel";

export default function PanelListingContainerWithVerticalSelector() {
  const dispatch = useDispatch();

  // handler

  function handleSeeAllClick() {
    dispatch(setOpenedPanel("LISTING_SELECTOR"));
  }

  // render

  return (
    <Box sx={{ display: "flex", width: 1, height: 1 }}>
      <VerticalBarInLeftPanel>
        <VerticalSelectorListing onSeeAllClick={handleSeeAllClick} />
      </VerticalBarInLeftPanel>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          height: 1,
          position: "relative",
        }}
      >
        <PanelListingContainer />
      </Box>
    </Box>
  );
}
