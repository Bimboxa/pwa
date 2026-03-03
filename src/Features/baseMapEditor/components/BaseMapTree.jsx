import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedBaseMapListingId } from "../baseMapEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, List, ListItemButton, Typography } from "@mui/material";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateBaseMapListing from "../hooks/useCreateBaseMapListing";

import BaseMapTreeItem from "./BaseMapTreeItem";

export default function BaseMapTree() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const displayedListingId = useSelector(
    (s) => s.baseMapEditor.displayedBaseMapListingId
  );
  const listings = useProjectBaseMapListings();
  const createListing = useCreateBaseMapListing();

  // effects - auto-select first listing

  useEffect(() => {
    if (displayedListingId) return;
    if (!listings?.length) return;
    const first = listings[0];
    dispatch(setDisplayedBaseMapListingId(first.id));
  }, [displayedListingId, listings, dispatch]);

  // handlers

  async function handleCreateListing() {
    const listing = await createListing({
      projectId,
      title: `Fonds de plan ${(listings?.length || 0) + 1}`,
    });
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(null));
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <List dense disablePadding>
        {listings?.map((listing) => (
          <BaseMapTreeItem key={listing.id} listing={listing} />
        ))}
      </List>

      <ListItemButton onClick={handleCreateListing} sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          + Nouveau groupe
        </Typography>
      </ListItemButton>
    </Box>
  );
}
