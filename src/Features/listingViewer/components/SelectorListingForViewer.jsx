import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ListListings from "Features/listings/components/ListListings";
import SectionListingsGroup from "./SectionListingsGroup";
import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";

// Listing selector of the "Objets" module: every listing of the scope
// whatever its nature (base maps, annotations, business objects, exports...),
// grouped by entityModel type. Header + "+" mirror the Fond de plan module
// panel (PanelBaseMaps): the creation dialog carries the type and the name,
// so the panel needs a single action.
export default function SelectorListingForViewer({
  onListingSelected,
  selectedListingId,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Listes";
  const createListingS = "Nouvelle liste";
  const emptyS = "Aucune liste dans ce repérage.";

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: listings, loading } = useListingsByScope({
    filterByProjectId: projectId,
  });

  // state

  const [openCreateListing, setOpenCreateListing] = useState(false);

  // helpers

  const groups = getListingGroupsByEntityModelType({
    listings,
    entityModelTypes: appConfig?.features?.entityModelTypes,
  });
  const isEmpty = !loading && groups.length === 0;
  const selection = selectedListingId ? [selectedListingId] : [];

  // handlers

  function selectListing(listing) {
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleListingClick(listing) {
    selectListing(listing);
  }

  function handleSeeObjects(listing) {
    selectListing(listing);
    if (onListingSelected) onListingSelected();
  }

  function handleListingCreated(listing) {
    selectListing(listing);
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
        }}
      >
        <LeftDrawerPanelHeader title={titleS} />
        <Tooltip title={createListingS}>
          <IconButton
            size="small"
            color="secondary"
            onClick={() => setOpenCreateListing(true)}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <ListListings loading />
      ) : isEmpty ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {emptyS}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateListing(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {createListingS}
          </Button>
        </Box>
      ) : (
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          {groups.map((group) => (
            <SectionListingsGroup
              key={group.type}
              group={group}
              selection={selection}
              onListingClick={handleListingClick}
              onSeeObjects={handleSeeObjects}
            />
          ))}
        </BoxFlexVStretch>
      )}

      {openCreateListing && (
        <DialogCreateBusinessObjectListing
          open
          onClose={() => setOpenCreateListing(false)}
          onCreated={handleListingCreated}
        />
      )}
    </BoxFlexVStretch>
  );
}
