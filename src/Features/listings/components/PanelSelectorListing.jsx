import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setOpenSelectorPanel,
  setOpenDialogAddListing,
} from "../listingsSlice";

import useListingsByScope from "../hooks/useListingsByScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import DialogFs from "Features/layout/components/DialogFs";

import ListListings from "./ListListings";
import { Box, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonDialogCreateListing from "./ButtonDialogCreateListing";

export default function PanelSelectorListing({
  onListingSelected,
  selectedListingId,
}) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: listings, loading } = useListingsByScope({
    filterByProjectId: projectId,
  });

  // helpers - title

  const title = appConfig?.strings?.listing?.namePlural || "Listes";

  // helpers

  const selection = selectedListingId ? [selectedListingId] : [];

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
    if (onListingSelected) onListingSelected();
  }

  function handleAddClick() {
    dispatch(setOpenSelectorPanel(false));
    dispatch(setOpenDialogAddListing(true));
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1, display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: "bold" }}>{title}</Typography>
        <ButtonDialogCreateListing />
      </Box>
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ bgcolor: "white" }}>
          <ListListings
            loading={loading}
            listings={listings}
            onClick={handleListingClick}
            selection={selection}
            onAddClick={handleAddClick}
          />
        </Box>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
