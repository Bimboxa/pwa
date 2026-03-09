import { useEffect, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedBaseMapListingId } from "../baseMapEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, List, ListItemButton, ListItemText } from "@mui/material";
import { CreateNewFolderOutlined } from "@mui/icons-material";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
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
  const { value: allBaseMaps } = useBaseMaps();
  const createListing = useCreateBaseMapListing();

  // helpers

  const hasEmptyListing = useMemo(() => {
    if (!listings?.length || !allBaseMaps) return false;
    const listingIdsWithBaseMaps = new Set(
      allBaseMaps.map((bm) => bm.listingId)
    );
    return listings.some((l) => !listingIdsWithBaseMaps.has(l.id));
  }, [listings, allBaseMaps]);

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

      {!hasEmptyListing && (
        <ListItemButton
          onClick={handleCreateListing}
          sx={{ pl: 1, color: "text.disabled" }}
        >
          <CreateNewFolderOutlined sx={{ fontSize: 20, mr: 1 }} color="disabled" />
          <ListItemText
            primary="Nouveau groupe"
            slotProps={{
              primary: { variant: "body2", color: "text.disabled" },
            }}
          />
        </ListItemButton>
      )}
    </Box>
  );
}
