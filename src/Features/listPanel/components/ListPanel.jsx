import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogAddListing } from "Features/listings/listingsSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Box, Button, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import SectionShapesInListPanel from "Features/shapes/components/SectionShapesInListPanel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListPanelHeader from "./ListPanelHeader";
import ListPanelBottom from "./ListPanelBottom";
import PanelListItem from "./PanelListItem";
import ListPanelListItems from "./ListPanelListItems";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function ListPanel() {
  const dispatch = useDispatch();
  // strings

  const addS = "Nouvelle liste";

  // data

  const width = useSelector((s) => s.listPanel.width);
  const open = useSelector((s) => s.listPanel.open);
  const isMobile = useIsMobile();
  const { value: listings } = useListingsByScope();

  console.log("debug_1707 listings", listings);

  // helpers - hasListings

  const hasListings = listings && listings.length > 0;

  // helper

  let computedWidth = open ? width : 0;
  if (isMobile) computedWidth = 1;

  // handlers

  function handleAdd() {
    dispatch(setOpenDialogAddListing(true));
  }

  // empty return

  if (!hasListings) {
    return (
      <Box
        sx={{
          width: computedWidth,
          minWidth: computedWidth, // component lives in a flex container
          height: 1,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.main",
          position: "relative",
        }}
      >
        <BoxCenter>
          <Button startIcon={<Add />} onClick={handleAdd}>
            <Typography variant="body2" color="text.secondary">
              {addS}
            </Typography>
          </Button>
        </BoxCenter>
      </Box>
    );
  }

  // main return
  return (
    <Box
      sx={{
        width: computedWidth,
        minWidth: computedWidth, // component lives in a flex container
        height: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.main",
        position: "relative",
      }}
    >
      <ListPanelHeader open={open} />
      <BoxFlexVStretch>
        {/* <SectionShapesInListPanel /> */}
        <ListPanelListItems />
      </BoxFlexVStretch>
      {open && <ListPanelBottom />}
    </Box>
  );
}
