import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListListings from "Features/listings/components/ListListings";

// Entity model types excluded from the listing viewer selector
const EXCLUDED_TYPES = ["BASE_MAP", "PORTFOLIO_PAGE", "BLUEPRINT", "ANNOTATION_TEMPLATE"];

export default function SelectorListingForViewer({
  onListingSelected,
  selectedListingId,
}) {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: allListings, loading } = useListingsByScope({
    filterByProjectId: projectId,
  });

  // helpers

  const listings = allListings?.filter(
    (l) => !EXCLUDED_TYPES.includes(l?.entityModel?.type)
  );
  const title = "Listes";
  const selection = selectedListingId ? [selectedListingId] : [];

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
    if (onListingSelected) onListingSelected();
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <Typography sx={{ fontWeight: "bold" }}>{title}</Typography>
      </Box>
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ bgcolor: "white" }}>
          <ListListings
            loading={loading}
            listings={listings}
            onClick={handleListingClick}
            selection={selection}
          />
        </Box>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
